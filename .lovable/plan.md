# Plano — Auditoria & Refinamento Premium v3

Escopo focado em **frontend, UX/UI, microinterações, consistência visual e linguagem humanizada**. Sem mexer em RLS, schema do banco ou contratos do Flow Engine — apenas a camada de apresentação acima deles.

## Princípios

1. **Esconder a complexidade técnica.** Nada de "workflow", "agent", "token", "LLM", "pipeline", "OpenSquad" na UI.
2. **Linguagem orientada a benefício** ("Criar campanha", "Analisar faturamento", "Gerar resumo").
3. **Cartões inteligentes** no lugar de tabelas frias para insights e campanhas.
4. **Microinterações discretas** padronizadas com os tokens já criados em `design-system.ts` (duration-fast/base/slow, transition-premium, hover-lift, press-scale).
5. **Lucide only**, animações com mesmo timing, sem libs novas.

---

## Etapa 1 — Auditoria & Fundação Visual

**Novo:** `src/components/ui/insight-card.tsx`, `src/components/ui/campaign-card.tsx`, `src/components/ui/section-summary.tsx`, `src/components/ui/stat-tile.tsx`.

`src/styles.css` ganha utilitários:
- `.card-premium` (neomorphism leve consistente: shadow-sm + ring sutil + hover-lift).
- `.chip-soft` (estados info/warning/critical/opportunity unificados).
- `.list-stagger > *` (entrada `fade-in` com delay incremental via CSS variable `--i`).
- `.skeleton-shimmer` já existe → aplicar de forma sistemática.

**Auditoria executada agora** (substituições):
- Remover overflow horizontal em tabelas densas (`agendamentos.tsx`, `ordens.tsx`, `equipe.tsx`, `clientes/index.tsx`) → adotar layout cartão <768px (já há `useMobile`); reaproveitar `CampaignCard`/`StatTile` quando aplicável.
- Padronizar headers de página: `PageHeader` recebe `eyebrow`, `actions`, `description` opcionais (refator leve no componente existente em `app-layout.tsx`).
- Normalizar PT-BR (acentos) nos textos das telas remanescentes (varredura em todas as rotas de `_authenticated/`).

## Etapa 2 — Módulo Inteligência humanizado

**Reescrever `src/routes/_authenticated/inteligencia.tsx`** mantendo as chamadas a `inteligencia.functions.ts` (sem mexer em backend).

Estrutura nova (3 abas suaves, sem cara de painel técnico):
- **Hoje** → `SectionSummary` com 3-5 bullets ("Agenda com baixa ocupação", "Ticket médio caiu", "Potencial de upsell") + CTA "Ver análise". Substitui o bloco de "Resumo diário".
- **Oportunidades** → grid de `InsightCard` (ícone temático, título curto, descrição em 1 frase, badge de impacto "+R$ 2.300", CTA primário "Gerar campanha" / secundário "Dispensar").
- **Especialistas** → cards de "Análises" (faturamento, retenção, ocupação), cada um com botão "Analisar agora" — esconde a noção de agent/workflow.

**Renomes de UI (sem mudar slugs):**
- "Configurações da IA" → **"Modo Inteligência"** (toggle Ligado/Desligado + intensidade leve/equilibrado/intenso, sem mostrar tokens/limites brutos; usa um slider que mapeia internamente para `monthly_token_limit`).
- "Executar workflow" → **"Criar campanha"**.
- "Rodar agente de faturamento" → **"Analisar faturamento"**.
- "Pipeline" → **"Gerar resumo"**.

**Campanhas (`campanhas.tsx`):** lista vira grid de `CampaignCard` com: objetivo (badge), público (chip), status (chip animado), data, canais (ícones), ações `Ver` / `Duplicar` / `Pausar`.

## Etapa 3 — Microinterações

- Entrada de listas: `.list-stagger` (fade-in + translate-y 8px, 60ms entre itens, máx 8 itens animados).
- Skeletons substituem spinners genéricos em Dashboard, Inteligência, Campanhas, Ordens, Equipe.
- Toast de sucesso ganha ícone `CheckCircle2` + leve `scale-in` (config no `sonner.tsx`).
- Hover em cards: `hover-lift` (translate-y -2px + shadow). Press: `press-scale` (scale 0.98).
- Transições de rota: fade-in 200ms no `<Outlet />` do `_authenticated/route.tsx`.

