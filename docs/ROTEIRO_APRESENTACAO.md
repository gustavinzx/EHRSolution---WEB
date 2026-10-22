# Roteiro de Apresentação e Demonstração — EHR Solutions

> **Objetivo:** Guia passo a passo do que mostrar, clicar e falar durante a banca/avaliação (prazo de **27/11**), cobrindo o Painel Web do Gestor, o Aplicativo Mobile do Motorista, o Cadastro Nacional da ANP, o Provisionamento de Chaves de Hardware e a Auditoria/LGPD.
> **Tempo estimado de demonstração:** 8 a 10 minutos.

---

## 0. Checklist Pré-Apresentação (5 minutos antes)

1. **Banco e Backend rodando (`porta 3001`):**
   - No `backend/.env`, garanta para a demonstração fluida:
     - `FACE_PROVIDER=mock`
     - `FACE_MOCK_MODE=always_match`
     - `VIRTUAL_HARDWARE_ENABLED=true`

2. **Painel Web aberto (`http://localhost:5173`):**
   - Faça login com as credenciais administrativas criadas com `npm run create-admin` (ou cadastradas no ambiente de testes).
     - Para criar o primeiro gestor em produção: execute `npm run create-admin` informando e-mail e senha.
     - O seed (`npm run seed`) é restrito somente a desenvolvimento, exigindo ALLOW_SEED_WIPE=true e NODE_ENV != production.
3. **App Mobile no celular (Expo Go via Túnel HTTPS):**
   - Túnel Cloudflare ativo apontando para `http://localhost:3001`.
   - `npx expo start --tunnel` rodando na pasta `mobile/`.
   - Credenciais do motorista de demonstração prontas:
     - **E-mail:** `carlos.silva@ehr.com`
     - **Senha:** `Motorista@123`

---

## Ato 1 — Contexto do Problema e Visão Geral no Dashboard (1 min 30 s)

### O que fazer na tela
- Com o painel aberto na tela inicial (**Dashboard** `/`), aponte para os **4 indicadores superiores** (Total de Caminhões, Em Rota, Tanques Críticos e Abastecimentos Hoje), o **Mapa em Tempo Real** e o painel lateral de **Alertas** e **Últimos Abastecimentos**.

### O que falar
> *"Frotas rodoviárias sofrem perdas expressivas com desvio de combustível: abastecimentos em postos não credenciados, litros cobrados na bomba que não entram no tanque e uso indevido de cartões por terceiros. O **EHR Solutions** resolve isso unindo três pontas: o aplicativo do motorista com validação facial, a trava física inteligente no tanque do caminhão controlada pelo servidor, e este painel em tempo real para o gestor."*

---

## Ato 2 — Cadastro Nacional da ANP e Postos Homologados (1 min 30 s)

### O que fazer na tela
1. No menu lateral esquerdo, clique em **Postos** (`/stations`).
2. Mostre os contadores da base oficial da **ANP** (mais de **45.700 postos** sincronizados em todo o Brasil).
3. Filtre por **UF** (ex.: `SP`) ou busque por CNPJ/Razão Social para mostrar a resposta instantânea.
4. Mostre a coluna de status **Autorizado / Bloqueado**.

### O que falar
> *"Não dependemos de cadastro manual para saber onde o caminhão abasteceu. Sincronizamos diretamente com a base oficial de revendedores da **ANP** com mais de 45 mil postos. Quando o caminhão abastece, o servidor cruza automaticamente a coordenada com os postos num raio configurável de 150 metros e verifica se aquele CNPJ é homologado pela transportadora."*

---

## Ato 3 — Frota e Provisionamento Seguro da Chave do Hardware (2 min)

### O que fazer na tela
1. Clique em **Frota** (`/fleet`) e abra o primeiro caminhão (`EHR-0001` — `/fleet/1`).
2. Role até o cartão **"Chave do hardware (x-api-key)"**.
3. Destaque o cabeçalho **"ID do caminhão: 1 • Placa: EHR-0001"**, o prefixo da chave, a data de criação e o carimbo de **"Último uso"**.
4. Clique em **"Trocar chave"** (ou **"Gerar chave"**), confirme e mostre o modal que exibe a chave **uma única vez**, já com os comandos prontos de PowerShell e `curl` para o time de hardware testar.
5. Feche o modal e mostre que apenas os 8 primeiros caracteres ficam visíveis.

