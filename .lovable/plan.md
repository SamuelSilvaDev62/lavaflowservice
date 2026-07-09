# Remoção do Modo MVP + IA e blueprint de reestruturação

Dois blocos: **(A) faxina** — remover o modo MVP e tudo relacionado a IA, promovendo o dashboard enxuto atual como o dashboard único; **(B) blueprint** — reestruturação focada em performance e usabilidade.

---

## A) Faxina — remoção de MVP e IA

### A.1 Remover o modo MVP (o dashboard enxuto vira o padrão)
- Excluir: `src/lib/mvp-mode.ts`, `src/lib/features.ts`.
- `src/routes/_authenticated/dashboard.tsx`: renderizar `MvpDashboard` diretamente (sem branch `isMvpMode`). Renomear o arquivo do componente para `src/components/dashboard/dashboard.tsx` e o export para `Dashboard` (o "Mvp" no nome perde sentido).
- `src/components/app-layout.tsx`: remover import/uso de `isMvpMode`, `setMvpMode`, `MVP_ALLOWED_ROUTES`, o filtro de rotas MVP, o badge "Modo MVP" e o botão de toggle no rodapé.
- `src/routes/_authenticated/route.tsx`: remover o guard de rotas MVP.
- `.env.example`: remover `VITE_MVP_MODE`.

### A.2 Remover toda a superfície de IA
Arquivos/rotas a excluir:
- Rotas: `src/routes/_authenticated/assistente.tsx`, `src/routes/_authenticated/inteligencia.tsx`, `src/routes/_authenticated/crescimento.tsx`, `src/routes/_authenticated/auditoria.tsx`, `src/routes/api/assistente-chat.ts`.
- Componentes: `src/components/copilot/contextual-copilot.tsx` e a pasta `src/components/copilot/`.
- Libs: `src/lib/ai/` (inteira), `src/lib/copilot/`, `src/lib/flow-engine/`, `src/lib/ai-gateway.server.ts`, `src/lib/inteligencia.functions.ts`, `src/lib/auditoria.functions.ts`.
- Assets landing referenciando IA: `src/assets/landing/app-assistant.webp.asset.json` (se referenciado só pelo assistente).

Ajustes em arquivos que sobrevivem:
- `src/routes/_authenticated/route.tsx`: remover `<ContextualCopilot />` e imports.
- `src/components/app-layout.tsx`: remover itens de nav "Centro de Crescimento", "Inteligência", "Consultor Inteligente", "Auditoria" (e ícones `Bot`, `BrainCircuit`, `Rocket` se ficarem órfãos).
- `src/routes/_authenticated/dashboard.tsx`, `src/routes/_authenticated/relatorios.tsx`, `src/routes/_authenticated/ordens.tsx`, `src/components/guided-tour.tsx`: remover chamadas/menções a insights de IA, tour de "assistente" e cards do consultor.
- `src/routes/__root.tsx` e `src/routes/lp.tsx`: revisar copy que fale de "IA" / "Consultor Inteligente".

Backend/limpeza de dados (migração única):
- `DROP TABLE` em `ai_recommendations`, `ai_usage_logs`, `tenant_ai_settings` (após confirmar que nenhuma FK vive fora dessas). Manter `equipe_auditoria` (não é IA).
- Não mexer em `LOVABLE_API_KEY` como secret — apenas parar de usá-lo. Recomendar remoção manual em Settings depois.

Verificações finais:
- `rg -n "isMvpMode|mvp-mode|hasFeature|features\\.ts|ai-gateway|lavaflow-consultor|ContextualCopilot|flow-engine|inteligencia|assistente" src/` deve voltar vazio.
- `tsgo` limpo; smoke test nas rotas `/dashboard`, `/agendamentos`, `/fila`, `/ordens`, `/clientes`, `/equipe`, `/configuracoes`.

Rotas finais no `_authenticated`: Painel, Agendamentos, Fila (Kanban), OS, Clientes, Fidelidade, Assinaturas, Campanhas, Equipe, Relatórios, Configurações, Meu Trabalho. (Fidelidade/Assinaturas/Campanhas voltam a ficar visíveis por padrão, já que o filtro MVP some — se quiser mantê-las escondidas, dizer na revisão.)

---

## B) Blueprint de reestruturação — alta performance e usabilidade

Objetivo: uma base sólida sem IA, com UX rápida, previsível e mobile-first.

### B.1 Arquitetura de dados e navegação
- **Rota-raiz do app** = `/dashboard` (Central do Dia). Um único ponto de entrada pós-login.
- **Agrupar navegação** em 3 áreas mentais:
  1. *Operação* — Painel, Agenda, Fila, OS, Meu Trabalho.
  2. *Clientes & Receita* — Clientes, Fidelidade, Assinaturas, Campanhas.
  3. *Gestão* — Equipe, Relatórios, Configurações.
