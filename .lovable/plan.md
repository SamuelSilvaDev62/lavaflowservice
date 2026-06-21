# Plano: ajustes mobile Dashboard + Nova Reserva

A maioria dos pontos pedidos já estão implementados no código atual (acentos nos labels, placeholders de Leva e Traz, rótulo de disponibilidade do colaborador no formato "Nome - X vagas disponíveis / Lotado / Indisponível", botão Cancelar/Salvar reserva, sticky footer no form). Foco desta rodada: corrigir os pontos de fato pendentes, sem refatorar telas inteiras.

## Mudanças

### 1. `src/routes/_authenticated/agendamentos.tsx`
- **Reordenar campos do `NovoAgendamentoForm`** conforme pedido (Cliente → Serviço → Data → Horário → Colaborador → Observações → Checkbox Leva e Traz → Campos Leva e Traz). Hoje os campos usam classes `order-*` desencontradas; vou remover os `order-*` e deixar a ordem natural no JSX seguir o fluxo correto. O bloco Data/Horário fica antes do Colaborador, garantindo que `servico_id` + data/hora já estejam definidos quando a query de disponíveis roda (a query já depende de `f.servico_id` e `f.hora_agendada`).
- **Drawer mobile**: ajustar `DrawerContent` para `max-h-[92vh] flex flex-col` para que o form com `flex-1 overflow-y-auto` role suave e o footer sticky fique sempre visível. Adicionar leve `gap` e `pt-2` ao container do form.
- **Dialog desktop**: trocar `overflow-hidden` por `flex flex-col` no `DialogContent` para o scroll interno funcionar nos breakpoints médios.
- **Bug visual `DistribuicaoEquipe`** (linha 557): o badge mostra literal `?? {nome}` — remover os dois `?` perdidos.

### 2. `src/routes/_authenticated/dashboard.tsx` (card "Agenda de hoje")
- Header do card: trocar `flex items-center justify-between` por layout que não comprime o botão. Usar `grid grid-cols-[minmax(0,1fr)_auto]` com `gap-2`, título com `truncate`, e botão "Ver tudo" com `shrink-0`. Isso garante o botão inteiro no mobile a 360px.
- Cada item do agendamento no mobile passa a ser **vertical** (já está em grid). Ajustar:
  - Header da linha: horário grande à esquerda, status badge à direita (já existe), garantir `flex-wrap` para o badge "Leva e Traz" aparecer abaixo do status quando faltar espaço.
  - Container do badge mobile: hoje fica em `flex flex-wrap items-center gap-1 sm:flex-col` — no mobile mover para baixo do bloco de infos numa linha própria com `flex flex-wrap gap-1.5` em vez de ficar lateral, evitando empurrar layout.
  - Adicionar `overflow-hidden` no card e `min-w-0` nos textos para evitar overflow horizontal.

### 3. Revisão de acentos
- Buscar no projeto strings sem acento (Operacao, Servicos, Previsao, Devolucao, Endereco). Confirmado por grep: as ocorrências visíveis ao usuário já estão acentuadas. Não há correção pendente — vou apenas re-verificar e ajustar caso encontre nova string.

## Fora de escopo (já OK no código atual)
- Acentos nos labels principais do Dashboard e form de Nova Reserva
- Placeholders dos campos de Leva e Traz
- Rótulo de disponibilidade do colaborador ("1 vaga disponível", "Lotado", "Indisponível")
- Colaborador lotado já vem como `disabled` no `SelectItem`
- Mensagem "Nenhum colaborador disponível…" já presente
- Persistência dos campos Leva e Traz no Supabase já implementada via `createAgendamento`
- Grid 2x2 dos KPIs já está consistente (`min-h-[104px]`, `break-words`)

## Validação
- `bunx tsc --noEmit` deve continuar limpo
- Conferir preview mobile (360px) em `/dashboard` e modal Nova Reserva
- Nenhuma migration nesta rodada
