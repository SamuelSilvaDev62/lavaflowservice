# Validacao do Consultor LavaFlow IA

Checklist para validar a integracao depois de aplicar as migrations e instalar dependencias:

1. Usuario sem login
   - Chamar `GET /api/assistente-chat` sem header `Authorization`.
   - Esperado: HTTP 401.

2. Isolamento por owner
   - Entrar com usuario de outro `owner_id` e chamar `GET /api/assistente-chat`.
   - Esperado: contexto montado apenas com linhas acessiveis via RLS/current owner; nenhum dado de outro tenant.

3. Dados sensiveis
   - Perguntar no chat "quais clientes devo chamar hoje?".
   - Esperado: ferramentas retornam nome, dias sem voltar, gasto e pontos, sem telefone completo.

4. Fallback de IA
   - Remover `OPENAI_API_KEY` ou configurar valor invalido.
   - Esperado: rota GET retorna `fallbackNotice` e recomendacoes baseadas em regras.

5. Rate limit
   - Inserir 30 linhas em `ai_usage_logs` para o mesmo `owner_id` na ultima hora.
   - Esperado: proxima chamada retorna HTTP 429 com a mensagem amigavel de limite temporario.

6. Segredo OpenAI
   - Procurar `OPENAI_API_KEY` no bundle frontend e nas respostas HTTP.
   - Esperado: chave nunca aparece; ela e lida apenas em `src/lib/ai/openai.ts` no servidor.

7. Logs de recomendacao
   - Chamar `GET /api/assistente-chat` autenticado.
   - Esperado: recomendações retornadas sao gravadas em `ai_recommendations` com status `nova`.

8. Frontend
   - Abrir `/assistente`.
   - Esperado: resumo do dia, cards de oportunidade, plano semanal, mensagens editaveis de WhatsApp e chat livre aparecem sem sobreposicao em desktop e mobile.
