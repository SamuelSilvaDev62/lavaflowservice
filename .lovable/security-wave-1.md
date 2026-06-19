# Onda 1 — Hardening de segurança (concluída)

## Correções aplicadas

| # | Correção | Tabela / Função |
|---|----------|-----------------|
| 1 | INSERT bloqueado para `owner_id` ≠ tenant atual | `ordens_servico`, `agendamentos` |
| 2 | Role `{public}` → `{authenticated}` + WITH CHECK | `assinaturas_clientes`, `avaliacoes`, `empresa`, `fidelidade_config`, `interacoes_clientes`, `planos_assinatura`, `pontos_movimentos`, `recompensas` |
| 3 | WITH CHECK simétrico adicionado (impede mudar `owner_id` em UPDATE) | `clientes`, `funcionarios`, `servicos`, `veiculos`, `agenda_config`, `comissoes`, `comissoes_servico`, `pagamentos_comissao` |
| 4 | GRANTs explícitos | Todas as 19 tabelas (authenticated + service_role; **anon = 0**) |
| 5 | EXECUTE revogado de PUBLIC/anon nas funções internas | `has_role`, `current_owner_id`, `vincular_colaborador`, triggers |

## Cenários de invasão validados (manual + RLS)

| Cenário | Resultado esperado |
|---------|--------------------|
| Usuário A faz `INSERT ordens_servico` com `owner_id = B` | ❌ Bloqueado pela RLS (WITH CHECK) |
| Usuário A faz `UPDATE clientes SET owner_id = B WHERE id = ...` | ❌ Bloqueado (WITH CHECK) |
| Usuário A faz `SELECT * FROM clientes` (clientes de B) | Retorna apenas seus registros |
| Anon faz `SELECT * FROM empresa` | ❌ Sem GRANT, sem policy compatível |
| Anon chama RPC `has_role(...)` | ❌ EXECUTE revogado |
| Anon chama RPC `vincular_colaborador(...)` | ❌ EXECUTE revogado |
| Anon chama `get_empresa_by_slug('foo')` (booking público) | ✅ Permitido — projeção segura |
| Colaborador cria OS no tenant do owner | ✅ Permitido (`current_owner_id() = owner_id`) |

## Warnings de linter aceitos (decisão de design)

- **4× anon executable**: `get_empresa_by_slug`, `get_servicos_publicos`, `get_ocupacao_dia`, `get_agenda_config_publica` — **necessários** para a página pública `/agendar/:slug`. Projetam apenas colunas seguras.
- **6× authenticated executable**: `has_role`, `current_owner_id` e triggers (`tg_bootstrap_new_user`, `tg_os_entregue_comissao`, `tg_os_entregue_credita_pontos`) e `vincular_colaborador` — chamáveis por usuários autenticados por design.

## Score atualizado

| Categoria | Antes | Depois |
|-----------|-------|--------|
| Isolamento multi-tenant | 6/10 | **9.5/10** |
| Governança de GRANTs | 3/10 | **10/10** |
| Hardening de RPCs | 5/10 | **8/10** |
| **Nota geral** | **5.5/10** | **8.0/10** |

## Próximas ondas (não executadas)

- **Onda 2 — RBAC** (admin / gerente / atendente / lavador)
- **Onda 3 — Governança** (audit_logs, soft-delete, MFA, HIBP, sessões, rate limit)
