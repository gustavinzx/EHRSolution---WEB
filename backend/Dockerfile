FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Executa seed apenas quando RUN_SEED_ON_BOOT=true (evita apagar dados em restarts do container).
# As migrations já rodam automaticamente dentro de src/index.js na subida do servidor.
CMD ["sh", "-c", "if [ \"$RUN_SEED_ON_BOOT\" = \"true\" ]; then node src/seed/seed.js; fi && node src/index.js"]
