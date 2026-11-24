/*
  ============================================================================
   TRAVA EHR — Trava eletrônica de abastecimento  |  firmware ESP32  v1.1
  ============================================================================
   Como funciona
   - O ESP32 cria a própria rede Wi-Fi (modo Access Point). O celular conecta
     nessa rede e o app envia os comandos para http://192.168.4.1
   - TRAVAR: as 3 palhetas giram até o fim de curso "travada".
     DESTRAVAR: giram de volta até o fim de curso "destravada".
   - Cada motor para sozinho ao tocar o seu sensor. Se não chegar dentro de
     TEMPO_MAX_MOV_MS, ele para e a resposta informa qual palheta falhou.

   Hardware (ver esquema de ligação)
   - ESP32 DevKit V1 (módulo ESP32-WROOM-32)
   - 2x módulo ponte H L298N  ->  placa A: motores 1 e 2  |  placa B: motor 3
     (alimentação dos motores 7,5 V: o L298N perde ~2 V e o motor recebe ~5 V)
   - 3x motor DC com redução "TT" (3–6 V)
   - 6x sensor de fim de curso (micro switch NA ou sensor Hall A3144),
     que ligam o pino ao GND quando a palheta chega na posição

   API HTTP (usada pelo app Android)
     GET  /status                  -> estado atual (JSON)
     POST /travar      pin=1234    -> trava e responde com o estado final
     POST /destravar   pin=1234    -> destrava e responde com o estado final
     GET  /                        -> página web com os botões (reserva do app)

   Monitor Serial (115200 baud):  t = travar   d = destravar   s = status

   IDE Arduino: placa "ESP32 Dev Module" (pacote "esp32" da Espressif, 2.x ou 3.x)
  ============================================================================
*/

#include <WiFi.h>
#include <WebServer.h>

// ============================ CONFIGURAÇÃO ==================================
// Rede Wi-Fi criada pela trava. Use nome e senha diferentes em cada caminhão.
const char* WIFI_NOME  = "TRAVA-EHR-01";
const char* WIFI_SENHA = "trava2026";      // mínimo 8 caracteres

// PIN pedido pelo app para travar/destravar
const char* PIN_ACESSO = "1234";

// Motores
const int      VELOCIDADE_PCT   = 80;      // velocidade de trabalho (0–100 %)
const int      PARTIDA_PCT      = 50;      // velocidade no início da rampa
const uint32_t RAMPA_MS         = 120;     // partida suave (reduz o pico de corrente)
const uint32_t TEMPO_MAX_MOV_MS = 1500;    // não chegou ao sensor nesse tempo -> falha

// Se uma palheta girar para o lado errado, troque false por true
// (ou inverta os dois fios daquele motor).        M1     M2     M3
const bool INVERTER_MOTOR[3]                   = { false, false, false };

// Sensores de fim de curso
const bool     USAR_SENSORES  = false;      // false = teste sem sensores (motor gira por tempo)
const uint32_t TEMPO_CURSO_MS = 250;       // só sem sensores: ajuste até a palheta chegar ao batente

// Se uma palheta sair da posição travada (vibração, alguém forçando),
// o ESP32 gira o motor de novo para recolocá-la. Desiste após 3 tentativas
// seguidas sem sucesso (até o próximo comando).
const bool REFORCAR_TRAVA = true;

// Segurança: após 5 PINs errados, recusa comandos por 1 minuto
const uint8_t  MAX_TENTATIVAS    = 5;
const uint32_t TEMPO_BLOQUEIO_MS = 60000;

// ================================ PINOS =====================================
// Módulos L298N (tire os jumpers de ENA e ENB das duas placas)
const int PINO_PWM  = 16;   // ENA e ENB da placa A + ENA da placa B (na placa ESP32: RX2)
//                             M1    M2    M3
const int PINO_IN1[3]     = {  23,   21,   18 };  // A:IN1  A:IN3  B:IN1
const int PINO_IN2[3]     = {  22,   19,   17 };  // A:IN2  A:IN4  B:IN2  (17 = TX2)
// Fins de curso (ligam o pino ao GND quando acionados)
const int PINO_FC_TRAV[3] = {  32,   25,   27 };  // palheta travada
const int PINO_FC_DEST[3] = {  33,   26,   13 };  // palheta destravada
const int PINO_LED = 2;     // LED azul da placa: aceso = travado, apagado = destravado,
                            // piscando = posição indefinida

