# Relatório: Ajustes e Revisão - Rodada 3

Este relatório resume os ajustes finais feitos no painel web, papéis e documentação, implementados na branch `fix/web-round3-review` após o merge precoce da branch anterior.

## O que Mudou (Resolvido)

1. **Documentação API Mobile Lida do Código**
   - O arquivo `docs/API_MOBILE.md` foi integralmente reescrito utilizando os limites extraídos dos controllers reais.
   - Foram corrigidos os fluxos diagramados no Mermaid (incluindo o fluxo BLE Fallback de 2 vias `hardware -> backend <- app`).
   - Todos os status de erro (`403`, `404`, `409`, `429`, `503`) da biometria facial e autorizações foram detalhados exatamente como implementados.

2. **Testes de Permissões (Roles) no Backend**
   - Criado `backend/tests/roles.test.js` e implementada verificação exaustiva de permissões em todas as rotas (Manager não edita settings, Auditor não tem write permissions).
   - Validada a proteção que impede o rebaixamento/desativação acidental do *último admin ativo* (`409`).
   - Corrigido o bug em `usersController.update` onde no caminho de `404 User not found` a transação ficava aberta porque havia `release()` sem `ROLLBACK`. O teste validou que a query seguinte no pool passava.
   - Os emails agora sofrem normalização `.toLowerCase().trim()` nativa em `/login` e criação de usuário. Adicionada a rota especial para senhas `PATCH /api/users/:id/password`.

3. **Correções na Proteção Frontend e Vitest**
   - A rota de admin (`/users`) e as renderizações das actions (Salvar, Editar, Remover e Cancelar Rota de Emergência) agora validam efetivamente `user?.role !== 'auditor'` (e `'admin'` para /users e configurações).
   - Atualizado o TopBar para exibir uma badge `Modo somente leitura` dourada para contas de Auditor.
   - Todos os arquivos vitest do React rodaram em jsdom limpos de falha.

4. **Limpeza Geral**
   - Remoção compulsória via `git rm` de *dezenas* de arquivos de correção soltos pelo repositório (scripts descartáveis `qX.js`, `patch.js`, `fix.js`).
   - O arquivo `docker-compose.yml` teve sua warning depreciada de versão removida, e a identação dupla no final do `backend/src/index.js` foi corrigida.
   - O `backend/.env.example` e `README.md` refletem totalmente o ecossistema com a tabela de variáveis e os pormenores arquitetônicos em produção e ambientes de teste.

## O que NÃO foi Resolvido

Nenhuma pendência estrutural requerida na tarefa foi deixada aberta. A única limitação sistêmica relatada (que já constava como exceção aceitável) é a não-implementação da nuvem facial da AWS/Azure no controller nativo `faceProvider/index.js`, que no momento utiliza um *mock* e emite aviso explícito de falha em produção `NODE_ENV=production`. A checagem real contra AWS/Azure depende da liberação de tokens/contas que não fazem parte do escopo atual.
