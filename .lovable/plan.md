## Redesign mobile da tela de Relatórios

Hoje no mobile a tela quebra:
- KPI "Faturamento" trunca (`R$ 325,0…`) porque o grid de 3 colunas é estreito demais
- Gráficos `recharts` ficam apertados, com poucos rótulos legíveis
- Sem hierarquia visual — apenas três cards iguais + dois gráficos genéricos

### O que vou mudar (apenas `src/routes/_authenticated/relatorios.tsx`)

1. **Hero KPI "Faturamento"** em destaque no topo (mobile):
   - Card largura total com gradiente sutil (`from-primary/10 to-transparent`), valor em fonte display grande, label "Últimos 90 dias", e um chip de variação visual (ex.: "✅ X entregues de Y ordens").
   - Desktop mantém grid 3-col atual.

2. **KPIs secundários em carrossel horizontal** (mobile, padrão já usado em /fila e /agendamentos):
   - Chips snap-scroll: Ordens, Entregues, Ticket médio (calculado client-side: `total/qtd`), Taxa de entrega (`entregues/qtd`).
   - Mantém consistência visual com as outras telas redesenhadas.

3. **Tabs "Serviços / Equipe"** no mobile para alternar entre os dois gráficos (em vez de empilhar dois cards grandes). Desktop continua mostrando os dois lado a lado em `lg:grid-cols-2`.

4. **Gráficos otimizados para mobile**:
   - Trocar `BarChart` vertical por **horizontal** (`layout="vertical"`) — labels de serviço/funcionário ficam legíveis à esquerda, barra cresce para direita. Melhor para nomes longos como "Lavagem Simples".
   - Altura ajustada (`h-72` mobile, `h-64` desktop), margens reduzidas, tooltip formatado em BRL, rótulo de valor no fim da barra (`LabelList`).
   - Mostrar top 5 no mobile com link "ver todos" se houver mais.

5. **Ranking textual abaixo do gráfico** (mobile): lista compacta com medalha 🥇🥈🥉 + nome + valor, reforçando os dados do gráfico de forma escaneável no celular.

6. **Empty/loading** mantidos (já bons).

### Arquivos
- `src/routes/_authenticated/relatorios.tsx` (único arquivo alterado)

### Notas técnicas
- Sem mudanças em backend, server functions ou tipos.
- Tudo via classes responsivas `sm:` — desktop intocado.
- `LabelList` e `layout="vertical"` já fazem parte do recharts instalado.
- Cálculo de ticket médio e taxa de entrega feito no componente a partir de `data.total`, `data.qtd`, `data.entregues`.
