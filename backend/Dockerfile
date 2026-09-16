FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Executa seed para popular banco com dados demo na inicialização
CMD ["sh", "-c", "node src/seed/seed.js && node src/index.js"]