// ============================== VARIÁVEIS ===================================
WebServer servidor(80);
const char* TIPO_JSON = "application/json; charset=utf-8";

enum Estado { DESTRAVADO, TRAVADO, INDEFINIDO };

Estado   estadoSemSensor   = INDEFINIDO;  // usado só com USAR_SENSORES = false
bool     travaConfirmada   = false;       // último TRAVAR deixou as 3 palhetas no lugar
String   ultimaMsg         = "Pronta";

uint8_t  tentativasErradas = 0;
bool     bloqueado         = false;
uint32_t bloqueioInicio    = 0;

uint8_t  reforcos[3]  = { 0, 0, 0 };      // tentativas seguidas sem sucesso de recolocar
bool     fora[3]      = { false, false, false };
uint32_t foraDesde[3] = { 0, 0, 0 };
const uint32_t TOLERANCIA_FORA_MS = 300;  // ignora aberturas curtas do sensor (vibração)
const uint8_t  MAX_REFORCOS       = 3;

// ============================== PWM (LEDC) ==================================
const uint32_t PWM_FREQ_HZ = 1000;        // 1 kHz: o L298N é lento para frequências altas
const uint8_t  PWM_BITS    = 8;

void pwmIniciar() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PINO_PWM, PWM_FREQ_HZ, PWM_BITS);
#else
  ledcSetup(0, PWM_FREQ_HZ, PWM_BITS);
  ledcAttachPin(PINO_PWM, 0);
#endif
}

void pwmPercentual(int pct) {
  uint32_t duty = (uint32_t)constrain(pct, 0, 100) * 255 / 100;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PINO_PWM, duty);
#else
  ledcWrite(0, duty);
#endif
}

// ========================= MOTORES E SENSORES ===============================
void motorGirar(int m, bool paraTravar) {
  bool sentido = (paraTravar != INVERTER_MOTOR[m]);
  digitalWrite(PINO_IN1[m], sentido ? HIGH : LOW);
  digitalWrite(PINO_IN2[m], sentido ? LOW : HIGH);
}

// Freio do L298N (IN1 = IN2 = HIGH com EN ligado): para na hora e segura a palheta
void motorFrear(int m) {
  digitalWrite(PINO_IN1[m], HIGH);
  digitalWrite(PINO_IN2[m], HIGH);
}

bool sensorAcionado(int pino)  { return digitalRead(pino) == LOW; }
bool palhetaTravada(int m)     { return sensorAcionado(PINO_FC_TRAV[m]); }
bool palhetaDestravada(int m)  { return sensorAcionado(PINO_FC_DEST[m]); }
bool naPosicao(int m, bool travar) { return travar ? palhetaTravada(m) : palhetaDestravada(m); }

const char* situacaoPalheta(int m) {
  if (!USAR_SENSORES) return "sem sensor";
  bool t = palhetaTravada(m), d = palhetaDestravada(m);
  if (t && d) return "erro no sensor";
  if (t)      return "travada";
  if (d)      return "destravada";
  return "fora de posição";
}

Estado lerEstado() {
  if (!USAR_SENSORES) return estadoSemSensor;
  int nt = 0, nd = 0;
  for (int m = 0; m < 3; m++) {
    bool t = palhetaTravada(m), d = palhetaDestravada(m);
    if (t && !d) nt++;
    if (d && !t) nd++;
  }
  if (nt == 3) return TRAVADO;
  if (nd == 3) return DESTRAVADO;
  return INDEFINIDO;
}

const char* nomeEstado(Estado e) {
  if (e == TRAVADO)    return "TRAVADO";
  if (e == DESTRAVADO) return "DESTRAVADO";
  return "INDEFINIDO";
}

String jsonEstado(bool ok, const String& msg) {
  String j;
  j.reserve(220);
  j += "{\"ok\":";
  j += ok ? "true" : "false";
  j += ",\"estado\":\"";
  j += nomeEstado(lerEstado());
  j += "\",\"palhetas\":[";
  for (int m = 0; m < 3; m++) {
    if (m) j += ",";
    j += "\"";
    j += situacaoPalheta(m);
    j += "\"";
  }
  j += "],\"msg\":\"";
  j += msg;
  j += "\"}";
  return j;
}

