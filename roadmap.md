# Ordens de Serviço
- [ ] Implementar consulta paginada e métricas reais sem alterar listOrdens.
- [ ] Reformular /ordens, preservar criação, status e upsell.
- [ ] Verificar regras, interface autenticada desktop/mobile, erros e commit.

# Segurança — piloto Founders
- [ ] Portal por e-mail: OTP, prova de identidade e histórico isolado; depende de remetente configurado.
- [ ] Revisar/aplicar conversão atômica agendamento → OS, integrar RPC e testar concorrência/rollback.
- [ ] Limites atômicos em PostgreSQL; aguarda confirmação da solução específica solicitada.