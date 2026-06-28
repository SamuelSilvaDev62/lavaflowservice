# Página de Auditoria — Eventos de Segurança & Uso de IA

Nova tela `/auditoria` (acesso restrito a **owner** e **admin**) que unifica em um único timeline os registros já gravados em `equipe_auditoria` (ações de equipe / segurança) e `ai_usage_logs` (uso do Consultor IA), com filtros por usuário, período e tipo.

O tenant (owner_id) já é resolvido automaticamente via RLS + `current_owner_id()`, então o filtro "por tenant" se traduz em "dados do meu tenant" — não exponho seletor de tenant cruzado (seria furo multi-tenant).

## Escopo

### Backend (server functions em `src/lib/auditoria.functions.ts`)
- `getAuditEvents({ from, to, userId?, source?: 'equipe'|'ai'|'all', limit, offset })`
  - Usa `requireSupabaseAuth`, valida role owner/admin via `has_any_role`.
  - Lê `equipe_auditoria` (join opcional com `funcionarios` p/ nome) e `ai_usage_logs` (join com `auth.users` via admin client para email) — normaliza em um shape comum: `{ id, timestamp, source, actor: {id,label}, action, metadata }`.
  - Faz merge por timestamp desc, aplica paginação após o merge.
- `getAuditActors()` — lista usuários do tenant (reaproveita `list_tenant_members` RPC) para popular o select do filtro.
- `getAuditSummary({ from, to })` — totais por origem (KPIs do topo).

### Frontend
- `src/routes/_authenticated/auditoria.tsx`
  - Protegido com `<RequireRole roles={['owner','admin']}>`.
  - Topo: 3 KPIs (Eventos de Equipe, Chamadas IA, Custo IA estimado no período).
  - Barra de filtros sticky: DateRangePicker (default últimos 7 dias), Select de usuário, Select de origem (Todos / Equipe / IA), botão "Limpar".
  - Estado de filtros via `validateSearch` (zod) → compartilhável por URL.
  - Tabela responsiva (cards no mobile) com colunas: Quando, Origem (badge), Ator, Ação, Detalhes (popover com `metadata` em JSON formatado).
  - Paginação "Carregar mais" (offset incremental).
- Item de navegação "Auditoria" no `app-layout.tsx` dentro do grupo Administração, filtrado pelo role.

### Sem mudanças de schema
Tudo o que precisamos já existe nas duas tabelas. Não há nova migration — apenas leitura.

## Fora de escopo
- Exportação CSV (posso adicionar depois se quiser).
- Novos pontos de instrumentação (por enquanto, exibimos o que já é registrado pelos triggers/rotas existentes).
- Retenção / arquivamento (mantém comportamento atual).

## Detalhes técnicos
- Merge no servidor: cada origem com `limit + offset` próprios é caro p/ paginação combinada; vou usar abordagem simples — buscar até `limit*2+offset` de cada lado, fundir, ordenar, fatiar. Aceitável para o volume atual; documentado para evolução futura via view SQL.
- `ai_usage_logs.user_id` → email: resolvido com `supabaseAdmin.auth.admin.getUserById` em lote (cache por request); load dentro do handler conforme regra de `*.functions.ts`.
- Datas em `America/Sao_Paulo` no display; filtros enviados como ISO UTC.
