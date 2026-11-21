# Regra de interação dos cards — LavaFlow

Aplica-se a novas telas e refatorações de componentes.

1. **Card com tela de destino:** a superfície principal do card deve ser um link semântico (`Link`) para essa tela, com foco visível e indicação de navegação. Não usar `div onClick` ou links aninhados.
2. **Card com informações adicionais:** mostrar só o resumo inicialmente. A superfície principal deve ser um `button` acessível que alterna detalhes, com `aria-expanded`, `aria-controls` e indicação visual. Botões dentro da área expandida ficam separados do acionador.
3. **Card informativo sem ação:** não apresentar cursor/efeitos de botão que insinuem interação.
4. **Cards de métricas:** quando houver filtro ou tela correspondente, transformar o KPI em atalho contextual; não inventar destinos ou métricas.
5. **Mobile e desktop:** manter área de toque confortável, funcionamento por teclado e nenhuma ação escondida apenas no hover.
6. **Regressão:** verificar abrir/fechar, múltiplos cards, filtros combinados e navegação ao detalhe.

## Aplicação
- Carteira de Clientes: card compacto expande produção, pontos e atalhos; o link de perfil aparece dentro do detalhe.
- Resumo de Clientes: indicadores filtram/ordenam a carteira.
- Central do Dia: KPIs abrem Agenda/Fila; mini-KPIs de operação abrem a etapa filtrada na Fila.
