# EHR Solutions - App Mobile (Rodada A)

## Tabela de Conformidade dos Requisitos (A1 a E5)

| Item | Arquivo:Linha | Prova | Resultado | Não Resolvido |
|---|---|---|---|---|
| **A1** | `mobile/src/types/auth.ts:4-8`<br>`mobile/src/contexts/AuthContext.tsx:64-74`<br>`mobile/src/screens/DashboardScreen.tsx:78` | `LoginResponse` tipado com `vehicle: Vehicle \| null`. `AuthContext.signIn` consome `response.vehicle`, se `null` não chama `saveVehicle`, define `setVehicle(null)`. `DashboardScreen` exibe "Nenhum veículo vinculado. Procure o gestor." com botões desabilitados. | Concluído e verificado | Nenhum |
| **A2** | `mobile/tests/apiClient.test.ts:28-66`<br>`mobile/tests/AuthContext.test.tsx:43-138` | Mock do login com formato exato do backend `{ token, driver: { id, name, email, phone }, vehicle: { id, plate, model, brand, capacity } }` e caso `vehicle: null`. Testes validam salvamento, restauração e desativação quando `null`. | Concluído (testes passando) | Nenhum |
| **A3** | `mobile/src/services/api/apiClient.ts:70-72`<br>`mobile/tests/apiClient.test.ts:68-96` | 401 em `/auth/driver/login` lança `ApiError('Credenciais inválidas')` sem chamar `onUnauthorized`. 401 em outras rotas chama `onUnauthorized`. | Concluído (testes passando) | Nenhum |
| **B1** | `mobile/package.json:35`<br>`mobile/jest.config.js:3` | `@react-native/jest-preset` alinhado a `^0.86.3` (compatível com `react-native` 0.86.3 e `jest-expo` 57.0.5). Removido `empty-mock.js` e `moduleNameMapper` de `setup-env`. Matcher embutido `@testing-library/react-native/extend-expect` configurado. | Concluído | Nenhum |
| **B2** | `mobile/jest.config.js:4` | `testTimeout: 20000` configurado no Jest. | Concluído | Nenhum |
| **B3** | `mobile/package-lock.json`<br>`mobile/package.json` | `rm -rf node_modules && npm ci` (sem flags) finalizado com código 0; `npm install` (sem flags) finalizado com código 0. Árvore de dependências regenerada de forma consistente. | Concluído (código de saída 0) | Nenhum |
| **C1** | `mobile/src/services/bluetooth/bleLock.ts:1-33` | Interface `BleLock` criada (`isAvailable`, `connect`, `disconnect`). Implementações `unavailableBleLock` e `mockBleLock`. Seletor `getBleLock()` exportado. | Concluído | Nenhum |
| **C2** | `mobile/src/screens/DashboardScreen.tsx:17-19, 65, 98-106` | Botão "Usar Bluetooth" só renderizado se `getBleLock().isAvailable()` for `true`. Checagem prévia em `handleStartOperation` impede criação de sessão `ble_fallback` no servidor sem BLE. | Concluído | Nenhum |
| **C3** | `mobile/src/screens/OperationResultScreen.tsx:73-84` | Removida checagem solta de variável de ambiente; invoca `getBleLock().connect()` antes da autorização em sessões `ble_fallback`. | Concluído | Nenhum |
| **C4** | `mobile/src/screens/OperationResultScreen.tsx:75-82` | Se retomar sessão `ble_fallback` 'requested' e BLE indisponível, exibe "Esta sessão foi iniciada por Bluetooth, que não está disponível. Procure o gestor." sem laço de autorização e mantendo o botão de voltar. | Concluído | Nenhum |
| **C5** | `mobile/src/session/sessionMachine.ts:49-56` | Desvio para `AUTHORIZING` por `ble_fallback` restrito ao status 'requested', preservando 'authorized' (`WAITING_HARDWARE`) e 'active' (`FUELING`). | Concluído | Nenhum |
| **D1** | `mobile/src/session/sessionMachine.ts:13-37, 78-95` | Ações `POLL_ERROR`, `POLL_EXPIRED` adicionadas. Estado `ERROR` para 'cancelled'/'expired' e TTL de 30 min ("Tempo da sessão esgotado. Inicie novamente."). `POLL_DONE` distingue `seenActive: true` (DONE) de sem abastecimento (ERROR: "Sessão encerrada sem abastecimento. Se precisar, inicie novamente."). Rascunhos removidos. | Concluído | Nenhum |
| **D2** | `mobile/src/screens/OperationResultScreen.tsx:32-72` | Polling a cada 2s com guarda de sobreposição (`isFetching.current`), `AbortController` cancelado ao desmontar, e aviso "Sem conexão. Tentando novamente..." após 3 falhas consecutivas sem encerrar a sessão. | Concluído | Nenhum |
| **D3** | `mobile/src/screens/OperationResultScreen.tsx:97-124` | Mapeamento completo dos erros reais do contrato (geofence via status 403 e mensagem do servidor, `facial_verification_expired` com botão para refazer validação, códigos BLE em português, 404/409, e mensagem amigável para desconhecidos). | Concluído | Nenhum |
| **D4** | `mobile/src/screens/FacialAuthScreen.tsx:18, 59-75, 80-90, 137` | 429 por sessão vai para `BLOCKED_NEEDS_MANAGER` e chama `reportFacialFailure`; 429 por hora exibe "Muitas tentativas. Tente mais tarde." com `retryBlocked: true`. Fallback quando `attempts_left` é ausente. Botão desabilitado até `cameraReady`. | Concluído | Nenhum |
| **D5** | `mobile/src/screens/FacialAuthScreen.tsx:40-62` | Redimensionamento para 720 px com `expo-image-manipulator` (compress 0.6, JPEG, base64: true), validação de limite ≤ 2 MB decodificado, envio de base64 puro sem prefixo `data:`. | Concluído | Nenhum |
| **E1** | `mobile/tests/sessionMachine.test.ts:3-145` | Testes unitários para todas as ações e transições da máquina de estados (REQUEST_SUCCESS, FACIAL_VERIFY_*, AUTHORIZE_*, POLL_*, expiração, RESET). | Concluído (11 testes passando) | Nenhum |
| **E2** | `mobile/tests/FacialAuthScreen.test.tsx:46-180` | Testes cobrindo 429 por sessão, 429 por hora, erro de rede, 400 de imagem, botão desabilitado antes de `cameraReady`, e foto redimensionada sem `data:`. | Concluído (8 testes passando) | Nenhum |
| **E3** | `mobile/tests/OperationResultScreen.test.tsx:33-322` | Testes de autorização com GPS concedido/negado, mapeamento de todos os erros reais do D3, polling com timers falsos (expirada, cancelada, sem abastecimento, 3 falhas de rede e cleanup ao desmontar). | Concluído (13 testes passando) | Nenhum |
| **E4** | `mobile/tests/DashboardScreen.test.tsx:18-85` | Testes de exibição condicional do botão BLE, estado com veículo null e retomada 409 conforme status. | Concluído (4 testes passando) | Nenhum |
| **E5** | `mobile/tests/bleLock.test.ts:3-38` | Testes de `getBleLock` retornando `unavailableBleLock` em produção e `mockBleLock` somente em DEV com `EXPO_PUBLIC_BLE_MOCK === 'true'`. | Concluído (3 testes passando) | Nenhum |

