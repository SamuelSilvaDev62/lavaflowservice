# Evolução do Programa de Fidelidade

Transformar cada mensagem de "veículo pronto" em uma ferramenta de retenção, mostrando pontos ganhos, saldo, recompensas disponíveis e próximo benefício.

## 1. Nova função `buildReadyVehicleMessage()`

Local: `src/lib/fidelidade-messages.ts` (novo, client-safe).

Recebe:
- `cliente` (nome, pontos_saldo, total_visitas)
- `ordem` (serviço, valor)
- `config` (pontos_por_lavagem, pontos_por_real)
- `recompensas` (lista ativa ordenada por custo)
- `templates` personalizados (opcional, do localStorage)

Calcula:
- `pontos_ganhos` = `pontos_por_lavagem + floor(valor * pontos_por_real)`
- `saldo_novo` = `pontos_saldo + pontos_ganhos`
- `recompensa_disponivel` = maior recompensa com `custo_pontos <= saldo_novo`
- `proxima_recompensa` = menor recompensa com `custo_pontos > saldo_novo`
- `pontos_faltantes` = `proxima.custo_pontos - saldo_novo`
- VIP se `total_visitas >= 10` OU `saldo_novo >= 1000` (configurável)

Retorna 1 de 3 mensagens (cenário 1, 2 ou VIP) usando placeholders:
`{nome}`, `{servico}`, `{valor}`, `{pontos_ganhos}`, `{saldo_atual}`, `{proxima_recompensa}`, `{pontos_faltantes}`, `{recompensa_disponivel}`.

## 2. Integração no fluxo "Pronto"

Na tela de Ordens / Fila / Kanban, ao mover OS para `pronto` e clicar em "Avisar no WhatsApp":
- Buscar dados necessários via novo server fn `getDadosMensagemPronto({ ordemId })` que retorna cliente, ordem, config, recompensas.
- Gerar mensagem com `buildReadyVehicleMessage()`.
- Abrir `waLink(telefone, mensagem)`.

Substitui o template estático `pronto_para_retirada` atual.

## 3. Botão "Enviar Extrato de Fidelidade" no perfil do cliente

Local: `src/routes/_authenticated/clientes/$id.tsx`.

- Novo server fn `getExtratoFidelidade({ clienteId })` → saldo, últimos 5 `pontos_movimentos` (com nome do serviço via join em ordens_servico+servicos), recompensas elegíveis.
- Função `buildExtratoMessage()` em `fidelidade-messages.ts`.
- Botão abre WhatsApp com a mensagem.

## 4. Dashboard — Card "Clientes com recompensa disponível"

- Novo server fn `getClientesComRecompensa()` → conta clientes cujo `pontos_saldo >= min(recompensas.custo_pontos)`, retorna `{ qtd, clientes: [...] }`.
- Card no dashboard com botão "Ver clientes" → navega para `/clientes?filtro=recompensa_disponivel`.
- Suporte ao filtro na rota `clientes/index.tsx`.

## 5. Oportunidades — Nova oportunidade

Em `oportunidades.tsx`, adicionar item:
- "X clientes possuem recompensas disponíveis e ainda não resgataram"
- Valor potencial = `qtd * ticket_medio` (ticket médio do owner, já calculado nos relatórios; senão fallback R$ 80)
- Reusa `getClientesComRecompensa()`.

## 6. Assistente — Novas ferramentas/insights

Em `src/routes/api/assistente-chat.ts`, adicionar 2 tools:
- `clientes_proximos_recompensa` (faltam ≤ 50 pts)
- `clientes_com_recompensa_disponivel`

E expor no system prompt o insight "clientes que usam fidelidade retornam mais" como fato estático.

## 7. Configurações — Templates personalizáveis

Em `configuracoes.tsx`, nova seção "Mensagens de Fidelidade":
- 4 textareas: mensagem cenário 1, cenário 2, VIP, extrato.
- Salvas via `setTemplate()` em `lib/whatsapp.ts` (novas chaves: `fidelidade_pronto_padrao`, `fidelidade_pronto_disponivel`, `fidelidade_pronto_vip`, `fidelidade_extrato`).
- Lista de placeholders disponíveis exibida acima dos campos.
- Botão "Restaurar padrão" por mensagem.

## Arquivos

Novos:
- `src/lib/fidelidade-messages.ts` — funções de build + defaults
- (opcional) helper de cálculo de pontos compartilhado

Editados:
- `src/lib/lavaflow.functions.ts` — `getDadosMensagemPronto`, `getExtratoFidelidade`, `getClientesComRecompensa`
- `src/lib/whatsapp.ts` — novas chaves de template
- `src/routes/_authenticated/ordens.tsx` (ou onde está o botão "Avisar pronto" hoje) — usar nova msg
- `src/routes/_authenticated/fila.tsx` — idem
- `src/routes/_authenticated/clientes/$id.tsx` — botão extrato
- `src/routes/_authenticated/clientes/index.tsx` — filtro `recompensa_disponivel`
- `src/routes/_authenticated/dashboard.tsx` — card
- `src/routes/_authenticated/oportunidades.tsx` — nova oportunidade
- `src/routes/_authenticated/configuracoes.tsx` — seção de templates
- `src/routes/api/assistente-chat.ts` — novas tools

## Fora do escopo

- Não altera triggers de crédito de pontos (já funciona).
- Não cria novas tabelas — usa `clientes`, `recompensas`, `fidelidade_config`, `pontos_movimentos` existentes.
- Não envia WhatsApp automaticamente — continua sendo "abrir wa.me" manual.

## Pergunta antes de implementar

Critério VIP padrão: **10+ visitas ou 1000+ pontos**. Quer ajustar esses valores ou deixo como configurável depois?
