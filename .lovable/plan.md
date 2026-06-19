
# RBAC completo — OWNER, ADMIN, GERENTE, ATENDENTE, LAVADOR

Implementa a Onda 2 do plano de segurança: expande o enum `app_role`, cria helpers de autorização no banco e no front, aplica RLS por papel e adiciona guards de UI em cada tela.

## 1. Banco — enum, helpers e RLS por papel

**Migration única**, em ordem segura (ADD VALUE precisa de commit antes de uso, então a migração é dividida em dois passos: 1) `ALTER TYPE` + 2) bloco com helpers e policies em transação separada — feito num único arquivo SQL com `COMMIT;` entre eles).

### 1.1 Expansão do enum
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lavador';
```
Mantém `owner` e `colaborador` por compatibilidade. `colaborador` legado é tratado como `lavador` pelas helpers.

### 1.2 Helpers SECURITY DEFINER
```sql
-- Qualquer um dos papéis informados
CREATE FUNCTION public.has_any_role(_user uuid, _roles app_role[]) RETURNS boolean ...

-- Papel efetivo do usuário no tenant atual (maior privilégio)
CREATE FUNCTION public.current_user_role() RETURNS app_role ...
-- ordem: owner > admin > gerente > atendente > lavador/colaborador

-- Pertence ao tenant?
CREATE FUNCTION public.in_current_tenant() RETURNS boolean ...
```
EXECUTE só para `authenticated`.

### 1.3 RLS refinada por papel
Matriz aplicada nas policies:

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `empresa`, `agenda_config`, `fidelidade_config`, `planos_assinatura`, `recompensas` | owner+admin+gerente+atendente | owner+admin |
| `servicos`, `comissoes_servico` | todos do tenant | owner+admin |
| `funcionarios`, `user_roles` | owner+admin (read), gerente vê funcionarios | owner+admin |
| `clientes`, `veiculos` | owner+admin+gerente+atendente | owner+admin+gerente+atendente |
| `agendamentos` | mesmos + lavador (só os seus) | owner+admin+gerente+atendente |
| `ordens_servico` | mesmos + lavador (só `funcionario_id = me`) | owner+admin+gerente+atendente; lavador só UPDATE de status nas suas OS |
| `comissoes`, `pagamentos_comissao` | owner+admin; lavador vê só as suas | owner+admin |
| `assinaturas_clientes` | owner+admin+gerente+atendente | owner+admin+gerente |
| `interacoes_clientes`, `avaliacoes`, `pontos_movimentos` | owner+admin+gerente+atendente | owner+admin+gerente+atendente |

Todas as policies viram `TO authenticated` com `USING` e `WITH CHECK` simétricos baseados em `current_owner_id() = owner_id AND has_any_role(...)`.

### 1.4 `vincular_colaborador` aceita papel
```sql
CREATE OR REPLACE FUNCTION public.vincular_colaborador(
  _funcionario_id uuid, _email text, _role app_role DEFAULT 'lavador'
) ...
```
Só `owner` ou `admin` podem chamar. Valida que `_role` ∈ {admin, gerente, atendente, lavador}.

## 2. Server functions — autorização no backend

Cada server fn em `src/lib/lavaflow.functions.ts` recebe um guard explícito antes do query. Padrão:

```ts
async function requireRoles(ctx, roles: AppRole[]) {
  const { data } = await ctx.supabase.rpc('current_user_role')
  if (!roles.includes(data)) throw new Error('Forbidden')
  return data
}
```

Mapeamento por endpoint (todas já têm `requireSupabaseAuth`):
- Dashboard/relatórios financeiros, equipe, comissões, pagamentos, configurações, fidelidade, planos: **owner+admin**
- Equipe (somente leitura), faturamento agregado: **+ gerente**
- Clientes, veículos, agendamentos, OS (CRUD operacional): **owner+admin+gerente+atendente**
- `getMeuTrabalho`, `iniciarOs`, `finalizarOs`: **+ lavador** (já filtra por `funcionario_id`)
- `vincular_colaborador`, `updateFuncionario`, `marcarPagamento`, `comissaoPorServico`: **owner+admin**

RLS continua sendo a barreira real; o guard dá erro amigável em vez de "row violates RLS".

## 3. Front — hook, guard e roteamento por papel

**Novos arquivos:**
- `src/hooks/use-role.ts` — `useRole()` consulta `current_user_role` via server fn `getMeuPapel`, cacheia em React Query (`staleTime: Infinity`, invalida em `SIGNED_IN`).
- `src/components/require-role.tsx` — `<RequireRole roles={[...]}>{children}</RequireRole>`; renderiza fallback "Sem permissão" se não bate.
- `src/lib/rbac.ts` — constantes (`ADMINS`, `OPERACIONAL`, `GESTAO`) e tipo `AppRole`.

**Edições:**
- `src/routes/_authenticated/route.tsx`: após carregar papel, se for `lavador`/`colaborador` e rota atual não for `/meu-trabalho`, redireciona para `/meu-trabalho`. Demais papéis vão para `/dashboard` normalmente.
- `src/components/app-layout.tsx`: filtra itens do menu conforme matriz (lavador só vê "Meu trabalho"; atendente esconde Equipe/Relatórios/Configurações/Fidelidade; gerente vê tudo menos Configurações da empresa).
- Cada rota sensível embrulha o conteúdo em `<RequireRole>`:
  - `/equipe`, `/relatorios`, `/configuracoes`, `/fidelidade`, `/assinaturas` (criar/editar plano) → owner+admin
  - `/dashboard` financeiro → owner+admin+gerente (gerente vê sem botões de exportar/pagamentos)
  - `/clientes`, `/agendamentos`, `/ordens`, `/oportunidades` → owner+admin+gerente+atendente
- `src/routes/_authenticated/equipe.tsx`: ao vincular colaborador, novo `<Select>` de papel (admin/gerente/atendente/lavador) — default `lavador`. Chama `vincular_colaborador` com o papel escolhido.
- `src/routes/_authenticated/configuracoes.tsx`: nova seção "Membros e papéis" listando `user_roles` do tenant, com troca de papel inline (somente owner pode promover/rebaixar admin; admin gerencia gerente/atendente/lavador).

## 4. Testes manuais documentados

Adiciono `.lovable/rbac-tests.md` com 12 cenários:
- Lavador tenta abrir `/equipe` → redirect/sem permissão
- Atendente tenta criar plano de assinatura → bloqueado por RLS e UI
- Gerente vê dashboard mas não vê "Marcar como pago"
- Owner promove um lavador a admin → menu atualiza
- Admin não consegue rebaixar o owner
- Lavador vê apenas suas próprias OS em `/meu-trabalho`
- Lavador tenta `UPDATE` de OS de outro lavador via RPC → RLS bloqueia
- Atendente cria agendamento → OK; tenta alterar `owner_id` → bloqueado
- Owner de tenant A não vê dados do tenant B em nenhuma tela
- `vincular_colaborador` chamado por gerente → erro
- Troca de papel invalida `useRole()` cache
- Logout limpa cache e redireciona

## 5. Entregáveis

- 1 migration SQL
- 3 arquivos novos (`use-role.ts`, `require-role.tsx`, `rbac.ts`)
- ~8 arquivos editados (lavaflow.functions, route guard, app-layout, equipe, configuracoes, dashboard, relatorios, agendamentos)
- 1 doc de testes

Nenhuma quebra de fluxo existente para `owner`. Usuários `colaborador` legados continuam funcionando como `lavador`.

## Score esperado após aplicar
Multi-tenant + RBAC: **8.0 → 9.0/10**. Resta apenas a Onda 3 (audit logs, soft delete, MFA, rate limit) para chegar a 9.5+.

## Pergunta antes de implementar
- **Gerente pode ver faturamento total?** Plano acima diz "sim, mas sem ações de pagamento". Confirma ou prefere esconder valores financeiros do gerente?

Se não responder, sigo com o que está acima.
