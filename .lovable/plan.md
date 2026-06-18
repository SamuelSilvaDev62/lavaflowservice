# Plano — Gestão Operacional (Equipe, Agendamentos, Clientes)

Três frentes, todas mobile-first, integradas ao que já existe (triggers de comissão, agenda, fidelidade). Sem quebrar histórico.

---

## 1) Módulo Equipe — produtividade e pagamentos

### Banco

Migration única:

- **`funcionarios`**: adicionar `comissao_modo text default 'global'` (`global` | `por_servico`) e `email text` se ainda não tiver.
- **`comissoes_servico`** (nova): `funcionario_id`, `servico_id`, `tipo` (`fixo`|`percentual`), `valor numeric`, único por par. GRANTs + RLS por `current_owner_id()`.
- **`pagamentos_comissao`** (nova): `owner_id`, `funcionario_id`, `periodo_inicio date`, `periodo_fim date`, `valor numeric`, `pago_em timestamptz default now()`, `observacao text`. GRANTs + RLS.
- **`comissoes`**: adicionar `pagamento_id uuid references pagamentos_comissao on delete set null` + índice. Comissão com `pagamento_id null` = a receber; com id = paga.
- **Trigger `tg_os_entregue_comissao`** estendido: quando `funcionarios.comissao_modo = 'por_servico'`, ler `comissoes_servico` por `(funcionario, servico)` para calcular `v_valor`; fallback para a regra global atual se não houver linha.

### Server functions (`lavaflow.functions.ts`)

- `getEquipeMetrics({ periodo, inicio?, fim? })` — aceitar `semana` | `quinzena` | `mes` | `custom`. Retornar por colaborador: lavagens, faturamento, comissão acumulada **(somente não paga no período)**, último pagamento (data + valor), status (`a_receber` | `pago` | `sem_comissao`), tipo de comissão (descrição amigável). Topo: total a pagar, total lavagens, ativos hoje, melhor do período.
- `upsertComissoesServico({ funcionario_id, itens: [{servico_id,tipo,valor}] })`.
- `marcarPagamentoComissao({ funcionario_id, periodo_inicio, periodo_fim, observacao? })` — soma comissões abertas no intervalo, cria `pagamentos_comissao`, atualiza `comissoes.pagamento_id`. Retorna `{ valor }`.
- `listPagamentosComissao({ funcionario_id, limit })` — histórico.

### UI `routes/_authenticated/equipe.tsx`

- Filtro de período (Semana / 15 dias / Mês / Personalizado com 2 date pickers).
- Cards de topo: **Total a pagar**, **Lavagens**, **Colaboradores ativos hoje**, **Melhor do período** (com badge 🏆).
- Cada card de colaborador no formato pedido (🚗 lavagens, 💰 faturamento, 💵 comissão, 📅 período, badge 🟢 A receber / ✅ Pago).
- Botão **"Marcar como pago"** → confirma valor calculado, abre dialog com observação opcional, registra e atualiza UI.
- Linha "Último pagamento: dd/mm/aaaa — R$ X".
- No diálogo de editar colaborador: toggle **Modo de comissão** (`Global` / `Por serviço`). Quando "Por serviço", lista todos os serviços ativos com inputs (tipo + valor) por linha.

---

## 2) Colaborador no Agendamento

### Banco
- `agendamentos`: adicionar `funcionario_id uuid references funcionarios(id) on delete set null` + índice `(owner_id, data_agendada, funcionario_id)`.

### Server functions
- `upsertAgendamento` (e seed/demo): aceitar `funcionario_id` opcional.
- `converterAgendamentoEmOS` (ou trigger atual de criação de OS via agendamento): se `agendamentos.funcionario_id` existe e a OS não tem, preencher automaticamente — assim o trigger de comissão funciona sem mudança.
- Em `getAgendaDia` retornar `funcionario:funcionario_id(nome)` e contagem `byFuncionario`.

### UI `routes/_authenticated/agendamentos.tsx`
- No form de novo/editar: select **"Colaborador responsável (opcional)"**, com opção "Sem definir".
- Lista do dia: ao lado de cada horário, badge com nome do colaborador (ou "—").
- Bloco resumo do dia: "Distribuição da equipe" — chips `Samuel · 4`, `Davi · 2`, `João · 5`.

---

## 3) Edição completa de Clientes

### Banco
Migration:
- `clientes`: adicionar `whatsapp text`, `email text`, `observacoes text`.
- (Veículo já tem placa/modelo/marca/cor — vamos editar o **veículo principal** na mesma tela.)

### Server function
- `updateClienteCompleto({ id, nome, telefone, whatsapp, email, observacoes, veiculo?: { id?, placa, modelo, marca, cor } })` — `UPDATE` no cliente; se `veiculo` enviado, `UPDATE` (se `id`) ou `INSERT` no veículo. **Nunca toca em** `pontos_saldo`, ordens, agendamentos, pontos_movimentos, assinaturas. Validação Zod, telefone/placa normalizados.

### UI `routes/_authenticated/clientes/$id.tsx`
- Botão **"Editar Cliente"** no topo abre `Dialog` com todos os campos (cliente + veículo principal).
- Toast de sucesso, `invalidateQueries` do cliente e listas.
- Tudo permanece: histórico de OS, pontos, agendamentos, assinaturas (queries inalteradas).

---

## Arquivos

**Novos**
- `supabase/migrations/<ts>_equipe_pagamentos_agendamento_cliente.sql`
- `src/components/equipe/comissao-por-servico-dialog.tsx`
- `src/components/equipe/marcar-pagamento-dialog.tsx`
- `src/components/clientes/editar-cliente-dialog.tsx`

**Editados**
- `src/lib/lavaflow.functions.ts` (novas fns + extensão das existentes)
- `src/routes/_authenticated/equipe.tsx`
- `src/routes/_authenticated/agendamentos.tsx`
- `src/routes/_authenticated/clientes/$id.tsx`
- `src/lib/onboarding.functions.ts` (seed demo: alguns agendamentos com `funcionario_id`, 1 pagamento de comissão de exemplo)

## Pontos técnicos

- Trigger de comissão continua a fonte da verdade (cálculo no momento da OS entregue). Modo "por serviço" só muda a leitura da tabela de tarifas.
- "A receber" = soma de `comissoes` com `pagamento_id IS NULL` no período do filtro.
- Período padrão da Equipe: **mês atual**.
- Todas as RLS via `current_owner_id()` (consistente com o resto do projeto).
- Nenhuma migração apaga colunas; tudo aditivo. Histórico 100% preservado.

## Fora de escopo (confirmar se quiser depois)

- Exportar pagamentos em PDF/CSV.
- Comprovante automático no WhatsApp do colaborador ao marcar como pago.
- Cálculo de horas trabalhadas (entrada/saída).
