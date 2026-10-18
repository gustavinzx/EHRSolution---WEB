# Guia de Integração do Hardware (Placa IoT) — EHR Solutions

> **Para quem é:** equipe de hardware/firmware que vai conectar a placa da trava e do sensor de combustível ao backend.
> **Base deste guia:** código do backend na `main` (commit `e579b1d`) e `docs/API_MOBILE.md`. Tudo marcado como **[verificado]** foi lido no código. O que for **[sugestão]** é recomendação nossa e ainda não existe no sistema.
> **URL base:** `http(s)://<SERVIDOR>:3001/api` (em desenvolvimento: `http://<IP-DO-PC>:3001/api`).

---

## 1. Visão geral

A placa tem **três responsabilidades**:

1. **Destravar a bomba só quando o servidor mandar** (consulta periódica à sessão ativa).
2. **Reportar o resultado do abastecimento** (nível do tanque antes e depois, e litros medidos na bomba).
3. **Enviar telemetria e eventos de segurança** (posição, nível do tanque, violação da trava etc.).

O motorista **nunca destrava a bomba diretamente**. Quem decide é o servidor, depois de validar o rosto do motorista (ou a liberação do gestor). A placa só obedece ao campo `unlock`.

### Checklist de integração

- [ ] Cada caminhão tem uma **chave de API** própria cadastrada no servidor (seção 2).
- [ ] A placa consulta `GET /fueling/sessions/:truckId/active` a cada poucos segundos e **mantém a trava fechada** sempre que `unlock` for `false`, ausente ou a requisição falhar.
- [ ] Ao terminar de abastecer, a placa chama `finish` e depois `pump-reading` (seção 4.3 e 4.4, **nesta ordem**).
- [ ] A placa envia telemetria periódica (seção 4.5).
- [ ] A placa reporta eventos de segurança (seção 4.6).
- [ ] O simulador (hardware virtual) está **desligado** no servidor real (seção 6).

---

## 2. Autenticação

**[verificado]** Todas as chamadas da placa usam o cabeçalho:

```
x-api-key: <chave-do-caminhao>
Content-Type: application/json
```

- A chave identifica **um caminhão**. A placa só pode agir sobre o próprio caminhão: se o `:id`/`:truckId` da URL não for o do caminhão dono da chave, a resposta é `403`.
- Erros de autenticação nas rotas exclusivas de hardware: `401 {"error":"Hardware API Key missing"}` (sem cabeçalho) e `401 {"error":"Invalid Hardware API Key"}` (chave desconhecida, revogada ou cabeçalho com mais de 200 caracteres).

### Como gerar, trocar e revogar a chave pelo painel

**[verificado]** O provisionamento da chave é feito diretamente no painel web (**Frota → Detalhes do Caminhão → cartão "Chave do hardware"**, disponível para perfis `admin` e `manager`, oculto para `auditor`):

1. **Geração e exibição única:** ao clicar em **Gerar chave**, o servidor gera 32 bytes aleatórios (`crypto.randomBytes(32)`) em hexadecimal (64 caracteres) e devolve a chave **uma única vez** na resposta `201`. O painel exibe a chave em uma janela modal com botão **Copiar** e o aviso *"Guarde agora; ela não será exibida de novo"*. Ao fechar a janela, a chave em texto puro é descartada da memória do navegador.
2. **Armazenamento em hash (SHA-256):** o texto puro **nunca é persistido** no banco de dados. Um *trigger* no PostgreSQL (`trucks_hash_api_key_trg`, `BEFORE INSERT OR UPDATE OF api_key ON trucks`) calcula `api_key_hash = encode(sha256(convert_to(NEW.api_key, 'UTF8')), 'hex')`, grava os 8 primeiros caracteres em `api_key_prefix`, preenche `api_key_created_at = NOW()` e zera `NEW.api_key = NULL`. Na autenticação da placa, o backend calcula o SHA-256 (UTF-8, hex) do cabeçalho `x-api-key` e consulta `WHERE api_key_hash = $1`.
3. **Último uso (`api_key_last_used_at`):** atualizado automaticamente na autenticação da placa no máximo **1 vez por minuto** por caminhão (`WHERE api_key_last_used_at IS NULL OR api_key_last_used_at < NOW() - INTERVAL '1 minute'`). Eventual falha nessa atualização é isolada e nunca derruba a autenticação.
4. **Rotação (Trocar chave) e Revogação (Revogar):** exigem confirmação no painel (*"A chave atual para de funcionar imediatamente e a placa precisará ser reconfigurada."*). Ao trocar ou revogar, a chave anterior passa a responder `401 {"error":"Invalid Hardware API Key"}` imediatamente. Cada geração ou revogação grava um evento em `security_events` (`hardware_key_generated` ou `hardware_key_revoked`, severidade `low`, sem alerta em `fleet_alerts` e sem a chave no `payload`).

