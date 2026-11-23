/*
  ============================================================================
   TRAVA EHR - Revisão R4 - Firmware v2.1 (NÃO VALIDADO EM BANCADA)
   ESP32 WROOM-32 + 2 solenoides fail-secure + 2 fins de curso + LoRa + GPS +
   GSM (SIM800L) + RTC DS3231 + MicroSD
  ============================================================================
   Segue a seção 10 do DESCRITIVO_TECNICO_R4_TRAVA_EHR.md. Leia hardware/TravaEHR_R4/README.md
   antes de gravar: tem a lista do que foi e do que NÃO foi implementado e o checklist de bancada.

   Arquitetura (dois núcleos):
   - loop()  (núcleo 1): SEGURANÇA. Fins de curso, pulso dos solenoides, violação, RTC, GPS,
                          SD, LoRa, Wi-Fi local. Nunca bloqueia em rede.
   - netTask (núcleo 0): único dono do modem GSM. Faz HTTP via GPRS e SMS. Pode demorar
                          segundos sem afetar o acionamento.

   Princípio de segurança: solenoide fail-secure (sem energia = TRAVADO). Qualquer erro,
   dúvida ou falha de rede mantém os solenoides DESLIGADOS.
*/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <SPI.h>
#include <Wire.h>
#include <SD.h>
#include <LoRa.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <esp_idf_version.h>
#include "mbedtls/md.h"

#if __has_include("config.h")
#include "config.h"
#else
#error "Falta config.h. Copie config.example.h para config.h e preencha (config.h nao vai para o git)."
#endif
#ifdef EHR_CONFIG_EXAMPLE
#error "config.h ainda contem EHR_CONFIG_EXAMPLE: preencha os valores reais e remova essa linha."
#endif
#if T_PULSO_MS > 5000 || T_PULSO_MS < 500
#error "T_PULSO_MS deve ficar entre 500 e 5000 ms (maximo absoluto do descritivo: 5 s)."
#endif
#ifndef WIFI_STA_SSID
#define WIFI_STA_SSID ""
#endif
#ifndef WIFI_STA_PASS
#define WIFI_STA_PASS ""
#endif

// ============================ PINOS (descritivo 10.1) ========================
#define PIN_TRIG_SOL1   25
#define PIN_TRIG_SOL2   26
#define PIN_FC_TRAVA1   35   // LOW = lingueta estendida (travada). Só entrada, pull-up EXTERNO 4k7
#define PIN_FC_TRAVA2   36   // LOW = travada. Só entrada, pull-up externo. Ler por varredura (errata)
#define PIN_VBAT_ADC    32
#define PIN_KL15_ADC    39   // Pós-chave / ignição (descritivo 10.1 e 10.5)
#define PIN_LED         2
#define PIN_BUZZER      15
#define PIN_LORA_NSS    5
#define PIN_LORA_RST    27
#define PIN_LORA_DIO0   4
#define PIN_SD_CS       13
#define PIN_GPS_RX      34   // UART1 RX
#define PIN_GPS_TX      33
#define PIN_GSM_RX      16   // UART2 RX
#define PIN_GSM_TX      17
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
// SPI: SCK 18, MISO 19, MOSI 23

// ============================ PARÂMETROS =====================================
static const uint32_t SCAN_MS            = 20;       // varredura dos fins de curso
static const uint8_t  SCAN_CONFIRM       = 3;        // leituras iguais para aceitar mudança
static const uint32_t LOCK_CONFIRM_MS    = 200;      // TRAVADO = ambos baixos por >= 200 ms
static const uint32_t SOL2_DELAY_MS      = 50;       // defasagem entre SOL1 e SOL2
static const uint32_t PULSE_MIN_GAP_MS   = 10000;    // intervalo mínimo entre pulsos
static const uint8_t  PULSES_PER_MIN_MAX = 3;
static const uint32_t OPEN_WINDOW_MS     = 15UL * 60UL * 1000UL;  // vida da sessão ativa no backend
static const uint32_t TOKEN_MAX_TTL_S    = 900;      // token de destravar vale no máx. 15 min
static const uint32_t POLL_MS            = 3000;     // consulta /active
static const uint32_t POLL_MAX_AGE_MS    = 8000;     // resposta mais velha que isso é ignorada
static const uint32_t TELEMETRY_MS       = 30000;
static const uint32_t BEACON_MS          = 60000;
static const uint32_t AUDIT_SYNC_MS      = 60000;
static const uint32_t STATE_POST_GAP_MS  = 2000;
static const uint8_t  AUTH_FAIL_LOCKOUT  = 5;
static const uint32_t AUTH_LOCKOUT_MS    = 5UL * 60UL * 1000UL;
static const char*    AUDIT_FILE         = "/ehr_audit.csv";
static const char*    EVENTS_FILE        = "/ehr_events.log";

// ============================ TIPOS ==========================================
enum JobType : uint8_t { J_POST, J_SMS, J_AUDIT };
struct NetJob {
  JobType type;
  bool critical;        // reenviar até conseguir (violação, fim do abastecimento...)
  uint32_t arg;         // J_AUDIT: novo offset do arquivo após sucesso
  char path[72];
  char body[960];
};
struct NetResult { uint32_t auditOffset; };

struct Debounced {
  bool stable;          // true = travado (nível LOW)
  bool lastRaw;
  uint8_t count;
  uint32_t sinceMs;
};

struct PollResult {
  bool valid;
  bool unlock;
  long session;
  uint32_t atMs;
};

// ============================ ESTADO GLOBAL ==================================
static HardwareSerial gpsSerial(1);
static HardwareSerial gsmSerial(2);
static WebServer server(80);
static Preferences prefs;

static QueueHandle_t netQueue;
static QueueHandle_t netResultQueue;
static portMUX_TYPE pollMux = portMUX_INITIALIZER_UNLOCKED;
static volatile PollResult pollRes = {false, false, 0, 0};
static volatile bool netTaskGsmOk = false;

static Debounced sw1 = {true, true, 0, 0};
static Debounced sw2 = {true, true, 0, 0};

static bool sdOk = false;
static bool loraOk = false;
static bool hmacOk = false;
static uint8_t hmacKey[32];

static bool pulseOn = false;
static bool sol2On = false;
static uint32_t pulseStartMs = 0;
static uint32_t lastPulseEndMs = 0;
static uint32_t pulseHistory[PULSES_PER_MIN_MAX] = {0, 0, 0};
static uint8_t pulseHistIdx = 0;
static bool pulseHistFilled[PULSES_PER_MIN_MAX] = {false, false, false};