// "2"  |  "1 e 3"  |  "1, 2 e 3"
String listaPalhetas(const bool marcadas[3]) {
  int num[3], n = 0;
  for (int m = 0; m < 3; m++) if (marcadas[m]) num[n++] = m + 1;
  String s;
  for (int i = 0; i < n; i++) {
    if (i > 0) s += (i == n - 1) ? " e " : ", ";
    s += String(num[i]);
  }
  return s;
}

// ============================== MOVIMENTO ===================================
// Gira os motores marcados em "usar" até o fim de curso (travar ou destravar).
// Bloqueia até todos pararem (no máximo TEMPO_MAX_MOV_MS).
// Devolve quantos motores NÃO chegaram e marca quais em "falhou".
int moverPalhetas(bool travar, const bool usar[3], bool falhou[3]) {
  bool    ativo[3];
  uint8_t confirma[3] = { 0, 0, 0 };
  int     emMovimento = 0;

  for (int m = 0; m < 3; m++) {
    falhou[m] = false;
    ativo[m]  = false;
    if (!usar[m]) continue;
    if (USAR_SENSORES && naPosicao(m, travar)) {   // já está no lugar
      motorFrear(m);
      continue;
    }
    motorGirar(m, travar);
    ativo[m] = true;
    emMovimento++;
  }

  uint32_t inicio = millis();
  while (emMovimento > 0) {
    uint32_t t = millis() - inicio;

    // Rampa de partida: começa em PARTIDA_PCT e sobe até VELOCIDADE_PCT
    int pct = VELOCIDADE_PCT;
    if (t < RAMPA_MS) pct = PARTIDA_PCT + (int)((long)(VELOCIDADE_PCT - PARTIDA_PCT) * (long)t / (long)RAMPA_MS);
    pwmPercentual(pct);

    for (int m = 0; m < 3; m++) {
      if (!ativo[m]) continue;
      bool chegou;
      if (USAR_SENSORES) {
        confirma[m] = naPosicao(m, travar) ? confirma[m] + 1 : 0;
        chegou = (confirma[m] >= 2);               // 2 leituras seguidas: ignora ruído
      } else {
        chegou = (t >= TEMPO_CURSO_MS);
      }
      if (chegou) {
        motorFrear(m);
        ativo[m] = false;
        emMovimento--;
      } else if (t >= TEMPO_MAX_MOV_MS) {
        motorFrear(m);
        ativo[m]  = false;
        falhou[m] = true;
        emMovimento--;
      }
    }
    delay(1);
  }
  pwmPercentual(100);   // EN ligado + IN1 = IN2 = HIGH: todos em freio

  int nFalhas = 0;
  for (int m = 0; m < 3; m++) if (falhou[m]) nFalhas++;
  return nFalhas;
}

// Executa TRAVAR (true) ou DESTRAVAR (false) nas 3 palhetas e devolve a mensagem
String executarComando(bool travar, bool& ok) {
  const bool todos[3] = { true, true, true };
  bool falhou[3];

  travaConfirmada = false;
  for (int m = 0; m < 3; m++) { reforcos[m] = 0; fora[m] = false; }

  int nFalhas = moverPalhetas(travar, todos, falhou);
  if (!USAR_SENSORES) estadoSemSensor = travar ? TRAVADO : DESTRAVADO;

  Estado alvo = travar ? TRAVADO : DESTRAVADO;
  ok = (nFalhas == 0) && (lerEstado() == alvo);

  String msg;
  if (ok) {
    msg = travar ? "Trava acionada" : "Trava liberada";
    travaConfirmada = travar;
  } else if (nFalhas == 1) {
    msg = "Falha: a palheta " + listaPalhetas(falhou) + " não chegou ao fim de curso";
  } else if (nFalhas > 1) {
    msg = "Falha: as palhetas " + listaPalhetas(falhou) + " não chegaram ao fim de curso";
  } else {
    msg = "Falha: os sensores não confirmam a posição";
  }

  ultimaMsg = msg;
  Serial.printf("[%s] %s  ->  %s\n", travar ? "TRAVAR" : "DESTRAVAR", msg.c_str(), nomeEstado(lerEstado()));
  return msg;
}

