# Relatório - Rodada 2: Servidor Facial e Hardening

## Resumo das Tarefas
Nesta rodada, foi implementada a verificação facial no servidor e regras de hardening, com suporte a BLE Fallback seguro:

1. **Servidor Facial**:
   - `mockProvider` modificado para suportar respostas realistas (MATCH, NOMATCH, NOLIVE).
   - Bloqueio automático em produção se `mockProvider` for usado.
   - Modificação no `fuelingController` para checar `facial_verified_at` na autorização da bomba.
   - Cadastro de template da face atrelado ao `driver_id`.
   - Limpeza automática de `facial_attempts` (retentionPolicy limitando a 5.000 logs antigos).

2. **Segurança (Hardening)**:
   - Desativação do motorista agora encerra sessões e alerta o `securityService`.
   - O `securityService` agora alerta corretamente tentativas de abastecimento com BLE sem consentimento de hardware.

3. **Interface de Usuário (Frontend)**:
   - `FacialAttemptsPage` adicionada com listagem e status do match facial (Liveness e Score).
   - `DriversPage` atualizada com indicadores visuais de "Biometria Ativa" ou ausente.
   - Inserido `EnrollmentModal` contendo aviso LGPD claro e funcionalidade para enviar o mock base64 da câmera.
   - Confirmação explícita de impacto ao desativar o acesso de motoristas ("Atenção: desativar o motorista cancelará imediatamente...").
   - Atualizados os alertas visuais no `alertMapping.js` para `facial_auth_failed`, `facial_auth_locked` e `ble_fallback_used`.

## Testes
A suíte `facial.test.js` teve 13 testes cobrindo todo o ciclo facial e BLE. Todos passaram, comprovando:
- Inserções de template base64, erro no tamanho/formato da foto.
- Tentativas registradas para falhas (3 seguidas bloqueiam a bomba).
- Sessões expiram corretamente ao autorizar de novo ou após tempo limite (facial_consumed_at funciona).
- BLE fallback gera registro na tabela de `fleet_alerts` (nível `medium`).
- Desativação do motorista encerra o `fueling_sessions` abertas.
