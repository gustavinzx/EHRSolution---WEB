# Relatório de Polimento — Provisionamento de Chave do Hardware (`fix/hardware-key-polish`)

## 1. Tabela de Conformidade (`A1..D2`)

| Item | Arquivo:Linha | Prova | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | `frontend/src/components/ErrorMessage.jsx:3-43`<br>`frontend/src/hooks/useFleet.js:116-127`<br>`frontend/src/pages/TruckDetailsPage.jsx:299-302, 421-471` | `ErrorMessage` aceita `title` (padrão `"Erro de Conexão"`) e `children`. Em `TruckDetailsPage`, HTTP 404 exibe `title="Caminhão não encontrado"`, mensagem `"Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista."` e botão `"Voltar para a Frota"`. Falha de rede sem resposta do servidor exibe `"Erro de Conexão"`. Outros status HTTP exibem `"Não foi possível carregar o caminhão."` com botão `"Tentar novamente"`. Provado em `frontend/src/TruckDetailsPage.test.jsx:104-179`. | PASS (`EXIT=0`) | Nenhum |
| **A2** | `frontend/src/pages/InvestigationPage.jsx:5-9, 100-112, 134-184` | Varredura `git grep -n "useParams\|ErrorMessage" -- frontend/src/pages` identificou duas telas de detalhe (`:id`) no painel: `TruckDetailsPage.jsx` (`/fleet/:id`) e `InvestigationPage.jsx` (`/investigation/:id`). Ambas tratam HTTP 404 com `ErrorMessage` (`title="Caminhão não encontrado"`, `"Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista."`, botão `"Voltar para a Frota"`), falha de rede (`"Erro de Conexão"`) e demais erros HTTP (`"Não foi possível carregar o caminhão."`, botão `"Tentar novamente"`). `FleetPage.jsx` é tela de listagem (`/fleet`) e mantém o padrão `"Erro de Conexão"`. | PASS (`EXIT=0`) | Nenhum |
| **B1** | `frontend/src/pages/TruckDetailsPage.jsx:755-765` | No cartão `"Chave do hardware"`, exibe sempre a linha selecionável (`userSelect: 'text'`) `"ID do caminhão: <id> • Placa: <placa>"`. Provado em `frontend/src/TruckDetailsPage.test.jsx:181-193`. | PASS (`EXIT=0`) | Nenhum |
| **B2** | `frontend/src/pages/TruckDetailsPage.jsx:126-267` | Em `HardwareKeyModal`, além da chave com botão `"Copiar"`, exibe o ID do caminhão (`ID do caminhão: <truckId>`) e um bloco de código PowerShell pronto para colar (`$h = @{ "x-api-key" = "<chave>" }` + `Invoke-RestMethod -Uri "<URL da API>/fueling/sessions/<id>/active" -Headers $h`) com botão `"Copiar comando"`. A URL da API vem de `client.defaults.baseURL`. Chave e comando existem somente no estado local da janela e são removidos do DOM ao fechar (`setNewHardwareKey(null)`). Provado em `frontend/src/TruckDetailsPage.test.jsx:206-274`. | PASS (`EXIT=0`) | Nenhum |
| **B3** | `frontend/src/pages/TruckDetailsPage.jsx:304-370, 745-754, 795-801` | Atualização de `"Último uso"`: botão `"Atualizar"` no cabeçalho do cartão, recarga silenciosa quando a aba volta a ficar visível (`document.addEventListener('visibilitychange', ...)` com `document.visibilityState === 'visible'`) e intervalo de 30s (`setInterval(..., 30000)`) limpo ao desmontar (`clearInterval` e `removeEventListener`). Falha na atualização exibe aviso discreto no cartão sem apagar o estado atual. Provado em `frontend/src/TruckDetailsPage.test.jsx:276-346`. | PASS (`EXIT=0`) | Nenhum |
| **C1** | `backend/src/controllers/fleetController.js:368-383, 408-423` | Em `generateHardwareKey` e `revokeHardwareKey`, a chamada a `security.recordSecurityEvent` está envolvida em `try/catch` ("best effort"): registra apenas `eventErr.message || eventErr` no log sem a chave e preserva as respostas `201` e `200 { success: true }`. Provado em `backend/tests/hardware_key_provisioning.test.js:437-481`. | PASS (`EXIT=0`) | Nenhum |
| **C2** | `docs/GUIA_INTEGRACAO_HARDWARE.md:83-108` | Migration `016_hardware_key_hash.sql` intocada e nenhuma migration nova criada (`git diff --name-only origin/main..HEAD -- mobile docs/API_MOBILE.md backend/src/migrations` vazio). Documentada na Seção 2 do guia e na Seção 2 deste relatório a consulta prévia de duplicidade (`SELECT api_key, count(*) FROM trucks WHERE api_key IS NOT NULL GROUP BY api_key HAVING count(*) > 1`) e a mensagem clara do índice único `idx_trucks_api_key_hash_unique`. | PASS (`EXIT=0`) | Nenhum |
| **D1** | `frontend/src/TruckDetailsPage.test.jsx:104-365` | 10 testes Vitest cobrindo: 404 (`"Caminhão não encontrado"` + `"Voltar para a Frota"`), erro de rede (`"Erro de Conexão"`), outro erro HTTP (`"Não foi possível carregar o caminhão."` + `"Tentar novamente"`), `"ID do caminhão: 42 • Placa: ABC-1234"`, janela com ID + comando PowerShell + remoção ao fechar, botão `"Atualizar"`, `visibilitychange`, limpeza do intervalo de 30s ao desmontar (fake timers), ciclo completo com confirmação e ocultação para `auditor`. | PASS (`EXIT=0`) | Nenhum |
| **D2** | `backend/tests/hardware_key_provisioning.test.js:437-481` | Teste Jest simulando falha em `security.recordSecurityEvent` (`mockRejectedValue`) e provando que `POST /api/fleet/:id/hardware-key` responde `201` com a chave (sem vazar no `console.error`), a chave gerada autentica nas rotas de hardware (`GET /api/fueling/sessions/:truckId/active` -> `200`), e `DELETE /api/fleet/:id/hardware-key` responde `200 { success: true }` invalidando a chave antiga (`401`). | PASS (`EXIT=0`) | Nenhum |

