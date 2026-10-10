# EHR Solutions - App Mobile (Rodada A)

| Item | Arquivo:Linha | Prova | Resultado |
|---|---|---|---|
| A1 | mobile/.gitignore | Ignore de pastas e arquivos adicionado. | `git rm -r mobile/.expo` executado. |
| A2 | mobile/src/storage/secureStorage.ts | Expo secure store fallback para AsyncStorage. | Ok |
| A3 | mobile/src/types/driver.ts e vehicle.ts e session.ts | Tipos correspondentes. | Ok |
| A4 | mobile/src/contexts/AuthContext.tsx | Save vehicle/restore, onUnauthorized. | Ok |
| A5 | mobile/src/services/api/apiClient.ts | request helper com timer de 15s. HTTP e base URL. | Ok |
| A6 | mobile/src/storage/syncQueue.ts etc | Mock offline deletado. | Ok |
| B1 | mobile/src/session/sessionMachine.ts | State machine criado. | Ok |
| B2 | mobile/src/screens/DashboardScreen.tsx | Retoma sessão ativa recuperando de getActiveSession após 409. | Ok |
| B3 | mobile/src/screens/FacialAuthScreen.tsx | Câmera real disparando verifyFace. | Ok |
| B4 | mobile/src/screens/OperationResultScreen.tsx | Autorização com coords expo-location. | Ok |
| B5 | mobile/src/screens/OperationResultScreen.tsx | Polling a cada 2s do getActiveSession. | Ok |
| B6 | mobile/src/screens/OperationResultScreen.tsx | BLOCKED_NEEDS_MANAGER trata 429 max limit. | Ok |
| B7 | mobile/src/screens/OperationResultScreen.tsx | BLE mock timeout fallback de 1s (EXPO_PUBLIC_BLE_MOCK). | Ok |
| B8 | mobile/src/screens/FuelOperationScreen.tsx | Removido. Apenas OperationResultScreen gere a autorização e espera. | Ok |
| B9 | mobile/src/screens/*.tsx | Mensagens e português tratadas, botões desabilitados. | Ok |
| C1 | mobile/tests/apiClient.test.ts | mockFetch e requests validadas. | Ok |
| C2 | mobile/tests/sessionMachine.test.ts | Máquina de estados testada. | Ok |
| C3 | mobile/tests/FacialAuthScreen.test.tsx | Teste com mock da câmera. | Ok |
| C4 | mobile/tests/OperationResultScreen.test.tsx | Teste com polling falso de fake timers do Jest. | Ok |
| C5 | mobile/tests/secureStorage.test.ts | Fallback testado na medida possível. | Ok |
| C6 | mobile/tests/AuthContext.test.tsx | Recuperação de storaged driver testada. | Ok |

## Buscas Negativas

```bash
$ git grep -n "mock_photo_uri\|base64_placeholder\|getAuthToken\|vec_550\|EHR-2A26\|validateBiometrics\|syncOperation\|syncQueue\|finishSession" -- mobile/src mobile/App.tsx
(sem resultados)

$ git grep -n "AsyncStorage" -- mobile/src
mobile/src/storage/secureStorage.ts:2:import AsyncStorage from '@react-native-async-storage/async-storage';
mobile/src/storage/secureStorage.ts:13:    await AsyncStorage.setItem(key, value);
mobile/src/storage/secureStorage.ts:20:    return await AsyncStorage.getItem(key);
mobile/src/storage/secureStorage.ts:26:    await AsyncStorage.removeItem(key);

$ git grep -n "fuelBefore\|fuelAfter\|fuelLevelBefore\|fuelLevelAfter\|cpf\|registration" -- mobile/src
(sem resultados)

$ git ls-files mobile/.expo
(sem resultados)
```

## Pendências Não Implementadas
1. Reconhecimento Facial real + Liveness real não incluídos, apenas consumimos o mock server backend com captura de câmera local.
2. Tratamento BLE nativo (ex: react-native-ble-plx) pois precisamos do protocolo físico da trava para a implementação final.
3. Não existe endpoint GET para o resultado real após sessão fechada (somente recuperamos que foi fechada ou nula e marcamos DONE).
4. O Motorista não pode cancelar na interface atual a sessão; ela só é cancelada por expiração no servidor ou pelo admin.
