# Relatório de Provisionamento de Chave do Hardware (`feat/hardware-key-provisioning`)

- **Data:** 18/10/2026
- **Branch de trabalho:** `feat/hardware-key-provisioning` (criada a partir de `origin/main` `a6538b5`)
- **Hash de `origin/development` (intocado):** `e8d202be3f454c9cfae909b8bc5515a41a687860`
- **Banco de teste verificado no Passo 0:** `PostgreSQL 18.4 on x86_64-windows` (`>= 11`, suporte nativo a `sha256(bytea)`).

---

## 1. Tabela de Conformidade (`A1..G1`)

| Item | `arquivo:linha` | Prova | Resultado | Não resolvido |
|---|---|---|---|---|
| **A1** | `backend/src/migrations/016_hardware_key_hash.sql:3-12` | `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS` para `api_key_hash CHAR(64) NULL`, `api_key_prefix VARCHAR(8) NULL`, `api_key_created_at TIMESTAMPTZ NULL`, `api_key_last_used_at TIMESTAMPTZ NULL` e índice único parcial `idx_trucks_api_key_hash_unique` (`WHERE api_key_hash IS NOT NULL`). Testado em `backend/tests/hardware_key_provisioning.test.js:46-119`. | Concluído (`EXIT=0`) | Nenhum |
| **A2** | `backend/src/migrations/016_hardware_key_hash.sql:14-31` | Função `trucks_hash_api_key_fn()` e trigger `trucks_hash_api_key_trg` (`BEFORE INSERT OR UPDATE OF api_key ON trucks`): quando `NEW.api_key IS NOT NULL`, grava `api_key_hash = encode(sha256(convert_to(NEW.api_key, 'UTF8')), 'hex')`, `api_key_prefix = left(NEW.api_key, 8)`, `api_key_created_at = NOW()` e zera `NEW.api_key := NULL`. Provado no teste de vetor `'abc'` (`hardware_key_provisioning.test.js:46-63`). | Concluído (`EXIT=0`) | Nenhum |
| **A3** | `backend/src/migrations/016_hardware_key_hash.sql:33-39` | Backfill idempotente (`UPDATE trucks SET api_key_hash = ..., api_key_prefix = ..., api_key_created_at = COALESCE(api_key_created_at, NOW()), api_key = NULL WHERE api_key IS NOT NULL`). Rodado duas vezes seguidas na Prova Final 2 e em `hardware_key_provisioning.test.js:65-119` sem erro nem alteração de `api_key_created_at`. | Concluído (`EXIT=0`) | Nenhum |
| **B1** | `backend/src/middleware/authHardware.js:4-40`<br>`backend/src/middleware/authAny.js:11-36` | Rejeita cabeçalho `x-api-key` com `> 200` caracteres (`401 {"error":"Invalid Hardware API Key"}`), calcula SHA-256 hex (UTF-8) via `crypto.createHash('sha256')` e consulta `WHERE api_key_hash = $1`. Teste `hardware_key_provisioning.test.js:46-63` prova igualdade entre Node e trigger para `'abc'` (`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`), e `:337-352` prova rejeição de `> 200` chars. | Concluído (`EXIT=0`) | Nenhum |
| **B2** | `backend/src/middleware/authHardware.js:23-31`<br>`backend/src/middleware/authAny.js:20-28` | `UPDATE trucks SET api_key_last_used_at = NOW() WHERE id = $1 AND (api_key_last_used_at IS NULL OR api_key_last_used_at < NOW() - INTERVAL '1 minute')` isolado em `try/catch` que registra erro sem derrubar a autenticação. Provado em `hardware_key_provisioning.test.js:283-335`. | Concluído (`EXIT=0`) | Nenhum |
| **C1** | `backend/src/routes/fleet.js:21`<br>`backend/src/controllers/fleetController.js:366-409` | `POST /api/fleet/:id/hardware-key` (`authMiddleware, requireRole` para `'admin','manager'`): gera 32 bytes aleatórios hex (`64` chars), atualiza `trucks.api_key` (convertido em hash pelo trigger), responde `201 { api_key, prefix, created_at }` uma única vez, invalida chave antiga na hora, registra `hardware_key_generated` (`severity: 'low'`, sem alerta, com `user_id` e `truck_id`, sem chave) e retorna `400 {"error":"id inválido"}` ou `404 {"error":"Caminhão não encontrado"}`. Provado em `hardware_key_provisioning.test.js:145-281` e `:375-391`. | Concluído (`EXIT=0`) | Nenhum |
| **C2** | `backend/src/routes/fleet.js:22`<br>`backend/src/controllers/fleetController.js:411-438` | `GET /api/fleet/:id/hardware-key`: retorna `200 { configured, prefix, created_at, last_used_at }` e nunca expõe `api_key` nem `api_key_hash`. Provado em `hardware_key_provisioning.test.js:146-214`. | Concluído (`EXIT=0`) | Nenhum |
| **C3** | `backend/src/routes/fleet.js:23`<br>`backend/src/controllers/fleetController.js:440-478` | `DELETE /api/fleet/:id/hardware-key`: zera `api_key`, `api_key_hash`, `api_key_prefix`, `api_key_created_at`, `api_key_last_used_at`; responde `200 { success: true }`; registra `hardware_key_revoked` (`severity: 'low'`, sem alerta). Chave antiga passa a responder `401`. Provado em `hardware_key_provisioning.test.js:240-281`. | Concluído (`EXIT=0`) | Nenhum |
| **C4** | `backend/src/routes/fleet.js:21-26`<br>`backend/src/middleware/auth.js:6-55` | Rotas declaradas antes de `/:id`. Auditor recebe `403 {"error":"forbidden_role"}`, motorista `403 {"error":"Acesso restrito ao gestor"}` e hardware sem Bearer `401 {"error":"Authorization token missing or invalid"}`. Provado em `hardware_key_provisioning.test.js:354-373`. | Concluído (`EXIT=0`) | Nenhum |
| **C5** | `backend/src/controllers/driversController.js:38-44`<br>`backend/src/controllers/fleetController.js:35-38`<br>`backend/src/services/fleetDataProvider.js:3-6` | Varredura de `SELECT *`, `t.*`, `trucks.*`, `RETURNING *` sobre `trucks`: substituído `json_agg(t.*)` em `driversController.js:40` por `json_build_object('id', t.id, 'plate', t.plate, 'model', t.model)`. Nenhuma consulta em `backend/src` faz `SELECT *`, `SELECT t.*`, `trucks.*` ou `RETURNING *` em `trucks`. Provado em `leak_recursive.test.js:134-393`. | Concluído (`EXIT=0`) | Nenhum |
| **D1** | `backend/src/seed/seed.js:7-9,70-74` | `seed.js` mantém recusa em `NODE_ENV=production` e cria `EHR-0001` com `DEV_API_KEY_001` (hasheada automaticamente pelo trigger). Provado em `hardware_key_provisioning.test.js:121-143`. | Concluído (`EXIT=0`) | Nenhum |
| **E1** | `frontend/src/pages/TruckDetailsPage.jsx:530-607`<br>`frontend/src/hooks/useFleet.js:29-48` | Cartão `"Chave do hardware"` oculto para `auditor` (`user?.role !== 'auditor'`). Exibe `"Nenhuma chave configurada"` + `"Gerar chave"` ou `"Chave ativa: <prefixo>… • criada em <data> • último uso <data ou 'nunca'>"` + `"Trocar chave"` e `"Revogar"`. Provado em `frontend/src/TruckDetailsPage.test.jsx:108-249`. | Concluído (`EXIT=0`) | Nenhum |
| **E2** | `frontend/src/pages/TruckDetailsPage.jsx:45-156,177-178,211-249,609-668,741-744` | `"Trocar chave"` e `"Revogar"` abrem confirmação `"A chave atual para de funcionar imediatamente e a placa precisará ser reconfigurada."`. Chave nova exibida uma única vez em `HardwareKeyModal` com botão `"Copiar"` e aviso `"Guarde agora; ela não será exibida de novo"`, mantida apenas no estado local `generatedKeyModalData` e apagada ao fechar. Provado em `frontend/src/TruckDetailsPage.test.jsx:127-231`. | Concluído (`EXIT=0`) | Nenhum |
| **E3** | `frontend/src/pages/TruckDetailsPage.jsx:174-194,536-540` | Estados de carregamento (`"Carregando status da chave..."`) e erro (`"Não foi possível carregar o status da chave."`). Provado em `frontend/src/TruckDetailsPage.test.jsx:90-125`. | Concluído (`EXIT=0`) | Nenhum |
| **F1** | `backend/tests/hardware_key_provisioning.test.js:1-393` | 8 testes cobrindo trigger + vetor `'abc'`, backfill idempotente, seed `DEV_API_KEY_001`, ciclo completo (`POST`/`GET`/`DELETE`), ausência da chave em todas as colunas textuais de `trucks`, rotação, revogação, eventos de segurança sem alerta/sem chave, throttling de `api_key_last_used_at` + isolamento de falha, limite de 200 caracteres e RBAC/validações (`400`/`403`/`404`). | Concluído (`EXIT=0`) | Nenhum |
| **F2** | `backend/tests/leak_recursive.test.js:15-131,163-393` | Varredura recursiva de chaves e valores (`HW_SECRET_PLAIN`, `HW_SECRET_HASH`, `HW_SECRET_PREFIX` e chave gerada por `POST /api/fleet/:id/hardware-key`) em `/api/fleet`, `/api/fleet/:id`, telemetria, investigação, `dashboard-stats`, `live-events`, sessões, histórico, `/api/fueling`, login do motorista e payloads de Socket.IO (`getFleetSnapshot`, `getLiveEvents`). | Concluído (`EXIT=0`) | Nenhum |
| **F3** | 11 arquivos de teste existentes que usam `api_key` (listados na Seção 2 abaixo) | Nenhum dos 11 arquivos existentes precisou de ajuste; todos continuam passando porque o trigger converte automaticamente `INSERT/UPDATE` de `api_key` em `api_key_hash`. | Concluído (`EXIT=0`) | Nenhum |
| **F4** | `frontend/src/TruckDetailsPage.test.jsx:1-250` | 5 testes Vitest cobrindo carregamento, erro de API, estado sem chave + geração e limpeza ao fechar modal, chave ativa + confirmação antes de trocar/revogar, e ocultação para `auditor`. `npm test` sai com `EXIT=0` e sem `"Errors"`. | Concluído (`EXIT=0`) | Nenhum |
| **G1** | `docs/GUIA_INTEGRACAO_HARDWARE.md:40-94,305-312` | Seção 2 atualizada com fluxo pelo painel, exibição única, armazenamento em hash SHA-256 via trigger, rotação/revogação e documentação de `POST/GET/DELETE /api/fleet/:id/hardware-key`; comando SQL manual removido; pendência 1 removida da Seção 10. | Concluído (`EXIT=0`) | Nenhum |

