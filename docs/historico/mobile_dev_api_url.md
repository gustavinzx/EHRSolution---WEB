# Relatório de Resolução Dinâmica de URL da API no App Mobile

**Data:** 15/10/2026  
**Branch:** `fix/mobile-dev-api-url`  
**Escopo:** `/mobile` e `docs/relatorios`

---

## 1. Tabela de Conformidade (Itens A1 a B2)

| Item | Arquivo:Linha | Prova | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **A1** - Remoção de `DEFAULT_DEV_IP` e de `extra.apiUrl` | `mobile/src/services/api/apiClient.ts:1-27`<br>`mobile/app.json:1-51` | `git grep -n "192\.168\." -- mobile ':!mobile/tests'` retornou vazio (código 1). `DEFAULT_DEV_IP` não existe mais em `apiClient.ts` e `extra.apiUrl` foi removido de `app.json`. | Concluído | Nenhum |
| **A2** - Ordem de resolução dinâmica em `__DEV__` e proteção de produção | `mobile/src/services/api/apiClient.ts:28-49` | Implementada ordem: (1) `EXPO_PUBLIC_API_URL` (ignora loopback se for nativo); (2) Host Expo (`hostUri`, `debuggerHost`, `linkingUri`/`experienceUrl`) => `http://<host>:3001/api`; (3) Android emulator fallback => `http://10.0.2.2:3001/api`; (4) iOS/Web fallback => `http://localhost:3001/api`. Bloco `!__DEV__` exige HTTPS. | Concluído | Nenhum |
| **A3** - Banner `API: <url>` no Login apenas em `__DEV__` | `mobile/src/screens/LoginScreen.tsx:159-161` | Elemento `{__DEV__ && (<Text style={styles.devEnvironmentTag}>API: {getBaseUrl()}</Text>)}` preservado estritamente condicional ao ambiente de desenvolvimento. | Concluído | Nenhum |
| **B1** - Testes unitários de `getBaseUrl` cobrindo cenários | `mobile/tests/getBaseUrl.test.ts:1-174` | 15 testes unitários executados com `jest.isolateModules` e mocks dinâmicos de `Platform` e `expo-constants`. Todos passaram. | Concluído | Nenhum |
| **B2** - Regressão da suíte de testes do Mobile | `mobile/tests/*` | Execuções completas com `npx jest` e `npx jest --no-cache`: 10 suítes aprovadas, 121 testes aprovados em ambas. | Concluído | Nenhum |

---

## 2. Provas de Execução dos Testes e Tipagem

### 2.1. `npm ci` (mobile)
```
added 830 packages, and audited 831 packages in 1m

84 packages are looking for funding
  run `npm fund` for details

69 vulnerabilities (21 moderate, 48 high)
```

### 2.2. `npx tsc --noEmit` (mobile)
```
Exit code: 0
Stdout: (vazio)
Stderr: (vazio)
```

### 2.3. `npx jest` (1ª Execução com Cache)
```
PASS tests/secureStorage.test.ts
PASS tests/cancelError.test.ts
PASS tests/sessionMachine.test.ts
PASS tests/bleLock.test.ts
PASS tests/getBaseUrl.test.ts
PASS tests/apiClient.test.ts
PASS tests/AuthContext.test.tsx
PASS tests/OperationResultScreen.test.tsx
PASS tests/DashboardScreen.test.tsx
PASS tests/FacialAuthScreen.test.tsx

Test Suites: 10 passed, 10 total
Tests:       121 passed, 121 total
Snapshots:   0 total
Time:        4.753 s, estimated 17 s
Ran all test suites.
```

### 2.4. `npx jest --no-cache` (2ª Execução Sem Cache)
```
PASS tests/secureStorage.test.ts
PASS tests/cancelError.test.ts
PASS tests/sessionMachine.test.ts
PASS tests/bleLock.test.ts
PASS tests/getBaseUrl.test.ts
PASS tests/apiClient.test.ts
PASS tests/AuthContext.test.tsx
PASS tests/OperationResultScreen.test.tsx
PASS tests/FacialAuthScreen.test.tsx
PASS tests/DashboardScreen.test.tsx

Test Suites: 10 passed, 10 total
Tests:       121 passed, 121 total
Snapshots:   0 total
Time:        17.362 s
Ran all test suites.
```

---

## 3. Buscas Negativas

### 3.1. Busca por IP privado `192.168.` fora dos testes
Comando:
```bash
git grep -n "192\.168\." -- mobile ':!mobile/tests'
```
Saída bruta:
```
(vazio, código de saída 1)
```

### 3.2. Verificação de integridade de escopo em relação a `origin/main`
Comando:
```bash
git diff --name-only origin/main..HEAD -- backend frontend docs/API_MOBILE.md
```
Saída bruta:
```
(vazio, código de saída 0)
```

---

## 4. Estado do Repositório e Validação do Passo 0

### 4.1. Hash de `development` no repositório remoto
Comando:
```bash
git ls-remote --heads origin development
```
Saída bruta:
```
e8d202be3f454c9cfae909b8bc5515a41a687860	refs/heads/development
```
*O hash permanece rigorosamente inalterado em relação ao anotado no Passo 0.*

### 4.2. `git diff --stat origin/main..HEAD`
```
 mobile/assets/adaptive-icon.png      | Bin 0 -> 34715 bytes
 mobile/assets/splash.png             | Bin 0 -> 34715 bytes
 mobile/src/screens/LoginScreen.tsx   |   3 +-
 mobile/src/services/api/apiClient.ts |  45 +++++++--
 mobile/tests/getBaseUrl.test.ts      | 173 +++++++++++++++++++++++++++++++++++
 5 files changed, 214 insertions(+), 7 deletions(-)
```
*Apenas arquivos em `mobile/` e `docs/relatorios/` foram modificados na branch.*
