# Testes E2E (Ponta a Ponta) — EHR Solutions

O script `scripts/teste-completo.js` valida o fluxo completo via API integrando os papéis do painel (gestor/auditor), app do motorista (sessão, biometria mockada) e hardware IoT (trava, telemetria, detecção de divergência e alertas de violação).

## Variáveis de Ambiente

- `E2E_BASE_URL`: URL base do backend (padrão: `http://localhost:3001`).
- `E2E_ADMIN_EMAIL`: E-mail de administrador para autenticação inicial (obrigatório). Exemplo: `admin-e2e@exemplo.com`
- `E2E_ADMIN_PASSWORD`: Senha do administrador (obrigatório). Exemplo: `troque-esta-senha`
- `E2E_DRIVER_PASSWORD`: Senha do motorista de teste (opcional; gerada aleatoriamente se omitida).
- `E2E_AUDITOR_PASSWORD`: Senha do auditor de teste (opcional; gerada aleatoriamente se omitida).
- `E2E_ALLOW_REMOTE`: Defina como `true` caso queira executar fora de localhost/127.0.0.1.

## Como Executar no PowerShell

Com o backend ligado localmente (`npm run dev` no diretório `backend`):

```powershell
$env:E2E_ADMIN_EMAIL = "admin-e2e@exemplo.com"
$env:E2E_ADMIN_PASSWORD = "troque-esta-senha"
node scripts/teste-completo.js
```

Use `node scripts/teste-completo.js --keep` se desejar manter os registros criados para inspeção.