---

## 2. Achados da Varredura A2 e Documentação C2

### 2.1 Varredura de Telas de Detalhe (`A2`)
Comando executado:
```text
git grep -n "useParams\|ErrorMessage" -- frontend/src/pages
```
Resultado:
- `frontend/src/pages/TruckDetailsPage.jsx` (`/fleet/:id`): tela de detalhe de caminhão; atualizada para diferenciar `404` (`title="Caminhão não encontrado"`, `"Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista."`, botão `"Voltar para a Frota"`), erro de rede sem resposta (`title="Erro de Conexão"`) e demais códigos HTTP (`"Não foi possível carregar o caminhão."`, botão `"Tentar novamente"`).
- `frontend/src/pages/InvestigationPage.jsx` (`/investigation/:id`): tela de detalhe de investigação do caminhão; atualizada para usar `ErrorMessage` com o mesmo tratamento de `404`, erro de rede e demais códigos HTTP.
- `frontend/src/pages/FleetPage.jsx` (`/fleet`): tela de listagem geral da frota (sem parâmetro `:id`); mantém `ErrorMessage` com o título padrão `"Erro de Conexão"`.

### 2.2 Verificação de Chaves Duplicadas Antes da Migration 016 (`C2`)
A migration `016_hardware_key_hash.sql` cria o índice único parcial:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_trucks_api_key_hash_unique
  ON trucks (api_key_hash)
  WHERE api_key_hash IS NOT NULL;
```
Em bancos legados que tenham dois caminhões com a mesma `api_key` em texto puro antes da aplicação da migration `016`, o PostgreSQL aborta a transação da migration com a mensagem:
```text
ERROR: could not create unique index "idx_trucks_api_key_hash_unique"
DETAIL: Key (api_key_hash)=(<sha256_hex>) is duplicated.
```
Para diagnosticar e sanear antes de aplicar a migration `016` em ambientes existentes, execute:
```sql
SELECT api_key, count(*)
  FROM trucks
 WHERE api_key IS NOT NULL
 GROUP BY api_key
