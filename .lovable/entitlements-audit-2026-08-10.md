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
| Assinatura/trial ativo para usar o app | ✅ Boundary global | ⚠️ funções essenciais ainda não possuem guard global próprio | Parcial — UI fechada, hardening backend pendente |
| Clientes / Agenda / OS / Fila / Equipe / Configurações | ✅ bloqueados globalmente sem plano | ⚠️ autorização de tenant/RBAC existe, mas falta guard comercial central para chamada direta | Parcial |
| Fidelidade | ✅ FeatureGate | ✅ `assertPlanFeature("fidelidade")` em leitura/escrita | Fechado |
| Clientes inativos | ✅ FeatureGate + dashboard não consulta sem acesso | ✅ `assertPlanFeature("clientes_inativos")` | Fechado |
| Campanhas | ✅ FeatureGate + menu | ✅ `assertPlanFeature("campanhas")` em leitura/escrita/processamento | Fechado |
| Assinaturas de serviços | ✅ FeatureGate + menu | ✅ `assertPlanFeature("assinaturas")` | Fechado |
| Oportunidades | ✅ FeatureGate + menu + GESTAO | ✅ `assertPlanFeature("oportunidades")` | Fechado |
| Relatórios avançados | ✅ FeatureGate + menu | ✅ `assertPlanFeature("relatorios_avancados")` | Fechado |
| Análises inteligentes | ✅ bloco Intelligence dentro de Relatórios; Growth vê CTA de upgrade | ✅ `getInsights` exige `analises_inteligentes` | Fechado para a implementação atual |
| WhatsApp automações | ⚠️ campanhas são Growth, mas os helpers de WhatsApp/manual não usam a feature dedicada | ⚠️ não há enforcement específico de `whatsapp_automacoes` | Parcial / definição de produto necessária |
| Acompanhamento do cliente | ❌ não foi localizada rota/experiência dedicada atual | ❌ não foi localizado enforcement de `acompanhamento_cliente` | Gap de produto |
| Assistente com IA | ❌ feature declarada e migrations históricas existem, mas não há experiência atual localizada no app | ❌ não foi localizado enforcement de `ai_assistant` | Gap comercial — não prometer como pronto sem implementar |
| Recomendações inteligentes | ⚠️ motor de upsell/regras existe em Configurações, porém não está protegido como Intelligence | ⚠️ `listUpsellRegras` / `upsertUpsellRegra` e `getSaudeNegocio` não possuem gate Intelligence | Gap de entitlement |
| Founders | ✅ tratado como Intelligence e checkout separado dos cards públicos | ✅ oferta Founders só é aceita quando o tenant já está marcado no banco | Fechado |

---

## Correções aplicadas nesta branch

1. Criado `SubscriptionBoundary` no layout autenticado.
   - Sem assinatura/trial válido, a operação não renderiza.
   - `/planos` permanece acessível para regularização.
   - Falha ao consultar entitlement fecha o acesso por segurança.
   - Dados não são apagados.

2. Navegação alinhada aos planos.
   - Relatórios agora só aparece para Growth+.
   - Oportunidades passou a aparecer apenas para Growth+ e papéis de gestão.

3. Oportunidades alinhado com RBAC.
   - A rota agora exige `GESTAO` além do entitlement Growth.

4. Intelligence passou a ter valor visível na UI atual.
   - `getInsights`, que já era protegido no backend por `analises_inteligentes`, agora é consumido na tela de Relatórios.
   - Growth vê o relatório normal e um card de upgrade para Intelligence.
   - A consulta Intelligence só ocorre após confirmação do entitlement.

5. Checkout Founders separado da seleção pública de planos.
   - Essencial, Growth e Intelligence sempre enviam o plano que o usuário clicou.
   - Uma conta elegível a Founders recebe um CTA próprio para o preço Founders.
   - A oferta continua validada no backend pelo marcador `is_founders`; o cliente não consegue se autodeclarar Founder.

6. CI validado após as alterações estruturais.
   - Typecheck ✅
   - Production build ✅

---

## Bloqueadores antes de produção comercial

### P0 — Backend comercial para recursos Essencial
O `SubscriptionBoundary` impede o uso normal pela interface, mas não substitui autorização server-side. Criar um guard/middleware de assinatura ativa para funções pagas da operação essencial, mantendo billing (`getMeuPlano`, checkout, portal) acessível para contas sem plano.

Não acoplar essa regra cegamente ao `requireSupabaseAuth`, pois funções de cobrança também dependem desse middleware e precisam funcionar durante recuperação de assinatura.

### P0 — Recomendações / Upsell Intelligence
Se o Motor de Upsell for parte de `recomendacoes`, adicionar gate `recomendacoes` tanto na UI de Configurações quanto em `listUpsellRegras`, `upsertUpsellRegra` e funções correlatas. Avaliar `getSaudeNegocio` como `analises_inteligentes` ou `recomendacoes` e protegê-lo no backend.

### P0 — Promessa do plano Intelligence
A matriz comercial atualmente promete `Assistente com IA`. A experiência não foi localizada no código atual. Antes de vender Intelligence, escolher uma das duas opções:
- implementar/restaurar a experiência do Assistente e proteger com `ai_assistant`; ou
- remover temporariamente essa promessa da oferta até o recurso estar pronto.

### P1 — Acompanhamento do cliente
`acompanhamento_cliente` está declarado no Growth, mas não foi localizada uma experiência dedicada atual. Confirmar se a intenção é o acompanhamento público de OS/agendamento; implementar/restaurar e proteger, ou retirar temporariamente da matriz.

### P1 — WhatsApp
Separar claramente:
- envio manual via link/registro de interação (pode continuar operacional), e
- automações de WhatsApp (Growth).

Aplicar `whatsapp_automacoes` somente às automações reais para não bloquear comunicação manual básica indevidamente.

---

## Critério para considerar billing + entitlements pronto

- Checkout escolhe o Price ID correto para cada plano.
- Webhook sincroniza criação, pagamento, upgrade, downgrade e cancelamento.
- `tenant_subscriptions` é fonte de verdade comercial.
- UI nunca monta recurso não autorizado.
- Backend rejeita chamada direta de recurso não autorizado.
- Conta cancelada/expirada não opera, mas preserva dados e consegue acessar cobrança para reativar.
- Founders mantém acesso completo sem virar um quarto plano público.
- Promessas exibidas na tela de planos correspondem a funcionalidades realmente disponíveis.
