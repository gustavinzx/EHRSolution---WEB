# Guia de Hardening e Prontidão para Produção — EHR Solutions

Este documento consolida os requisitos operacionais, arquiteturais e de segurança mandatórios para o deploy e operação da plataforma **EHR Solutions** em ambiente de produção real.

---

## 1. Comunicação Segura (HTTPS Obrigatório)
- **Criptografia em Trânsito:** Em ambiente de produção (`NODE_ENV=production`), o servidor Express redireciona compulsoriamente todas as requisições HTTP para HTTPS (código 301), preservando os parâmetros originais da URL.
- **Isolamento de Exceções:** Apenas a rota de probe/healthcheck `GET /api/health` é isenta de redirecionamento HTTPS, garantindo a integração correta com balanceadores de carga internos e probes de orquestração (Kubernetes, AWS ALB, NGINX).
- **Certificados e TLS:** Recomenda-se TLS 1.3 (ou TLS 1.2 com cifras fortes). O encerramento TLS deve ocorrer no proxy reverso/API Gateway corporativo ou via túnel seguro.

---

## 2. Segredo Criptográfico da Sessão (JWT_SECRET Forte)
- **Validação de Inicialização:** Na subida do servidor com `NODE_ENV=production`, o backend executa validação estrita do segredo via `jwtValidator.js`.
- **Requisitos do Segredo:**
  - Presença obrigatória da variável `JWT_SECRET`.
  - Comprimento mínimo de **32 caracteres**.
  - Proibição absoluta de segredos padrão ou triviais (tais como `change_this_secret_in_production`, `test_secret`, `ehr_secret_mude_em_producao_2024`).
- **Falha Rápida (Fail-Fast):** Se o segredo não atender aos critérios, o backend emite erro e aborta imediatamente o processo (`process.exit(1)`), impedindo execuções vulneráveis a falsificação de tokens.
- **Docker Compose:** No arquivo `docker-compose.yml`, o segredo é declarado com `${JWT_SECRET:?defina JWT_SECRET}`, impedindo que contêineres subam sem a injeção do segredo pelo operador.

---

## 3. Proxy Reverso e Endereçamento de Clientes (TRUST_PROXY)
- **Identificação Real do Cliente:** Em arquiteturas com balanceador de carga, CDN (ex: Cloudflare) ou proxy reverso, o IP do cliente chega nos cabeçalhos `X-Forwarded-For`.
- **Configuração:** Defina a variável `TRUST_PROXY=1` (ou a contagem precisa de saltos do proxy reverso) no `.env`.
- **Alerta em Produção:** Se `NODE_ENV=production` for iniciado sem `TRUST_PROXY` configurado, o servidor emite aviso visível no log alertando sobre o risco de distorção de IP no rate limiter.

---

## 4. Política de Origem Cruzada (CORS_ORIGINS)
- **Restrição de Domínios:** Em produção, a variável `CORS_ORIGINS` deve conter estritamente a lista de domínios autorizados separados por vírgula (ex: `https://painel.frotas-ehr.com.br,https://gestao.frotas-ehr.com.br`).
- **Proibição de Wildcards:** Nunca utilize `*` ou permita origens arbitrárias em produção.

---

## 5. Provedor Facial Real (NOT_IMPLEMENTED em Produção)
- **Status Atual:** O provedor `mock` (`FACE_PROVIDER=mock`) é restrito exclusivamente ao ambiente de desenvolvimento e testes.
- **Proteção:** O servidor rejeita categoricamente `FACE_PROVIDER=mock` quando `NODE_ENV=production`, lançando erro fatal.
- **Integração Real:** Em produção sem provedor configurado, a biometria facial atua em modo desativado seguro (`PROVIDER_NOT_CONFIGURED`), retornando HTTP 503 com mensagem explícita.
- **Próximos Passos:** Para entrada em operação com motoristas reais, é mandatória a integração com provedor forense certificado (ex: AWS Rekognition com Liveness ativo), garantindo prova de vida contra ataques de apresentação (fotos estáticas, vídeos ou máscaras).

---

