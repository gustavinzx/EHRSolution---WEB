# EHR Solutions - Fleet Management

Sistema completo para gestão de frotas, motoristas, regras de abastecimento e integração de hardware (bombas e rastreamento).

## Funcionalidades Principais
- **Painel de Controle Administrativo (Web):** SPA em React para visualizar posições de caminhões via WebSockets, gerenciar motoristas, e definir políticas de segurança de consumo e desvios.
- **Sistema de Liberação Dupla (Mobile / Hardware):**
  - **Reconhecimento Facial:** Validação antifraude com motorista na frente da bomba.
  - **BLE Fallback:** Conexão Bluetooth entre celular e bomba em áreas de sombra de rede.
  - **Override Emergencial:** O Gestor pode liberar a bomba à distância via painel em caso de falha sistêmica (limitado aos papéis superiores).
- **Papéis de Acesso e Permissões:**
  - `admin`: Gerencia usuários, configurações globais e tem acesso total.
  - `manager`: Operações diárias, liberação emergencial, criação de motoristas, mas sem acesso à gestão de painel ou configurações de alarme.
  - `auditor`: Modo somente leitura. Acesso livre a histórico de logs e painéis, mas sem nenhuma permissão de gravação/edição.

---

## Variáveis de Ambiente (`backend/.env`)

Para executar o sistema localmente, crie o arquivo `backend/.env` (use o `backend/.env.example` como base).

| Variável | Descrição | Valor Padrão (Local) |
| :--- | :--- | :--- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Credenciais do PostgreSQL. | `localhost:5432`, `ehr_fleet`, etc. |
| `JWT_SECRET` | Chave para assinar JWT. **Regra de Produção:** O sistema recusa inicializar se `NODE_ENV=production` e a chave tiver menos de 32 caracteres ou for "change_this_secret_in_production". | `test_secret_123` |
| `FACE_PROVIDER` | Motor de biometria. Opções: `mock` (simulado para dev) ou nuvem real. | `mock` |
| `FACE_MATCH_THRESHOLD` | Threshold de precisão do match facial (0 a 1). | `0.85` |
| `FACIAL_ATTEMPTS_RETENTION_DAYS` | Tempo (em dias) que as fotos de tentativas faciais com falha ficam retidas no DB antes de exclusão automática via rotina interna. | `7` |
| `SIMULATOR_ENABLED` | Liga o simulador de telemetria e GPS (via WebSockets). | `true` |
| `ALLOW_SEED_WIPE` | Permite que o comando de seed apague dados existentes. | `true` |
| `GEOFENCE_KM` | Raio geográfico máximo entre motorista e caminhão para aceitar criação de sessão (em Km). | `0.2` |

---

## 🔒 Segurança

* **Reconhecimento Facial MOCK:** O uso de `FACE_PROVIDER=mock` é estritamente proibido no ambiente de produção. O servidor emitirá um erro letal caso não esteja mockado corretamente no desenvolvimento ou caso as integrações reais falhem em produção (Fail Closed).
* **Armazenamento de Biometria:** O banco de dados salva exclusivamente **referências e templates** faciais extraídos e codificados. O sistema nunca salva fotos limpas (JPG/PNG) da face aprova do motorista. Fotos de *tentativas frustradas* são mantidas apenas por `FACIAL_ATTEMPTS_RETENTION_DAYS` para auditoria, sendo varridas pelo *Garbage Collector* automaticamente após este prazo.
* **Armazenamento Seguro de JWT:** O token JWT dos gestores (Painel Web) fica no `localStorage` por necessidade de SPA. Proteções pesadas de XSS e controle de sessão curtos são recomendados no App Secundário para proteção integral, além de invalidações baseadas em banco (que já existem ao desativar motoristas/usuários).

> **Aviso:** O provedor real em nuvem para IA facial (AWS/Azure) **ainda não está acoplado** à versão de produção atual, e a checagem de "Liveness" (prova de vida com piscar) é o próximo requisito do roadmap de integração.

---

## Como Rodar o Sistema Localmente (com Docker)

O repositório já inclui configurações prontas para subir banco, backend e frontend.

1. Faça o build inicial e suba os contêineres:
   ```bash
   docker-compose down -v
   docker-compose up --build -d
   ```
2. O sistema aplicará **automaticamente as migrations** do DB `ehr_fleet`.

As portas expostas são:
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- Banco (PostgreSQL): `5432`

## Execução de Testes (TDD/CI)

Toda a lógica de negócios e segurança é protegida por testes extensivos.

**Backend (Jest + Supertest):**
Garante isolamento de transações, regras antifraude e controle de roles.
```bash
cd backend
npm run test
# (Nota: o banco guard "ehr_fleet_test" deve estar criado localmente antes de rodar fora do Docker)
```

**Frontend (Vitest + React Testing Library):**
Garante que a UI renderiza/protege adequadamente opções baseadas nos JWT claims e Context API.
```bash
cd frontend
npm run test
```