---

## Buscas Negativas de Código Morto / Rascunhos

Executadas e verificadas no repositório (todas com resultado vazio e código de saída 1):

1. `git grep -n "response.truck\|truck?: Vehicle\|saveVehicle({}" -- mobile/src` -> **VAZIO**
2. `git grep -n "Wait,\|wait,\|like 503\|TODO" -- mobile/src mobile/tests` -> **VAZIO**
3. `git grep -n "empty-mock\|setup-env" -- mobile` -> **VAZIO**
4. `git grep -n "includes('geofence')" -- mobile/src` -> **VAZIO**
5. `git grep -n "mock_photo_uri\|base64_placeholder\|getAuthToken\|vec_550\|validateBiometrics\|syncOperation\|syncQueue\|finishSession" -- mobile/src mobile/App.tsx` -> **VAZIO**

---

## Prova de Execução dos Testes e Build

### 1. Typecheck TypeScript
```
> npx tsc --noEmit
(nenhum erro, código de saída 0)
```

### 2. Execução Jest Rodada 1 (Normal)
```
Test Suites: 8 passed, 8 total
Tests:       56 passed, 56 total
Snapshots:   0 total
Time:        12.71 s
Ran all test suites.
```

### 3. Execução Jest Rodada 2 (--no-cache)
```
Test Suites: 8 passed, 8 total
Tests:       56 passed, 56 total
Snapshots:   0 total
Time:        40.559 s
Ran all test suites.
```

---

## Pendências Registradas

### Pendências de BACKEND (Não implementadas no mobile)
1. **Cancelamento da sessão pelo motorista**: Não existe endpoint para o motorista cancelar uma sessão em andamento (`DELETE` ou `POST /sessions/:id/cancel` por motorista). A sessão só se encerra por expiração de TTL (30 min) ou ação do gestor.
2. **GET /sessions/:id com o resultado do abastecimento**: O app precisa inferir o encerramento da sessão quando `/sessions/:truckId/active` retorna `null`. Um endpoint com o detalhamento pós-abastecimento (litros abastecidos, valor, etc.) é necessário para exibição de recibo ao motorista.
3. **Provedor facial real com prova de vida (Liveness)**: O backend atualmente roda com mock ou threshold fixo; provedor com desafio ativo/passivo de prova de vida em nuvem ou SDK nativo precisa ser integrado no backend.

### Pendência de HARDWARE
1. **Protocolo BLE da trava do bocal**: O app abstrai o travamento/destravamento via `BleLock` (`mockBleLock` e `unavailableBleLock`). A integração nativa real requer a especificação do protocolo GATT (Service UUID, Characteristic UUID, handshake criptográfico de desafio e resposta) do hardware embarcado.
