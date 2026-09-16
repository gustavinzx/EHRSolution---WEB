# EHR Solutions — Plataforma Web do Gestor de Frotas

> **Protótipo com dados fictícios** — dados de seed/demo estão marcados com `// DADOS DEMO` no código e podem ser substituídos por dados reais quando disponíveis.

Sistema de controle de travas e monitoramento de abastecimento para frotas, desenvolvido em parceria entre EHR Solutions e UCB.

---

## Stack

| Camada      | Tecnologia                          |
|-------------|-------------------------------------|
| Frontend    | React 18 + Vite + Leaflet           |
| Backend     | Node.js 20 + Express                |
| Banco       | PostgreSQL 16                       |
| Auth        | JWT + bcrypt                        |
| Deploy      | Docker + docker-compose             |

---

## Início Rápido (Docker — recomendado)

> Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando.

```bash
# 1. Clone / abra o projeto
cd EHR-Solutions-Web

# 2. Suba tudo com um comando
docker-compose up --build
```

Após o build (~2 min na primeira vez):

| Serviço    | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:5173        |
| Backend API| http://localhost:3001/api    |
| Health     | http://localhost:3001/api/health |

**Login demo:**
- Email: `gestor@ehr.com`
- Senha: `Demo@1234`

Para parar: `docker-compose down`  
Para resetar o banco: `docker-compose down -v`

---

## Desenvolvimento Local (sem Docker)

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16 rodando localmente

### Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Postgres

# Popular banco com dados demo
npm run seed

# Iniciar servidor (porta 3001)
npm run dev
```

### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Iniciar dev server (porta 5173)
npm run dev
```

O Vite está configurado para fazer proxy de `/api` → `http://localhost:3001`, sem problemas de CORS.

---

## Estrutura do Projeto

```
EHR-Solutions-Web/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js              # Entry point
│       ├── config/
│       │   ├── db.js             # Pool PostgreSQL
│       │   └── schema.sql        # DDL das tabelas
│       ├── middleware/
│       │   ├── auth.js           # JWT verification
│       │   └── validate.js       # express-validator helper
│       ├── controllers/          # Lógica de negócio
│       ├── routes/               # Endpoints REST
│       └── seed/
│           └── seed.js           # ⚠️ DADOS DEMO — substituir
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx               # Rotas + proteção
        ├── index.css             # Tokens CSS do tema dark
        ├── api/client.js         # Axios + interceptors JWT
        ├── hooks/                # useAuth, useFleet, useDrivers, useFueling
        ├── components/           # Sidebar, MapView, StatCard, etc.
        └── pages/                # Login, Dashboard, Drivers, Fleet, Fueling, Reports
```

---

## API Endpoints

Todos os endpoints (exceto `/api/auth/login`) requerem header:
```
Authorization: Bearer <token>
```

| Método | Endpoint                         | Descrição                        |
|--------|----------------------------------|----------------------------------|
| POST   | /api/auth/login                  | Login, retorna JWT               |
| GET    | /api/drivers                     | Lista motoristas                 |
| POST   | /api/drivers                     | Cadastrar motorista              |
| PUT    | /api/drivers/:id                 | Editar motorista                 |
| PATCH  | /api/drivers/:id/deactivate      | Desativar motorista              |
| POST   | /api/drivers/:id/trucks          | Vincular motorista ↔ caminhão    |
| GET    | /api/fleet                       | Lista frota com status           |
| GET    | /api/fleet/:id                   | Detalhe de um caminhão           |
| GET    | /api/fueling                     | Logs de abastecimento            |
| GET    | /api/reports/export              | Exportar CSV (params: truck_id, start, end) |

---

## Dados Demo

O seed cria automaticamente:
- **1 gestor** (gestor@ehr.com / Demo@1234)
- **10 motoristas** com nomes brasileiros
- **10 caminhões** (Volvo/Scania/Mercedes, placas BR)
- **30 logs** de abastecimento dos últimos 30 dias

> Todos marcados com `// DADOS DEMO — substituir por dados reais` no arquivo `backend/src/seed/seed.js`.

---

## Segurança

- Senhas armazenadas com **bcrypt** (salt rounds = 12)
- Tokens **JWT** com expiração de 8h
- Todas as rotas de dados protegidas por middleware
- Validação de input no backend com **express-validator**

---

## Fora de Escopo (MVP Web)

- Firmware / hardware
- Comunicação LoRa / BLE real
- App mobile
- Reconhecimento facial real (simulado nos logs como campo `release_method`)
