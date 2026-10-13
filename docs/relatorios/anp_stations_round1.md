# Relatório de Implementação — Catálogo Nacional de Postos ANP (`feat/anp-stations` — Rodada 1)

## 1. PASSO 0 — Investigação da API Oficial da ANP e Controle de Branches

### 1.1 Hash anotado de `development` (inalterado)
```text
$ git ls-remote --heads origin development
e8d202be3f454c9cfae909b8bc5515a41a687860	refs/heads/development
```

### 1.2 Saída bruta da investigação (`https://revendedoresapi.anp.gov.br/v1/combustivel?uf=DF&numeropagina=1`)
```text
TOP_KEYS: [ 'status', 'title', 'succeeded', 'data', 'searchPageFilter' ]
status: 200
title: Dados Encontrados
succeeded: true
searchPageFilter: {
  "filtroPesquisa": "",
  "numeroPagina": 1,
  "tamanhoPagina": 5000,
  "totalRegistro": 392,
  "totalPagina": 1
}
data.length: 392
ITEM_KEYS: [
  'codigoSIMP',
  'autorizacao',
  'dataPublicacao',
  'razaoSocial',
  'cnpj',
  'endereco',
  'complemento',
  'bairro',
  'cep',
  'uf',
  'municipio',
  'distribuidora',
  'dataVinculacao',
  'classe',
  'produtos',
  'latitude',
  'longitude',
  'latitude_ANP4C',
  'longitude_ANP4C',
  'validacao',
  'estimativaAcuracia',
  'srid',
  'src',
  'dataObtencao',
  'origemInformacao',
  'situacaoConstatada',
  'observacao',
  'statusSIGAF',
  'inadimplenciaPMQC'
]
SAMPLE_ITEM_0: {
  "codigoSIMP": 1000249,
  "autorizacao": "565",
  "dataPublicacao": "05/12/2003",
  "razaoSocial": "CASCOL COMBUSTIVEIS PARA VEICULOS LTDA",
  "cnpj": "00306597003112",
  "endereco": "QI 11 LOTE 01",
  "complemento": "LOJA A",
  "bairro": "LAGO SUL",
  "cep": "71625175",
  "uf": "DF",
  "municipio": "BRASILIA",
  "distribuidora": "VIBRA",
  "dataVinculacao": "23/08/2023",
  "classe": "Revendedor Varejista de Combustíveis Automotivos",
  "produtos": [
    {
      "produto": "ETANOL HIDRATADO COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 6
    },
    {
      "produto": "GASOLINA C ADITIVADA",
      "tancagem": 60,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 12
    },
    {
      "produto": "GASOLINA C COMUM",
      "tancagem": 60,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 12
    },
    {
      "produto": "OLEO DIESEL B S10 - COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 4
    }
  ],
  "latitude": "-15.8399235",
  "longitude": "-47.8758677",
  "latitude_ANP4C": "-15.8399",
  "longitude_ANP4C": "-47.8759",
  "validacao": "ANP4C",
  "estimativaAcuracia": "4",
  "srid": 4326,
  "src": "WGS 84",
  "dataObtencao": "18/05/2018 00:00:00",
  "origemInformacao": "ANP",
  "situacaoConstatada": "",
  "observacao": "",
  "statusSIGAF": "",
  "inadimplenciaPMQC": []
}
SAMPLE_ITEM_SEM_COORD: {
  "codigoSIMP": 1152490,
  "autorizacao": "678",
  "dataPublicacao": "05/10/2022",
  "razaoSocial": "AC2 COMBUSTIVEIS LTDA",
  "cnpj": "48386351000109",
  "endereco": "QUADRA QNM 34 AREA ESPECIAL 1",
  "complemento": "S/N",
  "bairro": "TAGUATINGA NORTE (TAGUATINGA)",
  "cep": "72145450",
  "uf": "DF",
  "municipio": "BRASILIA",
  "distribuidora": "BANDEIRA BRANCA",
  "dataVinculacao": "05/10/2022",
  "classe": "Revendedor Varejista de Combustíveis Automotivos",
  "produtos": [
    {
      "produto": "ETANOL HIDRATADO COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 8
    },
    {
      "produto": "GASOLINA C ADITIVADA",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 8
    },
    {
      "produto": "GASOLINA C COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 8
    },
    {
      "produto": "OLEO DIESEL B S10 - COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 4
    }
  ],
  "latitude": "",
  "longitude": "",
  "latitude_ANP4C": "",
  "longitude_ANP4C": "",
  "validacao": "",
  "estimativaAcuracia": "",
  "srid": null,
  "src": "",
  "dataObtencao": "",
  "origemInformacao": "",
  "situacaoConstatada": "",
  "observacao": "",
  "statusSIGAF": "",
  "inadimplenciaPMQC": []
}
```