## Etapa 4 — Home (Painel Executivo) priorizada

Reordenar o `dashboard.tsx` na ordem de decisão do dono do lava-rápido:

```text
[Hero saudação + contexto do dia]
[Faixa Oportunidades de Hoje]  ← novo, puxa top 3 de InsightCards
[Agenda de hoje + Ordens em andamento] (2 col desktop, stack mobile)
[KPIs faturamento com TrendIndicator]
[Atalhos: Clientes • Equipe • Insights completos]
```

A "Faixa Oportunidades" usa `listIntelligenceOverview` (já existe) com `limit: 3` — se vazio, esconde. Empty state com CTA "Configurar Modo Inteligência".

## Etapa 5 — Consistência & Reuso

- Consolidar 3 variações de empty state em `EmptyState` único (já existe `empty-state.tsx`, `empty-dashboard.tsx`) — manter um, deletar duplicado.
- `PageHeader` único usado por todas as rotas autenticadas (já é, mas auditar props inconsistentes).
- Ícones Lucide auditados — remover qualquer SVG inline remanescente.

## Etapa 6 — Linguagem orientada a benefício (varredura global)

Substituições textuais (find/replace controlado):
| ❌ | ✔ |
|---|---|
| Executar workflow | Criar campanha |
| Rodar agente | Analisar |
| Pipeline | Resumo |
| Token / LLM / Model | (remover da UI) |
| Configurações da IA | Modo Inteligência |

## Etapa 7 — Acessibilidade & Performance

- `min-h-11` em todos os CTAs primários mobile (já feito em `button.tsx`, auditar usos custom).
- `React.memo` em `InsightCard`, `CampaignCard`, `ServiceCard` (já memo), `StatTile`.
- `useQuery` com `staleTime: 30_000` onde hoje refetch é a cada 60s sem necessidade (Dashboard, Inteligência).
- Prefetch via `router.preload` nos links principais da sidebar.

## Etapa 8 — 3 Oportunidades estratégicas (entregues no relatório, não implementadas)

1. **Copiloto Operacional contextual** — assistente flutuante que lê a rota atual e oferece ações específicas (ex.: em `/agendamentos` sugere "Reagendar no-shows da semana"). Reaproveita Flow Engine sem expor o termo.
2. **Radar de Retenção** — painel que prevê risco de churn por cliente usando histórico de OS, com ação 1-clique "Enviar oferta de retorno". Usa segment-templates do flow-engine.
3. **Score Lava-Rápido** — índice composto (ocupação, ticket médio, retenção, NPS) com benchmarking anônimo vs. outros tenants. Vira diferencial comercial e gancho de upsell.

---

## Entregáveis

- ~6 componentes novos (`InsightCard`, `CampaignCard`, `SectionSummary`, `StatTile`, refactor `PageHeader`, unificação `EmptyState`).
- Reescrita de `inteligencia.tsx` e `campanhas.tsx`.
- Refator do `dashboard.tsx` (reordenação + faixa de oportunidades).
- Ajustes em `styles.css` (utilitários), `sonner.tsx` (ícones), `_authenticated/route.tsx` (fade-in).
- Varredura PT-BR + linguagem benefício em todas as rotas autenticadas.
- Relatório final em chat com: problemas corrigidos, decisões de design substituídas com justificativa, 3 oportunidades estratégicas.

## Fora de escopo (não tocar)

- Backend, RLS, migrations, edge functions.
- Contratos do Flow Engine / OpenSquad adapter.
- Auth, Storage policies, tipos gerados Supabase.

## Riscos & mitigação

- Renomes podem confundir power-users → manter slugs de rota, só mudar labels.
- Reescrita da Inteligência é a maior superfície → manter as mesmas server functions; só camada visual muda.
- Animações em listas longas → cap em 8 itens animados, resto entra sem stagger.