static long currentSession = 0;       // sessão em andamento (0 = nenhuma)
static long lastUnlockedSession = 0;  // anti-replay e anti-repulso (persistido)
static uint32_t windowEndMs = 0;      // fim da janela autorizada (0 = fechada)
static bool coverOpened = false;
static bool tamperLatched = false;
static bool prevLockConfirmed = false;
static const char* lastCommand = nullptr;  // "lock" | "unlock" | nullptr

static bool lastPostedLocked = false;
static bool lastPostedUnlocked = false;
static bool statePostPending = true;
static uint32_t lastStatePostMs = 0;

static uint32_t seqCounter = 0;
static uint32_t auditOffset = 0;

static double gpsLat = 0.0, gpsLng = 0.0, gpsSpeedKmh = 0.0;
static bool gpsFix = false;
static uint32_t gpsFixMs = 0;
static char nmea[100];
static uint8_t nmeaLen = 0;
static uint32_t lastRtcSyncMs = 0;

static uint8_t authFails = 0;
static uint32_t authLockUntilMs = 0;

static uint32_t lastTelemetryMs = 0, lastBeaconMs = 0, lastAuditMs = 0, lastScanMs = 0;

// ============================ UTILITÁRIOS ====================================
static void logLine(const char* tag, const char* msg) {
  Serial.printf("[%s] %s\n", tag, msg);
}

static int64_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return (int64_t)era * 146097 + (int64_t)doe - 719468;
}

static uint32_t epochFromCivil(int y, int mo, int d, int h, int mi, int s) {
  return (uint32_t)(daysFromCivil(y, mo, d) * 86400LL + h * 3600 + mi * 60 + s);
}

static void civilFromEpoch(uint32_t epoch, int& y, int& mo, int& d, int& h, int& mi, int& s) {
  int64_t z = (int64_t)(epoch / 86400) + 719468;
  const int64_t era = (z >= 0 ? z : z - 146096) / 146097;
  const unsigned doe = (unsigned)(z - era * 146097);
  const unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  y = (int)yoe + (int)era * 400;
  const unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const unsigned mp = (5 * doy + 2) / 153;
  d = (int)(doy - (153 * mp + 2) / 5 + 1);
  mo = (int)(mp < 10 ? mp + 3 : mp - 9);
  y += mo <= 2;
  uint32_t rem = epoch % 86400;
  h = rem / 3600; mi = (rem % 3600) / 60; s = rem % 60;
}

// ============================ RTC DS3231 =====================================
static uint8_t bcd2dec(uint8_t v) { return (v >> 4) * 10 + (v & 0x0F); }
static uint8_t dec2bcd(uint8_t v) { return ((v / 10) << 4) | (v % 10); }

// Retorna epoch UTC; 0 se o RTC estiver inválido (oscilador parou ou hora absurda).
static uint32_t rtcEpoch() {
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return 0;
  if (Wire.requestFrom(0x68, 7) != 7) return 0;
  uint8_t r[7];
  for (int i = 0; i < 7; i++) r[i] = Wire.read();
  Wire.beginTransmission(0x68);
  Wire.write(0x0F);
  if (Wire.endTransmission() != 0) return 0;
  if (Wire.requestFrom(0x68, 1) != 1) return 0;
  uint8_t status = Wire.read();
  if (status & 0x80) return 0;  // OSF: a hora não é confiável
  int s = bcd2dec(r[0] & 0x7F), mi = bcd2dec(r[1] & 0x7F), h = bcd2dec(r[2] & 0x3F);
  int d = bcd2dec(r[4] & 0x3F), mo = bcd2dec(r[5] & 0x1F), y = 2000 + bcd2dec(r[6]);
  if (y < 2025 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return 0;
  return epochFromCivil(y, mo, d, h, mi, s);
}

static void rtcSet(uint32_t epoch) {
  int y, mo, d, h, mi, s;
  civilFromEpoch(epoch, y, mo, d, h, mi, s);
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  Wire.write(dec2bcd(s)); Wire.write(dec2bcd(mi)); Wire.write(dec2bcd(h));
  Wire.write(1);  // dia da semana (não usado)
  Wire.write(dec2bcd(d)); Wire.write(dec2bcd(mo)); Wire.write(dec2bcd(y - 2000));
  Wire.endTransmission();
  Wire.beginTransmission(0x68);  // limpa OSF
  Wire.write(0x0F);
  Wire.write(0x00);
  Wire.endTransmission();
}

static void timestampUtc(char* out, size_t n, uint32_t* epochOut = nullptr) {
  uint32_t e = rtcEpoch();
  if (epochOut) *epochOut = e;
  if (e == 0) { snprintf(out, n, "1970-01-01 00:00:00"); return; }  // hora desconhecida: marcada
  int y, mo, d, h, mi, s;
  civilFromEpoch(e, y, mo, d, h, mi, s);
  snprintf(out, n, "%04d-%02d-%02d %02d:%02d:%02d", y, mo, d, h, mi, s);
}

// ============================ GPS (NMEA RMC) =================================
static double nmeaToDeg(const char* v, char hemi) {
  double raw = atof(v);
  int deg = (int)(raw / 100);
  double min = raw - deg * 100;
  double r = deg + min / 60.0;
  return (hemi == 'S' || hemi == 'W') ? -r : r;
}

static bool nmeaChecksumOk(const char* s) {
  if (s[0] != '$') return false;
  uint8_t cs = 0;
  const char* p = s + 1;
  while (*p && *p != '*') cs ^= (uint8_t)*p++;
  if (*p != '*') return false;
  return (uint8_t)strtol(p + 1, nullptr, 16) == cs;
}

static void handleRmc(char* line) {
  // $GPRMC,hhmmss.ss,A,lat,N,lon,E,speed_kn,course,ddmmyy,...
  char* f[12] = {0};
  int n = 0;
  char* star = strchr(line, '*');
  if (star) *star = 0;
  char* tok = strtok(line, ",");
  while (tok && n < 12) { f[n++] = tok; tok = strtok(nullptr, ","); }
  if (n < 10 || !f[2] || f[2][0] != 'A') { gpsFix = false; return; }
  gpsLat = nmeaToDeg(f[3], f[4][0]);
  gpsLng = nmeaToDeg(f[5], f[6][0]);
  gpsSpeedKmh = atof(f[7]) * 1.852;
  gpsFix = true;
  gpsFixMs = millis();
  // Hora do GPS -> RTC (a cada 10 min, ou se o RTC estiver inválido)
  if (strlen(f[1]) >= 6 && strlen(f[9]) == 6) {
    int hh = (f[1][0] - '0') * 10 + (f[1][1] - '0'), mm = (f[1][2] - '0') * 10 + (f[1][3] - '0'), ss = (f[1][4] - '0') * 10 + (f[1][5] - '0');
    int dd = (f[9][0] - '0') * 10 + (f[9][1] - '0'), mo = (f[9][2] - '0') * 10 + (f[9][3] - '0'), yy = 2000 + (f[9][4] - '0') * 10 + (f[9][5] - '0');
    if (yy >= 2025 && (rtcEpoch() == 0 || millis() - lastRtcSyncMs > 600000UL || lastRtcSyncMs == 0)) {
      rtcSet(epochFromCivil(yy, mo, dd, hh, mm, ss));
      lastRtcSyncMs = millis();
      if (lastRtcSyncMs == 0) lastRtcSyncMs = 1;
    }
  }
}

static void gpsService() {
  while (gpsSerial.available()) {
    char c = (char)gpsSerial.read();
    if (c == '\n' || c == '\r') {
      if (nmeaLen > 6) {
        nmea[nmeaLen] = 0;
        if ((strncmp(nmea, "$GPRMC", 6) == 0 || strncmp(nmea, "$GNRMC", 6) == 0) && nmeaChecksumOk(nmea)) {
          char copy[100];
          strncpy(copy, nmea, sizeof(copy));
          copy[sizeof(copy) - 1] = 0;
          handleRmc(copy);
        }
      }
      nmeaLen = 0;
    } else if (nmeaLen < sizeof(nmea) - 1) {
      nmea[nmeaLen++] = c;
    } else {
      nmeaLen = 0;
    }
  }
  if (gpsFix && millis() - gpsFixMs > 15000) gpsFix = false;  // fix velho
}

// ============================ HMAC E TOKENS ==================================
static bool hexToBytes(const char* hex, uint8_t* out, size_t n) {
  if (strlen(hex) != n * 2) return false;
  for (size_t i = 0; i < n; i++) {
    char b[3] = {hex[i * 2], hex[i * 2 + 1], 0};
    char* end;
    long v = strtol(b, &end, 16);
    if (*end) return false;
    out[i] = (uint8_t)v;
  }
  return true;
}

static void hmacHex(const char* msg, char out[65]) {
  uint8_t mac[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, hmacKey, sizeof(hmacKey));
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)msg, strlen(msg));
  mbedtls_md_hmac_finish(&ctx, mac);
  mbedtls_md_free(&ctx);
  for (int i = 0; i < 32; i++) sprintf(out + i * 2, "%02x", mac[i]);
  out[64] = 0;
}

