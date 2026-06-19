# Plano de Segurança do LavaFlow

Auditoria já executada. Abaixo o relatório resumido e o plano de correção dividido em **3 ondas** para você aprovar incrementalmente. Implementar tudo de uma vez seria arriscado (RBAC novo, mudanças em RLS e grants podem quebrar fluxos). Sugiro aprovarmos **onda por onda**.

---

## Relatório de Auditoria

| # | Achado | Severidade | Impacto |
|---|--------|------------|---------|
| 1 | **Tabelas públicas sem GRANT explícito** (todas as 19) — hoje funcionam por defaults herdados, mas a Data API pode passar a recusar a qualquer momento e remixes quebram | ALTO | App pode parar de ler/escrever sem aviso |
| 2 | **8 policies usam role `{public}`** (assinaturas, avaliacoes, empresa, fidelidade_config, interacoes_clientes, planos_assinatura, pontos_movimentos, recompensas) — inclui `anon`. Hoje o filtro `auth.uid()=owner_id` protege, mas é prática perigosa | ALTO | Se alguém remover o filtro por engano, expõe tudo |
| 3 | **INSERT em `agendamentos` e `ordens_servico` sem WITH CHECK** — qualquer usuário autenticado pode inserir linha com `owner_id` arbitrário | **CRÍTICO** | Cross-tenant write (gravar OS no lava-rápido de outro dono) |
| 4 | **Funções SECURITY DEFINER com EXECUTE público** (`has_role`, `current_owner_id`, `vincular_colaborador`, triggers) — linter reportou 10 warnings | MÉDIO | `vincular_colaborador` é a mais sensível: já valida o caller, mas EXECUTE deve ser restrito |
| 5 | **RBAC só tem `owner` e `colaborador`** — não atende OWNER/ADMIN/GERENTE/ATENDENTE/LAVADOR pedidos | ALTO | Sem separação de perfis operacionais |
| 6 | **Sem `audit_logs`** | MÉDIO | Não há rastro de quem alterou comissão, cliente, assinatura |
| 7 | **Sem soft-delete** — exclusões são definitivas | MÉDIO | Risco de perda acidental |
| 8 | **Sem rate limiting** no `/api/assistente-chat` e em `/auth` | MÉDIO | Brute force / abuso de IA. *Nota: backend não tem primitivo padrão de rate-limit; implementação seria ad-hoc por owner_id em tabela* |
| 9 | **Sem tela "dispositivos conectados"** / revogação de sessão | BAIXO | Supabase Auth gerencia tokens; UI para listar/encerrar exige `supabaseAdmin` |
| 10 | **Sem 2FA / MFA, sem leaked password (HIBP)** | MÉDIO | Configurável via `configure_auth` |
| 11 | Rotas públicas `/agendar/:slug` e `/plano/:slug` → usam `SECURITY DEFINER` funcs com projeção segura ✅ OK | — | Sem exposição |
| 12 | Variáveis sensíveis no frontend: apenas chaves publishable ✅ OK | — | — |
| 13 | `assistente-chat`: valida bearer e usa client com RLS ✅ OK | — | — |

**Nota geral atual: 5.5/10** (multi-tenant funcional, mas com brechas de write cross-tenant e governança fraca).

---

## Onda 1 — CRÍTICO + ALTO (recomendado começar aqui)

Foco em **isolamento total de tenants** e **prevenção de gravação cruzada**. Uma migration SQL única e ajustes mínimos no código.

### 1.1 Fechar INSERT cross-tenant (achado #3)
```sql
DROP POLICY "ordens owner write" ON ordens_servico;
DROP POLICY "agendamentos owner write" ON agendamentos;

CREATE POLICY "ordens insert" ON ordens_servico FOR INSERT TO authenticated
  WITH CHECK (current_owner_id() = owner_id);
CREATE POLICY "agendamentos insert" ON agendamentos FOR INSERT TO authenticated
  WITH CHECK (current_owner_id() = owner_id);
```
+ revisar todas as policies `FOR ALL` que esquecem `WITH CHECK` separado.

### 1.2 Trocar role `{public}` → `{authenticated}` em 8 tabelas (achado #2)
Recria as 8 policies com role `authenticated` e adiciona `WITH CHECK` simétrico.

