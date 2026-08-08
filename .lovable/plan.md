# Cards sem rolagem lateral — Agenda e Fila

Objetivo: no mobile, todos os indicadores e seletores das telas **Agenda** e **Fila** ficam visíveis sem arrastar a tela para o lado. Nada de lógica de negócio muda — só layout.

## Agenda (`/agendamentos`)

1. **Indicadores (Hoje, Confirmados, Pendentes, Leva e Traz, Receita prevista)**
   - Hoje: faixa com rolagem lateral.
   - Novo: grade de 2 colunas no celular, 3 em tablet, 5 no desktop. O card de Receita prevista ocupa a linha inteira no celular.
   - Cards ficam mais compactos (rótulo menor, número em destaque) para caber sem cortar texto.

2. **Faixa de dias**
   - Hoje: tira horizontal arrastável com 14 dias.
   - Novo: grade de 7 colunas por semana (duas linhas), botões de largura fluida em vez de largura fixa, altura reduzida. Semana inteira visível de uma vez, sem arrastar.

## Fila (`/fila`)

3. **Indicadores (Na fila, Em andamento, Prontos, Em produção)**
   - Hoje: quatro chips com rolagem lateral no celular.
   - Novo: grade 2x2 no celular e 4 colunas a partir de tablet, usando um único componente de card em vez de dois (remove a duplicação atual entre `QuickCard` e `KpiChip`).

4. **Abas de etapa (Aguardando, Em lavagem, Finalização, Pronto, Entregue)**
   - Hoje: pílulas com rolagem lateral.
   - Novo: grade de 5 colunas fixas, texto curto + contador empilhado, sem rolagem. Mantém a barra fixa no topo e o comportamento de seleção atual.

## Detalhes técnicos

- Arquivos: `src/routes/_authenticated/agendamentos.tsx`, `src/routes/_authenticated/fila.tsx`.
- Remover `overflow-x-auto`, `snap-x`, `shrink-0`, `min-w-[...]` e as margens negativas `-mx-4 px-4` dos blocos citados; trocar por `grid` + `min-w-0` + `truncate` conforme padrão responsivo do projeto.
- O kanban desktop com drag-and-drop, o drawer de detalhes e todas as consultas permanecem intactos.
- Sem alterações em server functions, RLS ou permissões.
