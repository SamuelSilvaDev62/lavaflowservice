# Plano — Copiloto Contextual + Redesign Booking Público

Dois eixos independentes que podem ser entregues juntos. Foco em frontend; backend só onde a lógica de slots realmente exige correção.

---

## Parte A — Copiloto Operacional Contextual

Assistente flutuante que lê a rota atual e oferece 2-4 ações de alto valor. Sem expor "agent/workflow/LLM" na UI.

### Componente

- Novo `src/components/copilot/contextual-copilot.tsx`: FAB no canto inferior direito (acima do menu mobile), abre um popover com:
  - Cabeçalho "Copiloto" + descrição curta do contexto ("Você está na Agenda de hoje").
  - Lista de ações sugeridas (chips/cards) com ícone + label + atalho.
  - Footer "Abrir Consultor Inteligente" → `/inteligencia`.
- Novo `src/lib/copilot/registry.ts`: mapa `route → CopilotAction[]`. Cada ação tem `id`, `label`, `icon`, `tone`, `run(ctx)` que abre dialog/navega/mutate.
- Hook `useCopilotContext()` lê `useRouterState({ select: s => s.location.pathname })` + dados leves via `useQuery` (já cacheados) e retorna ações.

### Mount

- Em `src/routes/_authenticated/route.tsx` (dentro do layout, fora do `<Outlet/>`).

### Ações por rota (v1)

| Rota | Ações |
|---|---|
| `/dashboard` | "Ver agenda de hoje", "Reagendar no-shows", "Cobrar OS pendentes" |
| `/agendamentos` | "Reagendar selecionado", "Marcar como concluído", "Confirmar via WhatsApp", "Bloquear horário" |
| `/ordens` | "Avançar status", "Adicionar upsell sugerido", "Marcar entregue" |
| `/clientes` | "Enviar oferta de retorno", "Marcar VIP" |
| `/equipe` | "Marcar pagamento de comissão", "Ver ranking do mês" |
| `/inteligencia` | "Criar campanha a partir do top insight" |

### Atalhos reais

- **Reagendar OS**: usa server fn `atualizarAgendamento` (existente) — dialog rápido com date/time pickers reaproveitando os novos slots do redesign.
- **Atualizar status OS**: usa `atualizarStatusOS` (existente) — dropdown de status no copiloto, mutate + invalidate query.
- **No-shows**: filtra agendamentos `status=nao_compareceu` últimos 7d e abre lista com botão "Reagendar para amanhã".

Sem novas server functions; só wrappers de UI.

### Persistência leve

- LocalStorage `copilot:dismissed:{actionId}` para esconder ações dispensadas por 24h.
- LocalStorage `copilot:open` para lembrar estado.

---

## Parte B — Redesign Booking Público (`/agendar/$slug`)

Reescrita do fluxo priorizando velocidade (<60s) e clareza, mobile-first.

### Nova estrutura — 4 etapas + resumo fixo

```text
[Hero compacto da empresa]
[Stepper: Serviço → Data → Horário → Confirmar]
[Conteúdo da etapa atual]
[Resumo sticky (mobile: bottom bar) com CTA]
```

Stepper reusa `src/components/booking-stepper.tsx` (já existe).

### Etapa 1 — Hero

- Logo, nome, badge avaliação (se houver), endereço, horário hoje, CTA "Agendar" (rolagem ou scroll).
- Remove `PremiumPageBody` da rota principal. Recompensas/portal viram tab/aba secundária acessada por link "Sou cliente" no header.

### Etapa 2 — Serviços

- Grid de `ServiceCard` (já existe, lazy load) — imagem, nome, preço, duração, pontos. Sem descrição longa.
- Único CTA "Selecionar". Ao selecionar: card expande mostrando descrição + upsell sugerido inline; demais cards colapsam.
- Categorias viram chips horizontais com scroll-snap (mobile).

### Etapa 3 — Data

- Calendário Shadcn `<Calendar mode="single">` com `disabled` para dias fora de `agenda_config.dias_semana` e dias passados.
- Prefetch dos slots dos próximos 7 dias úteis para troca instantânea (`useQueries`).

### Etapa 4 — Horário (redesign profundo)

- Novo componente `src/components/booking/time-slot-picker.tsx`.
- Esconde indisponíveis (não risca — remove). Esconde passados (compara com `now()` em America/Sao_Paulo).
- Agrupa por período: Manhã (<12h), Tarde (12-18h), Noite (≥18h), com header ícone + label.
- Botões grandes (`min-h-12`), grid 3 col mobile / 4 col desktop.
- Marca "⭐ Recomendado" no próximo horário livre ≥ now()+30min.
- Mostra "1h" embaixo do hora se o serviço tem `tempo_estimado_min`.