### Rotas do painel para gestão da chave (`authMiddleware` + `requireRole('admin', 'manager')`)

- **`POST /api/fleet/:id/hardware-key`** — Gera (ou rotaciona) a chave do caminhão `:id`.
  - **Cabeçalho:** `Authorization: Bearer <token-jwt-admin-ou-manager>`
  - **Resposta 201 (exibida uma única vez):**
    ```json
    {
      "api_key": "<64-caracteres-hex>",
      "prefix": "<8-primeiros-caracteres>",
      "created_at": "2026-10-18T12:00:00.000Z"
    }
    ```
  - **Efeito colateral:** substitui qualquer chave anterior na hora, zera `api_key_last_used_at` e registra `hardware_key_generated` (`severity: "low"`, com `user_id` e `truck_id`, sem a chave).
  - **Erros:** `400 {"error":"id inválido"}`; `401 {"error":"Authorization token missing or invalid"}`; `403 {"error":"forbidden_role"}` (auditor) ou `403 {"error":"Acesso restrito ao gestor"}` (motorista); `404 {"error":"Caminhão não encontrado"}`.

- **`GET /api/fleet/:id/hardware-key`** — Consulta o status da chave do caminhão `:id` (nunca retorna a chave nem o hash).
  - **Cabeçalho:** `Authorization: Bearer <token-jwt-admin-ou-manager>`
  - **Resposta 200 (configurada):**
    ```json
    {
      "configured": true,
      "prefix": "a1b2c3d4",
      "created_at": "2026-10-18T12:00:00.000Z",
      "last_used_at": "2026-10-18T12:05:00.000Z"
    }
    ```
  - **Resposta 200 (sem chave):**
    ```json
    {
      "configured": false,
      "prefix": null,
      "created_at": null,
      "last_used_at": null
    }
    ```
  - **Erros:** `400 {"error":"id inválido"}`; `401`; `403`; `404 {"error":"Caminhão não encontrado"}`.

- **`DELETE /api/fleet/:id/hardware-key`** — Revoga a chave ativa do caminhão `:id`.
  - **Cabeçalho:** `Authorization: Bearer <token-jwt-admin-ou-manager>`
  - **Resposta 200:** `{ "success": true }`
  - **Efeito colateral:** limpa `api_key_hash`, `api_key_prefix`, `api_key_created_at` e `api_key_last_used_at`, e registra `hardware_key_revoked` (`severity: "low"`, sem alerta).
  - **Erros:** `400 {"error":"id inválido"}`; `401`; `403`; `404 {"error":"Caminhão não encontrado"}`.

**Chave de desenvolvimento (somente dev):** o seed cria o caminhão `EHR-0001` com a chave `DEV_API_KEY_001` (convertida automaticamente em hash pelo trigger no banco). Nunca usar em produção.

---

## 3. Fluxo completo

### 3.1 Abastecimento normal (liberação por rosto)

```mermaid
sequenceDiagram
    actor M as Motorista
    participant App as App Mobile
    participant API as Backend
    participant HW as Placa IoT

    M->>App: Iniciar abastecimento
    App->>API: POST /fueling/sessions
    App->>API: POST /fueling/sessions/:id/verify-face (foto)
    API-->>App: verificado
    App->>API: POST /fueling/sessions/:id/authorize
    loop a cada poucos segundos
        HW->>API: GET /fueling/sessions/:truckId/active
        API-->>HW: { unlock: false }
    end
    HW->>API: GET /fueling/sessions/:truckId/active
    API-->>HW: { unlock: true, session_id, status: "authorized", expires_at }
    Note over HW: Destrava a válvula; o motorista abastece
    Note over HW: Fecha a válvula e lê nível do tanque e litros da bomba
    HW->>API: POST /fueling/sessions/:id/finish { level_before, level_after }
    API-->>HW: { success: true, volume_liters, duration_minutes }
    HW->>API: POST /fueling/sessions/:id/pump-reading { pump_liters }
    API-->>HW: { success: true, pump_liters }
    Note over API: Compara litros da bomba x variação do tanque (divergência)
```

