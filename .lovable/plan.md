
# Modo Demonstração & Onboarding LavaFlow

Antes de qualquer nova feature, entregar uma experiência de "primeiro valor em menos de 2 minutos": seed automático opcional, checklist de configuração, dashboard vazio inteligente e tour guiado.

## 1. Estado de onboarding (backend)

Adicionar coluna em `empresa` para registrar a escolha do usuário e o progresso:

- `onboarding_status` (`text`, default `'pending'`) — valores: `pending`, `demo`, `empty`, `done`
- `onboarding_completed_steps` (`text[]`, default `'{}'`) — ids dos passos do checklist concluídos
- `tour_completed_at` (`timestamptz`, nullable)

Migração via tool de migration. Sem novas tabelas, sem mexer em RLS existente.

## 2. Server function: `seedDemoData`

Arquivo novo: `src/lib/onboarding.functions.ts`

- `getOnboardingState()` — retorna status + contadores reais (clientes, serviços, funcionários, planos, OS) para alimentar checklist e detectar "vazio".
- `seedDemoData()` — protegido por `requireSupabaseAuth`. Idempotente: só roda se `onboarding_status = 'pending'` E não existirem dados do owner. Insere via `supabase` (RLS do próprio usuário):
  - 6 serviços (Lavagem Simples, Completa, Premium, Detalhada, Higienização, Polimento)
  - 4 funcionários
  - 3 planos de assinatura (Básico 4 lavagens, Plus 8, Ilimitado)
  - 4 recompensas
  - 25 clientes (nomes BR realistas, telefones, origens variadas)
  - 35 veículos (placas Mercosul, modelos comuns)
  - 8 assinaturas ativas vinculadas a clientes/planos
  - 150 ordens de serviço distribuídas nos últimos 90 dias com status realistas (maioria `entregue`, algumas em fila/lavagem para o Kanban parecer vivo), `valor` coerente com o serviço, `funcionario_id`, `veiculo_id`
  - ~60 avaliações (notas 4–5 majoritárias)
  - ~40 interações (`whatsapp`, `ligacao`, `presencial`)
  - Pontos: o trigger `tg_os_entregue_credita_pontos` já credita ao mudar status para `entregue`; o seed insere OS já como `entregue` com `entregue_em` distribuído. Para evitar duplicação, inserir as OS com status final direto e gerar `pontos_movimentos` manualmente se o trigger não disparar em INSERT (verificar — provavelmente só dispara em UPDATE). Decisão: inserir OS como `aguardando` e fazer UPDATE para `entregue` em lote, deixando o trigger creditar pontos naturalmente.
- `setOnboardingChoice({ choice: 'demo' | 'empty' })` — grava status; se `demo`, chama `seedDemoData` internamente.
- `markStepDone({ step })` — adiciona ao array `onboarding_completed_steps`.
- `dismissTour()` — grava `tour_completed_at`.

## 3. Modal de boas-vindas

Componente novo: `src/components/welcome-modal.tsx`

Dispara no `_authenticated/route.tsx` (ou no `dashboard.tsx`) quando `onboarding_status === 'pending'`. Duas opções:

1. **Explorar com dados de demonstração** — chama `setOnboardingChoice('demo')`, mostra loader "Preparando seu lava-rápido…" (~2–4s), invalida queries, segue para tour.
2. **Começar do zero** — chama `setOnboardingChoice('empty')`, fecha modal, abre checklist.

Visual alinhado ao design system (Card grande, ícones, copy de crescimento).

## 4. Checklist de primeiros passos

Componente novo: `src/components/setup-checklist.tsx`, renderizado no topo do `/dashboard` enquanto `onboarding_status !== 'done'` e progresso < 100%.

Passos (auto-detectados via contadores + flag manual):
- Configurar empresa (nome ≠ default OR telefone preenchido)
- Cadastrar primeiro serviço (count servicos > 0)
- Cadastrar primeiro funcionário (count funcionarios > 0)
- Cadastrar primeiro cliente (count clientes > 0)
- Criar primeiro plano de assinatura (count planos_assinatura > 0)

Cada item: checkbox visual, link para a rota relevante, % de progresso no header. Ao atingir 100%, marca `onboarding_status = 'done'` e some com animação.

## 5. Dashboard vazio inteligente

Em `src/routes/_authenticated/dashboard.tsx`:

- Se todos os contadores principais = 0 → renderizar `EmptyDashboard` com 3 CTA cards ("Cadastrar primeiro cliente", "Criar plano de assinatura", "Configurar fidelidade") em vez dos gráficos zerados.
- Se houver dados parciais, renderizar KPIs normalmente mas esconder gráfico de 14 dias se série toda zero (placeholder com CTA "Registrar primeira ordem").

Aplicar mesma lógica em `/oportunidades` e `/assistente` (estado vazio com copy convidativo, sem gráficos quebrados).

## 6. Tour guiado

Adicionar dependência `driver.js` (leve, sem React wrapper pesado). Componente `src/components/guided-tour.tsx` que dispara após escolha do modal, percorrendo 5 paradas via seletores `data-tour`:

1. Dashboard — "Seu painel de crescimento em tempo real"
2. Oportunidades — "Ações automáticas para vender mais"
3. Assistente — "Insights inteligentes do seu negócio"
4. Clientes — "Sua base e quem está sumindo"
5. Assinaturas — "Crie receita recorrente todo mês"

Botão "Pular" e "Concluir" → `dismissTour()`. Não reabre depois.

## 7. Integração no layout

- `AppLayout` consulta `getOnboardingState` (React Query, stale 60s) e decide renderizar `<WelcomeModal />` / `<GuidedTour />`.
- Adicionar atributos `data-tour="dashboard|oportunidades|assistente|clientes|assinaturas"` nos itens da sidebar.

## Detalhes técnicos

- Seed roda **server-side** com o client autenticado (RLS aplicada como o próprio usuário) — sem `supabaseAdmin`, mantendo isolamento por `owner_id`.
- Geração de dados determinística-ish: usar arrays fixos de nomes/modelos + `Math.random` com sementes simples; nada de libs externas (`faker` é pesado para o Worker).
- Datas: `created_at` das OS espalhadas com `now() - interval 'X days'` via SQL bulk insert dentro do handler (um único `insert` array por tabela).
- Performance: todo o seed deve completar em < 5s. Usar inserts em batch (`supabase.from(...).insert([...])`).
- Idempotência: dupla verificação (status + count) antes de inserir.
- Sem mudanças no design system, stack ou rotas existentes; apenas novos componentes e uma migração aditiva.

## Entregáveis

1. Migração (3 colunas em `empresa`)
2. `src/lib/onboarding.functions.ts` + `src/lib/demo-seed.server.ts` (dados estáticos)
3. `src/components/welcome-modal.tsx`
4. `src/components/setup-checklist.tsx`
5. `src/components/empty-dashboard.tsx`
6. `src/components/guided-tour.tsx` (+ `bun add driver.js`)
7. Ajustes em `app-layout.tsx`, `dashboard.tsx`, `oportunidades.tsx`, `assistente.tsx`

## Fora de escopo

- Tour para módulos secundários (Fila, Relatórios, Equipe) — fica para iteração futura.
- Reset/limpar dados de demonstração — pode entrar depois em Configurações.
- Tradução/i18n do tour.