---

## 2. Detalhamento de C5 (Varredura de Vazamento) e F3 (11 Testes Existentes)

### C5 — Ocorrências verificadas em `backend/src`
1. `backend/src/controllers/driversController.js:40`: continha `COALESCE(json_agg(t.*) FILTER (WHERE t.id IS NOT NULL), '[]') AS assigned_trucks` em `exports.list`. **Ação:** substituído por `COALESCE(json_agg(json_build_object('id', t.id, 'plate', t.plate, 'model', t.model)) FILTER (WHERE t.id IS NOT NULL), '[]') AS assigned_trucks`.
2. `backend/src/controllers/fleetController.js`: já utilizava `SAFE_TRUCK_COLS` / `SAFE_TRUCK_COLS_T` (colunas explícitas sem `api_key`, `api_key_hash` ou `api_key_prefix`) em `list`, `getOne`, `create`, `update`, `configureRoute`, `getInvestigation`, `getDashboardStats`, `getLiveEvents`.
3. `backend/src/services/fleetDataProvider.js`: já utilizava `SAFE_TRUCK_COLS` em `getFleetSnapshot` e colunas explícitas em `getLiveEvents`.
4. `backend/src/controllers/authController.js:72`: `driverLogin` seleciona `SELECT t.id, t.plate, t.model, t.capacity_liters, t.current_level_liters, t.lat, t.lng, t.status, t.speed_kmh, t.fuel_station_id, t.sim_state FROM trucks t` (lista explícita permitida).

