/*
  ============================================================================
   TRAVA EHR — Trava eletrônica de abastecimento com LoRa & Telemetria
   Firmware ESP32 v2.0 (LoRa 915MHz + GPS + GSM + RTC + MicroSD + Acionamento)
  ============================================================================
*/

#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <Wire.h>
#include <LoRa.h>
#include <SD.h>

// ============================ DEFINIÇÃO DE PINOS ============================
// Barramento SPI Compartilhado (LoRa e Cartão MicroSD)
#define PIN_SPI_SCK   18
#define PIN_SPI_MISO  19
#define PIN_SPI_MOSI  23

// Módulo LoRa SX1276 (915 MHz)
#define LORA_CS       5
#define LORA_RST      2
#define LORA_DIO0     4
#define LORA_FREQ     915E6

// Módulo Leitor Micro SD
#define SD_CS         13

// Módulo RTC DS3231 (I2C)
#define I2C_SDA       21
#define I2C_SCL       22
#define DS3231_ADDR   0x68

// Módulo GPS NEO-6M (Serial 1)
#define GPS_RX_PIN    34
#define GPS_TX_PIN    33

// Módulo GSM GPRS SIM800L (Serial 2)
#define GSM_RX_PIN    16
#define GSM_TX_PIN    17

// Acionamento das Travas / Motores (PWM / Gate)
#define PIN_ATUADOR_1 25
#define PIN_ATUADOR_2 26
#define PIN_PWM_VEL   14

// Sensores de Fim de Curso
#define PIN_FC_TRAV   35
#define PIN_FC_DEST   36

// ============================ CONFIGURAÇÕES =================================
const char* WIFI_SSID = "TRAVA-EHR-01";
const char* WIFI_PASS = "trava2026";
const char* PIN_AUTH  = "1234";

WebServer server(80);
HardwareSerial gpsSerial(1);
HardwareSerial gsmSerial(2);

enum EstadoTrava { TRAVADO, DESTRAVADO, EM_MOVIMENTO, FALHA };
EstadoTrava estadoAtual = TRAVADO;

// Variáveis de Telemetria
String ultimaLatitude  = "-19.9245";
String ultimaLongitude = "-43.9352";
String carimboTempo    = "2026-10-20 21:30:00";

// ========================== ROTINAS DE OPERAÇÃO =============================
void registrarLogSD(String evento, String resultado) {
  File logFile = SD.open("/ehr_audit.csv", FILE_APPEND);
  if (logFile) {
    String linha = carimboTempo + ";" + ultimaLatitude + ";" + ultimaLongitude + ";" + evento + ";" + resultado;
    logFile.println(linha);
    logFile.close();
    Serial.println("[SD LOG] " + linha);
  }
}

void enviarAlertaGSM(String msg) {
  gsmSerial.println("AT+CMGF=1"); // Modo texto SMS
  delay(100);
  gsmSerial.println("AT+CMGS=\"+5531999999999\""); // Inserir número da central
  delay(100);
  gsmSerial.print("[ALERTA TRAVA EHR] " + msg + " em Lat: " + ultimaLatitude + " Lon: " + ultimaLongitude);
  delay(100);
  gsmSerial.write(26); // Ctrl+Z
}

void executarTravar() {
  estadoAtual = EM_MOVIMENTO;
  Serial.println("[AÇÃO] Acionando travamento...");
  digitalWrite(PIN_ATUADOR_1, HIGH);
  digitalWrite(PIN_ATUADOR_2, LOW);
  ledcWrite(0, 200); // 80% PWM
  delay(1000);       // Pulso de 1 segundo
  ledcWrite(0, 0);
  digitalWrite(PIN_ATUADOR_1, LOW);
  estadoAtual = TRAVADO;
  registrarLogSD("TRAVAR", "SUCESSO");
}

void executarDestravar() {
  estadoAtual = EM_MOVIMENTO;
  Serial.println("[AÇÃO] Acionando destravamento...");
  digitalWrite(PIN_ATUADOR_1, LOW);
  digitalWrite(PIN_ATUADOR_2, HIGH);
  ledcWrite(0, 200);
  delay(1000);
  ledcWrite(0, 0);
  digitalWrite(PIN_ATUADOR_2, LOW);
  estadoAtual = DESTRAVADO;
  registrarLogSD("DESTRAVAR", "SUCESSO");
  enviarAlertaGSM("Bocal destravado para abastecimento.");
}

// ============================== SETUP =======================================
void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);

  pinMode(PIN_ATUADOR_1, OUTPUT);
  pinMode(PIN_ATUADOR_2, OUTPUT);
  pinMode(PIN_FC_TRAV, INPUT_PULLUP);
  pinMode(PIN_FC_DEST, INPUT_PULLUP);

  ledcAttachPin(PIN_PWM_VEL, 0);
  ledcSetup(0, 1000, 8); // 1 kHz, 8 bits

  // 1. Inicializar I2C para RTC
  Wire.begin(I2C_SDA, I2C_SCL);

  // 2. Inicializar barramento SPI
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

  // 3. Inicializar MicroSD
  if (!SD.begin(SD_CS)) {
    Serial.println("[SD] Falha na inicialização do cartão.");
  } else {
    Serial.println("[SD] Cartão pronto.");
  }

  // 4. Inicializar LoRa 915 MHz
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("[LORA] Falha na conexão com SX1276.");
  } else {
    Serial.println("[LORA] Rádio 915MHz ativo!");
  }

  // 5. Configurar Wi-Fi AP
  WiFi.softAP(WIFI_SSID, WIFI_PASS);
  server.on("/status", HTTP_GET, []() {
    String json = "{\"estado\":\"" + String(estadoAtual == TRAVADO ? "TRAVADO" : "DESTRAVADO") + "\",\"lat\":\"" + ultimaLatitude + "\",\"lon\":\"" + ultimaLongitude + "\"}";
    server.send(200, "application/json", json);
  });
  server.on("/destravar", HTTP_POST, []() {
    if (server.hasArg("pin") && server.arg("pin") == PIN_AUTH) {
      executarDestravar();
      server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Destravado\"}");
    } else {
      server.send(403, "application/json", "{\"ok\":false,\"msg\":\"PIN Incorreto\"}");
    }
  });
  server.on("/travar", HTTP_POST, []() {
    executarTravar();
    server.send(200, "application/json", "{\"ok\":true,\"msg\":\"Travado\"}");
  });
  server.begin();
}

// =============================== LOOP =======================================
void loop() {
  server.handleClient();

  // Escuta de Comandos LoRa
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String loraMsg = "";
    while (LoRa.available()) {
      loraMsg += (char)LoRa.read();
    }
    Serial.println("[LORA RX] " + loraMsg);
    if (loraMsg == "CMD:DESTRAVAR:1234") {
      executarDestravar();
      LoRa.beginPacket();
      LoRa.print("ACK:DESTRAVADO");
      LoRa.endPacket();
    } else if (loraMsg == "CMD:TRAVAR:1234") {
      executarTravar();
      LoRa.beginPacket();
      LoRa.print("ACK:TRAVADO");
      LoRa.endPacket();
    }
  }

  // Leitura periódica do GPS
  while (gpsSerial.available()) {
    char c = gpsSerial.read();
    // Parser NMEA pode atualizar ultimaLatitude e ultimaLongitude
  }
}
