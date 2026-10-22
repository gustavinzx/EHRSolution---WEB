# Relatório de Limpeza de Repositório, Hardening e Pipeline CI

**Data:** 13/10/2026  
**Branch:** `feat/repo-cleanup-ci`  
**Base:** `origin/main` (atualizada)  
**Status da branch development:** Intacta (`e8d202be3f454c9cfae909b8bc5515a41a687860`)

---

## 1. Tabela de Rastreabilidade de Itens (A1 a E1)

| Item | Arquivo:Linha | Prova Executada | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | `backend/add_compression.cjs`, `change_speed.cjs`, `check.js`, `q.js`, `test9.js`, `test_db.js`, `test_dist_live.cjs`, `test_fuel.js`, `test_fuel2.js`, `test_ghi.js`, `test_loop.js`, `test_marker_logic.cjs`, `test_postgis.cjs`, `test_sim2.js`, `test_speed.js`, `test_stations.js` | `git grep <nome>` confirmou zero referências em código, scripts ou documentação. `git ls-files backend \| grep -E '^backend/[^/]+\.(js\|cjs)$'` retorna apenas os 3 scripts permitidos. | 16 scripts removidos do controle de versão via `git rm`. | Nenhum |
| **A2** | `backend/test/` -> `backend/tests/drivers_controller.test.js` e `backend/tests/simulator_state.test.js` | Execução de `npm test` do Jest executando todas as 18 suítes com 228 testes passando. | Testes migrados de `node:test` para formato Jest com cobertura total; pasta `backend/test/` removida. | Nenhum |
| **A3** | `backend/.gitignore:20-22` | `git status` com arquivos de rascunho criados localmente. | Padrões `sql_tmp.js`, `mover_caminhao.js` e `*.log` adicionados ao `.gitignore`. | Nenhum |
| **B1** | `frontend/src/pages/LoginPage.jsx:170-192` | `npm run build` seguido de `grep -r "Demo@1234" frontend/dist` retornando saída vazia. | Credenciais de teste e botão envolvidos em `{import.meta.env.DEV && (...)}`. No bundle de produção a string é eliminada por DCE/tree-shaking. | Nenhum |
| **B2** | `frontend/src/pages/LoginPage.test.jsx:1-42` | `npm test` em `frontend/` executando Vitest com `vi.stubEnv('DEV', false)` e `vi.stubEnv('DEV', true)`. | Testes unitários cobrem ausência do botão com DEV=false e presença com DEV=true. Suíte 100% verde. | Nenhum |
| **C1** | `backend/src/seed/seed.js:134-138` | `ALLOW_SEED_WIPE=true node src/seed/seed.js` no banco `ehr_fleet_test` seguido de query SQL direta. | Usuário `gestor@ehr.com` inserido com `role: 'admin'` explícito no INSERT com `ON CONFLICT DO NOTHING`. | Nenhum |
| **D1** | `.github/workflows/ci.yml:1-119` | Validação de sintaxe YAML com `python -c "import yaml; yaml.safe_load(...)"`. | Workflow configurado para `push` na `main` e `pull_request`, permissões somente leitura, concorrência por ref e jobs `backend`, `frontend`, `mobile` com timeout de 15 min. | Nenhum |
| **D2** | `backend/package-lock.json` | `npx --yes npm@10 ci` e `npm ci` (npm 11) executados no backend com código 0. | Lockfile regenerado com npm 10 adicionando `@emnapi/core@1.11.3` e `@emnapi/runtime@1.11.3`. | Nenhum |
| **D3** | Pipeline Local Equivalente ao CI | Execução local dos comandos de cada job (PostgreSQL de teste, `npm ci`, `npm test`, `npm run build`, `npx tsc --noEmit`). | Todos os jobs simulam com sucesso no ambiente local. Prova em nuvem será o primeiro run do PR. | Nenhum |
| **E1** | `README.md:67-93` | Leitura do arquivo confirmando subseções Backend, Frontend e Mobile em `## CI (Integração Contínua)`. | Seção incluída com instruções precisas de reprodução local. | Nenhum |

---

## 2. Detalhamento de Scripts Removidos e Vulnerabilidade de Credenciais

### 2.1 Lista dos 16 scripts removidos
1. `backend/add_compression.cjs`
2. `backend/change_speed.cjs`
3. `backend/check.js`
4. `backend/q.js`
5. `backend/test9.js`
6. `backend/test_db.js`
7. `backend/test_dist_live.cjs`
8. `backend/test_fuel.js`
9. `backend/test_fuel2.js`
10. `backend/test_ghi.js`
11. `backend/test_loop.js`
12. `backend/test_marker_logic.cjs`
13. `backend/test_postgis.cjs`
14. `backend/test_sim2.js`
15. `backend/test_speed.js`
16. `backend/test_stations.js`

