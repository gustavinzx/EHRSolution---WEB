# ─── Estágio 1: Compila o Painel Web (Frontend React/Vite) ──────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_MAPBOX_TOKEN=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ARG VITE_APP_ENV=""
ENV VITE_APP_ENV=$VITE_APP_ENV
RUN npm run build

# ─── Estágio 2: Servidor Unificado (Backend API + Socket.IO + Painel Web) ────
FROM node:20-alpine
WORKDIR /app

# Instala dependências do Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copia código do Backend e o build pronto do Frontend
COPY backend/ ./backend/
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

WORKDIR /app/backend
ENV SERVE_FRONTEND=true
EXPOSE 3001

CMD ["node", "src/index.js"]
