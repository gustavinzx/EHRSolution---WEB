# EHR Solutions - Fleet Management

Sistema avançado de gestão de frotas e controle de combustível, construído com arquitetura Node.js (Express), PostgreSQL, e React (Vite). Focado em segurança zero-trust para prevenir desvios de combustível.

## Arquitetura e Funcionalidades

- **Reconhecimento Facial no Servidor:** Validação biométrica estrita para autorização de abastecimento na bomba.
- **Autorização BLE (Fallback offline):** Validação via token criptográfico assinado pelo caminhão para cenários sem internet.
- **Motor de Anomalias:** Algoritmo que detecta quedas súbitas de combustível via telemetria sem registro correspondente de abastecimento.
- **Controle Baseado em Papéis (RBAC):** Níveis granulares de acesso: `admin`, `manager`, e `auditor`.
- **Desativação Imediata (Kill-switch):** Quando um motorista é desativado (ex: suspeita de fraude), qualquer sessão de abastecimento ativa é derrubada na hora via WebSocket.
- **Dados Imutáveis e Auditoria:** Alertas não podem ser deletados (apenas resolvidos com nota e autoria) e o histórico de alterações das configurações de sensibilidade é preservado (`alert_settings_history`).

## Requisitos

- Node.js >= 18
- PostgreSQL >= 14
- PM2 (para produção)

## Executando Localmente

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure as variáveis no .env, garantindo que o DB exista.
npm run start
```
*O banco é populado automaticamente através do runner de migrations no primeiro startup.*

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```
*Acesse em http://localhost:5173.*

## Scripts Disponíveis

- `npm test` no backend executará a suíte de testes rigorosa com Jest, que cobre desde os limites de tentativas faciais até as projeções seguras de API. O banco de dados para os testes DEVE terminar em `_test`.

## Permissões

| Role | Permissões |
| --- | --- |
| **Admin** | Acesso total. Único que pode alterar Configurações de Alertas e gerenciar Papéis de usuários. |
| **Manager** | Operacional (resolver alertas, despachar caminhões, override de abastecimento, cadastrar motoristas). |
| **Auditor** | Leitura estrita (GET apenas). Todos os botões de ação na interface são ocultos ou bloqueados. |

## Documentação API Mobile

A documentação dos endpoints para integração com o aplicativo móvel dos motoristas pode ser encontrada em `docs/API_MOBILE.md`.