### 3.2 Contingência por Bluetooth (BLE fallback)

**[verificado]** Quando a sessão usa `release_method = ble_fallback`, a placa avisa o servidor que pareou com o app do motorista, **antes** do motorista autorizar:

1. App cria a sessão no modo BLE e pareia por Bluetooth com a placa.
2. Placa chama `POST /fueling/sessions/:id/ble-confirmed`.
3. O app chama `authorize`, e a partir daí a placa vê `unlock: true` na consulta normal.

### 3.3 Cancelamento e expiração

**[verificado]** Se o motorista cancelar (ou a sessão expirar, 30 minutos), a próxima consulta devolve `unlock: false`. **A placa deve voltar a travar a válvula imediatamente**, mesmo que já tenha destravado.

### 3.4 Liberação de emergência pelo gestor

**[verificado]** Se o motorista falha no rosto 3 vezes, o gestor pode liberar pelo painel. Para a placa não muda nada: ela continua consultando `active` e só reage ao `unlock`.

---

## 4. Referência dos endpoints da placa

### 4.1 `GET /api/fueling/sessions/:truckId/active` — consultar se pode destravar

- **Quem chama:** placa (`x-api-key`).
- **Resposta 200 (hardware):**
  ```json
  { "unlock": true, "session_id": 1, "status": "authorized", "expires_at": "2026-10-17T15:30:00.000Z" }
  ```
  Sem sessão aberta: `{ "unlock": false, "session_id": null, "status": null, "expires_at": null }`.
- **Regra:** `unlock` é `true` somente quando o status é `authorized` ou `active`.
- **Erros:** `400 {"error":"truckId inválido"}`, `401 {"error":"Invalid Hardware API Key"}`, `403 {"error":"API Key não pertence a este caminhão"}`.
- **[sugestão]** Consultar a cada 2 a 5 segundos. O simulador usa 2 s.

### 4.2 `POST /api/fueling/sessions/:id/ble-confirmed` — confirmar pareamento BLE

- **Corpo:** vazio.
- **Resposta 200:** `{ "success": true }`.
- **Erros:** `400 {"error":"id inválido"}`; `403 {"error":"Esta sessão pertence a outro caminhão"}`; `409 {"error":"Sessão não usa BLE fallback"}`; `409 {"error":"Sessão não encontrada ou não aguardando"}`.

### 4.3 `POST /api/fueling/sessions/:id/finish` — encerrar o abastecimento

- **Quando:** logo depois de fechar a válvula.
- **Corpo (números, em litros):**
  ```json
  { "level_before": 120.5, "level_after": 180.0 }
  ```
  - `level_after` **é obrigatório e numérico** para o dado contar como medição do hardware. Sem ele (ou inválido), o registro fica `data_source = "unverified"` e o volume não é confirmado.
  - `level_before` é opcional; se faltar, o servidor usa o último nível conhecido do caminhão.
  - O servidor limita `level_after` ao intervalo `0` a capacidade do tanque e calcula `volume_liters = max(level_after − level_before, 0)`.
- **Resposta 200:** `{ "success": true, "volume_liters": 59.5, "duration_minutes": "3.2" }`.
- **Erros:** `400 {"error":"id inválido"}`; `403 {"error":"Sem permissão para esta sessão"}`; `404 {"error":"Sessão não encontrada ou não está ativa"}` (inclui chamada repetida: a segunda vez a sessão já está concluída).

### 4.4 `POST /api/fueling/sessions/:id/pump-reading` — litros medidos na bomba

- **Quando:** **depois** do `finish`. **[verificado]** Se a sessão ainda estiver `authorized`, a resposta é `409 {"error":"Sessão não está ativa nem concluída"}`.
- **Corpo:**
  ```json
  { "pump_liters": 59.8 }
  ```