### 1.3 GRANTs explícitos em todas as 19 tabelas (achado #1)
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;
GRANT ALL ON public.<tabela> TO service_role;
```
Nenhum GRANT para `anon` — todas as tabelas são auth-only. Dados públicos (slug do lava-rápido, serviços, ocupação) já saem por funções SECURITY DEFINER.

### 1.4 Hardening de funções SECURITY DEFINER (achado #4)
```sql
REVOKE EXECUTE ON FUNCTION has_role, current_owner_id, vincular_colaborador,
  tg_bootstrap_new_user, tg_os_entregue_credita_pontos, tg_os_entregue_comissao
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_role(uuid, app_role), current_owner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION vincular_colaborador(uuid, text) TO authenticated;
-- get_empresa_by_slug, get_servicos_publicos, get_ocupacao_dia, get_agenda_config_publica
-- continuam acessíveis a anon (são a API pública de booking).
```

### 1.5 Teste de invasão automatizado
Adicionar `src/lib/__security_tests__.md` documentando os 6 cenários testados manualmente: troca de `owner_id` em insert/update/delete em cada tabela, leitura cruzada, chamada direta de RPC.

**Entregáveis da Onda 1:** 1 migration SQL + arquivo de testes. **Zero mudança em UI**, zero quebra esperada.

---

## Onda 2 — RBAC completo (achado #5)

### 2.1 Expandir enum `app_role`
```sql
ALTER TYPE app_role ADD VALUE 'admin';
ALTER TYPE app_role ADD VALUE 'gerente';
ALTER TYPE app_role ADD VALUE 'atendente';
ALTER TYPE app_role ADD VALUE 'lavador';
-- mantém 'owner' e 'colaborador' (legado → migrar para 'lavador')
```

### 2.2 Matriz de permissões (em código + RLS)
| Tela / Ação | OWNER | ADMIN | GERENTE | ATENDENTE | LAVADOR |
|---|---|---|---|---|---|
| Dashboard / Relatórios financeiros | ✅ | ✅ | ❌ | ❌ | ❌ |
| Equipe / Comissões / Pagamentos | ✅ | ✅ | 👁️ | ❌ | ❌ |
| Configurações / Empresa / Fidelidade | ✅ | ✅ | ❌ | ❌ | ❌ |
| Clientes (criar/editar) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Agendamentos | ✅ | ✅ | ✅ | ✅ | 👁️ próprios |
| OS (criar/avançar) | ✅ | ✅ | ✅ | ✅ | 👁️ atribuídas |
| Assinaturas | ✅ | ✅ | ✅ | ✅ | ❌ |

### 2.3 Implementação
- Helper `public.has_any_role(_user uuid, _roles app_role[])` (SECURITY DEFINER).
- RLS adicional em `ordens_servico` / `pagamentos_comissao` / `comissoes` filtrando por papel.
- Hook React `useRole()` + componente `<RequireRole roles={[...]}>` para guards de UI.
- `_authenticated/route.tsx` redireciona LAVADOR direto para `/meu-trabalho` (já existe a lógica, ampliar).
- Tela `/configuracoes/equipe` ganha seletor de papel ao vincular colaborador.

**Entregáveis Onda 2:** 1 migration + ~6 arquivos novos/editados. Mudanças visíveis na UI.

---

## Onda 3 — Governança + Hardening (achados #6 a #10)

### 3.1 Auditoria (`audit_logs`)
Tabela `audit_logs(id, owner_id, actor_id, action, entity, entity_id, before jsonb, after jsonb, ip, user_agent, created_at)` + triggers em: `clientes`, `funcionarios`, `comissoes_servico`, `pagamentos_comissao`, `assinaturas_clientes`, `user_roles`. Tela `/configuracoes/auditoria` (somente OWNER/ADMIN).

### 3.2 Soft delete
Coluna `arquivado_em timestamptz` em `clientes`, `funcionarios`, `servicos`, `planos_assinatura`. Queries filtram `IS NULL` por padrão. Tela "Arquivados" com restore.

### 3.3 Hardening de auth (via `configure_auth`)
- Ativar `password_hibp_enabled`
- Ativar MFA (TOTP)
- Reduzir OTP expiry para 600s

### 3.4 Sessões e rate limit
- Tela "Dispositivos conectados" usando `supabaseAdmin.auth.admin.listUserSessions` + botão "Encerrar outras sessões".
- Rate limit ad-hoc no `/api/assistente-chat`: tabela `rate_limits(owner_id, bucket, count, window_start)` — 30 req/min por owner. ⚠️ **Backend não tem primitivo padrão; é implementação custom — confirma se quer?**

### 3.5 Score final
Documento `.lovable/security-report.md` com checklist final, achados resolvidos, restantes e nota atualizada (alvo: 9/10).

---

## Detalhes técnicos

- Todas as migrations seguem ordem: `ALTER/CREATE` → `GRANT` → `ENABLE RLS` → `POLICY`.
- Nenhuma mudança remove colunas ou tabelas (compatibilidade total).
- Backup: o Supabase já faz PITR diário (gerenciado pela Cloud), não precisa de migration.
- Storage: projeto não usa buckets ainda (auditado: 0 buckets) — sem ação necessária.

---

## Perguntas para você

1. **Aprova começar pela Onda 1 (críticos)?** Posso executar já — é a mais urgente e não muda UI.
2. **RBAC (Onda 2):** a matriz acima faz sentido para o seu negócio? Quer ajustar algum perfil?
3. **Rate limit custom (3.4):** vale o esforço agora ou deixamos para depois?

Se aprovar a Onda 1 sem comentar 2 e 3, eu sigo só a Onda 1 e te apresento as outras depois.