static bool ctEquals(const char* a, const char* b, size_t n) {
  uint8_t diff = 0;
  for (size_t i = 0; i < n; i++) diff |= (uint8_t)(tolower(a[i]) ^ tolower(b[i]));
  return diff == 0;
}

// Token: HMAC-SHA256(chave, "UNLOCK:<truck>:<session>:<exp>") em hex. exp = epoch UTC (s).
// Anti-replay: session precisa ser MAIOR que a última sessão destravada (ids do backend são crescentes).
static bool verifyUnlockToken(long session, uint32_t exp, const char* mac, const char** why) {
  if (!hmacOk) { *why = "chave hmac nao configurada"; return false; }
  if (session <= 0) { *why = "sessao invalida"; return false; }
  if (strlen(mac) != 64) { *why = "mac invalido"; return false; }
  uint32_t now = rtcEpoch();
  if (now == 0) { *why = "relogio invalido"; return false; }
  if (exp < now) { *why = "token expirado"; return false; }
  if (exp - now > TOKEN_MAX_TTL_S) { *why = "validade excessiva"; return false; }
  if (session <= lastUnlockedSession) { *why = "sessao ja usada"; return false; }
  char msg[80];
  snprintf(msg, sizeof(msg), "UNLOCK:%d:%ld:%lu", TRUCK_ID, session, (unsigned long)exp);
  char expect[65];
  hmacHex(msg, expect);
  if (!ctEquals(expect, mac, 64)) { *why = "mac incorreto"; return false; }
  return true;
}

// ============================ SD / AUDITORIA =================================
static void eventLog(const char* text) {
  char ts[24];
  timestampUtc(ts, sizeof(ts));
  Serial.printf("[EVT] %s %s\n", ts, text);
  if (!sdOk) return;
  File f = SD.open(EVENTS_FILE, FILE_APPEND);
  if (f) { f.printf("%s;%s\n", ts, text); f.close(); }
}

// Linha do CSV importável pelo backend: data;lat;lng;EVENTO;RESULTADO;seq
static void auditLog(const char* event, const char* result) {
  char ts[24];
  timestampUtc(ts, sizeof(ts));
  seqCounter++;
  prefs.putUInt("seq", seqCounter);
  Serial.printf("[AUDIT] %s;%s;%s #%lu\n", ts, event, result, (unsigned long)seqCounter);
  if (!sdOk) return;
  bool isNew = !SD.exists(AUDIT_FILE);
  File f = SD.open(AUDIT_FILE, FILE_APPEND);
  if (!f) return;
  if (isNew) f.println("data;lat;lng;evento;resultado;seq");
  f.printf("%s;%.6f;%.6f;%s;%s;%lu\n", ts, gpsLat, gpsLng, event, result, (unsigned long)seqCounter);
  f.close();
}

static void queueAuditSync() {
  if (!sdOk) return;
  File f = SD.open(AUDIT_FILE, FILE_READ);
  if (!f) return;
  if (auditOffset >= f.size()) { f.close(); return; }
  f.seek(auditOffset);
  NetJob job;
  memset(&job, 0, sizeof(job));
  job.type = J_AUDIT;
  job.critical = false;
  snprintf(job.path, sizeof(job.path), "/api/fleet/%d/audit-import", TRUCK_ID);
  size_t len = 0;
  uint32_t pos = auditOffset;
  while (f.available()) {
    char line[100];
    size_t n = f.readBytesUntil('\n', line, sizeof(line) - 2);
    uint32_t consumed = n + 1;  // inclui '\n'
    if (n == 0) { pos += consumed; continue; }
    if (len + n + 2 > sizeof(job.body)) break;
    memcpy(job.body + len, line, n);
    len += n;
    job.body[len++] = '\n';
    pos += consumed;
  }
  f.close();
  if (len == 0) return;
  job.body[len] = 0;
  job.arg = pos;
  xQueueSend(netQueue, &job, 0);
}