HAVING count(*) > 1;
```
Se retornar linhas, limpe ou regenere as chaves duplicadas antes de rodar as migrations.

---

## 3. Buscas Negativas

```text
=== BUSCA NEGATIVA 1 ===
$ git grep -n "localStorage\|sessionStorage" -- frontend/src/pages/TruckDetailsPage.jsx frontend/src/hooks/useFleet.js
EXIT_1=1

=== BUSCA NEGATIVA 2 ===
$ git grep -n "console\.\(log\|error\|warn\)" -- frontend/src/pages/TruckDetailsPage.jsx
frontend/src/pages/TruckDetailsPage.jsx:494:      console.error('Failed to parse route_geometry', e);
EXIT_2=0
Justificativa: a única chamada a console.* em TruckDetailsPage.jsx está no bloco catch de JSON.parse(truck.route_geometry) para geometria de rota do mapa e nunca recebe nem imprime dados da chave do hardware.

=== BUSCA NEGATIVA 3 ===
$ git diff --name-only origin/main..HEAD -- mobile docs/API_MOBILE.md backend/src/migrations
EXIT_3=0
```

---

## 4. Provas Finais — Saídas Brutas e Códigos de Saída

### 4.1 Backend: `node --check`, `DROP DATABASE IF EXISTS ehr_fleet_test` e `npm ci`

```text
$ node --check backend/src/controllers/fleetController.js; Write-Host "EXIT_CHECK_1=$LASTEXITCODE"
$ node --check backend/tests/hardware_key_provisioning.test.js; Write-Host "EXIT_CHECK_2=$LASTEXITCODE"
$ node --check frontend/src/hooks/useFleet.js; Write-Host "EXIT_CHECK_3=$LASTEXITCODE"
EXIT_CHECK_1=0
EXIT_CHECK_2=0
EXIT_CHECK_3=0

$ node -e "require('dotenv').config(); const {Client}=require('pg'); (async()=>{const c=new Client({host:process.env.DB_HOST||'localhost',port:process.env.DB_PORT||5432,user:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||'postgres',database:'postgres'}); await c.connect(); await c.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \'ehr_fleet_test\' AND pid <> pg_backend_pid()'); await c.query('DROP DATABASE IF EXISTS ehr_fleet_test'); console.log('DROPPED ehr_fleet_test'); await c.end();})()"; Write-Host "EXIT_DROP=$LASTEXITCODE"
DROPPED ehr_fleet_test
EXIT_DROP=0

$ npm ci; Write-Host "EXIT_NPM_CI=$LASTEXITCODE"
added 696 packages, and audited 697 packages in 1m
EXIT_NPM_CI=0
```

### 4.2 Backend: `npm test` Completo (2x) + `Node 20 + CI=true`

```text
=== BACKEND NPM TEST RUN 1 ===
> ehr-fleet-backend@1.0.0 test
> jest --detectOpenHandles --forceExit --runInBand

