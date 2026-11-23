# Firmware Trava EHR R4 (v2.1)

> **STATUS: NÃO VALIDADO EM BANCADA.** O código foi escrito seguindo a seção 10 do
> `DESCRITIVO_TECNICO_R4_TRAVA_EHR.md` e **compilado** (ver "Build"), mas nunca rodou no
> hardware. Não instale em caminhão antes de executar a fase 14 do comissionamento (seção 11 do descritivo)
> e o checklist abaixo.

## Por que isto substitui o `.ino` v2.0 do pacote ALFA

O `TravaEHR_ESP32_LoRa_Telemetria.ino` do pacote era para a R3 (motor + ponte H) e **não serve** na R4:

| Problema no `.ino` antigo | Consequência na R4 | Neste firmware |
|---|---|---|
| `TRAVAR` energizava `PIN_ATUADOR_1` | Solenoide **fail-secure**: energizado = recolhe = **destrava**. O comando "travar" abria a trava | Só existe pulso de **destravar** (SOL1+SOL2 juntos, defasagem 50 ms). Travar é mecânico; o firmware só **confirma** pelos fins de curso |
| `LORA_RST = 2` | G2 é o LED; o descritivo define o RST no **G27** | `PIN_LORA_RST = 27` |
| PWM no G14 | Descritivo (A13): G14 emite PWM no boot; deve ficar sem uso | Removido |
| `INPUT_PULLUP` em G35/G36 | Pinos 34 a 39 **não têm pull-up interno** | `INPUT` + pull-up externo 4k7 (R3/R4 do desenho) |
| Fins de curso nunca lidos | Estado `TRAVADO` era só "passou 1 s" | Varredura 20 ms, 3 leituras iguais, TRAVADO = ambos baixos ≥ 200 ms |
| `CMD:DESTRAVAR:1234` em texto puro, PIN no código | Qualquer rádio reabre a trava (replay) | HMAC-SHA256 + sessão crescente + validade (abaixo) |
| GPS, RTC e hora fixos; SMS com número de exemplo | Log sem hora/posição reais | NMEA RMC com checksum, RTC DS3231 sincronizado pelo GPS, número em `config.h` |
| Sem cliente do backend | Placa isolada | HTTP via GPRS (SIM800L) nas rotas do guia |

## Arquitetura

- **`loop()` (núcleo 1) = segurança.** Nunca bloqueia em rede: fins de curso, pulso, violação, RTC, GPS, SD, LoRa, Wi-Fi local, watchdog de 15 s.
- **`netTask` (núcleo 0) = modem GSM.** HTTP e SMS podem levar dezenas de segundos sem atrasar o corte do pulso.
- **Fail-secure:** na partida os solenoides vão para LOW antes de tudo; reinício, queda de energia, erro de rede ou resposta inválida **nunca** destravam. Corte do pulso: no máximo 5 s, com checagem redundante no `loop()`.
- **Pulso:** 3 s (`T_PULSO_MS`, máx. 5 s), intervalo mínimo de 10 s, no máximo 3 por minuto, só se a trava estiver confirmada TRAVADA e VBAT ≥ 20 V (24 V) / ≥ 10,5 V (12 V).

## Como a placa conversa com o backend

| Quando | Chamada | Guia |
|---|---|---|
| A cada 3 s | `GET /api/fueling/sessions/:truckId/active` (`unlock:true` + `session_id` → pulso) | 4.1 |
| Pulso termina / trava muda / violação | `POST /api/fleet/:id/lock-state` | 4.8 |
| Violação | `POST /api/fleet/:id/security-events` (`tamper`, crítico) + SMS + LoRa | 4.6 |
| Cobertura fechada após abastecer | `POST /api/fueling/sessions/:id/finish` (corpo `{}`, ver limitação 1) | 4.3 |
| A cada 30 s com fix GPS | `POST /api/fleet/:id/telemetry` | 4.5 |
| A cada 60 s se há linhas novas no SD | `POST /api/fleet/:id/audit-import` (CSV, idempotente) | 4.9 |

Eventos críticos (violação, estado após pulso, finish, SMS) são reenviados com backoff até conseguirem (4 slots).
O CSV do SD usa o formato `data;lat;lng;evento;resultado;seq`; o `seq` é persistido na NVS e o offset já enviado também, então reiniciar a placa não reenvia nem duplica.

## Destravar sem internet (LoRa e Wi-Fi local)

Token: `mac = HMAC-SHA256(chave, "UNLOCK:<truck_id>:<session_id>:<exp>")` em hex minúsculo (`exp` = epoch UTC em segundos).

