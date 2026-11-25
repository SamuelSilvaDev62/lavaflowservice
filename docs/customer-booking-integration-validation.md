# Integração de clientes e agendamentos

## Implementação
- `src/components/customer-registration-form.tsx`: cadastro compartilhado, erros recuperáveis, confirmação para reutilizar duplicidade, cancelamento, Salvar cliente e Salvar e agendar.
- `src/lib/customer-registration.ts`: schema compartilhado, pesquisa de nome/telefone e bloqueio síncrono de envios simultâneos.
- `src/routes/_authenticated/clientes/index.tsx`: cadastro compartilhado e abertura da reserva com o UUID do cliente.
- `src/routes/_authenticated/agendamentos.tsx`: pesquisa, cadastro dentro da reserva, seleção automática e preservação do estado da reserva.
- `src/lib/lavaflow.functions.ts`: cadastro autenticado via RPC e validação dos vínculos da reserva usando o validador existente, preservando capacidade/disponibilidade.
- `drizzle/migrations/0003_safe_customer_registration.sql`: migration aditiva aplicada; função SECURITY INVOKER, permissões operacionais, RLS original e lock transacional por empresa. Sem tabelas novas e sem alteração de clientes existentes.

## Critério de duplicidade
Telefone com formatação e prefixo brasileiro 55 é comparado por dígitos. Sem telefone, nome idêntico (sem diferença de maiúsculas ou espaços nas extremidades) e contato ausente indica possível duplicidade. O proprietário confirma a reutilização pela opção “Usar cliente existente”; nenhuma informação do cadastro existente é sobrescrita. Não se confunde automaticamente pessoas com nomes iguais e telefones diferentes. Essa regra protege o fluxo autenticado compartilhado; não altera o cadastro do agendamento público nem elimina duplicidades históricas.

## Verificação
- Testes unitários de pesquisa, limites de validação e bloqueio de cliques simultâneos.
- PostgreSQL descartável: migration exata aplicada, 24 cadastros concorrentes resultam em um cliente, telefones equivalentes reutilizados, isolamento entre empresas, acesso do atendente, rejeição de anônimo/lavador e validação dos vínculos da reserva.
- Regressões existentes de conversão, capacidade, rollback, RBAC e limites distribuídos.
- Navegador autenticado em 360 × 643 e 1280 × 1800: Salvar e agendar selecionou o cliente; cancelar cadastro rápido preservou data, horário, cliente, observações e Leva e Traz; falha de rede preservou os campos do cadastro; nova tentativa selecionou o novo cliente; pesquisa por telefone e nome; duplicidade com confirmação; reserva salva com os campos preservados; cancelamento do cadastro independente não abriu reserva.
- Foram usados apenas nomes/telefones sintéticos gerados para o teste. Dois clientes e uma reserva sintéticos foram removidos ao final, sem modificar clientes existentes. Sem erros de execução observados.
- Compilação verificada pelo processo automático do projeto; lint dos novos módulos verificado separadamente. Não foi executada publicação.