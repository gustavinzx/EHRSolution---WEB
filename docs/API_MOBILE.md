Verificado contra o commit 9fbe78ea863fe6ac356b3733846cc7e3517c575f

# EHR Solutions - Documentação da API Mobile & Hardware

Este documento especifica as rotas expostas para o App Mobile (Motorista) e a comunicação com a Placa IoT (Hardware).

## Autenticação e Erros Comuns

O backend utiliza middlewares específicos para validar quem está chamando a rota.

### Hardware (Placa IoT)
Rotas do hardware exigem o envio de um header `x-api-key`.
- `{ "error": "Invalid Hardware API Key" }` (Chave não cadastrada).

### App do Motorista
Rotas exclusivas do motorista exigem o envio do token no header `Authorization: Bearer <token>`.
- `{ "error": "Driver Authorization token missing or invalid" }`
- `{ "error": "Invalid or expired driver token" }`
- `{ "error": "Forbidden: Drivers only" }`
- `{ "error": "driver_inactive" }` (Ocorre se o motorista for desativado pelo painel *após* o login. A rota será bloqueada).

### Erros Globais (Dash/Misto)
Em rotas que aceitam múltiplos atores (`authAny`), gestores recebem:
- `{ "error": "Authorization token missing or invalid" }`
- `{ "error": "Invalid or expired token" }`
- `{ "error": "User not found" }`
- `{ "error": "User is deactivated" }`
- `{ "error": "Acesso restrito ao app do motorista" }` (gestor chamando rota de driver)
- `{ "error": "Acesso negado para motoristas" }` (driver chamando rota de gestor)
- `{ "error": "forbidden_role" }` (auditor tentando alterar algo).

---

## 1. Login do Motorista

### `POST /api/auth/driver/login`
Autentica o motorista, devolvendo o token JWT e dados do caminhão atualmente vinculado (se houver).

**Requisição (Body):**
```json
{
  "email": "motorista@ehr.com",
  "password": "senha"
}
```

**Respostas:**
- **200 OK**: Retorna o JWT de 30d, motorista e veículo logado.
- **401 Unauthorized**: `{ "error": "Credenciais inválidas" }`

---

## 2. Fluxo de Abastecimento

### `POST /api/fueling/sessions`
Inicia um processo de abastecimento. Pode ser invocado por motorista ou gestor.

**Respostas:**
- **201 Created**: Devolve a sessão criada.
- **400 Bad Request**: `{ "error": "truck_id é obrigatório" }`
- **400 Bad Request**: `{ "error": "invalid_release_method" }`
- **403 Forbidden**: `{ "error": "Este caminhão não está vinculado a você" }`
- **404 Not Found**: `{ "error": "Caminhão não encontrado" }`
- **409 Conflict**: `{ "error": "Já existe uma sessão ativa para este caminhão" }`

---

### `POST /api/fueling/sessions/:id/verify-face`
Valida a foto do motorista com a biometria cadastrada. Rota exclusiva do motorista.

**Respostas:**
- **200 OK (Sucesso)**: `{ "verified": true }`
- **200 OK (Falha biométrica)**: `{ "verified": false, "attempts": 2, "attempts_left": 1 }`
- **400 Bad Request**: `{ "error": "image_base64 é obrigatório" }`
- **400 Bad Request**: `{ "error": "A imagem deve ser uma string em base64" }`
- **400 Bad Request**: `{ "error": "A imagem excede o tamanho máximo de 2MB" }`
- **400 Bad Request**: `{ "error": "Formato de imagem inválido. Apenas JPEG e PNG são permitidos." }`
- **403 Forbidden**: `{ "error": "Sessão de outro motorista" }`
- **404 Not Found**: `{ "error": "Sessão não encontrada" }`
- **409 Conflict**: `{ "error": "face_not_enrolled" }`
- **429 Too Many Requests**: `{ "error": "Limite de tentativas por hora atingido." }`
- **429 Too Many Requests**: `{ "error": "Limite de tentativas da sessão atingido." }`
- **503 Service Unavailable**: `{ "error": "face_provider_unavailable" }`

---

### `POST /api/fueling/sessions/:id/authorize`
O app chama este endpoint para autorizar a trava final.

