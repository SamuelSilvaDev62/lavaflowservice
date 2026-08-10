# LavaFlow — Auditoria de Entitlements (2026-08-10)

Objetivo: garantir que cada assinatura libere exatamente os recursos vendidos, que uma assinatura inativa não continue usando a operação e que recursos premium sejam protegidos no frontend e no backend.

## Matriz comercial vigente

### Essencial — R$ 99/mês
- clientes
- agendamentos
- ordens
- fila
- equipe
- configuracoes

### Growth — R$ 179/mês
Inclui Essencial +
- fidelidade
- clientes_inativos
- campanhas
- whatsapp_automacoes
- acompanhamento_cliente
- assinaturas
- oportunidades
- relatorios_avancados

### Intelligence — R$ 279/mês
Inclui Growth +
- ai_assistant
- analises_inteligentes
- recomendacoes

### Founders — R$ 99/mês
Acesso efetivo equivalente ao Intelligence enquanto a assinatura estiver válida.

---

## Resultado da auditoria

| Área / feature | UI | Backend | Situação |
|---|---|---|---|
| Assinatura/trial ativo para usar o app | ✅ `SubscriptionBoundary` global | ✅ middleware comercial exige entitlement ativo | Fechado |
| Clientes / Agenda / OS / Fila / Equipe / Configurações | ✅ bloqueados globalmente sem plano | ✅ server functions com middleware padrão exigem assinatura/trial ativo | Fechado |
| Billing / recuperação de assinatura | ✅ `/planos` continua acessível | ✅ `getMeuPlano`, Checkout e Portal usam middleware auth-only | Fechado |
| Fidelidade | ✅ FeatureGate | ✅ `assertPlanFeature("fidelidade")` | Fechado |
| Clientes inativos | ✅ FeatureGate + dashboard não consulta sem acesso | ✅ `assertPlanFeature("clientes_inativos")` | Fechado |
| Campanhas | ✅ FeatureGate + menu | ✅ `assertPlanFeature("campanhas")` | Fechado |
| Assinaturas de serviços | ✅ FeatureGate + menu | ✅ `assertPlanFeature("assinaturas")` | Fechado |
| Oportunidades | ✅ FeatureGate + menu + GESTAO | ✅ `assertPlanFeature("oportunidades")` | Fechado |
| Relatórios avançados | ✅ FeatureGate + menu | ✅ `assertPlanFeature("relatorios_avancados")` | Fechado |
| Análises inteligentes | ✅ bloco Intelligence em Relatórios | ✅ `getInsights` exige `analises_inteligentes` | Fechado |
| Assistente com IA | ✅ Consultor IA restaurado, menu e rota só Intelligence/Founders | ✅ endpoint autentica tenant/papel e exige `ai_assistant` antes do modelo | Implementado na branch; smoke test publicado pendente |
| Recomendações inteligentes / Upsell | ⚠️ motor continua dentro de Configurações; UX de upgrade da aba pode ser refinada | ✅ migration exige Intelligence nas regras e oportunidades; trigger também bloqueia geração via service role | Backend fechado na branch; teste de migration pendente |
| WhatsApp automações | ⚠️ campanhas são Growth, mas envio manual e automações ainda precisam ser separados conceitualmente | ⚠️ enforcement dedicado `whatsapp_automacoes` ainda não cobre todos os fluxos | P1 |
| Acompanhamento do cliente | ❌ experiência dedicada não localizada | ❌ enforcement `acompanhamento_cliente` não localizado | P1 / definição de produto |
| Founders | ✅ Intelligence efetivo + checkout separado dos cards públicos | ✅ oferta aceita apenas para tenant marcado `is_founders` | Fechado |

---

## Correções aplicadas nesta branch

1. `SubscriptionBoundary` global e guard comercial central no backend.
   - Sem assinatura/trial válido, a operação não renderiza e server functions operacionais não executam.
   - `/planos`, consulta de assinatura, Checkout e Customer Portal permanecem disponíveis para recuperação.

