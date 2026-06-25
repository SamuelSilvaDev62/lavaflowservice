# LavaFlow — Design Language v2.1

Documento oficial. Toda nova tela deve referenciar este guia antes de inventar componente.

## Princípios

1. **Neomorphism premium**: profundidade vem de luz, não de bordas grossas. Sempre dual-shadow (light + dark) via `--shadow-neo-*`.
2. **Mobile-first**: target mínimo 44px, gestos com uma mão, scroll vertical natural.
3. **Tipografia com personalidade**: `Space Grotesk` para títulos (`font-display`), `Inter` para corpo.
4. **Tabular nums** em qualquer valor monetário/contagem (`tabular-nums`).
5. **Zero cor hardcoded**: sempre tokens semânticos (`bg-primary`, `text-foreground`, etc.).

## Tokens de motion

| Token | Duração | Uso |
|---|---|---|
| `fast` | 150ms | Press/scale, ripple, micro feedback |
| `base` | 200ms | Hover, focus ring, badge tone |
| `slow` | 250ms | Lift de card, transição de modal |
| `entrance` | 320ms | Skeleton → conteúdo, fade-in de imagem |

Easing padrão: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
Utilitários CSS: `transition-premium`, `hover-lift`, `press-scale`.

## Superfícies

| Utility | Quando |
|---|---|
| `neo-surface` | Card principal (KPI, painel) |
| `neo-surface-sm` | Linhas/itens de lista |
| `neo-surface-lg` | Hero, modal de destaque |
| `neo-inset` | Estado pressionado/selecionado |

## Botões

- **default**: ação primária neutra.
- **premium** (`btn-premium`): CTA único da tela (gradiente sutil + brilho interno).
- **outline / secondary**: ações secundárias.
- **ghost**: ações terciárias dentro de cards.
- Tamanhos: `default` (44px mobile / 40px desktop), `sm` (36/32), `lg` (48), `icon` (44/40 quadrado).

## Cards

- Radius: `rounded-2xl`.
- Sombra: `neo-surface` ou `neo-surface-sm`.
- Imagens: `<img loading="lazy">` com skeleton (`skeleton-shimmer`) e fade-in (`image-fade-in`).
- Preço em `text-xl font-display tabular-nums text-primary`.
- Categoria como `Badge variant="secondary"`.
- Tempo com ícone `Clock` de 14px discreto, `text-muted-foreground`.

Componente canônico: `<ServiceCard />`.

## KPIs

- Valor: `font-display text-2xl font-bold tabular-nums`.
- Label: `text-xs text-muted-foreground`.
- Tendência: `<TrendIndicator value={...} />` — pílula com seta + %.
- Tom semântico só via tokens (`text-success`, `text-warning`, `text-destructive`).

## Stepper de agendamento

Componente: `<BookingStepper />`. 4 passos: Serviço → Data → Horário → Confirmação.
Estado ativo usa `btn-premium`; concluídos usam `bg-success`.

## Slots de horário

| Utility | Estado |
|---|---|
| `slot-available` | Disponível e clicável |
| `slot-selected` | Selecionado (gradiente premium + inset) |
| `slot-busy` | Ocupado (warning translúcido) |
| `slot-disabled` | Fora do expediente / passado |

Sempre `min-height: 44px` (acessibilidade).

## Loaders

- `<Skeleton />` com classe `skeleton-shimmer` para listas/imagens.
- Spinners apenas em ações curtas (<1.5s).
- Mensagem de loading nunca substitui o conteúdo já carregado — usar `isPlaceholderData`.

## Modais

- Radix Dialog com `rounded-2xl`, `shadow-[var(--shadow-neo-lg)]`.
- Animação: fade + scale 95→100 em 200ms.
- Botão de fechamento `size="icon"` no canto superior direito.

## Empty states

Sempre 3 elementos: ilustração/ícone + headline + CTA acionável.
Exemplo:
> 🗓 **Nenhum agendamento para hoje**
> Compartilhe seu link de agendamento ou crie uma campanha para preencher a agenda.
> `[Compartilhar link] [Criar campanha]`

## Tom do Consultor Inteligente

- Primeira pessoa do agente, direto: "Eu observei…", "Recomendo…".
- Cada insight termina com 1 ação clicável.
- Nunca pessimista — sempre apontar próximo passo.
- Constantes em `consultorTone` (src/lib/design-system.ts).

## Espaçamentos

Escala 4/8: `gap-2 / gap-3 / gap-4 / gap-6 / gap-8`. Padding de card padrão: `p-4` (mobile), `p-6` (desktop).

## Linguagem premium (substituições oficiais)

| Antes | Depois |
|---|---|
| Sistema de Gestão | Plataforma Inteligente |
| Dashboard | Painel Executivo |
| Agendamentos | Central de Agendamentos |
| Clientes | Hub de Clientes |
| Assistente | Consultor Inteligente |
| Relatórios | Insights Operacionais |
| Ordens de Serviço | Ordens de Serviço (manter) |
| Fila | Fila Operacional |

Rotas permanecem (`/dashboard`, `/clientes`, ...) para evitar quebra de bookmarks.

## Acessibilidade

- Foco visível: `focus-visible:ring-2 focus-visible:ring-ring/50`.
- `aria-label` em todo botão só com ícone.
- `aria-pressed` em toggles.
- Contraste mínimo AA em ambos os temas.

## Performance

- `React.memo` em itens repetidos (linhas de tabela, cards).
- `loading="lazy"` em toda `<img>` abaixo da dobra.
- Rotas pesadas via lazy import se >50KB.
- Lighthouse mobile alvo ≥95.