**Respostas:**
- **200 OK**: Retorna a sessão `authorized`.
- **403 Forbidden**: `{ "error": "Sessão pertence a outro motorista" }`
- **403 Forbidden**: `{ "error": "driver_cannot_use_manager_override" }`
- **403 Forbidden**: `{ "error": "facial_verification_already_used" }`
- **403 Forbidden**: `{ "error": "facial_verification_required" }`
- **403 Forbidden**: `{ "error": "facial_verification_expired" }`
- **403 Forbidden**: `{ "error": "ble_confirmation_required" }`
- **403 Forbidden**: `{ "error": "ble_confirmation_already_used" }`
- **403 Forbidden**: `{ "error": "ble_confirmation_expired" }`
- **403 Forbidden**: `{ "error": "Caminhão fora da área do posto autorizado. Tentativa bloqueada e alertada." }`
- **404 Not Found**: `{ "error": "Sessão não encontrada ou já autorizada" }`
- **409 Conflict**: `{ "error": "Sessão já foi processada" }`

---

### `POST /api/fueling/sessions/:id/facial-failure`
App reporta falha severa na câmera/captura. (Motorista)

**Respostas:**
- **200 OK**: Devolve quantas tentativas restam.
- **403 Forbidden**: `{ "error": "Sessão pertence a outro motorista" }`
- **404 Not Found**: `{ "error": "Sessão não encontrada ou já processada" }`

---

### `POST /api/fueling/sessions/:id/finish`
Encerra a sessão.

**Respostas:**
- **200 OK**: Retorna o log final.
- **403 Forbidden**: `{ "error": "Sem permissão para esta sessão" }`
- **404 Not Found**: `{ "error": "Sessão não encontrada ou não está ativa" }`
- **404 Not Found**: `{ "error": "Caminhão não encontrado" }`

---

## 3. Hardware (Placa IoT)

A placa comunica-se com a API utilizando o cabeçalho `x-api-key`.

### `GET /api/fueling/sessions/:truckId/active`
Mecanismo de destravamento da placa IoT.

**Respostas:**
- **200 OK (Para Hardware)**: `{ "unlock": true, "session_id": 5, "status": "authorized", "expires_at": "..." }`
- **200 OK (Para App)**: Objeto da sessão.
- **400 Bad Request**: `{ "error": "truckId inválido" }`
- **403 Forbidden**: `{ "error": "API Key não pertence a este caminhão" }`
- **403 Forbidden**: `{ "error": "Este caminhão não está vinculado a você" }`

---

### `POST /api/fueling/sessions/:id/ble-confirmed`
O hardware avisa o servidor que pareou com o app mobile do motorista.

**Respostas:**
- **200 OK**: `{ "success": true }`
- **403 Forbidden**: `{ "error": "Esta sessão pertence a outro caminhão" }`
- **409 Conflict**: `{ "error": "Sessão não encontrada ou não aguardando" }`
- **409 Conflict**: `{ "error": "Sessão não usa BLE fallback" }`

---

### `POST /api/fueling/sessions/:id/pump-reading`
A placa envia a leitura de volume após fechar a válvula. O código grava `pump_liters` na sessão. Se a sessão já estiver 'completed', também grava no `fueling_logs` e dispara a avaliação de divergência. **NÃO altera o nível do tanque nem muda o status da sessão.**

**Respostas:**
- **200 OK**: `{ "success": true }`
- **400 Bad Request**: `{ "error": "pump_liters é obrigatório e numérico" }`
- **400 Bad Request**: `{ "error": "pump_liters inválido (fora do limite da capacidade)" }`
- **403 Forbidden**: `{ "error": "Hardware API Key não pertence a este caminhão" }`
- **404 Not Found**: `{ "error": "Sessão não encontrada" }`
- **409 Conflict**: `{ "error": "Sessão não está ativa nem concluída" }`

---

## Configurações e Privacidade
- **Privacidade e Biometria**: O sistema valida a foto via o provedor configurado (hoje apenas o mock em desenvolvimento; o Rekognition é um esqueleto NOT_IMPLEMENTED). O que fica em `facial_attempts` são **apenas metadados** (score, liveness, provedor, motivo, horário) e NENHUMA imagem.
- Constantes e Env (definidas em `.env` ou código):
  - \`SESSION_TTL_MIN\` (30min)
  - \`FACE_PROVIDER\`
  - \`FACE_MATCH_THRESHOLD\`
  - \`FACIAL_MAX_ATTEMPTS\`
  - \`FACIAL_ATTEMPTS_RETENTION_DAYS\`

## Integração via Socket.IO
- `emergencyUnlockRequest`: Emitido quando o motorista atinge o máximo de falhas faciais e precisa da ajuda do gestor (payload: sessão completa).
- `newAlert`: Disparado como broadcast global para todos os clientes sempre que surge um alerta no sistema.