Database ehr_fleet_test created.
Running migrations on ehr_fleet_test...
[Migrations] Waiting for advisory lock...
[Migrations] Lock obtained.
[Migrations] Executing 001_initial_schema.sql...
[Migrations] 001_initial_schema.sql executed successfully.
[Migrations] Executing 002_security_schema.sql...
[Migrations] 002_security_schema.sql executed successfully.
[Migrations] Executing 003_web_hardening.sql...
[Migrations] 003_web_hardening.sql executed successfully.
[Migrations] Executing 004_fix_data_source.sql...
[Migrations] 004_fix_data_source.sql executed successfully.
[Migrations] Executing 005_alert_rules.sql...
[Migrations] 005_alert_rules.sql executed successfully.
[Migrations] Executing 006_alert_settings_history.sql...
[Migrations] 006_alert_settings_history.sql executed successfully.
[Migrations] Executing 007_alert_fk_set_null.sql...
[Migrations] 007_alert_fk_set_null.sql executed successfully.
[Migrations] Executing 008_facial_server.sql...
[Migrations] 008_facial_server.sql executed successfully.
[Migrations] Executing 009_ble_consumed_at.sql...
[Migrations] 009_ble_consumed_at.sql executed successfully.
[Migrations] Executing 010_user_roles.sql...
[Migrations] 010_user_roles.sql executed successfully.
[Migrations] Executing 011_lowercase_emails.sql...
[Migrations] 011_lowercase_emails.sql executed successfully.
[Migrations] Executing 012_driver_face_photo.sql...
[Migrations] 012_driver_face_photo.sql executed successfully.
[Migrations] Executing 013_simulated_data_source.sql...
[Migrations] 013_simulated_data_source.sql executed successfully.
[Migrations] Executing 014_anp_stations.sql...
[Migrations] 014_anp_stations.sql executed successfully.
[Migrations] Executing 015_anp_station_matching.sql...
[Migrations] 015_anp_station_matching.sql executed successfully.
[Migrations] Executing 016_hardware_key_hash.sql...
[Migrations] 016_hardware_key_hash.sql executed successfully.
[Migrations] Releasing advisory lock.
Migrations completed on test DB.
PASS tests/api_contract.test.js (5.947 s)
PASS tests/hardware_key_provisioning.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/facial.test.js
PASS tests/roles.test.js
PASS tests/anp_stations.test.js
PASS tests/leak_recursive.test.js
PASS tests/anp_station_matching.test.js
PASS tests/manager_override.test.js
PASS tests/divergence.test.js
PASS tests/facial_extra.test.js
PASS tests/driver_history.test.js
PASS tests/ble.test.js
PASS tests/hardening.test.js
PASS tests/driver_actions.test.js
PASS tests/migrations.test.js
PASS tests/docs_drift.test.js
PASS tests/drivers_controller.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js
Test Suites: 20 passed, 20 total
Tests:       262 passed, 262 total
Snapshots:   0 total
Time:        28.46 s
Ran all test suites.
EXIT_TEST_1=0

=== BACKEND NPM TEST RUN 2 ===
> ehr-fleet-backend@1.0.0 test
> jest --detectOpenHandles --forceExit --runInBand

Running migrations on ehr_fleet_test...
[Migrations] Waiting for advisory lock...
[Migrations] Lock obtained.
[Migrations] Releasing advisory lock.
Migrations completed on test DB.
PASS tests/api_contract.test.js
PASS tests/anp_station_matching.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/leak_recursive.test.js
PASS tests/hardware_key_provisioning.test.js
PASS tests/facial.test.js
PASS tests/anp_stations.test.js
PASS tests/roles.test.js
PASS tests/driver_history.test.js
PASS tests/divergence.test.js
PASS tests/facial_extra.test.js
PASS tests/migrations.test.js
PASS tests/hardening.test.js
PASS tests/docs_drift.test.js
PASS tests/manager_override.test.js
PASS tests/driver_actions.test.js
PASS tests/ble.test.js
PASS tests/drivers_controller.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js
Test Suites: 20 passed, 20 total
Tests:       262 passed, 262 total
Snapshots:   0 total
Time:        24.863 s, estimated 28 s
Ran all test suites.
EXIT_TEST_2=0

=== BACKEND NODE 20 + CI=true ===
$ $env:CI = "true"; npx -y node@20 ./node_modules/jest/bin/jest.js --detectOpenHandles --forceExit --runInBand; Write-Host "EXIT_NODE20_CI=$LASTEXITCODE"
PASS tests/api_contract.test.js (5.838 s)
PASS tests/driver_fleet_hardening.test.js
PASS tests/anp_station_matching.test.js
PASS tests/leak_recursive.test.js
PASS tests/anp_stations.test.js
PASS tests/hardware_key_provisioning.test.js
PASS tests/facial.test.js
PASS tests/roles.test.js
PASS tests/hardening.test.js
PASS tests/divergence.test.js
PASS tests/facial_extra.test.js
PASS tests/driver_history.test.js
PASS tests/migrations.test.js
PASS tests/driver_actions.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/drivers_controller.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js
Test Suites: 20 passed, 20 total
Tests:       262 passed, 262 total
Snapshots:   0 total
Time:        34.852 s
Ran all test suites.
EXIT_NODE20_CI=0
```

### 4.3 Frontend: `npm ci`, `npm test` (3x), `Node 20 + CI=true` e `npm run build`

```text
$ npm ci; Write-Host "EXIT_FE_CI=$LASTEXITCODE"
added 566 packages, and audited 567 packages in 2m
EXIT_FE_CI=0

