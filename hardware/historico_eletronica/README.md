# Histórico Eletrônico e Firmware Legado - Trava EHR (v1.0 / v2.0)

Arquivos históricos de firmware, esquema elétrico e aplicativo móvel de teste enviados pelo diretor de hardware Rafael (`PROTOTIPO ALFA/ELETRONICA`):

| Arquivo / Diretório | Versão / Data | Descrição Técnica |
|---|---|---|
| `esquema_trava_ehr.pdf` | v1.0 (25/09/2026) | Esquema elétrico preliminar com 2x drivers TB6612FNG, 3 motores DC TT e 6 fins de curso (auditado e evoluído para o R4) |
| `TravaEHR_ESP32/TravaEHR_ESP32.ino` | Firmware v1.1 | Código do ESP32 para controle dos 3 motores DC, AP Wi-Fi local (192.168.4.1) e rotas HTTP `/status`, `/travar` e `/destravar` |
| `TravaEHR_ESP32_LoRa_Telemetria/` | Firmware v2.0 | Versão com rádio LoRa 915MHz SX1276, GPS NEO-6M, GSM SIM800L, RTC DS3231 e MicroSD |
| `TravaEHR.apk` | App v1.0 | APK Android compilado para acionamento direto dos comandos de bancada |
| `TravaEHR_app_fonte.zip` | Código-fonte Java | Projeto Android Studio nativo com `MainActivity.java` (botões TRAVAR/DESTRAVAR com envio de `pin=1234`) |

### Sucessão e Compatibilidade no Projeto Atual:
1. **Firmware Definitivo:** O código oficial de produção está em [`hardware/TravaEHR_R4/TravaEHR_R4.ino`](../TravaEHR_R4/TravaEHR_R4.ino) (Revisão R4 / v2.1), que implementou os solenoides duplos 12V, supervisor ADC de bateria (VBAT/KL15), watchdog de hardware e token criptográfico HMAC.
2. **Aplicativo Mobile:** O app em React Native (`mobile/`) suporta tanto o token HMAC seguro da R4 quanto retrocompatibilidade com o comando `/destravar?pin=1234` em [`localLockClient.ts`](../../mobile/src/services/hardware/localLockClient.ts).
