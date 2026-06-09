# Módulo Simplificado de Colaboradores

## 1. Papéis & autenticação
Migração:
- enum `app_role` (`owner`, `colaborador`)
- tabela `user_roles(user_id, role, unique(user_id, role))` + RLS + GRANTs
- função `public.has_role(_uid, _role)` SECURITY DEFINER
- adicionar `funcionarios.auth_user_id uuid unique null` + `funcionarios.comissao_*` (ver §3)
- novo trigger `tg_bootstrap_new_user` continua criando empresa; também insere role `owner` para o usuário recém-criado
- nova função `vincular_colaborador(email, funcionario_id)`: procura `auth.users` pelo email, marca `funcionarios.auth_user_id` e insere `user_roles(role='colaborador', owner_id=<dono>)`

Como o colaborador "vê" o lava-rápido do dono:
- `user_roles` ganha coluna `owner_id` (FK auth.users) → identifica de qual operação ele faz parte
- nova função `current_owner_id()` SECURITY DEFINER: retorna `auth.uid()` se for owner; caso contrário retorna `owner_id` da linha de role do usuário
- substituir policies `auth.uid() = owner_id` de `ordens_servico`, `funcionarios`, `clientes`, `veiculos`, `servicos` por `current_owner_id() = owner_id` para SELECT/UPDATE — INSERT/DELETE continuam restritas ao owner via `has_role(auth.uid(),'owner')`

UI:
- Tela `/equipe`: campo "email de acesso" no formulário de funcionário → chama `vincular_colaborador`
- AppLayout: ler role do usuário; se `colaborador`, esconder grupos Visão/Crescimento/Gestão e mostrar só "Meu Trabalho" + "Sair"
- `_authenticated/route.tsx`: após autenticar, se role=colaborador e rota não começar com `/meu-trabalho`, redirecionar para `/meu-trabalho`

## 2. Nova rota /meu-trabalho
`src/routes/_authenticated/meu-trabalho.tsx` — mobile-first.

Server fns (em `lavaflow.functions.ts`):
- `getMeuTrabalho`: retorna funcionário vinculado + cards (concluídos hoje, tempo médio, comissão acumulada do mês, lavagens da semana) + lista de OS atribuídas/não atribuídas em status `aguardando|em_lavagem|finalizacao`
- `iniciarOs(osId)`: seta `status='em_lavagem'`, `iniciado_em=now()`, `funcionario_id=<meu>`. Valida via `requireSupabaseAuth`.
- `finalizarOs(osId)`: seta `status='pronto'`, `finalizado_em=now()`. Mantém disparo de WhatsApp (já existente fica no Kanban; aqui só atualiza).

Layout:
- 4 cards no topo (grid 2x2 no mobile)
- lista de cards de OS com botões `[Iniciar]` ou `[Finalizar]` conforme status

## 3. Comissão configurável
Migração:
- `funcionarios.comissao_tipo text default 'fixo' check in ('fixo','percentual')`
- `funcionarios.comissao_valor numeric(10,2) default 0` (R$ se fixo, % se percentual)
- tabela `comissoes(id, owner_id, funcionario_id, ordem_id unique, valor, created_at)` + RLS (`current_owner_id() = owner_id`) + GRANTs
- trigger `tg_os_entregue_comissao`: ao mudar para `entregue` e `funcionario_id` not null, calcular e inserir em `comissoes` (idempotente via unique)

UI:
- Tela `/equipe`: inputs "Tipo (fixo/%)" + "Valor"
- `/meu-trabalho`: card "Comissão acumulada (mês)" lê de `comissoes`
- `/equipe` (dashboard do dono): ranking + receita gerada + comissão paga

## 4. Dashboard da Equipe (dono)
Server fn `getEquipeMetrics`:
- veículos lavados hoje, colaboradores ativos hoje (distintos `funcionario_id`), tempo médio (now()-iniciado_em até finalizado_em), valor gerado pela equipe
- ranking por filtro (hoje/semana/mês): lavagens + receita + comissão por colaborador

Acrescentado no topo de `/equipe`.

## 5. Kanban — melhorias visuais
`src/routes/_authenticated/fila.tsx`:
- 4 cards rápidos no topo (fila / em andamento / prontos / receita em produção)
- cards do Kanban exibem cliente, veículo, serviço, valor, colaborador responsável, tempo na etapa (`formatDistanceToNow` em pt-BR)
- ⚠️ SLA verde/amarelo/vermelho fica fora desta entrega (decisão do usuário)

## Detalhes técnicos
- `os_status` enum já tem `aguardando, em_lavagem, finalizacao, pronto, entregue` — reusar
- `requireSupabaseAuth` injeta `supabase` autenticado; consultas usarão `current_owner_id()` via RLS, sem mudar code-paths existentes
- `attachSupabaseAuth` já registrado em `src/start.ts`
- Re-gerar `routeTree.gen.ts` automaticamente ao salvar `meu-trabalho.tsx`
- Tudo em PT-BR, tokens semânticos do design system, sem cores hardcoded

## Entrega em uma única migração + edits de código
Migração SQL única cobrindo §1 + §3 + recriação das policies dos 5 tables. Depois dos arquivos:
- novo `src/routes/_authenticated/meu-trabalho.tsx`
- editar `src/components/app-layout.tsx` (esconder menus por role)
- editar `src/routes/_authenticated/route.tsx` (redirect colaborador)
- editar `src/routes/_authenticated/equipe.tsx` (campos comissão + email + dashboard equipe)
- editar `src/routes/_authenticated/fila.tsx` (cards topo + tempo na etapa + colaborador)
- editar `src/lib/lavaflow.functions.ts` (server fns novas)

Pontos abertos para confirmar antes de codar:
1. Quero reaproveitar `funcionarios.telefone` ou adicionar `funcionarios.email`? (proponho **adicionar `email`** pois telefone não serve para login)
2. Reescrever as policies dos 5 tables agora é uma mudança sensível — confirma que posso fazer?
