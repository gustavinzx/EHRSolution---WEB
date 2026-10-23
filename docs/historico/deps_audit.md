# Auditoria e Atualização Consciente de Dependências (`fix/deps-audit`)

Data: 2026-10-23  
Branch: `fix/deps-audit`  
Base: `main` (`681a172f58e4ef2413f0588ff05e340f3259f267`)  
Node Runtime: `v24.11.0` (Docker: `node:20-alpine`)

---

## 1. Resumo Antes vs. Depois (`npm audit --omit=dev`)

### Backend (`ehr-fleet-backend`)
- **Antes:** 4 vulnerabilidades (1 moderate, 2 high, 1 critical)
  - `follow-redirects` (1.16.0): High (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c)
  - `ip-address` (10.7.2): Moderate (GHSA-rxp7-6hxx-x8q5)
  - `tar` / `@mapbox/node-pre-gyp` via `bcrypt@5.1.1`: Critical/High (múltiplos advisories do node-tar)
- **Depois:** **0 vulnerabilidades** (`found 0 vulnerabilities`)

### Frontend (`ehr-solutions-fleet-frontend`)
- **Antes:** 3 vulnerabilidades (2 moderate, 1 high)
  - `follow-redirects` (1.16.0): High (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c)
  - `react-router` / `react-router-dom` (6.28.1): Moderate (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg)
- **Depois:** 2 vulnerabilidades moderadas (mantidas de propósito, breaking change v6->v7)
  - `follow-redirects` corrigido para 1.16.1 (0 vulnerabilidades altas ou críticas em produção)

---

## 2. O que foi corrigido

1. **`follow-redirects` (Backend e Frontend):**
   - Atualizado de 1.16.0 para 1.16.1 via `npm audit fix` sem quebras de API.
   - Corrige vazamento de cabeçalhos de autorização/credenciais em redirecionamentos cross-origin.
2. **`ip-address` (Backend):**
   - Atualizado de 10.7.2 para 10.7.4 via `npm audit fix`.
   - Elimina potencial DoS de parsing com zone identifier em tempo quadrático.
3. **Upgrade do `bcrypt` de 5.1.1 para 6.0.0 (Backend):**
   - O `bcrypt` v5 arrastava dependências vulneráveis legadas do `@mapbox/node-pre-gyp` e `tar@<=7.5.20` com vulnerabilidades críticas de traversal e DoS.
   - O `bcrypt` v6.0.0 adota compilação moderna e descarta o `node-pre-gyp` vulnerável.
   - Compatibilidade de runtime garantida: Node 24 local e Node 20 no Docker (`>= 18`).
   - Compatibilidade de hashes provada por teste automatizado dedicado: hashes `$2b$` gerados com a v5 continuam validando perfeitamente na v6 com `bcrypt.compare()`.

---

## 3. Pendências Conscientes e Não Resolvidas de Propósito

1. **`react-router-dom` 6.x -> 7.x (Frontend):**
   - **Motivo:** O salto para o React Router 7 é um major breaking change de arquitetura (mudança de routing provider, imports e convenções).
   - **Avaliação de Risco:** As duas vulnerabilidades (CVE-2025-68470 bypass e constructor injection em SSR hydration) são de severidade moderada e não se aplicam à arquitetura do app:
     - Não há uso de links `<Link>` ou `useNavigate()` com URLs externas ou construídas a partir de input não confiável de usuário.
     - A aplicação é uma SPA Vite puramente client-side, sem renderização server-side (SSR) nem desserialização de erros via hidratação.
2. **Dependências do aplicativo móvel (`mobile/`):**
   - **Motivo:** Mantidas estritamente intocadas. As versões no ecossistema React Native/Expo são estritamente pinadas pelo Expo SDK 52. Upgrades unilaterais via `npm audit fix` quebram o empacotamento nativo do Metro e Hermes.
3. **Script de pós-instalação `mobile/scripts/patch-expo-auth.js`:**
   - **Motivo:** O script realiza um patch in-place em `expo-local-authentication` substituindo a importação de `Platform` por `react-native`.
   - **Fragilidade Identificada:** Qualquer atualização futura do Expo SDK ou reinstalação de pacotes pode sobrescrever ou quebrar a expectativa de layout desse arquivo. Mantido documentado para acompanhamento na eventual migração do Expo SDK.

---

## 4. Tabela de Verificação e Rastreabilidade

| Item | Arquivo(s) | Prova Executada | Resultado | Não Resolvido / Justificativa |
| :--- | :--- | :--- | :--- | :--- |
| **follow-redirects** | `backend/package-lock.json`, `frontend/package-lock.json` | `npm audit --omit=dev` | Resolvido (1.16.1) | — |
| **ip-address** | `backend/package-lock.json` | `npm audit --omit=dev` | Resolvido (10.7.4) | — |
| **bcrypt 5 -> 6** | `backend/package.json`, `backend/package-lock.json` | `tests/bcrypt_upgrade_compatibility.test.js` | Resolvido (6.0.0, zero vulns) | — |
| **Compatibilidade de Login** | `backend/tests/bcrypt_upgrade_compatibility.test.js` | `jest tests/bcrypt_upgrade_compatibility.test.js` | 2/2 testes passed | — |
| **react-router-dom** | `frontend/package-lock.json` | Análise de código e navegação SPA | Mantido na 6.28.1 | Breaking change v7; SPA pura sem SSR |
| **Dependências Mobile** | `mobile/package.json`, `mobile/package-lock.json` | `git status` (sem alterações) | Intocado | Dependências gerenciadas pelo Expo SDK 52 |
| **Patch expo-auth** | `mobile/scripts/patch-expo-auth.js` | Inspeção estática de script | Documentado | Patch nativo no postinstall, risco com Expo upgrade |

---

## 5. Nota de Compatibilidade Multiplataforma (Lockfile)

> [!NOTE]
> Lockfile gerado no Windows omitia @emnapi; validar sempre com `npx -y npm@10 ci --dry-run` antes de abrir PR.