### 2.2 Scripts que continham credenciais de banco de dados hardcoded
Seis dos scripts removidos continham a senha do banco PostgreSQL exposta diretamente no código fonte:
- `backend/test_dist_live.cjs` (linha 6: `password: 'postgres'`)
- `backend/test_fuel2.js` (linha 6: `password: 'postgres'`)
- `backend/test_ghi.js` (linha 6: `password: 'postgres'`)
- `backend/test_marker_logic.cjs` (linha 6: `password: 'postgres'`)
- `backend/test_postgis.cjs` (linha 6: `password: 'postgres'`)
- `backend/test_speed.js` (linha 6: `password: 'postgres'`)

Com a remoção via `git rm` e a adição de regras no `.gitignore`, previne-se o vazamento e permanência de scripts de debug com dados sensíveis.

---

## 3. Migração dos Testes de `node:test` para Jest

A pasta `backend/test/` continha 2 arquivos que não eram executados pelo Jest (`testMatch: ["**/tests/**/*.test.js"]`):
1. `backend/test/drivers.test.js`:
   - **O que cobria:** Funções do controlador `driversController`:
     - `create`: criação de motorista e higienização dos dados retornados.
     - `update`: atualização de dados básicos e atualização de caminhões vinculados via transação (`client.query('BEGIN')`, `DELETE FROM driver_trucks`, `INSERT INTO driver_trucks`, `COMMIT`).
     - `deactivate`: inativação de motorista com validação de sessões ativas.
   - **Para onde foi:** Migrado para `backend/tests/drivers_controller.test.js` com mocks Jest para `db.pool.query` e `db.pool.connect()` (simulando client transacional com `release()`).
2. `backend/test/simulator.test.js`:
   - **O que cobria:** Mecânica interna do simulador de frota e telemetria:
     - Inicialização do estado de caminhões e estações.
     - Atualização periódica de posição e velocidade.
     - Consumo simulado de combustível em trânsito.
     - Registro de telemetria no banco.
     - Detecção de queda abrupta de combustível.
     - Registro de abastecimento e persistência de log ao atingir estação.
   - **Para onde foi:** Migrado para `backend/tests/simulator_state.test.js` em formato Jest com 6 testes unitários isolados.

A pasta legada `backend/test/` foi totalmente removida.

---

## 4. Alterações no `backend/package-lock.json` (Bloco D2)

A instalação com npm 10 (padrão em imagens Docker/CI Node 20) falhava devido à ausência explícita de pacotes opcionais do `@emnapi` no lockfile gerado por versões superiores do npm:
- **Pacotes adicionados:**
  - `@emnapi/core@1.11.3`
  - `@emnapi/runtime@1.11.3`
  - `@emnapi/wasi-threads@1.2.3`
  - Dependências aninhadas para WASI em `@unrs/resolver-binding-wasm32-wasi` (`@emnapi/core@1.10.0`, `@emnapi/runtime@1.10.0`, `@emnapi/wasi-threads@1.2.1`).
- **Ajustes:**
  - Remoção de tags `peer: true` geradas indevidamente em pacotes normais pelo npm 11.
- **Validação:**
  - `npx --yes npm@10 ci` em `backend/` finalizado com código 0 em 12s.
  - `npm ci` (npm local 11) finalizado com código 0 em 12s.
  - `npm test` do backend permaneceu 100% verde (18/18 suítes).

---

## 5. Buscas Negativas (Saídas Reais)

### 5.1 Apenas scripts permitidos na raiz de `backend/`
```bash
$ git ls-files backend | Select-String -Pattern '^backend/[^/]+\.(js|cjs)$'
backend/jest.config.js
backend/runMigration.js
backend/seedStations.js
```

### 5.2 Ausência da senha demo no bundle de produção
```bash
$ Get-ChildItem -Path frontend/dist -Recurse -File | Select-String -Pattern "Demo@1234"
# (Saída vazia — nenhuma ocorrência encontrada)
```

### 5.3 Ocorrência única de "Demo@1234" em `frontend/src`
```bash
$ git grep -n "Demo@1234" -- frontend/src
frontend/src/pages/LoginPage.jsx:188:                <div>Senha: Demo@1234</div>
```
**Justificativa:** A linha 188 está contida exclusivamente dentro do bloco `{import.meta.env.DEV && (...)}` (linhas 170-192). O bundler Vite substitui `import.meta.env.DEV` pelo booleano literal `false` durante o build de produção, permitindo que a etapa de minificação e tree-shaking elimine todo o bloco HTML e strings correspondentes.