- Nav mobile: bottom tab bar com 5 itens da Operação; demais em drawer.

### B.2 Padrão de dados (performance)
- **Loader + TanStack Query** em todas as telas: `ensureQueryData(queryOptions)` no `loader`, `useSuspenseQuery` no componente. Zero `useEffect + fetch`.
- **Server functions agregadoras**: uma função por tela devolve o payload completo (evitar N+1 no cliente). Ex.: `getDashboard()`, `getFilaBoard()`, `getClienteDetalhe(id)`.
- **Índices no banco** para queries quentes: `ordens_servico(owner_id, status)`, `agendamentos(owner_id, data_agendada, hora_agendada)`, `clientes(owner_id, ultima_visita)`.
- **Realtime seletivo** apenas em Fila (`ordens_servico`) e Agenda do dia. Nada de subscribe global.
- **Cache**: `staleTime` 30–60s para leituras, `refetchInterval` só em telas ao vivo (Fila).

### B.3 Design system e usabilidade
- Consolidar tokens em `src/styles.css` (cores, radius, sombras, motion). Remover cores hardcoded remanescentes.
- Componentes base auditados (Button, Card, Badge, Dialog, Table, EmptyState, Skeleton, PageHeader) com variantes claras.
- **Padrões de tela** obrigatórios: Skeleton → Data → EmptyState → Error, sempre.
- **Ação primária única** por tela, no topo (`PageHeader.actions`) e replicada em CTA flutuante mobile.
- **Toque ≥ 44px**, tipografia display em números-chave, `tabular-nums`.

### B.4 Central do Dia (definitiva)
Ordem fixa: Oportunidade → Agenda → Kanban resumido → Reativação → Ações rápidas. Cálculos:
- `ticketMedio` = média de `ordens_servico.valor` (status `entregue`, últimos 30d).
- `capacidadeDia` = derivada de `agenda_config` do dia da semana atual.
- `horariosLivres = max(0, capacidadeDia - agendadosAtivos)`.
- `potencial = horariosLivres * ticketMedio`.
Reativação: agregada em buckets `+30/+60/+90`, nunca lista com "999 dias".

### B.5 Fila (Kanban) de alta performance
- Colunas: Aguardando · Em lavagem · Finalização · Pronto · Entregue (hoje).
- Drag-and-drop otimista com rollback em erro.
- Realtime na tabela `ordens_servico` por `owner_id`.
- Ação de 1 clique: "Iniciar" · "Finalizar" · "Entregar + WhatsApp" (usa `waLink`).

### B.6 Clientes
- Lista virtualizada (react-virtual) com busca por nome/telefone/placa.
- Detalhe: histórico de OS, veículos, saldo de pontos, botão WhatsApp com template.
- Segmentos derivados por SQL view: `ativos_30`, `inativos_30_60`, `inativos_60_90`, `inativos_90+`.

### B.7 WhatsApp (sem IA)
- Templates fixos em `src/lib/whatsapp.ts` (já existente).
- CTA "Enviar WhatsApp" em: OS pronta, cliente inativo, aniversariante do mês, pós-serviço (agradecimento).

### B.8 Performance técnica
- Code-splitting por rota (padrão TanStack). Auditar bundle com `vite build --report`.
- Imagens: `vite-imagetools` para assets estáticos; lazy `loading="lazy"` em listas.
- Preload da LCP do dashboard via `head().links`.
- SW/PWA já existe (`src/pwa/register-sw.ts`) — validar cache-first para shell.

### B.9 Qualidade
- `tsgo` limpo; ESLint sem warnings novos.
- Smoke test manual documentado em `.lovable/mvp-smoke.md` (renomear para `smoke.md`).
- Métricas alvo: TTI < 2s em 4G simulada; interação < 100ms; Lighthouse mobile ≥ 90.

### B.10 Fora de escopo
- Qualquer IA/LLM, recomendações automáticas, consultor, insights gerados por modelo.
- OpenSquad, flow-engine e automações complexas.

---

## Ordem de execução sugerida
1. Bloco A.1 (MVP off) — 1 passo, baixo risco.
2. Bloco A.2 (IA off) — inclui migração de `DROP TABLE`.
3. Bloco B em ondas: navegação → dashboard definitivo → fila realtime → clientes virtualizado → performance/PWA.

Confirmar antes de executar: (i) manter Fidelidade/Assinaturas/Campanhas visíveis por padrão após remover o filtro MVP? (ii) posso dropar as 3 tabelas de IA na mesma migração?