// Com a trava acionada, recoloca uma palheta que tenha saído da posição
void vigiarTrava() {
  if (!USAR_SENSORES || !REFORCAR_TRAVA || !travaConfirmada) return;

  for (int m = 0; m < 3; m++) {
    if (palhetaTravada(m)) { fora[m] = false; continue; }
    if (!fora[m]) { fora[m] = true; foraDesde[m] = millis(); continue; }
    if (millis() - foraDesde[m] < TOLERANCIA_FORA_MS) continue;
    if (reforcos[m] >= MAX_REFORCOS) continue;

    reforcos[m]++;
    bool usar[3] = { false, false, false };
    bool falhou[3];
    usar[m] = true;
    moverPalhetas(true, usar, falhou);
    fora[m] = false;
    if (!falhou[m]) reforcos[m] = 0;        // voltou para o lugar: só falhas seguidas contam

    ultimaMsg = "Palheta " + String(m + 1) +
                (falhou[m] ? " saiu da posição e não voltou" : " saiu da posição e foi recolocada");
    Serial.println(ultimaMsg);
  }
}

// ======================== LED, SERIAL E DIAGNÓSTICO =========================
void atualizarLed() {
  static uint32_t ultimo = 0;
  static bool aceso = false;
  Estado e = lerEstado();
  if (e == TRAVADO)    { digitalWrite(PINO_LED, HIGH); return; }
  if (e == DESTRAVADO) { digitalWrite(PINO_LED, LOW);  return; }
  if (millis() - ultimo >= 250) {
    ultimo = millis();
    aceso = !aceso;
    digitalWrite(PINO_LED, aceso ? HIGH : LOW);
  }
}

// Mostra no Monitor Serial sempre que um sensor muda (ajuda a calibrar)
void logSensores() {
  if (!USAR_SENSORES) return;
  static uint8_t  anterior = 0xFF;
  static uint32_t ultimo = 0;
  if (millis() - ultimo < 50) return;
  ultimo = millis();

  uint8_t atual = 0;
  for (int m = 0; m < 3; m++) {
    if (palhetaTravada(m))    atual |= 1 << (2 * m);
    if (palhetaDestravada(m)) atual |= 1 << (2 * m + 1);
  }
  if (atual == anterior) return;
  anterior = atual;
  Serial.printf("Sensores  P1[trav:%d dest:%d]  P2[trav:%d dest:%d]  P3[trav:%d dest:%d]  -> %s\n",
                palhetaTravada(0), palhetaDestravada(0),
                palhetaTravada(1), palhetaDestravada(1),
                palhetaTravada(2), palhetaDestravada(2),
                nomeEstado(lerEstado()));
}

void lerSerial() {
  if (!Serial.available()) return;
  char c = Serial.read();
  bool ok;
  if (c == 't' || c == 'T')      executarComando(true, ok);
  else if (c == 'd' || c == 'D') executarComando(false, ok);
  else if (c == 's' || c == 'S') Serial.println(jsonEstado(true, ultimaMsg));
}

// ============================== SERVIDOR WEB ================================
bool pinValido() {
  if (bloqueado && millis() - bloqueioInicio < TEMPO_BLOQUEIO_MS) {
    servidor.send(429, TIPO_JSON, jsonEstado(false, "Muitas tentativas. Aguarde 1 minuto."));
    return false;
  }
  bloqueado = false;

  if (servidor.arg("pin") == PIN_ACESSO) {
    tentativasErradas = 0;
    return true;
  }
  if (++tentativasErradas >= MAX_TENTATIVAS) {
    bloqueado = true;
    bloqueioInicio = millis();
    tentativasErradas = 0;
  }
  servidor.send(401, TIPO_JSON, jsonEstado(false, "PIN incorreto"));
  return false;
}

void rotaComando(bool travar) {
  if (!pinValido()) return;
  bool ok;
  String msg = executarComando(travar, ok);
  servidor.send(200, TIPO_JSON, jsonEstado(ok, msg));
}

void rotaTravar()        { rotaComando(true); }
void rotaDestravar()     { rotaComando(false); }
void rotaStatus()        { servidor.send(200, TIPO_JSON, jsonEstado(true, ultimaMsg)); }
void rotaNaoEncontrada() { servidor.send(404, "text/plain", "Nao encontrado"); }

