# Piloto Founders — retomada de segurança

## Concluído

- Corrigidas relações ambíguas de funcionários na consulta de ordens (`funcionarios!<foreign-key>`), sem alterar o contrato de `listOrdens`.
- `iniciarAtendimento` usa somente a RPC autenticada `iniciar_atendimento_atomico` para converter agendamento em OS. Não há fallback para duas escritas independentes.
- A RPC usa bloqueio da linha do agendamento, preserva RLS, aceita owner/admin/gerente/atendente e valida cliente, veículo, serviço e funcionário no mesmo tenant. Veículo também precisa pertencer ao cliente.
- O funcionário do agendamento tem prioridade sobre o funcionário vinculado ao usuário. Preço, taxa de Leva e Traz, observações e campos opcionais permanecem preservados.
- Repetição retorna a mesma OS validada; falha no UPDATE desfaz o INSERT.
- Contadores de abuso em PostgreSQL substituem o limite em memória do assistente. A RPC de consumo é exclusiva de `service_role`; anon/authenticated não leem nem alteram os contadores. Chaves armazenadas são hashes, nunca telefone/e-mail/IP em texto.
- PIN e agendamento público recebem limite global antes de resolver o slug e limite por tenant/identidade antes de consultar clientes/colaboradores. IA recebe limite por tenant/usuário após autenticação, RBAC, entitlement e opt-in existentes.
- Bloqueio retorna HTTP 429 com `Retry-After`. Indisponibilidade da proteção impede processamento e retorna 503.

## Políticas iniciais

| Ação | Janela | Identidade | Tenant | Global | IP, quando validado |
|---|---:|---:|---:|---:|---:|
| OTP, preparado mas não conectado | 5 min | 5 | 60 | 1.000 | 20 |
| Agendamento público | 10 min | 5 | 60 | 1.000 | 20 |
| PIN | 5 min | 5 | 100 | 2.000 | 30 |
| Assistente IA | 1 h | 30 | 30 | 3.000 | 60 |

Contam-se solicitações, inclusive falhas, não apenas sucessos. Os limites são fixados no servidor, nunca recebidos do navegador. A limpeza de contadores expirados é oportunista e limitada a 100 linhas por consumo, sem cron.

## Migrações aplicadas

- `drizzle/migrations/0000_atomic_booking_to_work_order.sql`: conteúdo idêntico à migration pendente `supabase/migrations/20261121180700_atomic_booking_to_work_order.sql`.
- `drizzle/migrations/0001_atomic_booking_reference_validation.sql`: hardening incremental para atendentes e referências de tenant/cliente.
- `drizzle/migrations/0002_distributed_access_limits.sql`: tabela privada, grants, RLS, índice e RPC de contadores.

Nenhuma migration de capacidade foi reaplicada. O trigger de capacidade existente foi confirmado ativo. Nenhuma migration altera registros existentes de clientes, agendamentos ou ordens.

## Verificações

- 20 testes PostgreSQL reais em cluster descartável via `python3 tests/atomic-booking-postgres.test.py`: 14 de conversão e 6 de limites, incluindo 24 chamadas concorrentes, cinco admissões exatas, isolamento, expiração, privilégios, entradas inválidas e locks sobrepostos em ordens inversas.
- 15 testes via `bun test tests/access-limit.test.mjs tests/ordens-model.test.mjs tests/os-transitions.test.mjs`.
- Prévia autenticada como proprietário: `/ordens` carrega dados reais; formulário de criação abre e exige cliente; filtro de período funciona; 390px sem overflow horizontal; sem erros JavaScript observados.
- PIN: UUID aleatório sem colaborador real, cinco respostas de colaborador inativo e sexta resposta HTTP 429. Apenas contadores de segurança foram gravados; nenhum PIN real foi tentado nem sessão de equipe criada.
- Repetição autenticada de agendamento já vinculado: duas chamadas retornaram a OS original, encontrada em `/ordens`. Essa ramificação não executa INSERT/UPDATE de agendamento/OS.
- Harness de typecheck/build da prévia: última entrada consultada `build OK`.
- Lint dos módulos novos passou. Lint da rota IA passou desabilitando apenas `no-explicit-any`, já existente nessa rota; não se afirma lint integral do projeto.

## Bloqueios e limitações

1. **Portal OTP não concluído:** não existe domínio remetente configurado. O proprietário confirmou reutilizar o cadastro de cliente, sem perfil adicional. Não foi criada autenticação fictícia nem reativada consulta por telefone. OTP de seis dígitos, expiração, verificação, sessão e histórico isolado ainda precisam ser implementados após configurar envio. A política `otp` sozinha não equivale ao fluxo OTP.
2. **Limite por IP não ativo:** não foi encontrada garantia de que o proxy de hospedagem sobrescreve `cf-connecting-ip`. Por segurança, `X-Forwarded-For`, `Forwarded` e IPs de payload não são usados. `VERIFIED_EDGE_IP_HEADER=cf-connecting-ip` só deve ser configurado após verificar essa garantia; enquanto isso, limites globais, por tenant e identidade protegem os fluxos. Isso não deve ser anunciado como cobertura completa por IP.
3. **Agendamento público e IA:** as políticas e integrações foram testadas em fonte/banco isolado; não se enviaram reservas reais nem perguntas pagas à IA para esgotar quotas. A prova real de HTTP 429 foi feita no PIN.
4. **Conversão nova:** criação, concorrência e rollback foram verificados no banco descartável; no backend real verificou-se apenas a ramificação de repetição sem escrita, para preservar dados operacionais.
5. Os contadores são controle de abuso por janela fixa, não proteção geral contra DDoS. Sem IP confiável, abuso distribuído pode consumir o limite global e afetar outros estabelecimentos; a cobertura IP permanece bloqueada.
6. Nenhuma publicação foi realizada. Alterações de schema são compartilhadas com o backend conectado; o código publicado não foi atualizado neste trabalho.

## Arquivos principais

`src/lib/lavaflow.functions.ts`, `src/lib/access-limit.ts`, `src/lib/access-limit.server.ts`, `src/lib/assistente.server.ts`, `src/routes/api/assistente-chat.ts`, `tests/access-limit.test.mjs`, `tests/atomic-booking-postgres.test.py`, migrações acima, `AGENTS.md` e `roadmap.md`.