# Conta de demonstração permanente
- [x] Preparar identificação protegida de demo, acesso Growth permanente e bloqueio de cobrança.
- [x] Preparar fonte de tenants reais para futuros indicadores administrativos e bloqueio para futuros disparos automáticos (hoje só existem ações manuais).
- [x] Testar acesso Growth, RLS, classificação privilegiada, bloqueios e exclusão de métricas em banco descartável.
- [ ] Liberar exclusivamente o cadastro confirmado e verificar Presença Digital nessa sessão; aguarda e-mail, pois existem dois estabelecimentos LavaFlow Demo.

# Integração clientes ↔ agendamentos
- [x] Reutilizar cadastro rápido, selecionar cliente e preservar reserva no cadastro/cancelamento.
- [x] Conectar Salvar e agendar à reserva com cliente pré-selecionado.
- [x] Verificar duplicidades, concorrência, permissões e ambos os fluxos com dados sintéticos.

# Presença Digital
- [x] Persistir checklist e referências por tenant, sem conexão externa simulada.
- [x] Reaproveitar contexto comercial, integrar geração ao Consultor e convites neutros de avaliação.
- [x] Rastrear origem Google nos links públicos e medir reservas/OS vinculadas.
- [ ] Verificar a tela com uma conta Growth de teste; a conta disponível é Free e mostra corretamente o bloqueio.

# Ordens de Serviço
- [x] Implementar consulta paginada e métricas reais sem alterar listOrdens.
- [x] Reformular /ordens, preservar criação, status e upsell.
- [x] Verificar regras e interface autenticada desktop/mobile; corrigir relações ambíguas dos colaboradores.

# Segurança — piloto Founders
- [ ] Portal por e-mail: usar cadastro existente, sem perfil adicional; OTP e histórico dependem de domínio remetente configurado. Consulta por telefone permanece bloqueada.
- [x] Revisar/aplicar conversão atômica agendamento → OS, integrar RPC; 14 testes de concorrência/rollback/RBAC e repetição autenticada sem escrita de registros existentes passaram.
- [x] Implementar limites atômicos em PostgreSQL para agendamento público, PIN e assistente; validar 429 real no PIN e concorrência em banco descartável.
- [ ] Aplicar política de limites ao OTP quando o envio de e-mail estiver disponível.
- [ ] Ativar limites por IP somente após confirmação verificável de que o proxy sobrescreve o header de origem; identidade, tenant e limite global já ativos.