// Página simples com os mesmos botões do app (abre em http://192.168.4.1)
const char PAGINA[] PROGMEM = R"HTML(<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trava EHR</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:28px 20px;background:#f3f4f6;color:#1d2126;text-align:center}
h1{font-size:18px;font-weight:600;margin:0;color:#555}
#estado{font-size:34px;font-weight:800;margin:22px 0 6px}
#msg{color:#555;min-height:1.4em;margin-bottom:26px}
input{font-size:22px;padding:10px;width:150px;text-align:center;border:1px solid #bbb;border-radius:10px}
button{display:block;width:100%;max-width:360px;margin:16px auto;padding:24px;font-size:22px;font-weight:800;color:#fff;border:0;border-radius:14px}
#bt{background:#2e7d32}#bd{background:#e65100}button:disabled{opacity:.45}
</style></head><body>
<h1>Trava EHR</h1>
<div id="estado">...</div><div id="msg"></div>
<input id="pin" type="password" inputmode="numeric" placeholder="PIN">
<button id="bt">TRAVAR</button>
<button id="bd">DESTRAVAR</button>
<script>
const $=id=>document.getElementById(id);
const cor={TRAVADO:'#2e7d32',DESTRAVADO:'#e65100',INDEFINIDO:'#b26a00'};
function mostra(j){$('estado').textContent=j.estado;$('estado').style.color=cor[j.estado]||'#333';$('msg').textContent=j.msg;}
async function atualiza(){try{mostra(await (await fetch('/status')).json());}catch(e){$('msg').textContent='Sem conexão com a trava';}}
async function comando(c){
  $('bt').disabled=$('bd').disabled=true;
  $('msg').textContent=c=='travar'?'Travando...':'Destravando...';
  try{
    const r=await fetch('/'+c,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'pin='+encodeURIComponent($('pin').value)});
    mostra(await r.json());
  }catch(e){$('msg').textContent='Sem conexão com a trava';}
  $('bt').disabled=$('bd').disabled=false;
}
$('bt').onclick=()=>comando('travar');
$('bd').onclick=()=>comando('destravar');
atualiza();setInterval(atualiza,3000);
</script></body></html>)HTML";

void rotaPagina() { servidor.send_P(200, "text/html; charset=utf-8", PAGINA); }

// ================================ SETUP =====================================
void setup() {
  // 1) Motores parados antes de qualquer outra coisa
  for (int m = 0; m < 3; m++) {
    pinMode(PINO_IN1[m], OUTPUT);
    pinMode(PINO_IN2[m], OUTPUT);
    motorFrear(m);
    pinMode(PINO_FC_TRAV[m], INPUT_PULLUP);
    pinMode(PINO_FC_DEST[m], INPUT_PULLUP);
  }
  pwmIniciar();
  pwmPercentual(100);                       // EN ligado com IN1 = IN2 = HIGH: motores em freio
  pinMode(PINO_LED, OUTPUT);

  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println("Trava EHR v1.1 iniciando...");

  // Depois de uma queda de energia, a posição real vem dos sensores
  travaConfirmada = USAR_SENSORES && (lerEstado() == TRAVADO);

  // 2) Rede Wi-Fi própria
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(WIFI_NOME, WIFI_SENHA, 6, 0, 2)) {
    Serial.println("ERRO ao criar a rede Wi-Fi (a senha precisa ter 8 caracteres ou mais)");
  }
  Serial.printf("Rede Wi-Fi: %s   |   Endereço: http://%s\n",
                WIFI_NOME, WiFi.softAPIP().toString().c_str());

  // 3) Rotas do servidor
  servidor.on("/",          HTTP_GET,  rotaPagina);
  servidor.on("/status",    HTTP_GET,  rotaStatus);
  servidor.on("/travar",    HTTP_POST, rotaTravar);
  servidor.on("/destravar", HTTP_POST, rotaDestravar);
  servidor.onNotFound(rotaNaoEncontrada);
  servidor.begin();

  Serial.printf("Estado inicial: %s\n", nomeEstado(lerEstado()));
  Serial.println("Comandos pelo Monitor Serial: t = travar, d = destravar, s = status");
}

// ================================= LOOP =====================================
void loop() {
  servidor.handleClient();
  lerSerial();
  vigiarTrava();
  atualizarLed();
  logSensores();
  delay(2);
}