// ============================ FILA DE REDE ===================================
static void queuePost(const char* path, const char* body, bool critical) {
  NetJob job;
  memset(&job, 0, sizeof(job));
  job.type = J_POST;
  job.critical = critical;
  strncpy(job.path, path, sizeof(job.path) - 1);
  strncpy(job.body, body, sizeof(job.body) - 1);
  if (xQueueSend(netQueue, &job, 0) != pdTRUE) logLine("NET", "fila cheia: job descartado");
}

static void queueSms(const char* text) {
  NetJob job;
  memset(&job, 0, sizeof(job));
  job.type = J_SMS;
  job.critical = true;
  strncpy(job.body, text, sizeof(job.body) - 1);
  xQueueSend(netQueue, &job, 0);
}

static void sendLockState(bool withCommand) {
  bool locked = prevLockConfirmed;
  bool unlocked = !sw1.stable && !sw2.stable;
  char body[160];
  if (withCommand && lastCommand) {
    snprintf(body, sizeof(body),
             "{\"command\":\"%s\",\"sol1\":%s,\"sol2\":%s,\"fc_locked\":%s,\"fc_unlocked\":%s}",
             lastCommand, pulseOn ? "true" : "false", sol2On ? "true" : "false",
             locked ? "true" : "false", unlocked ? "true" : "false");
  } else {
    snprintf(body, sizeof(body),
             "{\"sol1\":%s,\"sol2\":%s,\"fc_locked\":%s,\"fc_unlocked\":%s}",
             pulseOn ? "true" : "false", sol2On ? "true" : "false",
             locked ? "true" : "false", unlocked ? "true" : "false");
  }
  char path[48];
  snprintf(path, sizeof(path), "/api/fleet/%d/lock-state", TRUCK_ID);
  queuePost(path, body, true);
  lastPostedLocked = locked;
  lastPostedUnlocked = unlocked;
  statePostPending = false;
  lastStatePostMs = millis();
}

static void alertTamper(const char* detail) {
  eventLog(detail);
  digitalWrite(PIN_BUZZER, HIGH);
  char path[48], body[200];
  snprintf(path, sizeof(path), "/api/fleet/%d/security-events", TRUCK_ID);
  snprintf(body, sizeof(body),
           "{\"type\":\"tamper\",\"severity\":\"critical\",\"source\":\"device\",\"payload\":{\"detalhe\":\"%s\"}}", detail);
  queuePost(path, body, true);
  char sms[200];
  snprintf(sms, sizeof(sms), "[ALERTA TRAVA EHR] Violacao no caminhao %d. Lat %.5f Lon %.5f", TRUCK_ID, gpsLat, gpsLng);
  queueSms(sms);
  if (loraOk) {
    LoRa.beginPacket();
    LoRa.printf("EHR1|%d|TAMPER|%.5f|%.5f", TRUCK_ID, gpsLat, gpsLng);
    LoRa.endPacket();
  }
}

// ============================ FINS DE CURSO ==================================
static void scanOne(Debounced& d, int pin) {
  bool raw = (digitalRead(pin) == LOW);  // LOW = travado
  if (raw == d.lastRaw) {
    if (d.count < 255) d.count++;
  } else {
    d.lastRaw = raw;
    d.count = 1;
  }
  if (d.count >= SCAN_CONFIRM && d.stable != raw) {
    d.stable = raw;
    d.sinceMs = millis();
  }
}

static bool lockConfirmed() {
  return sw1.stable && sw2.stable && (millis() - max(sw1.sinceMs, sw2.sinceMs) >= LOCK_CONFIRM_MS);
}

// ============================ SOLENOIDES =====================================
static void solenoidsOff() {
  digitalWrite(PIN_TRIG_SOL1, LOW);
  digitalWrite(PIN_TRIG_SOL2, LOW);
  sol2On = false;
}

static float readVbat() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogReadMilliVolts(PIN_VBAT_ADC);
  return (sum / 16.0f) * 16.0f / 1000.0f + 0.35f;
}

// Descritivo 10.5: Vkl15 = mV * 16 / 1000. Ignição LIGADA se > 8 V; DESLIGADA se < 4 V (histerese).
static bool ignitionOn = false;
static bool vbatLowLogged = false;
static uint32_t lastPowerCheckMs = 0;

static float readKl15() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogReadMilliVolts(PIN_KL15_ADC);
  return (sum / 16.0f) * 16.0f / 1000.0f;
}

static void powerSupervisionService() {
  uint32_t now = millis();
  if (now - lastPowerCheckMs < 1000) return;
  lastPowerCheckMs = now;
  float vkl = readKl15();
  if (!ignitionOn && vkl > 8.0f) {
    ignitionOn = true;
    eventLog("ignicao LIGADA (KL15 > 8V)");
  } else if (ignitionOn && vkl < 4.0f) {
    ignitionOn = false;
    eventLog("ignicao DESLIGADA (KL15 < 4V)");
  }
#if !BENCH_MODE
  float vb = readVbat();
  float minV = vb > 18.0f ? 20.0f : 10.5f;
  if (vb < minV && !vbatLowLogged) {
    vbatLowLogged = true;
    char m[64];
    snprintf(m, sizeof(m), "queda de VBAT detectada (%.1f V)", vb);
    eventLog(m);
  } else if (vb >= minV + 0.8f) {
    vbatLowLogged = false;
  }
#endif
}

static bool pulseRateOk(uint32_t now) {
  if (lastPulseEndMs != 0 && now - lastPulseEndMs < PULSE_MIN_GAP_MS) return false;
  uint8_t inLastMinute = 0;
  for (int i = 0; i < PULSES_PER_MIN_MAX; i++)
    if (pulseHistFilled[i] && now - pulseHistory[i] < 60000UL) inLastMinute++;
  return inLastMinute < PULSES_PER_MIN_MAX;
}

static bool startUnlock(long session, const char* origin) {
  uint32_t now = millis();
  if (pulseOn) return false;
  if (!lockConfirmed()) { eventLog("destravar ignorado: trava nao esta confirmada como TRAVADA"); return false; }
  if (!pulseRateOk(now)) { eventLog("destravar recusado: limite termico de pulsos"); return false; }
#if !BENCH_MODE
  float vbat = readVbat();
  float minV = vbat > 18.0f ? 20.0f : 10.5f;
  if (vbat < minV) {
    char m[64];
    snprintf(m, sizeof(m), "destravar recusado: VBAT baixa (%.1f V)", vbat);
    eventLog(m);
    return false;
  }
#endif
  char m[72];
  snprintf(m, sizeof(m), "destravar autorizado (%s) sessao %ld", origin, session);
  eventLog(m);
  currentSession = session;
  lastUnlockedSession = session;
  prefs.putLong("lastSess", session);
  coverOpened = false;
  windowEndMs = now + T_PULSO_MS + OPEN_WINDOW_MS;
  if (windowEndMs == 0) windowEndMs = 1;
  pulseOn = true;
  pulseStartMs = now;
  sol2On = false;
  digitalWrite(PIN_TRIG_SOL1, HIGH);
  pulseHistory[pulseHistIdx] = now;
  pulseHistFilled[pulseHistIdx] = true;
  pulseHistIdx = (pulseHistIdx + 1) % PULSES_PER_MIN_MAX;
  return true;
}

