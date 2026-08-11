# Smoke Test Seguro — LavaFlow Commercial v1

## Objetivo
Validar a versão comercial/piloto pago do LavaFlow (branch `agent/commercial-v1-hardening`, PR #1) sem editar código, aplicar migrations ou publicar o app live nesta etapa.

## Respostas às confirmações solicitadas

### 1) O agente deste projeto consegue acessar/usar essa branch ou PR diretamente como fonte?
**Não, não diretamente.**

O checkout visível no sandbox aponta apenas para os remotes gerenciados pela Lovable (`git.private.lovable-gcp.code.storage` e `s3://lovable-repositories`). Não existe um remote GitHub configurado acessível ao agente aqui, e a branch `agent/commercial-v1-hardening` (assim como a PR #1) vive no repositório GitHub conectado via Git sync do Lovable. O agente pode ler o estado atual do preview e do banco, mas não pode fazer fetch/checkout direto do GitHub/PR dentro deste sandbox.

### 2) Alterações feitas pelo chat do Lovable ficam somente no preview até Publish?
**Sim.**

Edições via chat alteram o working tree do preview (`edit/edt-...`). Elas só são refletidas no site publicado (`lavaflowservice.lovable.app`) quando o usuário executa explicitamente a ação de Publish/Update no preview. O banco de produção (Lovable Cloud) é compartilhado entre preview e publicado, mas o código/frontend só sobe no publish.

### 3) Qual é a forma mais segura de testar a branch/migration sem alterar o app live?
**Usar um ambiente de preview isolado + banco de staging/teste.**

Fluxo recomendado:
1. Garantir que a branch `agent/commercial-v1-hardening` esteja sincronizada/mergeada no repositório Lovable (via GitHub ou UI do Lovable).
2. Abrir o projeto LavaFlow em uma sessão de preview separada (ou em um branch de preview) para que o código da PR seja carregado sem afetar o `main` publicado.
3. Aplicar as migrations **somente em um projeto/banco de teste** ou em uma instância de staging do Lovable Cloud; nunca no banco de produção antes do smoke test.
4. Executar smoke tests automatizados (Playwright) e manuais no preview URL, cobrindo: multi-tenant A/B, feature gating Essencial/Growth/Intelligence/Founders, checkout Stripe test mode e webhook.
5. Só depois de green light, fazer merge definitivo para `main` e publicar.

### 4) Se não for possível usar a branch diretamente, qual é a melhor forma de trazer as mudanças para o preview sem reimplementar tudo manualmente?
**Através do Git sync da Lovable.**

Opções, em ordem de segurança:
- **A (preferida):** No GitHub, fazer merge da PR #1 para uma branch de preview (ex.: `preview/commercial-v1-test`). O Lovable sincroniza automaticamente essa branch e o preview reflete o código.
- **B:** Na UI do Lovable, alternar o projeto para a branch `agent/commercial-v1-hardening` (se a funcionalidade de branch switching estiver habilitada em Account Settings > Labs).
- **C:** Se o GitHub estiver conectado, fazer o merge da PR para `main` em um horário controlado e deixar o Lovable puxar as mudanças; depois validar no preview antes de publicar.
- **D (último recurso):** Exportar o diff da PR e aplicar manualmente no preview, mas isso perde histórico e é propenso a erros — evitar.

## Plano técnico de smoke test

### Fase 1 — Preparação do ambiente (sem alterar produção)
1. Verificar no GitHub se a PR #1 está com CI verde e sem conflitos.
2. Criar/identificar um projeto/banco de teste no Lovable Cloud para aplicar as migrations da PR sem tocar no banco de produção.
3. Garantir que as secrets Stripe estejam configuradas em modo de teste:
   - `STRIPE_SECRET_KEY` (test)
   - `STRIPE_WEBHOOK_SECRET` (test)
   - `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_INTELLIGENCE`, `STRIPE_PRICE_FOUNDERS`
4. Configurar webhook de teste apontando para o preview URL (`id-preview--...lovable.app/api/public/stripe-webhook`).

### Fase 2 — Validação de build e migrations
1. Sincronizar a branch `agent/commercial-v1-hardening` para o preview.
2. Rodar `tsc --noEmit` e `vite build` no preview.
3. Aplicar as migrations pendentes no banco de teste.
4. Verificar se todas as tabelas/campos novos existem (`tenant_subscriptions`, `stripe_webhook_events`, `tenant_ai_settings` se ainda existir, etc.).

### Fase 3 — Smoke tests funcionais
Executar os cenários de validação final do escopo comercial:

| Cenário | O que validar | Método |
|---------|---------------|--------|
| A | Tenant A e Tenant B têm slugs distintos e isolados | Playwright + query no banco de teste |
| B | Agendamento pelo link A grava apenas no tenant A | Playwright simulando visitante anônimo |
| C | Usuário Essencial não acessa Growth/Intelligence por UI nem rota direta | Playwright + requisição direta à rota |
| D | Usuário Growth acessa Growth, mas não IA/Intelligence | Playwright |
| E | Intelligence acessa todos os recursos | Playwright |
| F | Founders acessa todos os recursos | Playwright + flag `is_founders` |
| G | Checkout cria assinatura em test mode | Stripe Test Mode + Playwright |
| H | Webhook atualiza assinatura/plano | Stripe CLI/webhook de teste + logs |
| I | Cancelamento/falha não apaga dados e atualiza entitlement | Simular evento `customer.subscription.updated`/`invoice.payment_failed` |
| J | Customer Portal abre para o tenant autenticado | Playwright clicando em "Gerenciar assinatura" |

### Fase 4 — Checklist de segurança
- Confirmar que nenhuma secret Stripe ou service_role é exposta no client.
- Confirmar que RLS continua ativo em todas as tabelas tenant-scoped.
- Confirmar que `assertPlanFeature` está presente nas server functions premium.
- Confirmar que webhook valida assinatura e idempotência.

### Fase 5 — Decisão de go/no-go
- Se todos os cenários A-J passarem em ambiente de teste: aprovar merge para `main` e publicar.
- Se houver falha em G/J (Stripe) por falta de credenciais: documentar o blocker e não publicar até configurar as secrets.
- Se houver falha em A-F (multi-tenant/RBAC): corrigir antes de qualquer publicação.

## Riscos e pendências
- **Credenciais Stripe:** sem `STRIPE_SECRET_KEY` e price IDs reais, os cenários G/J não podem ser validados de ponta a ponta.
- **Banco compartilhado:** preview e publicado compartilham o mesmo banco Lovable Cloud; testes de escrita devem ser feitos em tenant de teste, nunca em tenant de cliente real.
- **Migrations irreversíveis:** se a PR contém migrations destrutivas, é necessário revisar o diff SQL antes de aplicar em produção.
- **Git sync delay:** pode haver atraso de alguns segundos/minutos entre merge no GitHub e sincronização no preview.

## Entregáveis deste plano
- Ambiente de preview isolado com a branch comercial carregada.
- Banco de teste com migrations aplicadas.
- Relatório de smoke test com resultados dos cenários A-J.
- Decisão documentada de merge/publicação ou lista de blockers.
