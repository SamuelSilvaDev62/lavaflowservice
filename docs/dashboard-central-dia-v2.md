# Central do Dia 2.0 — Visual + confiabilidade

## Arquivos principais
- `src/components/dashboard/dashboard.tsx`: composição executiva, KPIs, alertas e estados da consulta.
- `src/components/dashboard/dashboard-kpi-card.tsx`: quatro KPIs claros e responsivos.
- `src/components/dashboard/today-agenda-card.tsx`: próximos cinco agendamentos, rótulos de status e responsáveis.
- `src/components/dashboard/operation-status-card.tsx`: quatro estados de OS com totais completos.
- `src/components/dashboard/morning-brief-card.tsx`: inteligência Growth compacta com até três prioridades.
- `src/components/dashboard/growth-engine-card.tsx`: oportunidades contextualizadas.
- `src/lib/dashboard-metrics.ts`: contagem sem truncamento e previsão exclusivamente de reservas ativas.
- `src/lib/lavaflow.functions.ts`: consulta autenticada, isolamento por `owner_id` preservado.

## Indicadores e definições
- **Agendamentos:** reservas ativas para o dia local.
- **Previsão da agenda:** total dos serviços e taxas das reservas ativas, **não** dinheiro recebido.
- **Em atendimento:** soma das OS em lavagem ou em finalização.
- **Horários disponíveis:** vagas ainda ofertáveis segundo a configuração da agenda, ou zero quando fechado.
- **Operação ao vivo:** contagem completa de `aguardando`, `em_lavagem`, `finalizacao` e `pronto`, baseada nas OS abertas sem usar o recorte de seis veículos.
- **Alertas:** apenas aqueles retornados pelo servidor.
- **Oportunidades:** comportamento Free/Growth e cálculos existentes preservados.

**Atenção:** Previsão e receita de OS não são somadas entre si. Um agendamento pode gerar uma OS, o que resultaria em contagem dupla. No futuro, se existir ligação transacional entre OS e reserva, uma previsão combinada poderá ser implementada com deduplicação explícita.

## Checklist manual em ambiente de teste
- [ ] Verificar a experiência em 360 px, 390 px, 768 px e desktop.
- [ ] Conferir navegação por teclado e contraste.
- [ ] Criar duas empresas fictícias com volumes distintos; confirmar isolamento.
- [ ] Testar 0, 1, 5 e mais de 6 OS abertas; totais devem coincidir com a fila.
- [ ] Testar agendamentos confirmados, atrasados e sem responsável.
- [ ] Conferir a previsão de receita quando reserva já tem OS relacionada.
- [ ] Testar Free vs Growth e falhas de conectividade.
- [ ] Confirmar atualização automática a cada 60 s sem dados fictícios.
- [ ] Validar os botões (agendamento, cliente, fila e oportunidades).

Nenhuma migração de banco, cobrança ou alteração de permissões nesta PR.
