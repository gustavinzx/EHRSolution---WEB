# EHR Solutions - Plataforma de Abastecimento IoT

O **EHR Solutions Fleet Management** é um sistema completo para controle de frotas focadas em abastecimento e prevenção contra desvios de combustível. A solução foi arquitetada para unir telemetria veicular, comunicação direta com hardware IoT (válvulas e bombas) e um App mobile que realiza validação biométrica facial antes de liberar a trava de combustível, atendendo também aos preceitos da LGPD.

## Tecnologias e Camadas
- **Backend**: Node.js, Express, PostgreSQL, JWT, Socket.IO. Conta com um motor de regras para detecção de fraudes em tempo real e integração via AWS Rekognition para biometria facial.
- **Frontend Web**: React, Vite, Axios, React Router, React Leaflet (dashboard live com mapas). Painel administrativo com controle de papéis e permissões (RBAC).
- **Hardening e LGPD**: As imagens do reconhecimento facial NUNCA são salvas em disco. Apenas metadados são mantidos temporariamente na tabela `facial_attempts` (apagados após 90 dias, padrão definido por `FACIAL_ATTEMPTS_RETENTION_DAYS`). E-mails normalizados em letras minúsculas (Migration 011).

## Regras de Negócio e Segurança de Fluxo
- Um motorista não pode usar dois caminhões simultaneamente (sessões ativas impedem novas).
- O hardware rejeitará (ou o servidor rejeitará o hardware) se houver disparidade de chaves `x-api-key`.
- Tentativas frustradas de biometria facial estouram em um erro HTTP `429 Too Many Requests` (limite de 3 por sessão ou 10 por hora), forçando o bloqueio temporário ou a necessidade de fallback BLE.
- A validação da distância geográfica (Geofence) entre o motorista (App) e a estação ocorre no momento do `/authorize`.

## Configuração do Backend
Crie um `.env` em `backend/` com base no `.env.example`.

Variáveis de Controle Importantes:
- `FACE_PROVIDER`: Configura o provedor facial. Aceita `mock` (em ambiente de dev) ou `rekognition` (produção). Se deixado em branco ou não configurado, a API retorna erro `503 Service Unavailable` em rotas biométricas. (Nota: `mock` é **recusado com erro fatal** se a API iniciar em `NODE_ENV=production`).
- `FACE_MATCH_THRESHOLD`: Define o nível de confiança (Confidence) biométrico (padrão `0.90`).
- `FACIAL_ATTEMPTS_RETENTION_DAYS`: Dias de retenção dos metadados de biometria facial (padrão `90`).
- `GEOFENCE_KM`: Distância em km permitida para autorizar via geofence (padrão `0.2`).

## Como rodar localmente
1. **Banco de Dados**: Suba via `docker-compose up -d`.
2. **Backend**:
   - `cd backend`
   - `npm install`
   - `npm run dev` (Irá executar as migrations automaticamente, caso o banco esteja vazio).
3. **Frontend**:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

Para mais detalhes sobre as rotas mobile e a integração com a placa IoT, consulte a [Documentação da API Mobile (API_MOBILE.md)](docs/API_MOBILE.md).
