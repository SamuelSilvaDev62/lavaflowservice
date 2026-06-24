# Plano: Hardening de Segurança + Auditoria + Oportunidades

## Parte 1 — Correções de Segurança (migration única)

### 1.1 `notificacoes` – restringir SELECT por papel (ERROR)
Hoje qualquer membro do tenant (incluindo `lavador`/`colaborador`) lê notificações operacionais/financeiras.
```sql
DROP POLICY "notificacoes tenant select" ON public.notificacoes;
CREATE POLICY "notificacoes tenant select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    current_owner_id() = owner_id
    AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[])
  );
```

### 1.2 `funcionarios` – ocultar `pin_hash` e comissão do próprio lavador (ERROR)
Hoje o lavador lê o próprio registro com `pin_hash`, `comissao_*`, `pin_failed_attempts`, `pin_locked_until`.
- Criar view `public.funcionarios_self` (security_invoker) expondo só colunas seguras (id, nome, email, foto_url, ativo, telefone, created_at).
- Reescrever política SELECT de `funcionarios` para permitir `auth_user_id = auth.uid()` **apenas via** consulta administrativa: trocar a branch self por bloqueio direto e direcionar UI do lavador para a view.
```sql
DROP POLICY "funcionarios select" ON public.funcionarios;
CREATE POLICY "funcionarios admin select" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (
    current_owner_id() = owner_id
    AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
  );

CREATE OR REPLACE VIEW public.funcionarios_self
WITH (security_invoker=on) AS
  SELECT id, owner_id, nome, email, foto_url, telefone, ativo, created_at
  FROM public.funcionarios
  WHERE auth_user_id = auth.uid();
GRANT SELECT ON public.funcionarios_self TO authenticated;
```
Atualizar `meu-trabalho.tsx` e qualquer leitura de `funcionarios` por lavador para usar `funcionarios_self`.

### 1.3 `upsertFuncionarioFull` – guard de papel no servidor (WARN)
Em `src/lib/lavaflow.functions.ts`, adicionar no início do handler:
```ts
const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
assertTenantRole(role, ADMIN_ROLES, 'Apenas owner ou admin podem gerenciar funcionários');
```
Evita scrypt/PIN hashing para chamadas não autorizadas.

### 1.4 `public_page_events` – documentar/fechar escrita (WARN)
Adicionar política INSERT explícita apenas via service_role (ou anon com checagem se decidirmos manter tracking público — confirmar). Default: bloquear escrita direta de autenticados:
```sql
REVOKE INSERT, UPDATE, DELETE ON public.public_page_events FROM authenticated, anon;
GRANT INSERT ON public.public_page_events TO service_role;
```

### 1.5 Bucket `employee-photos` – tornar privado (WARN)
Risco: fotos de funcionários de qualquer tenant publicamente legíveis. Mudar bucket para `public=false`, e gerar URLs assinadas no client (`createSignedUrl`) onde for renderizada foto. Ajustar `image-upload-field.tsx` para suportar bucket privado quando aplicável.

### 1.6 Política storage `lavaflow_tenant_update_public` – simetria USING/WITH CHECK (WARN)
Adicionar `has_any_role(...)` também no `WITH CHECK`.

### 1.7 `search_path` mutável em função (WARN linter)
Localizar a função sem `SET search_path = public` e adicionar. (provável `tg_*` antigo)

### 1.8 SECURITY DEFINER expostos ao público/auth (16 WARNs linter)
- Manter `SECURITY DEFINER` apenas onde estritamente necessário (as RPCs públicas: `get_empresa_by_slug`, `get_servicos_publicos`, `get_agenda_config_publica`, `get_ocupacao_dia`, `has_role`, `has_any_role`, `current_owner_id`, `current_user_role`, `list_tenant_members`, `set_member_role`, `vincular_colaborador`, triggers).
- Revogar EXECUTE de `public`/`anon` em RPCs que **não** são públicas (ex.: `set_member_role`, `vincular_colaborador`, `list_tenant_members`, `tg_*`):
```sql
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_tenant_members() FROM anon, public;
-- manter GRANT EXECUTE TO authenticated
```
- Para as 4 RPCs realmente públicas (`get_empresa_by_slug`, `get_servicos_publicos`, `get_agenda_config_publica`, `get_ocupacao_dia`) manter `EXECUTE TO anon` — documentar como aceito em `security memory`.

---

## Parte 2 — Relatório de Achados (resumo gerado na resposta após implementar)

Estrutura entregue:
- **Críticos (ERROR)**: 2 → 1.1, 1.2
- **Altos (WARN agente)**: 3 → 1.3, 1.4, 1.5
- **Médios (WARN linter)**: 12 → 1.6, 1.7, 1.8
- Para cada item: causa, impacto, correção aplicada, verificação.

---

## Parte 3 — Auditoria de Rotas e Conexão com o Banco

Verificar e reportar status de:
- `/midia` — `listTenantMedia`/`deleteTenantMedia` server fns + 6 buckets.
- `/configuracoes` — `ImageUploadField` em serviços salva `foto_url` em `servicos`.
- `/agendar/$slug` — usa `get_empresa_by_slug` + `get_servicos_publicos` (campos novos `descricao`, `tempo_estimado_min`, `categoria`, `foto_url`).
- `/equipe`, `/clientes`, `/ordens`, `/fila`, `/fidelidade`, `/dashboard` — queries existentes intactas.
- Confirmar `routeTree.gen.ts` inclui `/midia`.
- Conferir `useOwnerId` resolvendo via `user_roles`.
- Rodar `tsgo` mentalmente nos arquivos tocados.

Saída: tabela rota → server fn/tabela → status (OK / pendente).

---

## Parte 4 — 3 Oportunidades de Melhoria

1. **Observabilidade & alertas operacionais**
   Adicionar `error-boundary` global enviando para `lovable-error-reporting` + dashboard interno em `/relatorios` com taxa de erros, latência média das server fns e uso de IA (`ai_usage_logs`). Hoje há logging mas sem agregação visível.

2. **Sistema de notificações em tempo real (Realtime)**
   Trocar polling de notificações por canal `supabase.channel` com `postgres_changes` em `notificacoes` filtrado por `owner_id`. Reduz carga e dá feedback instantâneo de OS entregue, comissão paga, agendamento novo.

3. **Auditoria & versionamento de dados sensíveis**
   Tabela `audit_log` (owner_id, actor_user_id, table, row_id, action, diff jsonb) populada por triggers em `funcionarios`, `comissoes`, `pagamentos_comissao`, `ordens_servico`. Necessária para suporte a disputas e LGPD; hoje só existe `equipe_auditoria` para sessões PIN.

(Bônus se houver tempo: Storage CDN cache headers + responsive `srcset` no `ImageUploadField`; lazy-load por rota com `defer` no TanStack Router; testes E2E Playwright para fluxos críticos.)

---

## Escopo & Não-escopo

**Inclui:** 1 migration consolidada + ajustes em `lavaflow.functions.ts`, `image-upload-field.tsx`, `meu-trabalho.tsx` (e onde mais usar `funcionarios` self-read), atualização de `security-memory`.

**Não inclui nesta rodada:** implementar Realtime, audit log, dashboard de observabilidade (são as 3 oportunidades, propostas como próximas sprints).
