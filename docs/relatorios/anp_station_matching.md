# Relatório Técnico — Casamento Automático de Postos ANP e Ajuste Gentil de Sync (HTTP 429)

- **Branch**: `feat/anp-station-matching` (criada a partir da `main` `3d524be`)
- **Hash intacto de `origin/development`**: `e8d202be3f454c9cfae909b8bc5515a41a687860`
- **Escopo**: `/backend`, `/frontend`, `README.md`, `backend/.env.example`, `docs/relatorios/anp_station_matching.md` (`git diff origin/main -- mobile/ docs/API_MOBILE.md` vazio).

## 1. Matriz de Requisitos (Requisito | Arquivo:Linha | Evidência)

| Requisito | Arquivo:Linha | Evidência |
| :--- | :--- | :--- |
| **A1** Migration 015 idempotente em `fueling_sessions` e `fueling_logs` (`anp_station_id`, `station_match_status`, `station_match_distance_m`, `station_match_source`) | `backend/src/migrations/015_anp_station_matching.sql:4-63` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` e `DO $$ BEGIN IF NOT EXISTS (...) ADD CONSTRAINT` com `CHECK (station_match_status IN ('matched','unrecognized','no_position'))` e `CHECK (station_match_source IN ('truck_telemetry','app_gps'))`. |
| **A2** Índice em `fueling_logs(anp_station_id)` | `backend/src/migrations/015_anp_station_matching.sql:65-66` | `CREATE INDEX IF NOT EXISTS idx_fueling_logs_anp_station_id ON fueling_logs (anp_station_id);` |
| **B1** Serviço `stationMatcher.js` (`resolveStation({ lat, lng, cnpj, radiusM })`) | `backend/src/services/stationMatcher.js:104-180` | Valida CNPJ 14 dígitos, valida coordenadas no globo (`\|lat\| <= 90`, `\|lng\| <= 180`, rejeita `(0,0)`), aplica bounding box (`lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4`) em `anp_stations WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL`, calcula Haversine exato e retorna `{ status, station, distanceM }` com lista explícita de colunas. |
| **B2** `STATION_MATCH_RADIUS_M` validado no boot (default `150`, aceito `30..1000`, erro fatal fora do intervalo) e documentado | `backend/src/services/stationMatcher.js:29-41`, `backend/src/index.js:19`, `backend/.env.example:41-42`, `README.md:29` | `validateStationMatchRadius()` lança erro fatal no boot caso inválido; documentado em `.env.example` e `README.md`. |
| **C1** Resolver posto ANP em `authorizeSession` (sem bloquear autorização) | `backend/src/controllers/fuelingController.js:242-269` | Prioriza `req.body.lat/lng` (`source = 'app_gps'`) sobre `truck.lat/lng` (`source = 'truck_telemetry'`), grava `anp_station_id`, `station_match_status`, `station_match_distance_m` e `station_match_source` em `fueling_sessions` dentro de `try/catch` não-bloqueante. `SESSION_PUBLIC_COLS` (`fuelingController.js:10-17`) omite colunas ANP para preservar 100% do contrato mobile/hardware. |
| **C2** Copiar campos em `finishSession` e `virtualHardware.js` + alertas ANP em `anomalyDetector.js` | `backend/src/controllers/fuelingController.js:353-396`, `backend/src/services/virtualHardware.js:48-84`, `backend/src/services/anomalyDetector.js:163-251` | Copia os 4 campos da sessão para `fueling_logs`. Quando `data_source != 'simulated'`: `unrecognized` cria alerta `'unrecognized_station'` (`severity = 'high'`, dedup 2h por caminhão); `matched` com `interdicted = true` cria `'unauthorized_station'` (`severity = 'critical'`, dedup 2h); `no_position` e `simulated` criam zero alertas. |
| **C3** Resolver posto ANP diretamente no `simulator.js` (`data_source = 'simulated'`) | `backend/src/services/simulator.js:136-160` | Resolve via `stationMatcher.resolveStation` com `source = 'truck_telemetry'` (em `try/catch`) e grava em `fueling_logs` mantendo `data_source = 'simulated'`. |
| **C4** `LEFT JOIN anp_stations` e objeto `station_match` nas consultas do painel (`GET /api/fueling`, `getTruckTelemetry`, `getInvestigation`) | `backend/src/services/fuelingQuery.js:4-85`, `backend/src/services/fleetDataProvider.js:94-158`, `backend/src/controllers/fleetController.js:215-235` | `formatFuelingLogRow` expõe `station_match: { status, distance_m, station: { cnpj, razao_social, municipio, uf, bandeira } }` apenas nas rotas do painel web; sockets e rotas de driver/hardware continuam sem campos ANP. |
| **D1** Rótulo e ícone para `'unrecognized_station'` | `frontend/src/utils/alertMapping.js:17-18` | Retorna `{ label: 'Posto não reconhecido (ANP)', icon: ShieldAlert }`. |
| **D2** Coluna/linha `"Posto (ANP)"` em `FuelingTable.jsx` e `TruckDetailsPage.jsx` | `frontend/src/components/FuelingTable.jsx:18-92,110,151`, `frontend/src/pages/TruckDetailsPage.jsx:8,392-397` | Renderiza badges `"ANP regular · a N m"`, `"Não reconhecido"` e `"Sem posição"`, exibe `razao_social` e `municipio/uf` quando disponíveis e tolera logs legados sem `station_match`. |
| **E1..E4** Testes automatizados (unitários, integração, contrato/leak e Vitest) | `backend/tests/anp_station_matching.test.js:1-665`, `backend/tests/leak_recursive.test.js:68-188`, `frontend/src/FuelingTable.test.jsx:1-130` | Cobrem todos os cenários de `stationMatcher`, fluxo de sessão/logs/alertas/simuladores, contrato idêntico de driver/hardware, ausência de vazamento em sockets e renderização em `FuelingTable`. |
| **E5** Mock de `global.fetch` em testes (OSRM offline) | `backend/tests/anp_station_matching.test.js:23-57` | `jest.spyOn(global, 'fetch')` simula rota OSRM mínima válida no `beforeAll` e restaura no `afterAll`, garantindo `simulateFleet` 100% offline sem chamadas reais a `router.project-osrm.org`. |
| **F1..F3** Ajuste gentil no sync ANP para HTTP 429/503 (`Retry-After`, backoff 5s/15s/45s, `ANP_UF_DELAY_MS` e reprocessamento final em `syncAll`) | `backend/src/services/anpSync.js:144-213,435-512`, `backend/tests/anp_stations.test.js:580-712`, `backend/.env.example:39-40`, `README.md:28` | Respeita `Retry-After` (teto 120s) ou espera 5s/15s/45s em 429/503; pausa `ANP_UF_DELAY_MS` (default 3000ms) entre UFs e tenta uma última vez ao final as UFs que falharam com 429 na 1ª passada. |

## 2. Evidências de Verificação (Saída Bruta)

### 2.1 EXPLAIN da consulta de Bounding Box em `anp_stations`
```text
Index Scan using idx_anp_stations_lat_lng on anp_stations  (cost=0.41..8.56 rows=1 width=309)
  Index Cond: ((lat >= '-15.7957802'::numeric) AND (lat <= '-15.7930532'::numeric) AND (lng IS NOT NULL) AND (lng >= '-48.0172829'::numeric) AND (lng <= '-48.0144489'::numeric))
  Filter: is_active
```

### 2.2 Greps Negativos e `node --check`
- `git grep -n "RETURNING \*"` nos arquivos alterados/criados: vazio (`exit code 1`).
- `git grep -n "SELECT s\.\*"` nos arquivos alterados/criados: vazio (`exit code 1`).
- `node --check` em todos os `.js` alterados/criados: `0` erros.

### 2.3 Resumo dos Testes (`DROP DATABASE IF EXISTS ehr_fleet_test` + 2x `npm test` Backend + Vitest + Build Frontend)
- **Backend Run 1 (banco recriado do zero)**: `Test Suites: 16 passed, 16 total` | `Tests: 221 passed, 221 total`
- **Backend Run 2 (idempotência)**: `Test Suites: 16 passed, 16 total` | `Tests: 221 passed, 221 total`
- **Frontend Vitest**: `Test Files: 7 passed (7)` | `Tests: 19 passed (19)`
- **Frontend Build (`npm run build`)**: `✓ built in 14.76s`