static void pulseService() {
  if (!pulseOn) return;
  uint32_t t = millis() - pulseStartMs;
  if (!sol2On && t >= SOL2_DELAY_MS) {
    digitalWrite(PIN_TRIG_SOL2, HIGH);
    sol2On = true;
  }
  if (t >= T_PULSO_MS || t >= 5000) {  // corte absoluto de 5 s, independente de qualquer outra lógica
    solenoidsOff();
    pulseOn = false;
    lastPulseEndMs = millis();
    // O pulso terminou: as linguetas devem ter recolhido (ambos fins de curso liberados).
    bool released = !sw1.stable && !sw2.stable;
    lastCommand = "unlock";
    if (released) {
      auditLog("DESTRAVAR", "SUCESSO");
      coverOpened = true;
    } else {
      auditLog("DESTRAVAR", "FALHA");
      eventLog("pulso terminou sem confirmacao dos fins de curso");
      lastUnlockedSession = 0;  // permite nova tentativa (sujeita aos limites termicos)
      prefs.putLong("lastSess", 0);
      windowEndMs = 0;
    }
    sendLockState(true);
  }
}

// ============================ LÓGICA DE TRAVA ================================
static void lockLogic() {
  bool confirmed = lockConfirmed();
  bool authorized = pulseOn || (windowEndMs != 0 && (int32_t)(windowEndMs - millis()) > 0);

  if (!pulseOn && !sw1.stable) coverOpened = coverOpened || authorized;
  if (!pulseOn && !sw2.stable) coverOpened = coverOpened || authorized;

  // Violação: saiu de TRAVADO sem destravamento autorizado.
  if (prevLockConfirmed && !confirmed && !authorized && !tamperLatched) {
    if (!(sw1.stable && sw2.stable)) {  // só se algum sensor realmente abriu
      tamperLatched = true;
      alertTamper("sensor de trava abriu sem destravamento autorizado");
    }
  }

  if (confirmed && !prevLockConfirmed) {
    // TRAVADO confirmado (tampa fechou e a lingueta engatou)
    tamperLatched = false;
    digitalWrite(PIN_BUZZER, LOW);
    lastCommand = "lock";
    if (!pulseOn) {
      auditLog("TRAVAR", "SUCESSO");
      if (authorized && coverOpened && currentSession > 0) {
        char path[64];
        snprintf(path, sizeof(path), "/api/fueling/sessions/%ld/finish", currentSession);
        // R4 não tem sensor de nível/vazão: sem level_after o backend marca o registro como "unverified".
        queuePost(path, "{}", true);
        eventLog("abastecimento encerrado (sem medicao de volume)");
        currentSession = 0;
        windowEndMs = 0;
        coverOpened = false;
      }
    }
    statePostPending = true;
  }
  if (!confirmed && prevLockConfirmed) statePostPending = true;
  prevLockConfirmed = confirmed;

  if (windowEndMs != 0 && (int32_t)(windowEndMs - millis()) <= 0) {
    windowEndMs = 0;
    currentSession = 0;
  }

  // Mudança de estado dos fins de curso -> backend (no máximo 1 envio a cada 2 s)
  bool locked = confirmed, unlocked = !sw1.stable && !sw2.stable;
  if ((locked != lastPostedLocked || unlocked != lastPostedUnlocked)) statePostPending = true;
  if (statePostPending && !pulseOn && millis() - lastStatePostMs >= STATE_POST_GAP_MS) sendLockState(false);
}

// ============================ BACKEND (poll) ================================
static void pollService() {
  PollResult p;
  portENTER_CRITICAL(&pollMux);
  p.valid = pollRes.valid; p.unlock = pollRes.unlock; p.session = pollRes.session; p.atMs = pollRes.atMs;
  portEXIT_CRITICAL(&pollMux);
  if (!p.valid || !p.unlock || p.session <= 0) return;            // fail-closed
  if (millis() - p.atMs > POLL_MAX_AGE_MS) return;                // resposta velha
  if (p.session <= lastUnlockedSession) return;                    // já tratada (evita repulso)
  if (startUnlock(p.session, "backend")) {
    portENTER_CRITICAL(&pollMux);
    pollRes.valid = false;  // consumida
    portEXIT_CRITICAL(&pollMux);
  }
}

// ============================ LORA ===========================================
static bool handleUnlockCommand(const char* sessionStr, const char* expStr, const char* mac, const char** why) {
  if (millis() < authLockUntilMs) { *why = "bloqueado por tentativas"; return false; }
  char* end;
  long session = strtol(sessionStr, &end, 10);
  if (*end || session <= 0) { *why = "sessao invalida"; return false; }
  unsigned long exp = strtoul(expStr, &end, 10);
  if (*end) { *why = "exp invalido"; return false; }
  if (!verifyUnlockToken(session, (uint32_t)exp, mac, why)) {
    if (++authFails >= AUTH_FAIL_LOCKOUT) { authLockUntilMs = millis() + AUTH_LOCKOUT_MS; authFails = 0; eventLog("bloqueio temporario: muitas falhas de autenticacao"); }
    return false;
  }
  authFails = 0;
  if (!startUnlock(session, "token")) { *why = "nao foi possivel destravar agora"; return false; }
  return true;
}

static void loraService() {
  if (!loraOk) return;
  int size = LoRa.parsePacket();
  if (size <= 0) return;
  char buf[200];
  int n = 0;
  while (LoRa.available() && n < (int)sizeof(buf) - 1) buf[n++] = (char)LoRa.read();
  buf[n] = 0;
  // Formato: UNLOCK|<session>|<exp>|<mac>
  if (strncmp(buf, "UNLOCK|", 7) != 0) return;
  char* p = buf + 7;
  char* s = strtok(p, "|");
  char* e = strtok(nullptr, "|");
  char* m = strtok(nullptr, "|");
  const char* why = "formato invalido";
  bool ok = (s && e && m) && handleUnlockCommand(s, e, m, &why);
  LoRa.beginPacket();
  if (ok) LoRa.printf("ACK|%d|UNLOCK", TRUCK_ID);
  else LoRa.printf("NAK|%d|%s", TRUCK_ID, why);
  LoRa.endPacket();
  if (!ok) eventLog(why);
}