### F3 — Os 11 arquivos de teste existentes que usam `api_key`
1. `backend/tests/anp_station_matching.test.js` — Passou sem alteração.
2. `backend/tests/api_contract.test.js` — Passou sem alteração.
3. `backend/tests/ble.test.js` — Passou sem alteração.
4. `backend/tests/divergence.test.js` — Passou sem alteração.
5. `backend/tests/docs_drift.test.js` — Passou sem alteração.
6. `backend/tests/driver_fleet_hardening.test.js` — Passou sem alteração.
7. `backend/tests/driver_history.test.js` — Passou sem alteração.
8. `backend/tests/facial.test.js` — Passou sem alteração.
9. `backend/tests/hardening.test.js` — Passou sem alteração.
10. `backend/tests/leak_recursive.test.js` — Expandido conforme F2 para também testar `HW_SECRET_HASH`, `HW_SECRET_PREFIX` e a chave gerada por `POST /api/fleet/:id/hardware-key`.
11. `backend/tests/roles.test.js` — Passou sem alteração.

---

## 3. Buscas Negativas (Saída Bruta e Justificativas)

```text
=== BUSCA 1 ===
> git grep -n 'WHERE api_key = \|api_key = \$1' -- backend/src
EXIT=1

=== BUSCA 2 ===
> git grep -n 'RETURNING \*\|SELECT t\.\*\|trucks\.\*\|SELECT \* FROM trucks' -- backend/src
backend/src/controllers/alertsController.js:101:      RETURNING *
backend/src/controllers/alertsController.js:141:       RETURNING *`,
backend/src/controllers/stationsController.js:27:      "INSERT INTO fuel_stations (name, brand, address, lat, lng, is_authorized, source) VALUES ($1,$2,$3,$4,$5,$6,'manual') RETURNING *",
backend/src/controllers/stationsController.js:41:      "UPDATE fuel_stations SET name=$1, brand=$2, address=$3, lat=$4, lng=$5, is_authorized=$6 WHERE id=$7 RETURNING *",
backend/src/controllers/stationsController.js:54:      "UPDATE fuel_stations SET is_authorized = NOT is_authorized WHERE id = $1 RETURNING *",
backend/src/controllers/usersController.js:30:        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
backend/src/controllers/usersController.js:97:      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
backend/src/controllers/usersController.js:130:    const { rows } = await db.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *', [hash, id]);
backend/src/services/fuelRules.js:105:          RETURNING *
EXIT=0

