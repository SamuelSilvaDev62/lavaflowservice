# Testes manuais — RBAC (Onda 2)

Cenários a validar após aplicar a Onda 2.

## Perfis
- **OWNER** — dono do lava-rápido (criado no signup)
- **ADMIN** — acesso total exceto trocar/remover o owner
- **GERENTE** — opera + vê equipe e relatórios; sem configurações da empresa nem pagamentos
- **ATENDENTE** — opera clientes/agenda/OS/assinaturas; sem equipe, sem relatórios, sem configurações
- **LAVADOR** — só `/meu-trabalho`, vê apenas o que tem `funcionario_id = ele`

## Cenários

1. **Lavador → /equipe**: redirecionado para `/meu-trabalho` pelo guard de rota.
2. **Atendente → /relatorios**: vê "Sem permissão" (RequireRole GESTAO).
3. **Atendente → /configuracoes**: vê "Sem permissão".
4. **Gerente → /dashboard**: acessa normalmente.
5. **Gerente tenta criar plano de assinatura via UI**: botão presente, INSERT em `planos_assinatura` bloqueado por RLS (`ADMINS` apenas).
6. **Owner promove lavador a admin** em /configuracoes → Membros: menu lateral expande no próximo login.
7. **Admin tenta promover outro admin**: dropdown desabilita "Administrador" (`disabled={myRole !== "owner"}`); chamada direta a `set_member_role` é bloqueada pela função.
8. **Lavador chama `getFila` via servidor**: RLS retorna apenas OS com `funcionario_id` igual ao funcionário vinculado.
9. **Lavador tenta UPDATE de OS de outro lavador via Supabase REST**: RLS rejeita.
10. **Atendente cria agendamento** com `owner_id` do próprio tenant: OK; tenta `owner_id` de outro tenant: RLS rejeita (`WITH CHECK`).
11. **Owner do tenant A** consulta `list_tenant_members`: retorna apenas membros do tenant A.
12. **Gerente chama `vincular_colaborador`**: função lança `Apenas owner ou admin podem vincular colaboradores`.
13. **Logout** chama `qc.cancelQueries`/`qc.clear` + `signOut` + redirect `/auth` (sem 401 storm).
14. **Troca de papel** invalida `tenant-members`; `useRole()` re-busca em `SIGNED_IN`/`USER_UPDATED`.

## Comandos rápidos (psql)

```sql
-- ver papéis efetivos
SELECT user_id, role, owner_id FROM user_roles ORDER BY owner_id, role;

-- simular RLS como atendente
SET request.jwt.claim.sub = '<uuid-atendente>';
SELECT * FROM planos_assinatura;  -- esperado: vazio (SELECT permitido só GESTAO + ATENDENTE)
INSERT INTO planos_assinatura(...);  -- esperado: erro RLS
```