---

## 2. Tabela de Rastreabilidade (`A1..E3`)

| Item | Arquivo:Linha | Prova | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | `backend/src/migrations/014_anp_stations.sql:1-46` | Migration idempotente (`CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`) criando `anp_stations` (`cnpj CHAR(14) UNIQUE NOT NULL`, `codigo_simp`, `autorizacao`, `data_publicacao`, `razao_social`, `endereco`, `complemento`, `bairro`, `cep CHAR(8)`, `uf CHAR(2)`, `municipio`, `bandeira`, `data_vinculacao`, `lat/lng NUMERIC(10,7) NULL`, `acuracia_metros`, `situacao_sigaf`, `produtos JSONB NULL`, `is_active`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at`) e `anp_sync_runs` + 4 índices (`(uf, municipio)`, `(bandeira)`, parcial `(lat, lng) WHERE lat IS NOT NULL`, `(is_active)`). | Concluído | Nenhum |
| **B1** | `backend/src/services/anpSync.js:11-21`, `backend/src/services/anpSync.js:158-206`, `backend/scripts/anpSync.js:1-60`, `backend/package.json:10` | Serviço + CLI + script `"anp:sync"` (`--uf XX` ou percorre as 27 UFs uma de cada vez). Variável `ANP_API_BASE` (padrão `https://revendedoresapi.anp.gov.br/v1`), paginação até `totalPagina`, timeout 30 s (`AbortSignal.timeout`), 3 tentativas com backoff crescente, espera de 1 s entre páginas e `User-Agent: EHR-Solutions-Fleet-Monitor/1.0 (ANP-Catalog-Sync)`. | Concluído | Nenhum |
| **B2** | `backend/src/services/anpSync.js:23-139` | Normalização fiel à resposta da API da ANP: `normalizeCnpj` (14 dígitos numéricos), `normalizeCep` (8 dígitos com zero à esquerda via `padStart(8, '0')`), `normalizeCoordinates` (retorna `null` se vazio, `0/0` ou fora do bounding box do Brasil `lat [-33.80, 5.35]`, `lng [-74.05, -28.80]`), e `cleanText` com `trim()`. | Concluído | Nenhum |
| **B3** | `backend/src/services/anpSync.js:244-367` | Upsert por `cnpj` dentro de uma transação (`BEGIN`/`COMMIT`/`ROLLBACK`) dedicada por UF. Somente após buscar todas as páginas da UF sem erro é executado o `UPDATE anp_stations SET is_active = false` para os CNPJs da UF ausentes na rodada. Em falha parcial, executa `ROLLBACK` (sem desativar ninguém) e grava o resumo em `anp_sync_runs`. | Concluído | Nenhum |
| **B4** | `backend/.env.example:21-23`, `README.md:53-70` | Variável `ANP_API_BASE` documentada em `backend/.env.example` e instruções de sincronização (`npm run anp:sync` e `npm run anp:sync -- --uf DF`) no `README.md`. | Concluído | Nenhum |
| **C1** | `backend/src/controllers/anpController.js:39-145`, `backend/src/routes/anp.js:8`, `backend/src/index.js:126` | `GET /api/anp/stations` protegido por `authMiddleware` (rejeita 401 sem token e 403 para motorista; permite gestor/admin/auditor). Filtros `uf`, `municipio`, `bandeira`, `q`, `is_active`, `has_geo`, paginação `page` e `limit` (máx 100), escape de `%`, `_` e `\` com `ESCAPE '\'` no `ILIKE`, ordenação estável `ORDER BY razao_social ASC, cnpj ASC`, retorno `{ items, page, limit, total }`. | Concluído | Nenhum |
| **C2** | `backend/src/controllers/anpController.js:147-185`, `backend/src/routes/anp.js:9` | `GET /api/anp/stations/summary` retornando `total_active`, `by_uf` / `totals_by_uf`, `total_without_coordinates` e `last_sync_at`. | Concluído | Nenhum |
| **C3** | `backend/src/controllers/anpController.js:187-272`, `backend/src/routes/anp.js:10` | `GET /api/anp/stations/in-bounds?minLat&minLng&maxLat&maxLng` validando limites numéricos, filtrando postos ativos com coordenadas no retângulo, limitando a no máximo 500 itens e retornando `truncated: true` quando há mais de 500. | Concluído | Nenhum |
| **C4** | `backend/src/controllers/anpController.js:274-297`, `backend/src/routes/anp.js:11` | `GET /api/anp/stations/:cnpj` validando exatamente 14 dígitos numéricos (`400 { "error": "cnpj inválido" }`) e retornando `404 { "error": "Posto não encontrado" }` quando ausente. | Concluído | Nenhum |
| **C5** | `backend/src/controllers/anpController.js:3-29` | Lista explícita `ALLOWED_STATION_COLUMNS` e serializador `formatStationRow` devolvendo exclusivamente: `cnpj, razao_social, endereco, bairro, cep, uf, municipio, bandeira, lat, lng, acuracia_metros, situacao_sigaf, produtos, is_active, last_seen_at`. | Concluído | Nenhum |
| **D1** | `frontend/src/pages/StationsPage.jsx:70-1056` | Aba `"Rede Autorizada"` preservada intacta e nova aba `"ANP (Brasil)"` com filtros (UF, município, bandeira, busca por nome/CNPJ), tabela paginada, badges (`"Regular"`, `"Interditado"`, `"Sem coordenadas"`), gaveta lateral de detalhes com `produtos` (tancagem/bicos), cabeçalho `"N postos ativos • atualizado em <data>"` e estado vazio `"rode npm run anp:sync"`. | Concluído | Nenhum |
| **D2** | `frontend/src/components/AnpStationsMap.jsx:1-147` | Mapa por região em Leaflet consumindo `in-bounds` conforme a área visível (`moveend`/`zoomend`), sem biblioteca nova de cluster, exibindo banner `"aproxime o zoom"` quando `truncated: true`. | Concluído | Nenhum |
| **E1** | `backend/tests/anp_stations.test.js:1-566`, `backend/tests/fixtures/anp_combustivel_sample.json:1-285` | 13 testes automatizados (sem rede real) cobrindo parser com fixture real, normalização, retry, upsert idempotente, desativação de ausentes, rollback em falha parcial de paginação, autorização (401/403/200), filtros, teto `limit=100`, escape de `%` e `_`, SQL injection em `q`, `summary`, `:cnpj` (400/404/200), lista permitida (C5) e `in-bounds` (`truncated: true`). | Concluído | Nenhum |
| **E2** | `frontend/src/StationsPage.test.jsx:1-278` | 3 testes em Vitest cobrindo renderização da aba ANP (linhas, badges, cabeçalho, aviso `truncated` e gaveta de detalhes), filtros chamando `/anp/stations` e estado vazio `"rode npm run anp:sync"`. | Concluído | Nenhum |
| **E3** | `README.md:53-70`, `backend/.env.example:21-23`, `docs/relatorios/anp_stations_round1.md:1-310` | Documentação atualizada e relatório completo com provas brutas. | Concluído | Nenhum |

---

## 3. Saídas Brutas de Verificação

### 3.1 `node --check` nos arquivos `.js` alterados
```text
$ node --check src/index.js ; node --check src/services/anpSync.js ; node --check src/controllers/anpController.js ; node --check src/routes/anp.js ; node --check scripts/anpSync.js ; node --check tests/anp_stations.test.js ; echo "NODE_CHECK_EXIT=$LASTEXITCODE"
NODE_CHECK_EXIT=0
```

### 3.2 `DROP DATABASE IF EXISTS ehr_fleet_test` + `npm test` do Backend (2 execuções seguidas)

**Execução 1 (após `DROP DATABASE IF EXISTS ehr_fleet_test`):**
```text
DROP DATABASE IF EXISTS ehr_fleet_test executed.

> ehr-fleet-backend@1.0.0 test
> jest --detectOpenHandles --forceExit --runInBand

Database ehr_fleet_test created.
Running migrations on ehr_fleet_test...
[Migrations] Executing 001_initial_schema.sql ... 014_anp_stations.sql
[Migrations] 014_anp_stations.sql executed successfully.
Migrations completed on test DB.
PASS tests/api_contract.test.js
PASS tests/anp_stations.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/alerts_lifecycle.test.js
PASS tests/facial.test.js
PASS tests/anomaly.test.js
PASS tests/telemetry.test.js
PASS tests/roles.test.js
PASS tests/audit_fixes.test.js
PASS tests/driver_actions.test.js
PASS tests/migrations.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/jwtValidator.test.js

Test Suites: 15 passed, 15 total
Tests:       201 passed, 201 total
Snapshots:   0 total
Time:        16.95 s
Ran all test suites.
```

**Execução 2 (consecutiva):**
```text
> ehr-fleet-backend@1.0.0 test
> jest --detectOpenHandles --forceExit --runInBand

Running migrations on ehr_fleet_test...
[Migrations] Waiting for advisory lock...
[Migrations] Lock obtained.
[Migrations] Releasing advisory lock.
Migrations completed on test DB.
PASS tests/anp_stations.test.js
PASS tests/api_contract.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/facial.test.js
PASS tests/alerts_lifecycle.test.js
PASS tests/anomaly.test.js
PASS tests/roles.test.js
PASS tests/telemetry.test.js
PASS tests/audit_fixes.test.js
PASS tests/migrations.test.js
PASS tests/manager_override.test.js
PASS tests/driver_actions.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/jwtValidator.test.js

Test Suites: 15 passed, 15 total
Tests:       201 passed, 201 total
Snapshots:   0 total
Time:        12.715 s, estimated 17 s
Ran all test suites.
```

### 3.3 `npm test` e `npm run build` do Frontend
```text
> ehr-solutions-fleet-frontend@0.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (1 test) 149ms
 ✓ src/DriverModal.test.jsx (2 tests) 432ms
 ✓ src/StationsPage.test.jsx (3 tests) 492ms
 ✓ src/Roles.test.jsx (7 tests) 250ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 228ms
 ✓ src/DriversPage.test.jsx (3 tests) 363ms
 ✓ src/App.test.jsx (1 test) 36ms

 Test Files  7 passed (7)
      Tests  18 passed (18)
   Start at  00:50:05
   Duration  27.41s
```

```text
> ehr-solutions-fleet-frontend@0.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 2569 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.22 kB │ gzip:   0.66 kB
dist/assets/index-39j02iYT.css     27.35 kB │ gzip:   9.50 kB
dist/assets/index-DRSaACGl.js   1,031.92 kB │ gzip: 299.48 kB
✓ built in 8.51s
```

### 3.4 Sincronização Manual Real de 1 UF (`npm run anp:sync -- --uf DF`)
```text
$ npm run anp:sync -- --uf DF

> ehr-fleet-backend@1.0.0 anp:sync
> node scripts/anpSync.js --uf DF

[Migrations] Waiting for advisory lock...
[Migrations] Lock obtained.
[Migrations] Executing 014_anp_stations.sql...
[Migrations] 014_anp_stations.sql executed successfully.
[Migrations] Releasing advisory lock.
[ANP-SYNC] Iniciando sincronização da UF=DF...
[ANP-SYNC] Concluído UF=DF: status=succeeded, fetched=392, inserted=392, updated=0, deactivated=0
```

**Linha gravada em `anp_sync_runs` e 3 postos do DF:**
```json
=== anp_sync_runs ===
{
  "id": 1,
  "started_at": "2026-10-13T03:50:25.821Z",
  "finished_at": "2026-10-13T03:50:26.557Z",
  "scope": "DF",
  "status": "succeeded",
  "fetched": 392,
  "inserted": 392,
  "updated": 0,
  "deactivated": 0,
  "error": null
}
=== 3 postos do DF ===
[
  {
    "cnpj": "10668863000195",
    "razao_social": "ABRITTA POSTOS DE SERVICOS LTDA",
    "endereco": "QUADRA ADE CONJUNTO 05 LOTE,  28",
    "bairro": "AGUAS CLARAS",
    "cep": "71987180",
    "uf": "DF",
    "municipio": "BRASILIA",
    "bandeira": "RAIZEN",
    "lat": "-15.8763287",
    "lng": "-48.0202286",
    "acuracia_metros": "4.00",
    "situacao_sigaf": null,
    "is_active": true
  },
  {
    "cnpj": "00480025000130",
    "razao_social": "ARCO IRIS PETROLEO COMERCIO E SERVICOS LTDA",
    "endereco": "QUADRA 11 CONJUNTO F LOTE 32,  S/N",
    "bairro": "SAO SEBASTIAO",
    "cep": "71691001",
    "uf": "DF",
    "municipio": "BRASILIA",
    "bandeira": "RAIZEN",
    "lat": "-15.8977915",
    "lng": "-47.7827541",
    "acuracia_metros": "4.00",
    "situacao_sigaf": null,
    "is_active": true
  },
  {
    "cnpj": "05849569000140",
    "razao_social": "AUTO POSTO 109 NORTE LTDA",
    "endereco": "SHC / NORTE SQ 109,  S/N",
    "bairro": "ASA NORTE",
    "cep": "70752500",
    "uf": "DF",
    "municipio": "BRASILIA",
    "bandeira": "RAIZEN",
    "lat": "-15.7609053",
    "lng": "-47.8850615",
    "acuracia_metros": "4.00",
    "situacao_sigaf": null,
    "is_active": true
  }
]
```

### 3.5 Greps Negativos (`RETURNING *` / `SELECT *`)
Nos arquivos novos da sincronização e do controller ANP:
```text
$ git grep -n "RETURNING \*\|SELECT \*" -- backend/src/services/anpSync.js backend/src/controllers/anpController.js
(vazio — 0 ocorrências)
```
> Nota: No diretório `backend/src/controllers` como um todo, existem ocorrências legadas em controllers antigos (`alertsController.js`, `authController.js`, `fleetController.js`, `fuelingController.js`, `settingsController.js`, `stationsController.js`, `usersController.js`) que não foram alterados nesta rodada em respeito à regra de escopo (*"NÃO altere fuel_stations, fueling_sessions, fueling_logs, alertas nem o simulador nesta rodada"*).
