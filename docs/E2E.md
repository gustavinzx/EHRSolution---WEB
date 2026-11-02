# Testes E2E (Ponta a Ponta) — EHR Solutions

O script `scripts/teste-completo.js` valida o fluxo completo via API integrando os papéis do painel (gestor/auditor), app do motorista (sessão, biometria mockada) e hardware IoT (trava, telemetria, detecção de divergência e alertas de violação).

## Requisitos do backend

Para todas as 63 verificações passarem, o backend local deve rodar em modo desenvolvimento com `NODE_ENV=development`, `FACE_PROVIDER=mock`, `FACE_MOCK_MODE=always_match` e `VIRTUAL_HARDWARE_ENABLED=false` (sem isso o reconhecimento facial recusa a imagem do teste e o simulador interfere):

```powershell
Set-Location backend
$env:FACE_MOCK_MODE = "always_match"
$env:VIRTUAL_HARDWARE_ENABLED = "false"
npm run dev
```

## Variáveis de Ambiente e Execução

- `E2E_BASE_URL`: URL base da API (padrão: `http://localhost:3001`).
- `E2E_ADMIN_EMAIL`: E-mail de administrador (obrigatório). Exemplo: `admin-e2e@exemplo.com`
- `E2E_ADMIN_PASSWORD`: Senha de administrador (obrigatório). Exemplo: `troque-esta-senha`
- `E2E_DRIVER_PASSWORD` / `E2E_AUDITOR_PASSWORD`: Opcionais (geradas aleatoriamente se ausentes).
- `E2E_ALLOW_REMOTE`: Defina como `true` para liberar execução fora de localhost/127.0.0.1.

Na raiz do projeto:

```powershell
$env:E2E_ADMIN_EMAIL = "admin-e2e@exemplo.com"
$env:E2E_ADMIN_PASSWORD = "troque-esta-senha"
node scripts/teste-completo.js
```

Use `node scripts/teste-completo.js --keep` para não remover os dados no final.