### Resumo + Confirmação

- Card sticky (desktop: lateral; mobile: bottom drawer sempre visível após selecionar serviço).
- Mostra serviço, data, hora, duração, valor, pontos.
- Campos cliente (nome + WhatsApp + veículo + obs) numa última etapa "Confirmar".
- CTA único: "Confirmar agendamento".

### Microinterações

- Reusar `list-stagger`, `hover-lift`, `press-scale`, `scale-in` já no `styles.css`.
- Transição entre etapas: fade + slide-x suave.
- Skeleton no time-slot picker enquanto carrega.

---

## Parte C — Correção da sincronização de horários

Auditoria + fix em `getHorariosDisponiveis` e `solicitarAgendamentoPublico`.

### Problemas identificados

1. `getHorariosDisponiveis` não filtra horários passados — exibe slots `08:00` mesmo às 14h.
2. Comparação `new Date(data + "T12:00:00").getDay()` força meio-dia local do server (UTC), o que em datas de DST ou perto da meia-noite pode mudar o dia da semana. O lava-rápido opera em America/Sao_Paulo (sem DST atual, mas a lógica precisa ser explícita).
3. `solicitarAgendamentoPublico` não revalida capacidade no momento do insert (race condition: dois clientes pegam o mesmo slot).
4. Frontend não invalida `["slots"]` após sucesso — slot recém-tomado continua aparecendo para outros.

### Correções backend

- `getHorariosDisponiveis`:
  - Aceitar opcional `tz` (default `America/Sao_Paulo`).
  - Computar `agora` em SP via `Intl.DateTimeFormat("en-CA", { timeZone })`.
  - Se `data === hoje_local`, filtrar `slot.hora <= agora + 15min`.
  - Calcular `dia_da_semana` via componentes (year/month/day) sem `Date` com fuso, evitando off-by-one.
  - Retornar `{ slots, timezone, agora_local }` para debug.
- `solicitarAgendamentoPublico`: dentro da transação, revalidar `get_ocupacao_dia(owner, data)[hora] < capacidade` antes do insert. Se falhar, retornar 409 com mensagem amigável.
- Adicionar `data-funcionario_id` opcional ao trigger de capacidade (já existe; só validar reuso).

### Correções frontend

- `onSuccess` da mutation chama `queryClient.invalidateQueries({ queryKey: ["slots", slug] })`.
- Polling leve (`refetchInterval: 30_000`) na tela de horários apenas quando aba está visível (`refetchIntervalInBackground: false`).
- Realtime opcional v2 — fora deste escopo.

### Sem DST no Brasil hoje

Lógica usa `Intl` (DST-safe) então uma futura volta do horário de verão não quebra.

---

## Arquivos

**Novos**
- `src/components/copilot/contextual-copilot.tsx`
- `src/components/copilot/copilot-fab.tsx`
- `src/lib/copilot/registry.ts`
- `src/lib/copilot/use-copilot-context.ts`
- `src/components/booking/time-slot-picker.tsx`
- `src/components/booking/booking-summary.tsx`
- `src/components/booking/booking-calendar.tsx`
- `src/components/booking/customer-form-step.tsx`

**Editados**
- `src/routes/agendar.$slug.tsx` — reescrita do fluxo (mantém SEO/head, mantém server fns existentes).
- `src/routes/_authenticated/route.tsx` — mount do Copiloto.
- `src/lib/lavaflow.functions.ts` — fix em `getHorariosDisponiveis` + revalidação em `solicitarAgendamentoPublico`.

**Não tocar**
- RLS, migrations, tipos gerados, `client.server.ts`.

---

## Fora de escopo
- Edição da reserva pelo cliente após enviar.
- Notificações push.
- Realtime nos slots (apenas polling).
- Copiloto com IA generativa — v1 é regras determinísticas.

## Riscos
- Race condition em slots: mitigado por revalidação no insert + invalidate no client.
- Layout sticky no mobile pode brigar com teclado virtual — usar `dvh` e testar.
- Quebra de copy/links que páginas externas usam — manter slug e rota intactos.

## Entregáveis finais
- Booking público em 4 etapas, sub-60s, mobile-first.
- Copiloto contextual em 6+ rotas com atalhos reais para reagendar e mudar status.
- Relatório curto no chat listando: bugs de timezone encontrados, correções aplicadas, métricas alvo (taps até confirmar, slots exibidos vs reais).