2. Navegação e RBAC alinhados aos planos.
   - Relatórios Growth+.
   - Oportunidades Growth+ e papéis de gestão.
   - Consultor IA aparece somente para Intelligence/Founders e papéis de gestão.

3. Intelligence ganhou valor visível.
   - Análises inteligentes em Relatórios.
   - Consultor LavaFlow IA restaurado com resumo executivo, health score, oportunidades priorizadas, plano de ação e chat.
   - Chat consulta apenas dados do tenant e possui ferramentas server-side para clientes inativos, top clientes, dias da semana, serviços e apoio de mensagem.
   - Endpoint verifica `ai_assistant` antes de qualquer chamada ao modelo e limita passos/rate de consultas.

4. Recomendações/Upsell endurecidas.
   - Nova função SQL `tenant_has_intelligence` considera Intelligence/Founders e validade comercial.
   - RLS de `upsell_regras` e `os_upsell_oportunidades` exige Intelligence.
   - Como o modo equipe usa service role, trigger no banco impede geração de oportunidade para plano inferior sem quebrar o checklist.
   - Configuração de regra também recebe trigger de proteção.

5. Infra mínima de IA restaurada pela migration.
   - `ai_usage_logs` para rate/observabilidade.
   - `ai_recommendations` para persistir recomendações.
   - Ambas tenant-aware, com RLS e exigência de Intelligence.

6. Checkout Founders separado da seleção pública de planos.
   - Cards Essencial/Growth/Intelligence respeitam o plano clicado.
   - Founders possui CTA próprio e continua sendo oferta interna.

7. CI ajustado para TanStack Router.
   - Build roda antes do `tsc` para regenerar `routeTree.gen.ts` quando uma nova file route entra.
   - Última validação: install ✅, production build ✅, typecheck ✅.

---

## Antes de produção comercial

### P0 — Smoke test do Intelligence publicado
A implementação está na branch e compila, mas ainda não foi publicada. Antes do merge definitivo:
- aplicar a migration nova em ambiente controlado;
- validar Intelligence/Founders abrindo `/assistente`;
- validar Growth/Essencial sem acesso ao Assistente/API;
- testar GET do diagnóstico e uma conversa real pelo Lovable AI;
- concluir checklist em Growth e confirmar que não gera upsell inteligente;
- concluir checklist em Intelligence e confirmar que a oportunidade é criada.

### P0 — Customer Portal / ciclo de assinatura
Validar upgrade, downgrade e cancelamento da Stripe e confirmar sincronização pelo webhook, incluindo bloqueio/liberação automática de features.

### P1 — WhatsApp
Separar claramente envio manual (operação básica) de automações reais (Growth), aplicando `whatsapp_automacoes` somente às automações.

### P1 — Acompanhamento do cliente
Definir se `acompanhamento_cliente` representa o acompanhamento público de OS/agendamento. Implementar/restaurar e proteger ou retirar temporariamente da matriz comercial.

### P1 — UX do Motor de Upsell
O backend já está protegido; refinar a aba de Configurações para mostrar FeatureGate/CTA de Intelligence em vez de apenas depender do bloqueio do banco.

---

## Critério para considerar billing + entitlements pronto

- Checkout escolhe o Price ID correto para cada plano.
- Webhook sincroniza criação, pagamento, upgrade, downgrade e cancelamento.
- `tenant_subscriptions` é fonte de verdade comercial.
- UI não monta recurso não autorizado.
- Backend rejeita chamada direta de recurso não autorizado.
- Conta cancelada/expirada não opera, preserva dados e consegue reativar.
- Founders mantém acesso completo sem virar um quarto plano público.
- Intelligence entrega Assistente IA, análises e recomendações reais.
- Promessas exibidas nos planos correspondem ao produto publicado.
