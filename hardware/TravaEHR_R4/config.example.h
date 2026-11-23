// Copie este arquivo para config.h (que NÃO vai para o git) e preencha com os valores reais.
// Cada placa/caminhão tem os seus próprios segredos. Nunca reutilize a chave de outro caminhão.
#pragma once

// Remova esta linha no config.h real. Ela existe para o build falhar se você esquecer de preencher.
#define EHR_CONFIG_EXAMPLE

// ---- Identidade ----
#define TRUCK_ID            1                     // id do caminhão no painel (Frota)
#define API_KEY             "COLE_A_CHAVE_DE_HARDWARE_GERADA_NO_PAINEL"

// ---- Servidor (HTTP via GPRS do SIM800L) ----
// O SIM800L NÃO fala TLS moderno. Use um endpoint HTTP (ou um proxy/gateway) em frente à API.
#define API_HOST            "api.exemplo.com.br"
#define API_PORT            80
#define API_USE_TLS         0                     // 1 só se o seu módulo/firmware GSM suportar o TLS do servidor

// ---- Operadora (chip 2G) ----
#define GPRS_APN            "APN_DA_OPERADORA"
#define GPRS_USER           ""
#define GPRS_PASS           ""
#define SMS_ALERT_NUMBER    "+55DDDNUMERO"        // central que recebe os alertas

// ---- Wi-Fi local (somente manutenção/contingência) ----
#define WIFI_AP_SSID        "TRAVA-EHR-01"
#define WIFI_AP_PASS        "TROQUE-POR-SENHA-FORTE"   // mínimo 8 caracteres, única por placa

// ---- Autenticação de comandos de destravar (LoRa e Wi-Fi) ----
// 64 caracteres hexadecimais (32 bytes). Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#define HMAC_KEY_HEX        "0000000000000000000000000000000000000000000000000000000000000000"

// ---- Ajustes ----
#define T_PULSO_MS          3000                  // duração do pulso nos solenoides (máx. absoluto 5000)
#define BENCH_MODE          0                     // 1 = ignora a leitura de VBAT (SÓ para bancada sem divisor de tensão)