static void beaconService() {
  if (!loraOk || millis() - lastBeaconMs < BEACON_MS) return;
  lastBeaconMs = millis();
  uint32_t e = rtcEpoch();
  LoRa.beginPacket();
  // Descritivo 10.6: ID do caminhão, estado, VBAT, KL15, lat/lon, hora e contador
  LoRa.printf("EHR1|%d|%s|%.2f|%d|%.5f|%.5f|%lu|%lu", TRUCK_ID, prevLockConfirmed ? "TRAVADO" : "ABERTO",
              readVbat(), ignitionOn ? 1 : 0, gpsLat, gpsLng, (unsigned long)e, (unsigned long)seqCounter);
  LoRa.endPacket();
}

// ============================ WI-FI LOCAL ====================================
static void setupWebServer() {
  if (strlen(WIFI_STA_SSID) > 0) {
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(WIFI_STA_SSID, WIFI_STA_PASS);
  } else {
    WiFi.mode(WIFI_AP);
  }
  WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS);
  server.on("/", HTTP_GET, []() {
    char html[520];
    snprintf(html, sizeof(html),
             "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
             "<title>Trava EHR R4</title></head><body style='font-family:sans-serif;background:#0b1628;color:#fff;padding:24px'>"
             "<h2>Trava EHR R4 (Caminhao #%d)</h2><p>Estado: <b>%s</b> | SW1: %s | SW2: %s</p>"
             "<p>VBAT: %.2f V | KL15 (Ignicao): %s | GPS Fix: %s | SD: %s | LoRa: %s</p></body></html>",
             TRUCK_ID, prevLockConfirmed ? "TRAVADO" : "ABERTO",
             sw1.stable ? "TRAVADO" : "ABERTO", sw2.stable ? "TRAVADO" : "ABERTO",
             readVbat(), ignitionOn ? "LIGADA" : "DESLIGADA",
             gpsFix ? "SIM" : "NAO", sdOk ? "OK" : "FALHA", loraOk ? "OK" : "FALHA");
    server.send(200, "text/html", html);
  });
  server.on("/status", HTTP_GET, []() {
    char json[320];
    snprintf(json, sizeof(json),
             "{\"truck_id\":%d,\"estado\":\"%s\",\"pulso\":%s,\"sw1_travado\":%s,\"sw2_travado\":%s,"
             "\"vbat\":%.2f,\"kl15_v\":%.2f,\"ignicao\":%s,\"gps_fix\":%s,\"sd\":%s,\"lora\":%s}",
             TRUCK_ID, prevLockConfirmed ? "TRAVADO" : "ABERTO", pulseOn ? "true" : "false",
             sw1.stable ? "true" : "false", sw2.stable ? "true" : "false",
             readVbat(), readKl15(), ignitionOn ? "true" : "false",
             gpsFix ? "true" : "false", sdOk ? "true" : "false", loraOk ? "true" : "false");
    server.send(200, "application/json", json);
  });
  // POST /unlock  session=<id>&exp=<epoch>&mac=<hmac hex>  (mesmo token do LoRa)
  server.on("/unlock", HTTP_POST, []() {
    if (!server.hasArg("session") || !server.hasArg("exp") || !server.hasArg("mac")) {
      server.send(400, "application/json", "{\"ok\":false,\"msg\":\"parametros ausentes\"}");
      return;
    }
    const char* why = "";
    String s = server.arg("session"), e = server.arg("exp"), m = server.arg("mac");
    if (handleUnlockCommand(s.c_str(), e.c_str(), m.c_str(), &why)) {
      server.send(200, "application/json", "{\"ok\":true}");
    } else {
      server.send(403, "application/json", "{\"ok\":false,\"msg\":\"negado\"}");  // motivo só no log serial
      eventLog(why);
    }
  });
  server.begin();
}

// ============================ GSM / REDE (núcleo 0) ==========================
static bool atCmd(const char* cmd, const char* expect, uint32_t timeoutMs, char* out = nullptr, size_t outLen = 0) {
  while (gsmSerial.available()) gsmSerial.read();
  if (cmd) gsmSerial.print(cmd), gsmSerial.print("\r\n");
  char buf[400];
  size_t n = 0;
  uint32_t start = millis();
  bool ok = false;
  while (millis() - start < timeoutMs) {
    while (gsmSerial.available() && n < sizeof(buf) - 1) buf[n++] = (char)gsmSerial.read();
    buf[n] = 0;
    if (expect && strstr(buf, expect)) { ok = true; break; }
    if (strstr(buf, "ERROR")) break;
    vTaskDelay(5 / portTICK_PERIOD_MS);
  }
  if (out && outLen) { strncpy(out, buf, outLen - 1); out[outLen - 1] = 0; }
  return ok;
}

static bool gprsUp = false;

