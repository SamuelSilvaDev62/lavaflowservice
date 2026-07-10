## B.4 — Central do Dia (definitivo) + redesenho da tela do colaborador

Duas frentes independentes: (1) fechar o dashboard como "Central do Dia" com cálculos reais de ticket médio, capacidade e potencial; (2) trocar o layout de `/meu-trabalho` pelo mockup HTML enviado, mantendo dados e ações reais do backend.

---

### 1) Central do Dia — backend

Editar `getDashboardOperacional` em `src/lib/lavaflow.functions.ts`:

- Ler em paralelo (além do que já lê hoje):
  - `ordens_servico` dos últimos 30 dias com `status = 'entregue'` → `ticketMedio = média(valor)`, fallback R$ 50 quando não houver dados.
  - `agenda_config` do `ownerId` → derivar `capacidadeDia` do dia da semana atual (`hora_inicio`, `hora_fim`, `intervalo_min`, `capacidade_simultanea`, `dias_semana`). Se não configurado, fallback 8.
- Calcular:
  - `agendadosAtivos` = agendamentos ativos hoje (já derivado).
  - `horariosLivres = max(0, capacidadeDia - agendadosAtivos)`.
  - `potencialFaturamento = horariosLivres * ticketMedio`.
- Adicionar ao retorno em `cards`: `ticketMedio`, `capacidadeDia`, `horariosLivres`, `potencialFaturamento`.
- Remover o bloco morto de `clientesInativos = 0 / ticketMedio = 0` (nunca dispara).

### 2) Central do Dia — frontend

`src/components/dashboard/dashboard.tsx`, ordem fixa:

1. **Oportunidade de hoje** (card hero, gradiente primário): `horariosLivres` livres × `ticketMedio` = **`potencialFaturamento`**. CTA "Preencher agenda" → `/agendamentos`. Se `horariosLivres === 0` → "Agenda cheia hoje 🎉".
2. **Agenda do dia** (já existe, manter estilo, máximo 5 itens, "Ver agenda completa").
3. **Mini kanban 2×2** (já existe).
4. **Reativação em buckets** — consumir `getClienteInativos({dias: 30})` e agrupar em `+30 / +60 / +90` dias (contadores). Nada de lista com "999 dias". CTA "Reativar clientes" → `/clientes/inativos`.
5. **Ações rápidas** — já no `PageHeader.actions` (Agendamento / Cliente).

Remover o card "Insights do dia" atual (mistura oportunidade + reativação de forma desordenada).

### 3) Tela do colaborador — redesenho conforme HTML anexado

Reescrever `src/routes/_authenticated/meu-trabalho.tsx` seguindo o mockup, sem inventar dados novos:

- **Header escuro** (gradiente navy) com avatar (iniciais do nome do funcionário), nome, papel ("Lavador · Turno da manhã" — usar `funcionario.cargo` se existir, senão "Colaborador"), botão "Sair" (signOut). Strip com ponto pulsante e "Turno ativo desde HH:MM" — usar a hora do primeiro `iniciado_em` do dia ou a hora de login (fallback: hora atual da montagem).
- **Stat strip** compacta (4 colunas): `Atribuídos` (fila total), `Em serviço` (`em_lavagem`), `Concluídos` (hoje), `Próximo` (hora do próximo agendamento atribuído ou "Livre"). Substitui os 4 MetricCards atuais.
- **Job card hero** para a OS ativa (primeira `em_lavagem`, se não houver, primeira `aguardando`):
  - Topo: "Cliente · Nome" + título do serviço, badge de status com pulso.
  - **Flow timer** (faixa navy com pipes animados): "Tempo em atendimento" com minutos desde `iniciado_em` (se `aguardando`, mostrar "Aguardando início"). Chip "✓ Checklist ok" estático por enquanto.
  - Meta: "Iniciado às HH:MM · Veículo: modelo cor".
  - **Upsell** (banner dourado) — versão estática institucional ("Ofereça serviços adicionais ao cliente"), sem IA. Botão desabilitado ou ocultável em v1 — confirmar comportamento.
  - **Ações**: primário "▶ Continuar atendimento" (scrolla/foca card) quando `em_lavagem`, ou "▶ Iniciar" quando `aguardando`; linha secundária: "Avisar recepção" (v1: toast "Recepção notificada") + "Finalizar" (mutação existente `finalizarOs`).
- **Lista abaixo** dos outros veículos da fila (formato compacto como cards menores, sem hero). Reaproveita `iniciarOs`/`finalizarOs`.
- **Rodapé demoted**: "⇄ Trocar colaborador" (link para `/auth` ou signOut — confirmar).

Tokens: usar cores do mockup como classes tailwind arbitrárias apenas dentro deste arquivo (navy `#0E2E33`, teal `#1E8A8C`, flow-blue `#2F6FED`, foam `#F4FAF9`, gold `#DE9C2C`). Não promover a tokens globais nesta rodada.

### Fora de escopo

- Sem migrações novas.
- Sem alterar `getMeuTrabalho` (o payload atual já entrega `funcionario`, `fila`, `cards`).
- Sem IA, sem OpenSquad, sem sugestão dinâmica no upsell.
- Sem mexer nas outras rotas (fila, clientes, etc.) — isso são ondas B.5/B.6.

### Perguntas rápidas

1. O botão **"Avisar recepção"** existe como fluxo real? (v1 sugiro apenas um toast; depois viraria notificação.)
2. **"Trocar colaborador"** deve fazer signOut ou abrir um seletor rápido de usuário?
3. Upsell na v1: **ocultar** ou **mostrar mensagem estática** ("Ofereça enceramento/higienização") sem CTA funcional?
