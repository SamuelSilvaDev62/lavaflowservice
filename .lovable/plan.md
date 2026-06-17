## Plano — Maturidade comercial do LavaFlow

Foco em transformar funcionalidades existentes em **resultado mensurável**. Já existem `SetupChecklist`, `WelcomeModal` e seed demo — vou refinar o que está, expandir o que falta e adicionar a camada de KPIs que ainda não existe.

Entrego em 3 frentes na mesma leva.

---

### Frente 1 — Onboarding mais guiado

**Refinos no `SetupChecklist` existente:**
- Adicionar passo **"Criar primeira OS"** (hoje só tem cliente/serviço/funcionário/plano).
- Adicionar passo **"Configurar fidelidade"** (link para `/fidelidade`).
- Mostrar checklist também no `/dashboard` mesmo após `status = done`, enquanto progresso < 100% (hoje ele esconde cedo demais).
- Cada item ganha micro-descrição ("Cadastre o serviço que você mais vende") em vez de só o título.
- CTA final quando chega 100%: "Pronto! Veja seu dashboard de crescimento" → leva ao topo do dashboard.

**Onde aparece:** dashboard (já aparece) + uma versão compacta no topo de cada página relevante enquanto o passo daquela página não está concluído (ex.: banner em `/clientes` se ainda não tem cliente).

---

### Frente 2 — Dados demo mais ricos

O seed atual cria clientes, OS, planos e avaliações. Vou adicionar para a venda ficar mais convincente:
- **Recompensas resgatadas** (3-4 movimentos de débito de pontos) para a tela Fidelidade não ficar vazia.
- **Clientes em risco** plantados de propósito (5 clientes com `ultima_visita` 50-90 dias atrás e histórico ≥3 OS) para os KPIs novos já mostrarem números no demo.
- **Assinaturas pendentes** (2) além das ativas, para Dashboard mostrar o card de pendências.
- **Avaliações ruins** (2 com nota ≤3 e comentário) para a aba de oportunidades fazer sentido.
- **Agendamentos futuros** (5 próximos 7 dias) para `/agendamentos` não estar vazio no demo.

Tudo idempotente (continua respeitando o guard `count > 0`).

---

### Frente 3 — KPIs de crescimento + banner de impacto

**Novo server fn `getCrescimentoKPIs`** (em `lavaflow.functions.ts`), retornando:

| KPI | Fórmula |
|---|---|
| **Receita recuperável** | Σ (ticket médio do cliente) para clientes com ≥3 OS históricas e sem visita há 30-90 dias. Ticket médio = avg(valor) das OS entregues do cliente. |
| **Clientes em risco** | Count de clientes com ≥3 OS e última visita entre 45 e 90 dias atrás. |
| **Próximas recompensas** | Count de clientes a ≤50 pts da recompensa ativa mais barata. |
| **Potencial de assinatura** | (Clientes com ≥4 OS nos últimos 60 dias e SEM assinatura ativa) × valor mensal do plano mais barato. |
| **Impacto do mês** | Clientes "recuperados" (voltaram este mês após >30 dias inativos) + faturamento gerado por eles. |

**UI no Dashboard** (acima dos cards atuais):
- **Banner de impacto** (full-width, gradient com a cor primária):
  > "Este mês o LavaFlow ajudou a recuperar **{N} clientes** e gerar **R$ {X}** em faturamento."
  
  Esconde quando N=0 e mês ainda no início (<dia 5).

- **Grid de 4 cards "Oportunidades de Crescimento"**: Receita recuperável, Clientes em risco, Próximas recompensas, Potencial de assinatura. Cada card tem CTA que leva para a tela relevante já filtrada (ex.: "Clientes em risco" → `/oportunidades?filter=risco`).

**Performance:** uma única query SQL com CTEs, com filtro `owner_id` (já tem índice). `staleTime: 5 min` no React Query.

---

### Arquivos afetados

**Novos:**
- `src/components/dashboard/impact-banner.tsx`
- `src/components/dashboard/growth-kpis.tsx`

**Editados:**
- `src/lib/lavaflow.functions.ts` — adicionar `getCrescimentoKPIs`.
- `src/lib/onboarding.functions.ts` — adicionar passos `os_criada` e `fidelidade_configurada`; enriquecer `runSeed` (resgates, clientes em risco, assinaturas pendentes, avaliações ruins, agendamentos).
- `src/components/setup-checklist.tsx` — novos passos, descrições, lógica de "esconder só com 100%".
- `src/routes/_authenticated/dashboard.tsx` — banner + grid de KPIs no topo.
- `src/routes/_authenticated/oportunidades.tsx` — aceitar `?filter=` via search params.

**Sem migrations** — todos os dados já existem nas tabelas atuais.

---

### Resultado esperado

Quando o dono abre o LavaFlow vê, em ordem:
1. Quanto o sistema **gerou para ele este mês** (banner).
2. Quanto **ainda pode gerar** (4 KPIs com CTA).
3. O que falta **configurar** (checklist, quando aplicável).
4. Operação do dia (cards atuais).

Esse é o salto de "ferramenta operacional" para "consultor de crescimento" que você descreveu.
