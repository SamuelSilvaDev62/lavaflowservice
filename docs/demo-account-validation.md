# LavaFlow Demo — implementação e validação

## Implementado
- Classificação `tenant_subscriptions.is_demo`, inicialmente falsa para todos, protegida por permissões existentes e trigger contra alterações não privilegiadas.
- Growth integral permanente quando a classificação é verdadeira, incluindo o gate de Oportunidades/Presença Digital; não depende de trial, carência, pagamento ou data de expiração.
- Identificação “Growth · Demonstração” e status “Demonstração permanente · sem cobrança” no plano atual.
- Checkout e portal bloqueados no servidor para demo, antes de requisições à Stripe. Nenhum objeto Stripe foi criado ou alterado.
- Fonte `admin_real_tenants`, exclusiva de operações privilegiadas, para excluir demo de futuros agregados de clientes reais, faturamento, retenção e utilização. O LavaFlow Admin com esses agregados ainda não existe neste código; sua futura implementação deve usar essa fonte, conforme AGENTS.md.
- Os fluxos existentes aceitam dados fictícios sob as mesmas validações, isolamento, RBAC e RLS. Nenhum dado fictício foi inserido na base conectada.
- Consentimento para IA e controles de consumo/rate limit não foram alterados.
- Hoje não há provedor, fila ou rotina de disparo automático de WhatsApp/e-mail no aplicativo; existem apenas links manuais. A proteção server-side `assertAutomaticMessagingAllowed` está pronta e é obrigatória para qualquer integração automática futura; rejeita demo e falhas de consulta. Links manuais continuam sob responsabilidade de quem testa e não equivalem a envio automático.

## Banco
- Aplicada `drizzle/migrations/0006_permanent_demo_tenant_policy.sql`.
- Conferidos na base conectada: coluna com default false, trigger ativo, RLS de leitura por owner preservada e zero tenants classificados como demo.
- Nenhum plano de estabelecimento foi alterado. Não há liberação automática por nome/e-mail de cadastro.

## Verificações
- 18 testes unitários/regressão aprovados: regras de demo, entitlement, Presença Digital e limites de acesso/IA.
- 3 testes de PostgreSQL descartável aprovados: leitura por tenant, impossibilidade de autoatribuição mesmo com grant/policy de UPDATE acidental, e exclusão de métricas de clientes/receita/retenção/utilização.
- Verificação automática da prévia: build OK.
- Lint dos novos arquivos TypeScript/JavaScript passou; lint completo dos arquivos legados envolvidos ainda apresenta avisos de formatação e dois usos preexistentes de `any` em entitlements.server.ts.
- Não foram consumidos créditos de IA nem enviadas mensagens. Não houve publicação.

## Pendente de identificação
Foram encontrados dois estabelecimentos com o nome LavaFlow Demo. Aguardar o e-mail de cadastro informado pelo proprietário; cruzar com o usuário proprietário e empresa antes de uma atualização privilegiada, limitada ao owner UUID confirmado. Recusar casos ambíguos ou com assinatura Stripe existente sem nova revisão. Só depois conferir o plano atual e a tela de Presença Digital em sessão autenticada da conta correta. A liberação e essa verificação ainda não foram feitas.