=== FRONTEND NPM TEST RUN 1 ===
> ehr-solutions-fleet-frontend@0.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 362ms
 ✓ src/DriverModal.test.jsx (2 tests) 685ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 411ms
 ✓ src/StationsPage.test.jsx (3 tests) 852ms
 ✓ src/Roles.test.jsx (7 tests) 274ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 332ms
 ✓ src/DriversPage.test.jsx (3 tests) 486ms
 ✓ src/DashboardPage.test.jsx (13 tests) 981ms
 ✓ src/TruckDetailsPage.test.jsx (10 tests) 1292ms
 ✓ src/App.test.jsx (1 test) 46ms

 Test Files  10 passed (10)
      Tests  44 passed (44)
   Start at  22:46:22
   Duration  30.48s (transform 3.64s, setup 51.58s, collect 31.47s, tests 5.72s, environment 118.73s, prepare 13.67s)

EXIT_FE_TEST_1=0

=== FRONTEND NPM TEST RUN 2 ===
> ehr-solutions-fleet-frontend@0.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 379ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 669ms
 ✓ src/DriverModal.test.jsx (2 tests) 963ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 574ms
 ✓ src/Roles.test.jsx (7 tests) 712ms
 ✓ src/StationsPage.test.jsx (3 tests) 1157ms
 ✓ src/DriversPage.test.jsx (3 tests) 652ms
 ✓ src/DashboardPage.test.jsx (13 tests) 1538ms
 ✓ src/TruckDetailsPage.test.jsx (10 tests) 2140ms
 ✓ src/App.test.jsx (1 test) 86ms

 Test Files  10 passed (10)
      Tests  44 passed (44)
   Start at  22:46:55
   Duration  12.84s (transform 3.36s, setup 12.97s, collect 14.87s, tests 8.87s, environment 61.60s, prepare 5.00s)

EXIT_FE_TEST_2=0

=== FRONTEND NPM TEST RUN 3 ===
> ehr-solutions-fleet-frontend@0.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 386ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 889ms
 ✓ src/DriverModal.test.jsx (2 tests) 1413ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 793ms
 ✓ src/Roles.test.jsx (7 tests) 1088ms
 ✓ src/StationsPage.test.jsx (3 tests) 1750ms
 ✓ src/DriversPage.test.jsx (3 tests) 1045ms
 ✓ src/DashboardPage.test.jsx (13 tests) 1840ms
 ✓ src/TruckDetailsPage.test.jsx (10 tests) 2159ms
 ✓ src/App.test.jsx (1 test) 52ms

 Test Files  10 passed (10)
      Tests  44 passed (44)
   Start at  22:47:09
   Duration  12.25s (transform 3.23s, setup 12.84s, collect 18.17s, tests 11.42s, environment 48.62s, prepare 4.24s)

EXIT_FE_TEST_3=0

=== FRONTEND NODE 20 + CI=true ===
$ $env:CI = "true"; npx -y node@20 ./node_modules/vitest/vitest.mjs run; Write-Host "EXIT_FE_NODE20_CI=$LASTEXITCODE"

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 700ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 871ms
 ✓ src/DriverModal.test.jsx (2 tests) 1510ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 875ms
 ✓ src/Roles.test.jsx (7 tests) 1105ms
 ✓ src/StationsPage.test.jsx (3 tests) 1982ms
 ✓ src/DriversPage.test.jsx (3 tests) 1072ms
 ✓ src/DashboardPage.test.jsx (13 tests) 2097ms
 ✓ src/App.test.jsx (1 test) 127ms
 ✓ src/TruckDetailsPage.test.jsx (10 tests) 2716ms

 Test Files  10 passed (10)
      Tests  44 passed (44)
   Start at  22:47:50
   Duration  9.81s (transform 5.79s, setup 7.90s, collect 20.78s, tests 13.06s, environment 27.45s, prepare 4.81s)

EXIT_FE_NODE20_CI=0

=== FRONTEND NPM RUN BUILD ===
> ehr-solutions-fleet-frontend@0.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 2572 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.22 kB │ gzip:   0.67 kB
dist/assets/index-CIGNcfv1.css     27.35 kB │ gzip:   9.47 kB
dist/assets/index-Du8y8eqS.js   1,078.07 kB │ gzip: 309.42 kB
✓ built in 21.04s
EXIT_FE_BUILD=0
```
