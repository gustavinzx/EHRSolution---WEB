# Relatório de Execução: `fix/ux-tz-and-states`

## 1. Tabela de Conformidade (A1..C3)

| Item | Arquivo : Linha | Prova Executada | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | `frontend/src/utils/dayRange.js:1-19`<br>`frontend/src/pages/DashboardPage.jsx:11,102-112` | `isSameLocalDay(isoString, referenceDate)` compara ano/mês/dia pelos getters locais (`getFullYear`, `getMonth`, `getDate`); usado para `todayFuel`, `yesterdayFuel` e `fuelTrendPct`. Varredura em `frontend/src` por `toISOString().split`: zero ocorrências restantes em produção (`FacialAttemptsPage.jsx:29-33` usa `toISOString()` apenas para serializar intervalo de filtro `<input type="date">`, não para comparar "hoje"). | Aprovado (`EXIT=0`) | Nenhum |
| **A2** | `frontend/src/test/globalSetup.js:1-3`<br>`frontend/vite.config.js:11` | `process.env.TZ = 'America/Sao_Paulo'` configurado no `globalSetup` do Vitest antes dos workers subirem; validado inclusive com `TZ=UTC` no ambiente externo. | Aprovado (`EXIT=0`) | Nenhum |
| **B1** | `frontend/src/utils/truckVisualState.js:1-35` | Função pura `getTruckVisualState(truck)` retorna `'alert' \| 'fueling' \| 'ok'` com precedência de `sim_state` sobre `status` e suporte a `route_phase === 'fueling'`. | Aprovado (`EXIT=0`) | Nenhum |
| **B2** | `frontend/src/components/MapView.jsx:6,12-17,111-113`<br>`frontend/src/pages/DashboardPage.jsx:100-101,341-355` | `STATUS_COLORS.fueling = '#38bdf8'`; cor do pino e `isFueling` derivados via `getTruckVisualState(truck)`. Em `DashboardPage.jsx`, `isAlertTruck` (`getTruckVisualState(t) === 'alert'`) e `isFuelingTruck` (`getTruckVisualState(t) === 'fueling'`); legenda do mapa exibe `"Abastecendo (N)"` (`#38bdf8`) e `"Alerta (N)"` (`#f87171`) separados (caminhão abastecendo nunca conta em Alerta). | Aprovado (`EXIT=0`) | Nenhum |
| **B3** | `frontend/src/DashboardPage.test.jsx:199-354` | Testes Vitest cobrindo `getTruckVisualState` em cada estado e precedência, Dashboard com 1 caminhão em `fueling` (`Alerta (0)` e `Abastecendo (1)`), com `no_signal` (`Alerta (1)` e `Abastecendo (0)`), e virada de dia às 23:30 locais (dia seguinte em UTC) vs 00:10 de ontem local + tendência. | Aprovado (`EXIT=0`) | Nenhum |
| **C1** | `mobile/src/screens/DashboardScreen.tsx:82,86-91,95,120-134,542-559,1195-1228` | Estado separado `historyInlineError` exibe abaixo da lista `"Não foi possível carregar mais. Toque para tentar de novo."` (ou `"Sem conexão. Verifique sua rede e tente novamente."` quando `status === 0`) com botão de repetir (`testID="history-inline-retry-btn"`), mantendo os itens visíveis e limpando o erro ao ter sucesso. | Aprovado (`EXIT=0`) | Nenhum |
| **C2** | `mobile/src/services/api/apiClient.ts:83-85,111-113` | Em `__DEV__`, erros de rede e HTTP usam `console.warn` em vez de `console.error`; em produção continua sem log; mensagens mantidas (genéricas em produção, com URL apenas em `__DEV__`). | Aprovado (`EXIT=0`) | Nenhum |
| **C3** | `mobile/tests/DashboardScreen.test.tsx:776-901`<br>`mobile/tests/apiClient.test.ts:462-506` | Testes Jest cobrindo falha em `"Carregar mais"` com itens renderizados mantendo a lista visível e limpando o erro ao repetir, falha com `status 0`, e spies confirmando que `apiClient` em `__DEV__` usa `console.warn` e nunca `console.error`. | Aprovado (`EXIT=0`) | Nenhum |

---

## 2. Buscas Negativas (Saída Bruta e Exit Codes)

```text
> git grep -n "toISOString().split" -- frontend/src ':!*.test.*'
GREP1_EXIT=1

> git grep -n "console.error" -- mobile/src/services/api/apiClient.ts
GREP2_EXIT=1

> git grep -n "finishSession\|pump_liters\|data_source\|fuelLevel\|toFixed\|TODO" -- mobile/src
GREP3_EXIT=1

> git diff --name-only origin/main..HEAD -- backend docs/API_MOBILE.md
DIFF_EXIT=0
```

---

## 3. Provas Finais — Frontend

### 3.1 `npm ci`
```text
added 566 packages, and audited 567 packages in 2m
NPM_CI_EXIT=0
```