- **Resposta 200:** `{ "success": true, "pump_liters": 59.8 }`.
- **Efeito:** grava a leitura no registro do abastecimento e dispara a avaliação de divergência (litros da bomba × variação do tanque). **Não altera o nível do tanque nem o status da sessão.**
- **Pode repetir:** a leitura é sobrescrita.
- **Erros:** `400 {"error":"pump_liters é obrigatório e numérico"}`; `400 {"error":"pump_liters inválido (fora do limite da capacidade)"}`; `403 {"error":"Hardware API Key não pertence a este caminhão"}`; `404 {"error":"Sessão não encontrada"}`; `409 {"error":"Sessão não está ativa nem concluída"}`.

### 4.5 `POST /api/fleet/:id/telemetry` — telemetria do caminhão

- **Corpo (todos os campos opcionais, numéricos):**
  ```json
  { "fuel_level_liters": 180.0, "lat": -15.7939, "lng": -47.8828, "speed_kmh": 62 }
  ```
- **Resposta 200:** `{ "success": true, "truck": { "id": 1, "status": "ok" } }`.
- **Efeito:** atualiza nível, posição e velocidade; o status vira `low_fuel` quando o nível fica abaixo de 20% da capacidade (um `security_alert` ativo não é sobrescrito); grava no histórico de telemetria e atualiza o painel em tempo real.
- **Erros:** `400 {"error":"Valores de telemetria inválidos"}`; `400 {"error":"Coordenadas fora do intervalo válido"}`; `403 {"error":"API Key não pertence a este caminhão"}`; `404 {"error":"Truck not found"}`.
- **[sugestão]** Enviar a cada 10 a 30 segundos em movimento. Mais devagar parado.

### 4.6 `POST /api/fleet/:id/security-events` — eventos de segurança

- **Corpo:**
  ```json
  { "type": "tamper", "severity": "critical", "source": "device", "payload": { "detalhe": "trava aberta sem sessão" } }
  ```
  - `type` é obrigatório (texto de até 50 caracteres). `severity` é opcional (`low`, `medium`, `high`, `critical`). `source` assume `device`.
- **Tipos que geram alerta crítico no painel:** `tamper`, `unauthorized_movement`, `emergency_button`, `theft_signal`, `unauthorized_fueling_attempt`.
- **Resposta:** `201` com o resultado do registro.
- **Erros:** `400 {"error":"O campo type é obrigatório"}`; `403 {"error":"API Key não pertence a este caminhão"}`.

---

## 5. Origem dos dados e detecção de furto

**[verificado]** Cada abastecimento guarda de onde veio a medição (`data_source`):

| Valor | Significado |
|---|---|
| `hardware` | Placa informou `level_after` válido no `finish`. É a medição confiável. |
| `unverified` | Faltou `level_after`. O volume não é confirmado e o motorista vê "Volume a confirmar". |
| `manager` | O gestor informou os níveis pelo painel. |
| `simulated` | Veio do simulador. Nunca gera alerta de furto real. |

O sistema compara os **litros da bomba** (`pump_liters`) com a **variação do tanque** (`level_after − level_before`). Uma diferença acima do limite configurado gera alerta de divergência (os limites ficam em **Configurações → Alertas** no painel).

**Por isso:** quanto mais precisos e independentes forem o medidor da bomba e o sensor do tanque, melhor a detecção. Enviar o mesmo número nos dois campos anula o controle.

O servidor também cruza a posição do caminhão no abastecimento com o cadastro nacional de postos da ANP e alerta se não houver posto autorizado por perto. Isso depende de a telemetria trazer `lat` e `lng` corretos.

---

## 6. O simulador (hardware virtual)

**[verificado]** Enquanto o hardware real não chega, o servidor tem um simulador que faz o papel da placa: consulta sessões autorizadas, "destrava", conclui o abastecimento e grava o registro.

- Liga com `VIRTUAL_HARDWARE_ENABLED=true` no `.env` do backend. Verifica a cada 2 segundos.
- Marca os registros como `data_source = "simulated"` (não geram alerta de furto).
- **O servidor recusa subir em produção** (`NODE_ENV=production`) com o simulador ligado.

**Ao integrar o hardware real:** colocar `VIRTUAL_HARDWARE_ENABLED=false` (ou remover a linha) e reiniciar o backend. Se os dois ficarem ligados, o simulador pode concluir uma sessão antes da placa.

---

## 7. Testando sem a placa (PowerShell)

Pré-requisito: backend rodando, caminhão com chave cadastrada e `VIRTUAL_HARDWARE_ENABLED=false`. Troque `1` pelo id do caminhão e use a chave do caminhão.