static bool gsmInit() {
  gsmSerial.begin(9600, SERIAL_8N1, PIN_GSM_RX, PIN_GSM_TX);
  for (int i = 0; i < 5; i++) if (atCmd("AT", "OK", 1000)) break;
  if (!atCmd("ATE0", "OK", 1000)) return false;
  atCmd("AT+CMGF=1", "OK", 1000);
  for (int i = 0; i < 20; i++) {  // aguarda registro na rede (0,1 ou 0,5)
    char r[80];
    atCmd("AT+CREG?", "OK", 1000, r, sizeof(r));
    if (strstr(r, ",1") || strstr(r, ",5")) return true;
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
  return false;
}

static bool gprsOpen() {
  atCmd("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", "OK", 2000);
  char c[96];
  snprintf(c, sizeof(c), "AT+SAPBR=3,1,\"APN\",\"%s\"", GPRS_APN);
  atCmd(c, "OK", 2000);
  snprintf(c, sizeof(c), "AT+SAPBR=3,1,\"USER\",\"%s\"", GPRS_USER);
  atCmd(c, "OK", 2000);
  snprintf(c, sizeof(c), "AT+SAPBR=3,1,\"PWD\",\"%s\"", GPRS_PASS);
  atCmd(c, "OK", 2000);
  atCmd("AT+SAPBR=0,1", "OK", 5000);  // garante estado limpo
  gprsUp = atCmd("AT+SAPBR=1,1", "OK", 30000);
  return gprsUp;
}

// Retorna o status HTTP (200...), ou negativo em falha de modem/GPRS.
static int gsmHttp(bool post, const char* path, const char* body, const char* contentType, char* resp, size_t respLen) {
  if (!gprsUp && !gprsOpen()) return -1;
  atCmd("AT+HTTPTERM", "OK", 1500);
  if (!atCmd("AT+HTTPINIT", "OK", 3000)) { gprsUp = false; return -2; }
  atCmd("AT+HTTPPARA=\"CID\",1", "OK", 1000);
  char cmd[220];
  snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"URL\",\"http://%s:%d%s\"", API_HOST, API_PORT, path);
  atCmd(cmd, "OK", 2000);
#if API_USE_TLS
  atCmd("AT+HTTPSSL=1", "OK", 1000);
#endif
  snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"CONTENT\",\"%s\"", contentType ? contentType : "application/json");
  atCmd(cmd, "OK", 1000);
  // O SIM800L interpreta a sequência \r\n escrita literalmente como separador de cabeçalho.
  snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"USERDATA\",\"x-api-key: %s\\r\\n\"", API_KEY);
  atCmd(cmd, "OK", 1000);
  if (post) {
    snprintf(cmd, sizeof(cmd), "AT+HTTPDATA=%u,10000", (unsigned)strlen(body));
    if (!atCmd(cmd, "DOWNLOAD", 3000)) { atCmd("AT+HTTPTERM", "OK", 1500); return -3; }
    gsmSerial.print(body);
    if (!atCmd(nullptr, "OK", 10000)) { atCmd("AT+HTTPTERM", "OK", 1500); return -4; }
  }
  char act[120];
  if (!atCmd(post ? "AT+HTTPACTION=1" : "AT+HTTPACTION=0", "+HTTPACTION:", 30000, act, sizeof(act))) {
    atCmd("AT+HTTPTERM", "OK", 1500);
    gprsUp = false;
    return -5;
  }
  // +HTTPACTION: <metodo>,<status>,<len>
  int status = -6;
  const char* p = strstr(act, "+HTTPACTION:");
  if (p) {
    p = strchr(p, ',');
    if (p) status = atoi(p + 1);
  }
  if (resp && respLen) {
    resp[0] = 0;
    char rd[500];
    if (atCmd("AT+HTTPREAD", "OK", 8000, rd, sizeof(rd))) {
      char* nl = strstr(rd, "+HTTPREAD:");
      if (nl) {
        nl = strchr(nl, '\n');
        if (nl) { strncpy(resp, nl + 1, respLen - 1); resp[respLen - 1] = 0; }
      }
    }
  }
  atCmd("AT+HTTPTERM", "OK", 1500);
  return status;
}

// HTTP via Wi-Fi Station (usado quando conectado à rede do Servidor Local / bancada, com fallback para GPRS)
static int wifiStaHttp(bool post, const char* path, const char* body, const char* contentType, char* resp, size_t respLen) {
  if (WiFi.status() != WL_CONNECTED) return -10;
  WiFiClient client;
  HTTPClient http;
  char url[180];
  snprintf(url, sizeof(url), "http://%s:%d%s", API_HOST, API_PORT, path);
  http.setTimeout(5000);
  if (!http.begin(client, url)) return -11;
  http.addHeader("x-api-key", API_KEY);
  if (post) http.addHeader("Content-Type", contentType ? contentType : "application/json");
  int st = post ? http.POST(body ? body : "") : http.GET();
  if (st > 0 && resp && respLen) {
    String s = http.getString();
    strncpy(resp, s.c_str(), respLen - 1);
    resp[respLen - 1] = 0;
  }
  http.end();
  return st;
}

static int backendHttp(bool post, const char* path, const char* body, const char* contentType, char* resp, size_t respLen) {
  if (WiFi.status() == WL_CONNECTED) {
    int st = wifiStaHttp(post, path, body, contentType, resp, respLen);
    if (st > 0) return st;
  }
  return gsmHttp(post, path, body, contentType, resp, respLen);
}

static bool gsmSendSms(const char* text) {
  atCmd("AT+CMGF=1", "OK", 1000);
  char cmd[64];
  snprintf(cmd, sizeof(cmd), "AT+CMGS=\"%s\"", SMS_ALERT_NUMBER);
  if (!atCmd(cmd, ">", 5000)) return false;
  gsmSerial.print(text);
  gsmSerial.write(26);
  return atCmd(nullptr, "+CMGS:", 30000);
}

// JSON mínimo: procura "chave": valor
static bool jsonBool(const char* s, const char* key, bool* out) {
  char pat[32];
  snprintf(pat, sizeof(pat), "\"%s\"", key);
  const char* p = strstr(s, pat);
  if (!p) return false;
  p = strchr(p + strlen(pat), ':');
  if (!p) return false;
  p++;
  while (*p == ' ') p++;
  if (strncmp(p, "true", 4) == 0) { *out = true; return true; }
  if (strncmp(p, "false", 5) == 0) { *out = false; return true; }
  return false;
}

static bool jsonLong(const char* s, const char* key, long* out) {
  char pat[32];
  snprintf(pat, sizeof(pat), "\"%s\"", key);
  const char* p = strstr(s, pat);
  if (!p) return false;
  p = strchr(p + strlen(pat), ':');
  if (!p) return false;
  p++;
  while (*p == ' ') p++;
  if (strncmp(p, "null", 4) == 0 || !isdigit((unsigned char)*p)) return false;
  *out = atol(p);
  return true;
}

struct RetrySlot { bool used; NetJob job; uint32_t nextMs; uint8_t tries; };
static RetrySlot retrySlots[4];

static bool runJob(const NetJob& job) {
  if (job.type == J_SMS) return gsmSendSms(job.body);
  const char* ct = (job.type == J_AUDIT) ? "text/csv" : "application/json";
  int st = backendHttp(true, job.path, job.body, ct, nullptr, 0);
  bool ok = (st >= 200 && st < 300) || (st == 409 || st == 404);  // 409/404: já processado (guia 4.7)
  if (job.type == J_AUDIT && ok) {
    NetResult r = {job.arg};
    xQueueSend(netResultQueue, &r, 0);
  }
  if (!ok) Serial.printf("[NET] falha %s -> %d\n", job.path, st);
  return ok;
}