=== BUSCA 3 ===
> git grep -n "api_key" -- frontend/src ':!*.test.*'
frontend/src/hooks/useFleet.js:39:      api_key: res.data.api_key,
frontend/src/pages/TruckDetailsPage.jsx:47:  if (!generatedData || !generatedData.api_key) return null;
frontend/src/pages/TruckDetailsPage.jsx:49:  const rawKey = generatedData.api_key;
EXIT=0

=== BUSCA 4 ===
> git diff --name-only origin/main..HEAD -- mobile docs/API_MOBILE.md
EXIT=0
```

- **Justificativa da Busca 2:** Nenhuma das 9 linhas restantes toca na tabela `trucks` (`SELECT t.*`, `trucks.*` e `SELECT * FROM trucks` têm 0 ocorrências):
  - `alertsController.js:101,141` e `fuelRules.js:105`: `RETURNING *` na tabela `fleet_alerts` (não contém colunas de `trucks`).
  - `stationsController.js:27,41,54`: `RETURNING *` na tabela `fuel_stations` (não contém colunas de `trucks`).
  - `usersController.js:30,97,130`: `RETURNING *` na tabela `users`, filtrado imediatamente por `safeUser(rows[0])` antes de responder ao cliente.
- **Justificativa da Busca 3:**
  - `frontend/src/hooks/useFleet.js:39`: leitura do campo `res.data.api_key` retornado uma única vez por `POST /api/fleet/:id/hardware-key` em `generateHardwareKey`.
  - `frontend/src/pages/TruckDetailsPage.jsx:47,49`: leitura da propriedade `generatedData.api_key` exclusivamente dentro do componente modal de exibição única `HardwareKeyModal`, cujo estado local (`generatedKeyModalData`) é limpo (`null`) ao fechar a janela.

---

## 4. Provas Finais (Saída Bruta e Códigos de Saída)

### 4.1 Prova 1 — Backend: `node --check`, `DROP DATABASE`, `npm ci`, `npm test` (2x) e `Node 20 + CI=true`

```text
> node --check src/middleware/authHardware.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check src/middleware/authAny.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check src/routes/fleet.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check src/controllers/fleetController.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check src/controllers/driversController.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check src/seed/seed.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check tests/hardware_key_provisioning.test.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> node --check tests/leak_recursive.test.js; Write-Host "EXIT=$LASTEXITCODE"
EXIT=0
> DROP DATABASE IF EXISTS ehr_fleet_test WITH (FORCE)
Dropped ehr_fleet_test
EXIT=0

