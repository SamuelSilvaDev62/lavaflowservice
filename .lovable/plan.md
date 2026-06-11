
# Redesign Mobile — Agendamentos

Foco: tornar a tela `/agendamentos` mais prática no celular, mantendo a identidade visual moderna do LavaFlow (cards arredondados, tipografia atual, cores semânticas).

Observação sobre "arrastar não funciona": hoje a tela não tem swipe/drag — só botões. Vou adicionar gestos reais (swipe horizontal no card para ações rápidas) e melhorar a navegação por data via swipe entre dias.

---

## Mudanças

### 1. Header compacto + ação flutuante
- "Nova reserva" deixa de ser botão largo no topo → vira **FAB** (botão flutuante circular no canto inferior direito), padrão mobile-first.
- Subtítulo some no mobile (libera espaço); fica só "Agendamentos".

### 2. KPIs em scroll horizontal
- Em vez de grid 2x2 ocupando ~50% da tela, vira **carrossel horizontal** de chips/mini-cards (snap-scroll), altura ~72px.
- Quatro métricas continuam visíveis com swipe lateral.

### 3. Bloco "Link público" recolhível
- Vira um card colapsável (accordion fechado por padrão) com ícone de compartilhar — só abre se o usuário tocar. Libera muito espaço.

### 4. Seletor de data como faixa de dias (swipe)
- Substitui o `<input type="date">` por uma **faixa horizontal de 7 dias** (hoje + próximos 6) com swipe e tap. Botão "calendário" abre o date picker completo para datas distantes.
- Indicador do dia ativo com cor primária.

### 5. Tabs Agenda/Lista — sticky
- Tabs ficam **sticky** no topo ao rolar (sempre acessíveis).

### 6. Card de agendamento — swipe actions
- Card fica mais compacto (hora à esquerda em coluna destacada, dados à direita).
- **Swipe para esquerda** revela ações rápidas: Confirmar / Iniciar / Cancelar (com cores semânticas).
- Botões WhatsApp ficam em menu `...` (dropdown) para não poluir.
- Tap no card → abre bottom sheet com todos os detalhes e ações completas.

### 7. Bottom sheet de detalhes
- Substitui a explosão de botões dentro do card. Mostra: cliente, telefone (com tap-to-call), serviço, observações, e todas as ações em lista vertical confortável (alvo ≥44px).

### 8. Dialog "Nova reserva" → Drawer (bottom sheet) no mobile
- Usa `Drawer` do shadcn em telas <640px; mantém `Dialog` no desktop.

---

## Detalhes técnicos

- Editar apenas `src/routes/_authenticated/agendamentos.tsx` (sem mudanças em backend/server functions).
- Swipe actions: implementar com `framer-motion` (`drag="x"`, `dragConstraints`, `onDragEnd` threshold ~80px). Já está no projeto via shadcn.
- Faixa de dias: array gerado a partir de hoje com `date-fns`; container `overflow-x-auto snap-x snap-mandatory`.
- KPI carrossel: `flex gap-3 overflow-x-auto snap-x` com `snap-start` em cada card.
- FAB: `fixed bottom-20 right-4 z-40` (acima do chat bar), `rounded-full h-14 w-14 shadow-lg`.
- Sticky tabs: `sticky top-0 z-30 bg-background/95 backdrop-blur`.
- Bottom sheet: componente `Drawer` (já existe em `src/components/ui/drawer.tsx`).
- Responsivo: todos os ajustes são `sm:` opcionais — desktop continua com grid 4 colunas, dialog padrão, e card com botões inline (sem swipe).

## Fora de escopo
- Backend/server functions inalterados.
- Configurações de agenda (`/configuracoes`) inalteradas.
- Página pública `/agendar/$slug` inalterada.

## Arquivos
- editado: `src/routes/_authenticated/agendamentos.tsx`
