# LavaFlow — Sprint Refinamento Premium UI/UX v2.1

Foco: elevar percepção de valor sem redesign, preservando o neomorphism atual. Mobile-first, reuso de componentes, consistência.

## 1. Design Language (fundação)

Criar `src/lib/design-system.ts` + `DESIGN_LANGUAGE.md` documentando:
- Tokens de motion (`duration-fast 150ms`, `duration-base 200ms`, `duration-slow 250ms`, easings padrão).
- Tokens de elevação neomórfica já existentes em `styles.css` (catalogar, não recriar).
- Padrões de: cards, loaders (skeleton), modais, gráficos, KPIs, empty states, tom de voz do Consultor.
- Espaçamentos (escala 4/8), radius, área mínima de toque 44px.

## 2. Refinamentos transversais

- **UTF-8 sweep**: varrer `src/` por mojibake (`Ã©`, `Ã§`, `â€`) e corrigir.
- **Linguagem premium**: substituir labels no sidebar (`app-layout.tsx`), títulos de página e `<title>`/meta:
  - Dashboard → Painel Executivo
  - Agendamentos → Central de Agendamentos
  - Clientes → Hub de Clientes
  - Assistente → Consultor Inteligente
  - Relatórios → Insights Operacionais
  - Rotas mantêm slugs atuais (sem breaking change), só labels mudam.
- **Microinterações**: utilitários `transition-premium`, `hover-lift`, `press-scale` em `styles.css`; aplicar em botões e cards principais.
- **Touch target**: auditar `button.tsx` size variants para garantir `min-h-11` (44px) no mobile.

## 3. Dashboard (Painel Executivo)

- KPIs com indicador de tendência: novo componente `TrendIndicator` (↑ ↓ ● + %, cor semântica).
- Hero inteligente em `dashboard.tsx`: saudação dinâmica (bom dia/tarde/noite + nome) + linha de contexto ("3 horários livres hoje · potencial R$ X") calculada via dados já carregados (agenda_config + agendamentos do dia + ticket médio recente).
- Botão CTA principal com classe `btn-premium` (gradiente sutil + brilho interno via box-shadow inset).
- Empty state: quando 0 agendamentos hoje → CTA duplo "Criar campanha" / "Compartilhar link de agendamento".

## 4. Agendamento público (`/agendar/$slug`)

- Stepper visual (Serviço → Data → Horário → Confirmação) — componente `BookingStepper`.
- Estados do horário com tokens: `slot-available`, `slot-selected`, `slot-busy`, `slot-disabled`.
- Badges inteligentes: "Mais escolhido", "Atendimento imediato" (derivados de `get_ocupacao_dia`).
- Resumo automático sticky com preço, duração e previsão de entrega (`hora + tempo_estimado_min`).
- Seleção opcional de profissional (lista de `funcionarios` ativos, fallback "Qualquer profissional").

## 5. Cards de serviço

Componente `ServiceCard` reaproveitável:
- `<img loading="lazy">` + skeleton + fade-in (classe `image-fade-in`).
- Preço em destaque (text-xl tabular-nums).
- Duração com ícone `Clock` discreto.
- Categoria em badge `secondary` elegante.

Usar no `/agendar/$slug`, `configuracoes` (preview) e em qualquer lista de serviços.

## 6. Performance

- `React.memo` em cards e linhas de tabela pesadas (kanban OS, lista clientes).
- `<link rel="preload">` para fonte principal no `__root.tsx`.
- Lazy import de rotas pesadas (`relatorios`, `crescimento`, `midia`) via `lazyRouteComponent` se ainda não estiver.
- Auditar imagens (servir `foto_url` em formato webp — já é o pipeline de upload).

## 7. Mobile polish

- Sidebar drawer: garantir handles 44px.
- Tabelas → cards em <768px (já parcial; padronizar via `MobileListCard`).
- FAB de ação rápida no Dashboard mobile.

## 8. Auditoria final (checklist no PR)

UI · UX · Perf (Lighthouse mobile >95 nas rotas chave) · Responsividade 360/768/1280 · UTF-8 · Design System · Acessibilidade (foco visível, aria-labels) · Microinterações · Consistência de ícones (Lucide only).

---

## Escopo técnico (arquivos previstos)

```text
NEW   src/lib/design-system.ts
NEW   DESIGN_LANGUAGE.md
NEW   src/components/trend-indicator.tsx
NEW   src/components/service-card.tsx
NEW   src/components/booking-stepper.tsx
NEW   src/components/dashboard/hero-inteligente.tsx
EDIT  src/styles.css                  (utilitários motion + btn-premium + slot states)
EDIT  src/components/app-layout.tsx   (labels premium)
EDIT  src/components/ui/button.tsx    (min-h-11 mobile + variant premium)
EDIT  src/routes/_authenticated/dashboard.tsx
EDIT  src/routes/agendar.$slug.tsx
EDIT  src/routes/__root.tsx           (preload fonte, meta refinada)
EDIT  src/routes/_authenticated/*.tsx (títulos + headers premium nas 6 rotas-chave)
SWEEP src/**/*.{ts,tsx}               (UTF-8 + linguagem premium)
```

## Fora de escopo

- Redesign de cores/identidade.
- Mudança de rotas/URLs (apenas labels).
- Novas features de negócio.
- i18n multi-idioma (só corrigir PT-BR).

## Riscos & mitigação

- Renomear labels pode confundir usuários atuais → manter ícones e ordem do menu; apenas texto muda.
- `btn-premium` precisa respeitar dark/light → usar tokens HSL existentes, sem cores hardcoded.
- Stepper no `/agendar` é rota pública SSR → componente client-safe, sem server fns novos.

## Critério de pronto

- Lighthouse mobile ≥95 em `/`, `/agendar/$slug`, `/dashboard`.
- Zero ocorrência de mojibake em `rg "Ã[©§£¡]" src/`.
- Todos os botões CTA principais com `min-h-11` no mobile.
- Visual diff: nenhum componente quebrou layout em 360/768/1280.