> npm ci; Write-Host "EXIT=$LASTEXITCODE"
added 696 packages, and audited 697 packages in 31s
EXIT=0
```

#### `npm test` — 1ª Execução Completa
```text
PASS tests/api_contract.test.js
PASS tests/leak_recursive.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/facial.test.js
PASS tests/anp_stations.test.js
PASS tests/anp_station_matching.test.js
PASS tests/roles.test.js
PASS tests/hardening.test.js
PASS tests/divergence.test.js
PASS tests/driver_history.test.js
PASS tests/hardware_key_provisioning.test.js
PASS tests/facial_extra.test.js
PASS tests/migrations.test.js
PASS tests/manager_override.test.js
PASS tests/driver_actions.test.js
PASS tests/docs_drift.test.js
PASS tests/ble.test.js
PASS tests/drivers_controller.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js
Test Suites: 20 passed, 20 total
Tests:       261 passed, 261 total
Snapshots:   0 total
Time:        18.292 s
Ran all test suites.
EXIT=0
```

#### `npm test` — 2ª Execução Completa
```text
PASS tests/api_contract.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/leak_recursive.test.js
PASS tests/facial.test.js
PASS tests/anp_stations.test.js
PASS tests/hardware_key_provisioning.test.js
PASS tests/anp_station_matching.test.js
PASS tests/roles.test.js
PASS tests/facial_extra.test.js
PASS tests/driver_history.test.js
PASS tests/hardening.test.js
PASS tests/divergence.test.js
PASS tests/migrations.test.js
PASS tests/driver_actions.test.js
PASS tests/manager_override.test.js
PASS tests/docs_drift.test.js
PASS tests/ble.test.js
PASS tests/drivers_controller.test.js
PASS tests/jwtValidator.test.js
PASS tests/simulator_state.test.js
Test Suites: 20 passed, 20 total
Tests:       261 passed, 261 total
Snapshots:   0 total
Time:        17.856 s, estimated 18 s
Ran all test suites.
EXIT=0
```

#### `npm test` — `Node 20 + CI=true`
```text
Node version: v20.20.2 CI: true
PASS tests/api_contract.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/leak_recursive.test.js
PASS tests/facial.test.js
PASS tests/anp_stations.test.js
PASS tests/anp_station_matching.test.js
PASS tests/hardware_key_provisioning.test.js
PASS tests/roles.test.js
PASS tests/driver_actions.test.js
PASS tests/hardening.test.js
PASS tests/facial_extra.test.js
PASS tests/driver_history.test.js
PASS tests/divergence.test.js
PASS tests/migrations.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/drivers_controller.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js
Test Suites: 20 passed, 20 total
Tests:       261 passed, 261 total
Snapshots:   0 total
Time:        18.991 s
Ran all test suites.
EXIT=0
```

---

### 4.2 Prova 2 — Migration 016 aplicada duas vezes seguidas sobre caminhões com `api_key` em texto puro

```text
BEFORE MIGRATION 016: [
  {
    "plate": "MIG-0001",
    "api_key": "DEV_API_KEY_001",
    "api_key_hash": null,
    "api_key_prefix": null,
    "api_key_created_at": null
  },
  {
    "plate": "MIG-0002",
    "api_key": "abc",
    "api_key_hash": null,
    "api_key_prefix": null,
    "api_key_created_at": null
  }
]
AFTER 1ST RUN OF 016: [
  {
    "plate": "MIG-0001",
    "api_key": null,
    "api_key_hash": "4e7ec9971f7f96479d0545846ac758087d427666996446b91a9c7b71716e3b7a",
    "api_key_prefix": "DEV_API_",
    "api_key_created_at": "2026-10-18T07:40:45.971Z"
  },
  {
    "plate": "MIG-0002",
    "api_key": null,
    "api_key_hash": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "api_key_prefix": "abc",
    "api_key_created_at": "2026-10-18T07:40:45.971Z"
  }
]
AFTER 2ND RUN OF 016: [
  {
    "plate": "MIG-0001",
    "api_key": null,
    "api_key_hash": "4e7ec9971f7f96479d0545846ac758087d427666996446b91a9c7b71716e3b7a",
    "api_key_prefix": "DEV_API_",
    "api_key_created_at": "2026-10-18T07:40:45.971Z"
  },
  {
    "plate": "MIG-0002",
    "api_key": null,
    "api_key_hash": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "api_key_prefix": "abc",
    "api_key_created_at": "2026-10-18T07:40:45.971Z"
  }
]
EXIT=0
```

---

### 4.3 Prova 3 — Frontend: `npm ci`, `npm test` (3x sem `"Errors"`), `Node 20 + CI=true` e `npm run build`

```text
> npm ci; Write-Host "EXIT=$LASTEXITCODE"
added 566 packages, and audited 567 packages in 58s
EXIT=0