### 3.2 `npm test` (3 execuções consecutivas)
```text
 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/DriverModal.test.jsx (2 tests) 365ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 252ms
 ✓ src/FuelingTable.test.jsx (2 tests) 704ms
 ✓ src/StationsPage.test.jsx (3 tests) 831ms
 ✓ src/Roles.test.jsx (7 tests) 225ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 253ms
 ✓ src/DriversPage.test.jsx (3 tests) 374ms
 ✓ src/DashboardPage.test.jsx (13 tests) 753ms
 ✓ src/App.test.jsx (1 test) 37ms

 Test Files  9 passed (9)
      Tests  34 passed (34)
   Start at  18:35:18
   Duration  24.57s

TEST1_EXIT=0

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 182ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 368ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 300ms
 ✓ src/DriverModal.test.jsx (2 tests) 565ms
 ✓ src/StationsPage.test.jsx (3 tests) 690ms
 ✓ src/Roles.test.jsx (7 tests) 421ms
 ✓ src/DriversPage.test.jsx (3 tests) 427ms
 ✓ src/DashboardPage.test.jsx (13 tests) 659ms
 ✓ src/App.test.jsx (1 test) 35ms

 Test Files  9 passed (9)
      Tests  34 passed (34)
   Start at  18:35:44
   Duration  5.24s

TEST2_EXIT=0

 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 229ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 543ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 374ms
 ✓ src/DriverModal.test.jsx (2 tests) 685ms
 ✓ src/Roles.test.jsx (7 tests) 457ms
 ✓ src/StationsPage.test.jsx (3 tests) 767ms
 ✓ src/DriversPage.test.jsx (3 tests) 335ms
 ✓ src/DashboardPage.test.jsx (13 tests) 572ms
 ✓ src/App.test.jsx (1 test) 38ms

 Test Files  9 passed (9)
      Tests  34 passed (34)
   Start at  18:35:50
   Duration  5.83s

TEST3_EXIT=0
```

### 3.3 `Node 20 (v20.20.2) + CI=true`
```text
 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/FuelingTable.test.jsx (2 tests) 475ms
 ✓ src/DriverModal.test.jsx (2 tests) 795ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 546ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 388ms
 ✓ src/Roles.test.jsx (7 tests) 584ms
 ✓ src/StationsPage.test.jsx (3 tests) 970ms
 ✓ src/DriversPage.test.jsx (3 tests) 585ms
 ✓ src/DashboardPage.test.jsx (13 tests) 987ms
 ✓ src/App.test.jsx (1 test) 45ms

 Test Files  9 passed (9)
      Tests  34 passed (34)
   Start at  18:36:02
   Duration  5.77s

NODE20_CI_EXIT=0
```

### 3.4 `TZ=UTC` no ambiente
```text
 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend

 ✓ src/DriverModal.test.jsx (2 tests) 792ms
 ✓ src/FuelingTable.test.jsx (2 tests) 322ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 424ms
 ✓ src/pages/LoginPage.test.jsx (2 tests) 507ms
 ✓ src/DriversPage.test.jsx (3 tests) 703ms
 ✓ src/StationsPage.test.jsx (3 tests) 953ms
 ✓ src/Roles.test.jsx (7 tests) 467ms
 ✓ src/DashboardPage.test.jsx (13 tests) 854ms
 ✓ src/App.test.jsx (1 test) 36ms

 Test Files  9 passed (9)
      Tests  34 passed (34)
   Start at  21:36:09
   Duration  9.53s

TZ_UTC_EXIT=0
```

### 3.5 `npm run build`
```text
> ehr-solutions-fleet-frontend@0.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 2572 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.22 kB │ gzip:   0.67 kB
dist/assets/index-CIGNcfv1.css     27.35 kB │ gzip:   9.47 kB
dist/assets/index-BMxxXWPQ.js   1,066.17 kB │ gzip: 306.76 kB
✓ built in 20.02s
BUILD_EXIT=0
```

---

## 4. Provas Finais — Mobile

### 4.1 `npm ci` e `npx tsc --noEmit`
```text
added 830 packages, and audited 831 packages in 2m
MOBILE_CI_EXIT=0
MOBILE_TSC_EXIT=0
```

### 4.2 `npx jest` (Execução 1)
```text
PASS tests/secureStorage.test.ts
PASS tests/cancelError.test.ts
PASS tests/apiClient.test.ts
PASS tests/bleLock.test.ts
PASS tests/getBaseUrl.test.ts
PASS tests/sessionMachine.test.ts
PASS tests/withTimeout.test.ts
PASS tests/LoginScreen.test.tsx
PASS tests/OperationResultScreen.test.tsx
PASS tests/FacialAuthScreen.test.tsx
PASS tests/DashboardScreen.test.tsx

Test Suites: 11 passed, 11 total
Tests:       149 passed, 149 total
Snapshots:   0 total
Time:        19.148 s, estimated 27 s
Ran all test suites.
MOBILE_JEST1_EXIT=0
```

### 4.3 `npx jest --no-cache` (Execução 2)
```text
PASS tests/apiClient.test.ts
PASS tests/OperationResultScreen.test.tsx
PASS tests/LoginScreen.test.tsx
PASS tests/FacialAuthScreen.test.tsx
PASS tests/DashboardScreen.test.tsx
PASS tests/bleLock.test.ts
PASS tests/secureStorage.test.ts
PASS tests/getBaseUrl.test.ts
PASS tests/sessionMachine.test.ts
PASS tests/cancelError.test.ts
PASS tests/withTimeout.test.ts

Test Suites: 11 passed, 11 total
Tests:       149 passed, 149 total
Snapshots:   0 total
Time:        32.076 s
Ran all test suites.
MOBILE_JEST2_NOCACHE_EXIT=0
```

### 4.4 `Node 20 (v20.20.2) + CI=true`
```text
PASS tests/DashboardScreen.test.tsx
PASS tests/FacialAuthScreen.test.tsx
PASS tests/OperationResultScreen.test.tsx
PASS tests/LoginScreen.test.tsx
PASS tests/apiClient.test.ts
PASS tests/bleLock.test.ts
PASS tests/secureStorage.test.ts
PASS tests/getBaseUrl.test.ts
PASS tests/withTimeout.test.ts
PASS tests/sessionMachine.test.ts
PASS tests/cancelError.test.ts

Test Suites: 11 passed, 11 total
Tests:       149 passed, 149 total
Snapshots:   0 total
Time:        21.89 s, estimated 131 s
Ran all test suites.
MOBILE_NODE20_CI_EXIT=0
```
