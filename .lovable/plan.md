# Correção: Painel sem agendamentos + textos quebrados na tela de OS

Duas correções pontuais, sem novas funcionalidades.

## Problema 1 — Painel mostra "0 agendamentos" mesmo com 1 na Agenda

Causa confirmada no código do painel (`getDashboardOperacional`):

- A lista devolvida ao Painel (`agendaHoje`) é filtrada por "somente horários futuros" (`>= agora`). Um agendamento de hoje cujo horário já passou desaparece do Painel, mesmo aparecendo na tela Agenda.
- O contador do cabeçalho ("0 agendamentos") usa o tamanho dessa lista filtrada, e não o total do dia.
- O cálculo do "hoje" e do "agora" usa o fuso do servidor (UTC), não `America/Sao_Paulo`. À noite isso muda a data e pode esconder/exibir o dia errado.

Correções:

1. `agendaHoje` passa a devolver todos os agendamentos ativos do dia (ordenados por hora), com uma marcação de atrasado/próximo/concluído — o Painel continua exibindo no máximo 5, com "Ver agenda completa".
2. O subtítulo do Painel passa a usar o total do dia (`cards.agendamentosHoje`), então nunca mais mostra 0 havendo agendamento.
3. Data/hora de referência do painel calculadas no fuso de São Paulo, igual à tela de Agenda.

## Problema 2 — Textos quebrados em coluna na tela de OS

Causa: cada linha de OS usa uma única faixa horizontal (`flex`) em que o bloco da direita (valor + seletor de status) tem largura fixa. Em telas de ~360px sobra pouquíssimo espaço para o texto, que quebra palavra por palavra. Os blocos internos (badges de origem e cartões de oportunidade) também não têm limite de largura.

Correções (apenas layout/apresentação):

1. A linha de OS passa a ser empilhada no mobile (informações em cima, valor e status embaixo, ocupando a largura) e volta ao formato lado a lado em telas médias/grandes.
2. Adicionar `min-w-0` nos contêineres de texto e limitar quebras: nome/serviço com truncamento, descrições com quebra normal.
3. Bloco "Oportunidades identificadas pelo checklist": título e textos em largura total, badge de status alinhado abaixo no mobile, botões de ação em grade que cabe na tela.
4. Seletor de status e valor com largura mínima adequada, sem esmagar o texto.
5. Corrigir o caractere corrompido `Â·` no badge de "Origem da venda" (deve ser apenas `·`).

## Detalhes técnicos

- `src/lib/lavaflow.functions.ts` → `getDashboardOperacional`: remover o filtro `>= now` de `agendaHoje`, manter ordenação por `hora_agendada`, usar helper de data/hora no fuso `America/Sao_Paulo`.
- `src/components/dashboard/dashboard.tsx`: subtítulo usa `cards.agendamentosHoje`; lista continua com `slice(0, 5)`.
- `src/routes/_authenticated/ordens.tsx`: refatorar `OrdemRow` para layout responsivo (`flex-col md:flex-row`, `min-w-0`, grid de botões) e corrigir o `Â·`.

Sem alterações em RLS, políticas, migrations, permissões ou regras de negócio.

## Verificação

- Painel exibe o agendamento de hoje que já passou do horário, com marcação de atrasado, e o contador bate com a tela Agenda.
- Tela de OS a 360px: nenhum texto quebrando palavra por palavra, sem rolagem lateral.
- Typecheck/build limpos.