## 6. Conexão Bluetooth (BLE Real)
- **Status Atual:** A liberação física por Bluetooth (`mockBleLock`) é alcançável estritamente em builds com `__DEV__ === true` e `EXPO_PUBLIC_BLE_MOCK=true`.
- **Proteção de Build:** Em builds de release/produção (`__DEV__ === false`), a função `getBleLock()` retorna incondicionalmente `unavailableBleLock`, bloqueando qualquer chamada de simulação.
- **Hardware Real:** A conexão BLE definitiva aguarda a especificação final do protocolo criptográfico proprietário e chave assimétrica da trava eletromecânica do tanque.

---

## 7. Desativação de Simuladores e Hardware Virtual
- **Simulação de Anomalias:** As variáveis e endpoints legados de simulação de queda de combustível foram integralmente erradicados da base de código.
- **Simulador de Telemetria:** Em produção (`NODE_ENV=production`), o motor de simulação de rotas rodoviárias não é inicializado; a ingestão de telemetria ocorre exclusivamente via rotas autênticas de hardware.
- **VIRTUAL_HARDWARE_ENABLED:** O hardware virtual (`virtualHardware.js`) recusa execução e aborta a subida em produção caso a variável esteja como `true`.

---

## 8. Desativação de Seed e Criação do Primeiro Gestor
- **Proteção do Seed:** O script `npm run seed` (`seed.js`) é restrito ao desenvolvimento: recusa execução em produção (`NODE_ENV=production`) e exige a flag explícita `ALLOW_SEED_WIPE=true`.
- **Comando de Produção:** Para criar o primeiro usuário gestor administrador no ambiente de produção de forma segura:
  ```bash
  cd backend
  npm run create-admin -- --email "gestor.producao@empresa.com.br" --password "SenhaForte@2026#Segura" --name "Gestor Geral"
  ```
  *(Ou execute interativamente sem parâmetros para digitar a senha em prompt seguro, sem valores padrão no código).*

---

## 9. Provisionamento de Chaves de Hardware (Single-Reveal)
- **Segurança da Chave:** Cada caminhão possui uma chave de API de hardware criptográfica (`api_key`).
- **Visualização Única:** A chave é gerada pelo gestor no painel (`POST /api/fleet/:id/hardware-key`) e revelada **uma única vez** na resposta da requisição.
- **Hash no Banco:** O servidor armazena unicamente o hash SHA-256 (`api_key_hash`) e o prefixo identificador de 8 caracteres (`api_key_prefix`), impossibilitando a recuperação da chave em caso de vazamento da base de dados.
- **Revogação Imediata:** Chaves comprometidas podem ser revogadas a qualquer momento via painel (`DELETE /api/fleet/:id/hardware-key`).

---

## 10. Auditoria e Anonimização de Dados (LGPD)
- **Integridade da Trilha Antifraude:** A exclusão de motoristas e caminhões não realiza `DELETE` físico nas tabelas com histórico pericial.
- **Anonimização Forense:**
  - O motorista é anonimizado (`name` = `Motorista Anonimizado #id`, `email` = `anonimizado_id@removido.local`, telefone e fotos nulos, hash de senha invalidado, status `deleted`).
  - Logs de abastecimento (`fueling_logs`), sessões (`fueling_sessions`), alertas (`fleet_alerts`) e tentativas faciais (`facial_attempts`) mantêm a referência ao ID original.
  - Registros marcados como `deleted` são omitidos de listagens comuns e impossibilitados de autenticação.

---

## 11. Carteira Sicoob (Valores Estimativos)
- **Natureza dos Dados:** Atualmente, não há integração bancária transacional ativa com APIs do Sicoob.
- **Transparência Forense:**
  - O status da integração bancária é permanentemente `not_configured`.
  - Todas as transações da carteira retornam status `estimated`.
  - Os valores apresentados são estritamente estimativas calculadas pelo volume de litros abastecido multiplicado pelo preço médio de referência da ANP.
  - Não representam faturas de cartão, débitos em conta ou cobranças bancárias reais.

---

## 12. Armazenamento de Tokens no Painel Web (Nota de Segurança)
- **Mitigação Recomendada:** O painel administrativo atual utiliza `localStorage` para armazenar o token JWT do gestor.
- **Evolução Forense:** Em ambientes corporativos de máxima criticidade, recomenda-se a substituição para cookies `httpOnly`, `Secure` e `SameSite=Strict`, eliminando vetores de exfiltração de token via Cross-Site Scripting (XSS).
