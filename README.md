# EHR Solutions - Plataforma de Abastecimento IoT

O **EHR Solutions Fleet Management** é um sistema completo para controle de frotas focadas em abastecimento e prevenção contra desvios de combustível. A solução foi arquitetada para unir telemetria veicular, comunicação direta com hardware IoT (válvulas e bombas) e um App mobile que realiza validação biométrica facial antes de liberar a trava de combustível, atendendo também aos preceitos da LGPD.

## Tecnologias e Camadas
- **Backend**: Node.js, Express, PostgreSQL, JWT, Socket.IO. Conta com um motor de regras para detecção de fraudes em tempo real.
  - **AVISO IMPORTANTE (Provedor Facial):** A integração com provedores faciais reais é um esqueleto e lançará erro explícito (NOT_IMPLEMENTED) em modo `rekognition`. A prova de vida (liveness) real não existe neste código base. Para desenvolvimento, utilize apenas o modo `mock`. Sem configurar `FACE_PROVIDER`, as rotas faciais respondem 503.
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
- `FACE_MOCK_MODE`: Modo de validação do provedor facial mock. Aceita `marker` (padrão, exige marcador na imagem) ou `always_match` (somente desenvolvimento; nunca em produção). Permite testar o app mobile com fotos reais da câmera sem reprovação biométrica.
- `FACE_MATCH_THRESHOLD`: Define o nível de confiança (Confidence) biométrico (padrão `0.90`).
- `FACIAL_ATTEMPTS_RETENTION_DAYS`: Dias de retenção dos metadados de biometria facial (padrão `90`).
- `GEOFENCE_KM`: Distância em km permitida para autorizar via geofence (padrão `0.2`).
- `VIRTUAL_HARDWARE_ENABLED`: Ativa a simulação de bomba e trava física de hardware (somente desenvolvimento/demonstração; nunca em produção; desligar quando o hardware real for integrado). Padrão `false`.
- `ANP_API_BASE`: URL base da API oficial de Revendedores da ANP (padrão `https://revendedoresapi.anp.gov.br/v1`).

## Sincronização do Catálogo Nacional de Postos (ANP)
O painel inclui uma consulta ao cadastro oficial de postos revendedores de combustíveis automotivos de todo o Brasil.
- **Fonte Oficial**: Dados Abertos e API de Consulta de Revendedores da ANP (`https://revendedoresapi.anp.gov.br/v1`).
- **Como sincronizar**:
  1. Para sincronizar uma UF específica (ex.: Distrito Federal):
     ```bash
     cd backend
     npm run anp:sync -- --uf DF
     ```
  2. Para sincronizar todas as 27 UFs do Brasil (uma por vez, com intervalo entre requisições; se uma UF falhar, o processo continua nas demais, lista as falhas ao final e encerra com código diferente de zero):
     ```bash
     cd backend
     npm run anp:sync
     ```
  3. **Trava de segurança contra desativação em massa (`--allow-mass-deactivation`)**:
     A sincronização só desativa postos ausentes de uma UF quando: (a) nenhum registro foi descartado pela normalização, (b) a quantidade de CNPJs distintos recebidos é `>= totalRegistro` informado pela API, e (c) a desativação afetaria no máximo **20%** dos postos ativos da UF. Caso qualquer condição falhe, o upsert dos postos válidos é mantido, nenhuma desativação é feita e a execução é registrada com `status = 'partial'`. Para autorizar conscientemente uma desativação acima de 20%, adicione a flag `--allow-mass-deactivation`:
     ```bash
     cd backend
     npm run anp:sync -- --uf DF --allow-mass-deactivation
     ```
- **Aviso sobre novos cadastros**: Como os dados provêm da base pública oficial da ANP, postos recém-abertos ou alterações cadastrais recentes dependem do processamento e publicação pela própria ANP e podem demorar a aparecer no catálogo. A sincronização é executada sob demanda via CLI (não roda automaticamente no boot do servidor nem durante a suíte de testes).

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