- **LoRa:** `UNLOCK|<session_id>|<exp>|<mac>` → resposta `ACK|<truck>|UNLOCK` ou `NAK|<truck>|<motivo>`.
- **Wi-Fi local:** `POST http://192.168.4.1/unlock` com `session`, `exp`, `mac`. `GET /status` é somente leitura.
- Recusado se: relógio inválido, token expirado, validade > 15 min, `session_id` ≤ última sessão destravada (anti-replay, persistida), MAC incorreto. 5 falhas seguidas bloqueiam 5 min.
- **Quem gera o token:** o backend ainda **não** gera esse token (a chave HMAC não existe no servidor). Isso é o item 4 do plano (modo offline no app). Até lá, só o caminho "backend via GPRS" destrava; LoRa/Wi-Fi só funcionam com token gerado manualmente (ver `scripts` abaixo).

Gerar um token de teste (Node):

```js
const c = require('crypto');
const key = Buffer.from(process.env.HMAC_KEY_HEX, 'hex');
const exp = Math.floor(Date.now() / 1000) + 600;
const msg = `UNLOCK:${process.env.TRUCK_ID}:${process.env.SESSION}:${exp}`;
console.log(exp, c.createHmac('sha256', key).update(msg).digest('hex'));
```

## Configuração

1. Copie `config.example.h` para `config.h` (ignorado pelo git) e preencha. **Remova a linha `#define EHR_CONFIG_EXAMPLE`**; sem isso o build falha de propósito.
2. Chave de hardware: gere no painel (Frota → caminhão). Cada placa tem a sua.
3. `HMAC_KEY_HEX` zerada ou inválida desabilita LoRa/Wi-Fi unlock (a placa avisa na serial).

## Build

Alvo: **ESP32 Dev Module**, core `esp32:esp32@2.0.17` (compila também no core 3.x por causa do shim do watchdog; só 2.0.17 foi testado). Biblioteca: `LoRa` (Sandeep Mistry).

```
arduino-cli compile --fqbn esp32:esp32:esp32 hardware/TravaEHR_R4
```

## O que NÃO está implementado (honestidade)

1. **Sem medição de volume.** A R4 não tem sensor de nível nem vazão. O `finish` vai sem `level_after`, e o backend marca `data_source = "unverified"` e não calcula divergência. Enquanto não houver sensor, a detecção de furto por volume não funciona com hardware real. Há um ponto de extensão claro em `lockLogic()`.
2. **Sem SMS de entrada** (destravar por SMS) e sem sleep/wake por ignição (KL15/EXT0) nem leitura de KL15. O descritivo lista ambos; ficam para a etapa seguinte.
3. **Corte antecipado do pulso** quando os dois fins de curso indicam "aberta": o descritivo é ambíguo, então o pulso sempre dura `T_PULSO_MS`.
4. **Telemetria de VBAT** no backend: só vai no pacote LoRa; o backend não tem campo.
5. **SIM800L e TLS:** o módulo não suporta o TLS moderno dos servidores atuais. É preciso um endpoint HTTP (ou proxy/gateway) à frente da API, e não exponha a chave de hardware em HTTP aberto na internet: use VPN/APN privado ou migre para 4G (A7670SA, item 2 dos riscos do descritivo).
6. **2G:** a rede 2G está sendo desligada; confirme cobertura antes de contar com o GSM.

## Checklist de bancada (antes do caminhão)

- [ ] Fase 4: ligar e desligar 20 vezes, solenoides não estalam no boot.
- [ ] Serial mostra `[BOOT] ... v2.1`, `[SD] ok`, `[LORA] ok`, modem "registrado".
- [ ] Fim de curso: acionar SW1/SW2 e balançar o cabo, sem troca falsa (estado só muda após 60 ms estáveis).
- [ ] Confirmar a lógica do sensor: **LOW = lingueta estendida (travada)**. Se o seu microswitch for o inverso, inverta em `scanOne()`.
- [ ] Pulso: SOL1 e SOL2 por 3 s, corrente medida, V_SOL ≥ 11,5 V, temperatura da bobina tolerável; 10 ciclos.
- [ ] Recusa por limite: dois pedidos em < 10 s → o segundo é recusado no log.
- [ ] Violação: abrir a tampa sem sessão → buzzer, `tamper` crítico no painel, SMS recebido, linha no `/ehr_events.log`.
- [ ] Abastecimento ponta a ponta: app autoriza → placa destrava (≤ 6 s) → abrir, fechar → `finish` → sessão `completed`.
- [ ] Offline: desligar o GSM, destravar e travar; religar → `audit-import` envia e o painel mostra sem duplicar.
- [ ] Reiniciar a placa no meio de uma sessão → **não** repulsa a mesma sessão.
- [ ] `AT+HTTPPARA="USERDATA"`: confirmar que o cabeçalho `x-api-key` chega ao servidor (a sequência `\r\n` literal varia por firmware do SIM800L).
- [ ] SD + LoRa juntos por 1000 ciclos (fase 9, errata A18).
