# EHR Solutions - Aplicativo Motorista

Aplicativo mobile em React Native / Expo para motoristas realizarem autenticação facial ou liberação por Bluetooth (fallback) e acompanharem o abastecimento de veículos da frota.

## Funcionalidades Implementadas

- **Login e Restauração de Sessão**: Autenticação com JWT de longa duração, vinculação com veículo atual do motorista.
- **Início e Retomada de Sessão**: Solicitação de sessão biométrica (`facial`) ou de contingência (`ble_fallback`).
- **Validação Facial na Nuvem**: Captura de imagem com redimensionamento a 720px, compressão JPEG e envio em Base64 puro para `POST /sessions/:id/verify-face`.
- **Cancelamento de Sessões**: O motorista pode cancelar o abastecimento nos estados permitidos (`FACIAL_PENDING`, `AUTHORIZING`, `WAITING_HARDWARE`, `BLOCKED_NEEDS_MANAGER`), bem como em sessões pendentes retomadas no Dashboard e em telas de erro de sessões travadas.
- **Resultado do Abastecimento**: Na conclusão (`DONE`), o app consulta `GET /sessions/:id` e exibe o volume abastecido e a duração em formato pt-BR (ou aviso de volume pendente de confirmação quando a telemetria não aferiu o dado).

## Como Testar Localmente

1. **Configuração do Backend (SOMENTE desenvolvimento)**:
   - No arquivo `backend/.env`, defina:
     ```env
     FACE_PROVIDER=mock
     FACE_MOCK_MODE=always_match
     ```
   - Inicie o backend: `npm run dev` na pasta `backend`.
   - Cadastre uma foto de motorista através do painel Web e garanta que o motorista possui um caminhão vinculado.

2. **Configuração do App Mobile**:
   - No arquivo `mobile/.env` (ou variável de ambiente do Expo):
     ```env
     EXPO_PUBLIC_API_URL=http://<IP_DO_SEU_PC>:3001/api
     ```
   - Inicie o app: `npx expo start` na pasta `mobile`.

## Pendências Conhecidas

1. **Protocolo BLE da Trava do Bocal**: A confirmação de hardware da trava física depende da especificação do protocolo GATT embarcado (Service UUID, Characteristic UUID, handshake criptográfico de desafio e resposta).
2. **Provedor Facial Real com Prova de Vida (Liveness)**: Integração com SDK de biometria facial passiva/ativa ou serviço de nuvem em produção.
