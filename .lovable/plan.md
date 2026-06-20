## Diagnóstico

A última rodada criou a migration `20260619142000_operational_dashboard_leva_traz_capacity.sql` (Leva e Traz, capacidade dos colaboradores, escolha de profissional, tabela `notificacoes`) **mas a migration ainda não foi aplicada no banco**. Por isso `src/integrations/supabase/types.ts` não conhece os novos campos/tabelas, e o código que já os usa (`src/lib/lavaflow.functions.ts`) está com cascata de erros TypeScript.

Erros confirmados via `tsc --noEmit` (todos no mesmo arquivo):
- Tabela `notificacoes` desconhecida (linhas 273, 363) → quebra `listarNotificacoes`/`marcarNotificacaoLida`/`ignorarNotificacao`.
- Coluna `leva_traz`/`taxa_leva_traz`/`leva_traz_status` desconhecidas em `agendamentos` (l.1808, 1838+) → cascateia em ~25 erros de propriedades inexistentes no select da tela de Agendamentos / Leva e Traz.
- Coluna `permitir_escolha_profissional` desconhecida em `agenda_config` (l.2016) → quebra salvar configurações.
- Novos campos de `funcionarios` (`especialidades`, `horario_inicio/fim`, `dias_disponiveis`, `capacidade_por_horario`, `tempo_medio_servicos`) desconhecidos → quebra editar Equipe.
- Erro menor: `Map<unknown,unknown>` vs `Map<string,any>` em util de disponibilidade (l.1320) — tipagem do `new Map()` precisa anotação.

Além disso:
- `.env` **não está no `.gitignore`** (atualmente lista só `.dev.vars`). Há um `.env` no projeto com chaves publishable (não é segredo, mas deve ser ignorado por convenção, com `.env.example` documentando).
- Não foi observada quebra de runtime adicional além das que decorrem desses erros de schema; build estabiliza assim que a migration aplica e os tipos regeneram.

## Causa raiz única

**A migration de 19/06 está pendente.** Aplicá-la regenera `types.ts` e elimina ~95% dos erros sem alterar nenhuma tela. O restante são 2 ajustes de tipagem locais.

## Plano de correção (estabilização, sem novas features)

### Passo 1 — Aplicar a migration pendente
Re-submeter o conteúdo de `20260619142000_operational_dashboard_leva_traz_capacity.sql` via `supabase--migration` (mesmo SQL idempotente, usa `IF NOT EXISTS` em tudo — seguro, não apaga dados). Após aprovação, `types.ts` é regenerado automaticamente e os ~30 erros de "coluna/tabela não existe" desaparecem.

### Passo 2 — Corrigir 2 tipagens residuais em `src/lib/lavaflow.functions.ts`
- L.1320: tipar `new Map<string, any>()` explicitamente onde está sendo inferido como `Map<unknown,unknown>`.
- Revisar e fazer rebuild do `tsc --noEmit` após o passo 1 para garantir lista zerada (qualquer outro detalhe é ajuste pontual de cast).

### Passo 3 — Higienizar `.env`
- Adicionar ao `.gitignore`:
  ```
  .env
  .env.*
  !.env.example
  ```
- Criar `.env.example` com as chaves (`VITE_SUPABASE_URL=`, `VITE_SUPABASE_PUBLISHABLE_KEY=`, `VITE_SUPABASE_PROJECT_ID=`, e suas contrapartes server) **sem valores reais**.
- Não remover o `.env` atual do disco (o preview precisa dele para rodar).

### Passo 4 — Verificação de estabilidade (sem refactor)
Validar, **sem alterar UI**, que as telas críticas montam:
- `/dashboard`, `/agendamentos`, `/equipe`, `/configuracoes`, `/relatorios`, `/agendar/:slug`.
- Rodar `tsc --noEmit` final → deve ficar limpo.
- Conferir console do preview por erros de runtime nas telas listadas.

### O que NÃO vou tocar nesta rodada
- Nenhuma refatoração de Dashboard, Relatórios, Agendamentos, Equipe, Configurações, página pública ou Assistente.
- Nenhum ajuste de UX, layout, responsividade ou lógica de disponibilidade — toda essa lógica **já está implementada** no código atual; ela só não compila porque a migration está pendente. Depois de aplicada, validamos comportamento real e abrimos uma 2ª rodada de ajustes pontuais somente para o que efetivamente quebrar em runtime.
- Nenhuma alteração de RLS/segurança (a rodada anterior já endureceu isolamento por tenant).

## Entregáveis ao final
- Migration aplicada (idempotente, sem perda de dados).
- `types.ts` regenerado.
- 1–2 ajustes de tipagem em `lavaflow.functions.ts`.
- `.gitignore` + `.env.example`.
- Relatório final: arquivos alterados, erros corrigidos, pontos que pedem validação manual no preview (criar agendamento com Leva e Traz, editar colaborador, ativar "escolha de profissional", abrir relatórios e página pública).

## Pergunta antes de executar
A migration pendente cria a tabela `notificacoes` e adiciona colunas em `agendamentos`, `funcionarios` e `agenda_config` — todas com `IF NOT EXISTS` e defaults seguros, então não quebra dados antigos. Posso aplicá-la?