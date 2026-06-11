
# Módulo de Agendamento Inteligente

Decisões padrão (sem bloqueios):
- Página pública `/agendar/{slug}` incluída nesta entrega (slug derivado da empresa).
- Conflito de horário valida pela capacidade configurada (bloqueia com aviso explicativo).
- Lembretes manuais via botão WhatsApp (sem cron) — simples e alinhado ao restante.

---

## 1. Banco de dados (1 migration)

**Tabela `agendamentos`**
- `id`, `owner_id`, `cliente_id`, `veiculo_id` (nullable), `servico_id` (nullable)
- `data_agendada` (date), `hora_agendada` (time)
- `status` enum `agendamento_status`: agendado | confirmado | em_andamento | concluido | cancelado | nao_compareceu
- `observacoes` text, `ordem_id` (fk para OS criada)
- `created_at`, `confirmado_em`, `cancelado_em`, `concluido_em`
- Índices: (owner_id, data_agendada), (owner_id, status)

**Tabela `agenda_config`** (1 linha por owner)
- `owner_id` PK, `hora_inicio` (default 08:00), `hora_fim` (18:00), `dias_semana` int[] (1-6), `intervalo_min` (30), `capacidade_simultanea` (1)

**`empresa`**: adicionar `slug` text unique (gerado a partir de `nome_fantasia` no bootstrap; backfill com unaccent+lower+regex).

GRANTs para `authenticated` e `service_role`. RLS com `current_owner_id()` igual ao padrão. Para `agenda_config`/`empresa` por slug, criar função `public.get_empresa_by_slug(slug)` SECURITY DEFINER retornando apenas campos públicos (id, nome, telefone, slug) para a página pública.

Bootstrap: estender `tg_bootstrap_new_user` para inserir `agenda_config` default e gerar `slug`.

---

## 2. Server functions (`src/lib/lavaflow.functions.ts`)

- `listAgendamentos({ date?, range?, status? })`
- `createAgendamento(input)` — valida capacidade contra `agenda_config`
- `updateAgendamentoStatus({ id, status })`
- `iniciarAtendimento({ id })` — cria OS (`ordens_servico` aguardando), grava `ordem_id`, status → `em_andamento`
- `getAgendaConfig` / `updateAgendaConfig`
- `agendamentoStats()` — hoje, confirmados, em atendimento, no-show; usado no dashboard e cards

Página pública usa server fn sem auth:
- `getEmpresaPublica({ slug })` — chama RPC `get_empresa_by_slug`
- `getHorariosDisponiveis({ slug, data })` — calcula slots a partir de `agenda_config` − ocupação
- `solicitarAgendamentoPublico({ slug, nome, telefone, veiculo, servico_id, data, hora, obs })` — usa `supabaseAdmin` (import dentro do handler), cria/upserta cliente, insere agendamento `agendado`

---

## 3. Rotas

- `src/routes/_authenticated/agendamentos.tsx` — abas Agenda (timeline por horário) e Lista; cards no topo; modal "Nova Reserva"; ações por linha: Confirmar, Iniciar atendimento, Marcar não compareceu, Cancelar, WhatsApp confirmação, WhatsApp lembrete
- `src/routes/_authenticated/configuracoes.tsx` — nova seção "Agenda" (horários, dias, intervalo, capacidade)
- `src/routes/_authenticated/dashboard.tsx` — adicionar 4 KPIs de agendamento
- `src/routes/_authenticated/relatorios.tsx` — bloco "Agendamentos" (período, comparecimento %, cancelamento %, horários e dias mais procurados)
- `src/routes/agendar.$slug.tsx` — pública, SSR on, head() com OG; form em etapas (dados → serviço → data/hora → confirmação)
- Adicionar `Agendamentos` ao menu (grupo Operação) em `app-layout.tsx`

---

## 4. Conversão em OS

`iniciarAtendimento` cria `ordens_servico` com `cliente_id`, `veiculo_id`, `servico_id`, `valor = servicos.preco_padrao`, status `aguardando` (entra direto no Kanban da Fila); invalida queries de fila/ordens/agendamentos.

---

## 5. WhatsApp

Helpers em `src/lib/whatsapp.ts`:
- `mensagemConfirmacao(ag)` e `mensagemLembrete(ag)` → abrem `https://wa.me/<tel>?text=...` em nova aba

Botões na linha do agendamento e no detalhe.

---

## 6. Assistente / Oportunidades

Em `oportunidades.tsx` e/ou assistant, adicionar insights baseados em `agendamentos` quando houver dados:
- nº de no-shows no mês
- dia da semana com menor ocupação
- janela de horário mais procurada
- capacidade ociosa por dia da semana

Implementado como funções de agregação simples chamadas pela página existente — sem novo motor.

---

## 7. Detalhes técnicos

- Mobile-first: cards empilhados, abas via shadcn `Tabs`, timeline com lista agrupada por hora
- `Dialog` para Nova Reserva reusa selects de cliente/veículo/serviço já existentes em `ordens.tsx`
- Validação Zod no client e dentro dos handlers
- Página pública NÃO sob `_authenticated/`; loader chama server fn pública (admin client dentro do handler) — não usa `requireSupabaseAuth`
- Realtime opcional fica fora desta entrega

---

## Arquivos criados/alterados

Novos:
- `supabase/migrations/<ts>_agendamentos.sql`
- `src/routes/_authenticated/agendamentos.tsx`
- `src/routes/agendar.$slug.tsx`

Editados:
- `src/lib/lavaflow.functions.ts` (server fns + stats)
- `src/lib/whatsapp.ts` (helpers de mensagem)
- `src/components/app-layout.tsx` (item de menu)
- `src/routes/_authenticated/dashboard.tsx` (4 KPIs)
- `src/routes/_authenticated/configuracoes.tsx` (seção Agenda)
- `src/routes/_authenticated/relatorios.tsx` (bloco Agendamentos)
- `src/routes/_authenticated/oportunidades.tsx` (insights)

Fora de escopo (segunda fase): lembretes automáticos via cron, fila de aprovação para solicitações públicas (entram já como `agendado`), realtime updates.
