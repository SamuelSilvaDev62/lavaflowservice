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