static void netTask(void*) {
  netTaskGsmOk = gsmInit();
  Serial.printf("[NET] modem %s\n", netTaskGsmOk ? "registrado" : "SEM REDE");
  uint32_t lastPoll = 0;
  for (;;) {
    NetJob job;
    if (xQueueReceive(netQueue, &job, 200 / portTICK_PERIOD_MS) == pdTRUE) {
      if (!runJob(job) && job.critical) {
        for (auto& s : retrySlots) {
          if (!s.used) { s.used = true; s.job = job; s.nextMs = millis() + 15000; s.tries = 1; break; }
        }
      }
      continue;
    }
    for (auto& s : retrySlots) {
      if (s.used && (int32_t)(millis() - s.nextMs) >= 0) {
        if (runJob(s.job)) s.used = false;
        else { s.tries++; s.nextMs = millis() + min<uint32_t>(15000UL * s.tries, 300000UL); }
        break;
      }
    }
    if (millis() - lastPoll >= POLL_MS) {
      lastPoll = millis();
      char path[64], resp[300];
      snprintf(path, sizeof(path), "/api/fueling/sessions/%d/active", TRUCK_ID);
      int st = backendHttp(false, path, nullptr, "application/json", resp, sizeof(resp));
      portENTER_CRITICAL(&pollMux);
      if (st == 200) {
        bool unlock = false;
        long session = 0;
        bool okU = jsonBool(resp, "unlock", &unlock);
        bool okS = jsonLong(resp, "session_id", &session);
        pollRes.valid = okU;
        pollRes.unlock = okU && unlock && okS;
        pollRes.session = okS ? session : 0;
        pollRes.atMs = millis();
      } else {
        pollRes.valid = false;  // qualquer falha: fail-closed
      }
      portEXIT_CRITICAL(&pollMux);
    }
  }
}

// ============================ TELEMETRIA / SYNC ==============================
static void periodicService() {
  uint32_t now = millis();
  if (now - lastTelemetryMs >= TELEMETRY_MS && gpsFix) {
    lastTelemetryMs = now;
    char path[48], body[120];
    snprintf(path, sizeof(path), "/api/fleet/%d/telemetry", TRUCK_ID);
    snprintf(body, sizeof(body), "{\"lat\":%.6f,\"lng\":%.6f,\"speed_kmh\":%.1f}", gpsLat, gpsLng, gpsSpeedKmh);
    queuePost(path, body, false);
  }
  if (now - lastAuditMs >= AUDIT_SYNC_MS) {
    lastAuditMs = now;
    queueAuditSync();
  }
  NetResult r;
  while (xQueueReceive(netResultQueue, &r, 0) == pdTRUE) {
    if (r.auditOffset > auditOffset) {
      auditOffset = r.auditOffset;
      prefs.putUInt("auditOff", auditOffset);
    }
  }
}

// ============================ SETUP / LOOP ===================================
static void wdtInit(uint32_t seconds) {
#if ESP_IDF_VERSION_MAJOR >= 5
  esp_task_wdt_config_t cfg = {};
  cfg.timeout_ms = seconds * 1000;
  cfg.idle_core_mask = 0;
  cfg.trigger_panic = true;
  esp_task_wdt_reconfigure(&cfg);
#else
  esp_task_wdt_init(seconds, true);
#endif
  esp_task_wdt_add(NULL);
}

void setup() {
  // 1) PRIMEIRA coisa: solenoides desligados (descritivo 10.2)
  pinMode(PIN_TRIG_SOL1, OUTPUT); digitalWrite(PIN_TRIG_SOL1, LOW);
  pinMode(PIN_TRIG_SOL2, OUTPUT); digitalWrite(PIN_TRIG_SOL2, LOW);
  // 2) NSS do LoRa e CS do SD em nível alto antes de iniciar o SPI
  pinMode(PIN_LORA_NSS, OUTPUT); digitalWrite(PIN_LORA_NSS, HIGH);
  pinMode(PIN_SD_CS, OUTPUT); digitalWrite(PIN_SD_CS, HIGH);
  pinMode(PIN_FC_TRAVA1, INPUT);  // pull-up externo (pinos 34-39 não têm interno)
  pinMode(PIN_FC_TRAVA2, INPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT); digitalWrite(PIN_BUZZER, LOW);

  Serial.begin(115200);
  Serial.println("\n[BOOT] Trava EHR R4 - firmware v2.1 (NAO VALIDADO EM BANCADA)");

  prefs.begin("ehr", false);
  seqCounter = prefs.getUInt("seq", 0);
  auditOffset = prefs.getUInt("auditOff", 0);
  lastUnlockedSession = prefs.getLong("lastSess", 0);

  hmacOk = hexToBytes(HMAC_KEY_HEX, hmacKey, sizeof(hmacKey));
  bool allZero = true;
  for (size_t i = 0; i < sizeof(hmacKey); i++) if (hmacKey[i]) allZero = false;
  if (allZero) hmacOk = false;
  if (!hmacOk) Serial.println("[AUTH] HMAC_KEY_HEX invalida ou zerada: comandos por LoRa/Wi-Fi DESABILITADOS");

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  SPI.begin(18, 19, 23);

  // 3) Lê a posição real das linguetas. NÃO aciona nada sozinho (queda de energia, reinício).
  for (int i = 0; i < 10; i++) { scanOne(sw1, PIN_FC_TRAVA1); scanOne(sw2, PIN_FC_TRAVA2); delay(SCAN_MS); }
  sw1.sinceMs = sw2.sinceMs = millis() - LOCK_CONFIRM_MS;
  prevLockConfirmed = lockConfirmed();

  sdOk = SD.begin(PIN_SD_CS);
  Serial.printf("[SD] %s\n", sdOk ? "ok" : "FALHA (sem log offline)");

  LoRa.setPins(PIN_LORA_NSS, PIN_LORA_RST, PIN_LORA_DIO0);
  loraOk = LoRa.begin(915E6);
  if (loraOk) {
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(0x12);
    LoRa.setTxPower(17);
  }
  Serial.printf("[LORA] %s\n", loraOk ? "ok" : "FALHA");

  gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);

  netQueue = xQueueCreate(6, sizeof(NetJob));
  netResultQueue = xQueueCreate(4, sizeof(NetResult));
  xTaskCreatePinnedToCore(netTask, "net", 10240, nullptr, 1, nullptr, 0);

  setupWebServer();
  eventLog("partida");
  wdtInit(15);
}

void loop() {
  esp_task_wdt_reset();
  uint32_t now = millis();

  // Corte de segurança redundante: pulso nunca passa de 5 s, mesmo se algo travar a lógica.
  if (pulseOn && now - pulseStartMs > 5000) { solenoidsOff(); pulseOn = false; }

  if (now - lastScanMs >= SCAN_MS) {
    lastScanMs = now;
    scanOne(sw1, PIN_FC_TRAVA1);
    scanOne(sw2, PIN_FC_TRAVA2);
  }
  pulseService();
  lockLogic();
  powerSupervisionService();
  pollService();
  loraService();
  gpsService();
  server.handleClient();
  beaconService();
  periodicService();

  digitalWrite(PIN_LED, (now / (prevLockConfirmed ? 1500 : 300)) % 2);
  delay(1);
}