```powershell
$h = @{ "x-api-key" = "DEV_API_KEY_001"; "Content-Type" = "application/json" }
$base = "http://localhost:3001/api"

# 1) Nenhuma sessão: deve vir unlock = false
Invoke-RestMethod -Uri "$base/fueling/sessions/1/active" -Headers $h

# 2) No app, inicie o abastecimento e passe pela validação facial. Repita:
Invoke-RestMethod -Uri "$base/fueling/sessions/1/active" -Headers $h
#    agora deve vir unlock = true e um session_id (use no passo 3)

# 3) Encerrar o abastecimento (troque 12 pelo session_id)
Invoke-RestMethod -Method Post -Uri "$base/fueling/sessions/12/finish" -Headers $h -Body '{"level_before":120,"level_after":180}'

# 4) Leitura da bomba (depois do finish)
Invoke-RestMethod -Method Post -Uri "$base/fueling/sessions/12/pump-reading" -Headers $h -Body '{"pump_liters":60}'

# 5) Telemetria
Invoke-RestMethod -Method Post -Uri "$base/fleet/1/telemetry" -Headers $h -Body '{"fuel_level_liters":180,"lat":-15.7939,"lng":-47.8828,"speed_kmh":0}'

# 6) Evento de segurança
Invoke-RestMethod -Method Post -Uri "$base/fleet/1/security-events" -Headers $h -Body '{"type":"tamper","severity":"critical"}'
```

Para testar divergência, use `pump_liters` bem diferente da variação do tanque (por exemplo, `level_after − level_before = 60` e `pump_liters = 90`) e veja o alerta em **Alertas** no painel.

---

## 8. Boas práticas para o firmware

**[sugestão]** (não verificadas no servidor, mas recomendadas)

- **Falha fecha:** se a consulta `active` der erro, timeout ou resposta inesperada, **manter a trava fechada**. Nunca destravar por falta de resposta.
- **HTTPS em produção** (a chave trafega no cabeçalho). Em desenvolvimento, HTTP na rede local.
- **Repetição com espera crescente** (por exemplo 1 s, 2 s, 4 s, até 30 s) para `finish`, `pump-reading` e telemetria. O `pump-reading` pode ser repetido sem problema. Se o `finish` responder `404 Sessão não encontrada ou não está ativa` numa repetição, é sinal de que o primeiro envio já foi concluído.
- **Fila offline:** guardar na placa os eventos de segurança e o resultado do abastecimento quando estiver sem rede, e reenviar quando voltar.
- **Relógio:** o servidor carimba a hora de recebimento. Se a placa ficar offline por muito tempo, avisar no payload do evento a hora local do ocorrido.
- **Chave por caminhão** e **nunca reutilizar** a mesma em dois dispositivos. Se uma placa for roubada, trocar a chave do caminhão.

---

## 9. Perguntas para a empresa fornecedora do hardware

1. Como a placa se conecta à internet (4G, Wi-Fi, outro) e com que estabilidade?
2. Qual o protocolo e o formato do Bluetooth entre a placa e o app (serviço, características, pareamento, tempo de resposta)?
3. A placa tem medidor de fluxo na bomba (litros) **e** sensor de nível no tanque, independentes entre si?
4. Qual a precisão e a unidade dos dois sensores?
5. Quanto tempo a placa guarda dados offline, e quantos eventos cabem?
6. A placa suporta HTTPS (TLS) e como é a gestão da chave de API por dispositivo?
7. Como é a forma de atualização remota do firmware?
8. Que eventos de segurança a placa consegue detectar (violação, movimento sem sessão, botão de emergência)?

---

## 10. Pendências conhecidas do lado do servidor

1. **Provedor facial real** com prova de vida: hoje só o mock está implementado.
2. **Protocolo BLE real**: o fluxo de contingência está pronto no servidor, mas depende do protocolo definido pelo fornecedor.
3. **Limite de requisições (rate limit)** para as rotas da placa ainda não existe.
4. **Identificação do posto pelo CNPJ** enviado pela placa: planejada, depende do hardware saber em que posto está.

*Documento gerado a partir do código verificado em 17/10/2026 (atualizado em 18/10/2026 com provisionamento de chave por hash SHA-256). Se as rotas mudarem, o `docs/API_MOBILE.md` e os testes de contrato (`docs_drift`) continuam sendo a fonte da verdade.*