---

## 6. Provas Reais dos Testes

### 6.1 `node --check` nos arquivos JavaScript alterados no backend
```bash
$ node --check backend/src/seed/seed.js && node --check backend/tests/drivers_controller.test.js && node --check backend/tests/simulator_state.test.js
# Exit code: 0 (nenhum erro de sintaxe)
```

### 6.2 Backend: Execução 1 após `DROP DATABASE IF EXISTS ehr_fleet_test`
```text
PASS tests/api_contract.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/drivers_controller.test.js
PASS tests/anp_stations.test.js
PASS tests/facial.test.js
PASS tests/anp_station_matching.test.js
PASS tests/roles.test.js
PASS tests/facial_extra.test.js
PASS tests/divergence.test.js
PASS tests/leak_recursive.test.js
PASS tests/hardening.test.js
PASS tests/migrations.test.js
PASS tests/driver_actions.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js

Test Suites: 18 passed, 18 total
Tests:       228 passed, 228 total
Snapshots:   0 total
Time:        13.571 s, estimated 20 s
Ran all test suites.
```

### 6.3 Backend: Execução 2
```text
PASS tests/api_contract.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/anp_stations.test.js
PASS tests/roles.test.js
PASS tests/facial.test.js
PASS tests/anp_station_matching.test.js
PASS tests/migrations.test.js
PASS tests/facial_extra.test.js
PASS tests/divergence.test.js
PASS tests/hardening.test.js
PASS tests/leak_recursive.test.js
PASS tests/driver_actions.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/drivers_controller.test.js
PASS tests/simulator_state.test.js
PASS tests/jwtValidator.test.js

Test Suites: 18 passed, 18 total
Tests:       228 passed, 228 total
Snapshots:   0 total
Time:        13.86 s, estimated 14 s
Ran all test suites.
```

### 6.4 Frontend: Testes e Build
```text
$ npm test (frontend)
 Test Files  8 passed (8)
      Tests  21 passed (21)
   Start at  21:19:52
   Duration  10.67s

$ npm run build (frontend)
vite v5.4.21 building for production...
transforming...
✓ 2569 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.22 kB │ gzip:   0.66 kB
dist/assets/index-39j02iYT.css     27.35 kB │ gzip:   9.50 kB
dist/assets/index-MDGhqnJx.js   1,033.71 kB │ gzip: 299.76 kB
✓ built in 8.34s
```

### 6.5 Mobile: Typecheck e Testes (sem alteração de código)
```text
$ npx tsc --noEmit
# Exit code: 0 (sem erros de tipo)

$ npm test (mobile)
PASS tests/OperationResultScreen.test.tsx
PASS tests/LoginScreen.test.tsx
PASS tests/AuthContext.test.tsx
PASS tests/DashboardScreen.test.tsx
PASS tests/FacialAuthScreen.test.tsx
PASS tests/OfflineQueue.test.ts
PASS tests/BleScannerScreen.test.tsx
PASS tests/FuelingProgressScreen.test.tsx
PASS tests/apiClient.test.ts

Test Suites: 9 passed, 9 total
Tests:       100 passed, 100 total
Snapshots:   0 total
Time:        12.579 s
Ran all test suites.
```

### 6.6 Seed: Verificação de `gestor@ehr.com` com role `admin`
```text
$ $env:DB_NAME='ehr_fleet_test'; $env:ALLOW_SEED_WIPE='true'; node src/seed/seed.js
Schema created/verified via migrations.
Database cleaned for real usage.
Production Base Seed Complete! Ready for Hardware Integration.

$ SELECT email, role FROM users;
[
  {
    "email": "gestor@ehr.com",
    "role": "admin"
  }
]
# ehr_fleet_test devidamente dropado após o teste.
```

---

## 7. Verificações Finais de Repositório e Git

- **Status:** Limpo (`nothing to commit, working tree clean`).
- **Branch remota `development`:** Hash inalterado (`e8d202be3f454c9cfae909b8bc5515a41a687860`).
- **Arquivos tocados:** Apenas arquivos em escopo permitido (`backend/`, `frontend/src/pages/LoginPage*`, `.github/workflows/`, `README.md`, `docs/relatorios/`). Nenhum arquivo de `mobile/` ou `docs/API_MOBILE.md` foi modificado.
