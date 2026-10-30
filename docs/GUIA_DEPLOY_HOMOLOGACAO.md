# Guia Prático de Deploy para Testes da Empresa (Sem Hardware Físico)

Este guia mostra o passo a passo completo para colocar o **Painel Web**, a **API Backend**, o **Banco PostgreSQL** e o **App Mobile** rodando 24h por dia em um servidor para a empresa testar, utilizando o **Simulador de Frota** e o **Hardware Virtual** (bomba e sensores simulados automaticamente após a selfie do motorista).

---

## 1. Como Funciona a Arquitetura de Homologação

No arquivo [`docker-compose.staging.yml`](../docker-compose.staging.yml), tudo é unificado em **uma única porta de entrada** (o Nginx do container `frontend`):
- **`/`** → Abre o **Painel Web da Empresa** (React).
- **`/api/...`** → Redireciona automaticamente para o **Backend API** (usado tanto pelo Painel Web quanto pelo App Mobile).
- **`/socket.io/...`** → Redireciona os **WebSockets em Tempo Real** (atualização ao vivo dos caminhões no mapa e alertas).

Isso significa que você precisa de **apenas 1 endereço HTTPS** (ex: `https://frota.suaempresa.com.br`) para o Painel Web e para o App Mobile!

---

## 2. Subindo o Servidor (VPS Linux Ubuntu / Debian)

### Passo 2.1 — Instalar Docker no Servidor
Conecte-se via SSH ao servidor Ubuntu e rode:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Passo 2.2 — Clonar o Repositório e Criar o `.env`
```bash
git clone https://github.com/gustavinzx/EHRSolution---WEB.git
cd EHRSolution---WEB

# Gere um segredo JWT seguro de 64 caracteres automaticamente:
cat <<EOF > .env
JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)
HTTP_PORT=8080
EOF
```

### Passo 2.3 — Subir os Containers
```bash
docker compose -f docker-compose.staging.yml up -d --build
```

### Passo 2.4 — Popular os Dados Iniciais (Apenas na 1ª Vez)
Para criar o banco inicial de demonstração (`gestor@ehr.com` / `motorista@ehr.com` com senha `Demo@1234`, caminhão `EHR-0001` e posto de teste):
```bash
docker exec -e ALLOW_SEED_WIPE=true ehr_backend_staging npm run seed
```
*(Ou, se preferir começar com o banco limpo e criar apenas o seu usuário Gestor Administrador personalizado):*
```bash
docker exec -it ehr_backend_staging npm run create-admin -- --email "gestor@empresa.com.br" --name "Gestor Principal"
```
> **Segurança de Dados:** O `docker-compose.staging.yml` vem com `RUN_SEED_ON_BOOT=false`. Isso garante que, se o servidor reiniciar, **nenhum motorista, caminhão ou abastecimento cadastrado pela empresa será apagado**.

---

## 3. Ativando HTTPS Fixo e Gratuito no Servidor

Para que o App Mobile funcione em qualquer lugar (4G/5G ou Wi-Fi da empresa) e nunca desconecte:

### Opção A — Usando um Domínio (ou DuckDNS gratuito) com Caddy (Mais Simples)
Se você apontar um domínio (ex: `frota.suaempresa.com.br` ou um gratuito do [duckdns.org](https://www.duckdns.org)) para o IP público do servidor:
```bash
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile <<EOF
frota.suaempresa.com.br {
    reverse_proxy localhost:8080
}
EOF
sudo systemctl restart caddy
```
Pronto! O Caddy gera e renova o certificado HTTPS automaticamente:
- **Painel Web:** `https://frota.suaempresa.com.br`
- **URL da API para o App Mobile:** `https://frota.suaempresa.com.br/api`
- **Teste de Saúde:** `https://frota.suaempresa.com.br/api/health` → `{"status":"ok"}`

### Opção B — Usando Cloudflare Tunnel no Servidor (Sem precisar abrir portas no Firewall)
Se quiser rodar o `cloudflared` como serviço permanente no Linux (apontando para `http://localhost:8080`), o mesmo endereço do túnel servirá **tanto o Painel Web quanto a API do App Mobile**!

---

## 4. Como Entregar o App Mobile para a Empresa Testar

### Opção 1 — Gerar um Arquivo `.APK` Instalável para Android (Recomendado)
Com o arquivo [`mobile/eas.json`](../mobile/eas.json) já configurado no projeto, você pode gerar um instalador `.apk` oficial na nuvem da Expo:

1. No arquivo `mobile/.env`, coloque o endereço HTTPS do seu servidor:
   ```env
   EXPO_PUBLIC_API_URL=https://frota.suaempresa.com.br/api
   ```
2. Na pasta `mobile/`, faça login na sua conta gratuita da Expo e dispare o build:
   ```bash
   cd mobile
   npx eas-cli login
   npx eas-cli build -p android --profile preview
   ```
3. Ao terminar, o EAS fornecerá um **link de download do `.apk`** (e um QR Code). Basta enviar esse link no WhatsApp da empresa: eles instalam o aplicativo **EHR Motorista** direto no Android, sem precisar do Expo Go e sem depender do seu PC!

### Opção 2 — Testar pelo Expo Go (SDK 58 — Android e iPhone)
Como o projeto já está atualizado para o **Expo SDK 58**, basta apontar o `mobile/.env` para `https://frota.suaempresa.com.br/api` e iniciar com `npx expo start --tunnel`.

---

## 5. Como a Empresa Faz o Teste Completo (Fluxo Sem Placa Física)

### Configuração no Render.com e Variáveis de Ambiente
Ao realizar o deploy no Render (via `Dockerfile` ou blueprint `render.yaml`), certifique-se de configurar as seguintes variáveis no painel de Environment do serviço:
- `VITE_MAPBOX_TOKEN`: **Obrigatório para mapas interativos**. Token público da sua conta Mapbox. Ele é repassado no build do frontend (`ARG/ENV VITE_MAPBOX_TOKEN` no `Dockerfile`). Se ausente, o sistema exibe a mensagem orientativa `"Token do Mapbox não configurado"` nos componentes de mapa e autocomplete sem quebrar a aplicação.


1. **No Painel Web (`https://frota.suaempresa.com.br`):**
   - A empresa faz login como Gestor, cadastra motoristas (anotando a senha temporária gerada), cadastra caminhões e vincula o motorista ao caminhão.
2. **No Celular (App EHR Motorista):**
   - O motorista entra com e-mail e senha (e pode ativar a **Biometria Digital / Face ID** para os próximos acessos).
   - Clica em **"Iniciar Abastecimento"** → **"Reconhecimento Facial"** e tira uma selfie.
3. **Mágica do Hardware Virtual (`VIRTUAL_HARDWARE_ENABLED=true`):**
   - Assim que a selfie é aprovada e o motorista autoriza a sessão:
     - Em **3 segundos**, o servidor simula a abertura da solenoide e o início da bomba (`status: active`).
     - Em **8 segundos**, o servidor finaliza o abastecimento (`status: completed`), calcula os litros abastecidos, atualiza o nível do tanque do caminhão e exibe o comprovante no celular e no Painel Web em tempo real!