=== FRONTEND TEST RUN 1 ===
 ✓ src/FuelingTable.test.jsx (2 tests) 206ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 489ms
 ✓ src/DriverModal.test.jsx (2 tests) 686ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 453ms
 ✓ src/Roles.test.jsx (7 tests) 622ms
 ✓ src/StationsPage.test.jsx (3 tests) 909ms
 ✓ src/DriversPage.test.jsx (3 tests) 535ms
 ✓ src/TruckDetailsPage.test.jsx (5 tests) 889ms
 ✓ src/DashboardPage.test.jsx (13 tests) 826ms
 ✓ src/App.test.jsx (1 test) 36ms

 Test Files  10 passed (10)
      Tests  39 passed (39)
   Start at  04:42:10
   Duration  6.53s
EXIT=0

=== FRONTEND TEST RUN 2 ===
 ✓ src/FuelingTable.test.jsx (2 tests) 206ms
 ✓ src/DriverModal.test.jsx (2 tests) 528ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 429ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 363ms
 ✓ src/StationsPage.test.jsx (3 tests) 740ms
 ✓ src/Roles.test.jsx (7 tests) 495ms
 ✓ src/DriversPage.test.jsx (3 tests) 458ms
 ✓ src/DashboardPage.test.jsx (13 tests) 708ms
 ✓ src/TruckDetailsPage.test.jsx (5 tests) 795ms
 ✓ src/App.test.jsx (1 test) 35ms

 Test Files  10 passed (10)
      Tests  39 passed (39)
   Start at  04:42:18
   Duration  6.19s
EXIT=0

=== FRONTEND TEST RUN 3 ===
 ✓ src/FuelingTable.test.jsx (2 tests) 232ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 498ms
 ✓ src/DriverModal.test.jsx (2 tests) 659ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 352ms
 ✓ src/Roles.test.jsx (7 tests) 540ms
 ✓ src/StationsPage.test.jsx (3 tests) 842ms
 ✓ src/DriversPage.test.jsx (3 tests) 475ms
 ✓ src/TruckDetailsPage.test.jsx (5 tests) 762ms
 ✓ src/DashboardPage.test.jsx (13 tests) 773ms
 ✓ src/App.test.jsx (1 test) 36ms

 Test Files  10 passed (10)
      Tests  39 passed (39)
   Start at  04:42:40
   Duration  6.65s
EXIT=0

=== FRONTEND TEST NODE 20 + CI=true ===
Node version: v20.20.2 CI: true
 ✓ src/FuelingTable.test.jsx (2 tests) 268ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 478ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 369ms
 ✓ src/DriverModal.test.jsx (2 tests) 726ms
 ✓ src/StationsPage.test.jsx (3 tests) 915ms
 ✓ src/Roles.test.jsx (7 tests) 534ms
 ✓ src/DriversPage.test.jsx (3 tests) 539ms
 ✓ src/DashboardPage.test.jsx (13 tests) 887ms
 ✓ src/TruckDetailsPage.test.jsx (5 tests) 1021ms
 ✓ src/App.test.jsx (1 test) 45ms

 Test Files  10 passed (10)
      Tests  39 passed (39)
   Start at  04:42:53
   Duration  5.24s
EXIT=0

=== FRONTEND BUILD ===
> vite build
vite v5.4.21 building for production...
transforming...
✓ 2572 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.22 kB │ gzip:   0.67 kB
dist/assets/index-CIGNcfv1.css     27.35 kB │ gzip:   9.47 kB
dist/assets/index-DKvnCI3Z.js   1,072.88 kB │ gzip: 308.22 kB
✓ built in 8.82s
EXIT=0
```