### O que falar
> *"Cada placa IoT instalada no caminhão se autentica com uma chave exclusiva (`x-api-key`). Por segurança, o banco de dados **nunca** armazena a chave em texto puro: um trigger no PostgreSQL converte qualquer chave em hash **SHA-256** antes mesmo de gravar em disco. O gestor gera, rotaciona ou revoga a chave em um clique, e o sistema registra auditoria completa e o último contato da placa."*

---

## Ato 4 — App do Motorista: Abastecimento com Reconhecimento Facial (2 min 30 s)

### O que fazer no celular e no painel
1. No celular (App Mobile), faça login com `carlos.silva@ehr.com` / `Motorista@123`.
2. Mostre a tela inicial com o caminhão vinculado (`EHR-0001`) e o nível atual do tanque.
3. Toque em **"Iniciar Abastecimento"** → na tela de **Validação Facial**, aponte a câmera frontal e toque em **"Capturar Foto"**.
4. Destaque que **a foto capturada aparece imediatamente no visor** enquanto a identidade é validada.
5. Assim que autorizado, mostre a tela de progresso: o hardware virtual recebe `unlock: true`, destrava a válvula, simula a entrada de litros e encerra o abastecimento exibindo o resumo (volume abastecido e duração).
6. No **Painel Web**, clique em **Motoristas** (`/drivers`) e mostre que a foto real capturada no primeiro acesso passa a identificar o motorista no painel, sem nunca ser sobrescrita nas verificações seguintes.

### O que falar
> *"No posto, o motorista não consegue abrir o tanque sozinho. Ele inicia a sessão no app, tira a selfie na hora e a foto aparece imediatamente no quadro de validação. Seguindo a **LGPD**, não fazemos rastreamento contínuo da rota do motorista — a localização é coletada pontualmente no ato do abastecimento — e a foto de referência é gravada uma única vez com registro de consentimento biométrico. Assim que o servidor valida o rosto e o geofence do posto, a placa do caminhão recebe o comando de destravar, mede o nível antes e depois e devolve o resultado para o app e para o painel."*

---

## Ato 5 — Plano de Contingência: Falha Facial e Liberação de Emergência (1 min)

### O que fazer na tela
1. Explique o cenário em que o motorista falha 3 vezes na biometria (ex.: câmera quebrada ou baixa iluminação extrema).
2. No Painel Web, na tela de detalhes do caminhão (`/fleet/1`), aponte para o botão **"Liberação de Emergência"** (ou na tela de Tentativas Faciais / Alertas).
3. Mostre que a liberação manual exige uma **justificativa obrigatória** do gestor e gera um evento de auditoria (`manager_override`).

### O que falar
> *"Se o celular do motorista tiver a câmera danificada ou falhar três vezes seguidas, a operação não para na estrada: a sessão entra em bloqueio de segurança, o gestor recebe um alerta imediato no painel e pode acionar a **Liberação de Emergência** informando o motivo, que fica gravado de forma imutável na trilha de auditoria."*

---

## Ato 6 — Detecção de Fraude, Relatórios e Encerramento (1 min)

### O que fazer na tela
1. Clique em **Abastecimentos** (`/fueling`) e **Investigação / Alertas** para mostrar o cruzamento entre litros da bomba, variação do tanque e posto ANP.
2. Clique em **Relatórios** (`/reports`) e mostre a exportação em **CSV** e **PDF** para auditoria externa.

### O que falar
> *"Por fim, toda operação passa pelo motor de anomalias: se a bomba registrar 200 litros e o sensor do tanque subir apenas 170 litros, ou se o abastecimento ocorrer fora do horário ou em um posto interditado na ANP, o gestor recebe um alerta crítico na hora. Todo o código conta com mais de 460 testes automatizados integrados no GitHub Actions, garantindo que o software já esteja pronto esperando apenas o acoplamento físico do hardware."*
