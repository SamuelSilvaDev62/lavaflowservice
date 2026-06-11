## Plano de melhorias do LavaFlow

Dividi em 4 frentes priorizadas por impacto. Cada item pode ser executado de forma isolada — confirme quais quer que eu implemente (todas ou um subconjunto).

---

### 1. Segurança (CRÍTICO — fazer primeiro)

**1.1. Bloquear escalada de privilégio em `user_roles`** (finding `error`)
Hoje qualquer usuário autenticado pode inserir `(user_id=auth.uid(), owner_id=auth.uid(), role='owner')` e virar owner. Vou:
- `REVOKE INSERT/UPDATE/DELETE ON public.user_roles FROM authenticated`
- Manter apenas `SELECT` ao usuário sobre os próprios registros
- Toda criação de roles passa exclusivamente pelos triggers (`tg_bootstrap_new_user`) e RPC `vincular_colaborador` (SECURITY DEFINER já existente)
- Remover policies de INSERT/UPDATE/DELETE atualmente abertas em `user_roles`

**1.2. Endurecer `agendamentos` para colaboradores**
- Trocar policy de INSERT para usar `current_owner_id()` em vez de `auth.uid() = owner_id` (paridade com UPDATE), eliminando a assimetria que o scanner apontou.

**1.3. Linter — funções SECURITY DEFINER expostas**
11 warnings do linter. Vou revisar caso a caso:
- `get_agenda_config_publica`, `get_servicos_publicos`, `get_empresa_by_slug`, `get_ocupacao_dia` — devem permanecer chamáveis por `anon` (página pública `/agendar/$slug` depende delas). Mantenho com `GRANT EXECUTE ... TO anon` explícito e documento o motivo.
- `has_role`, `current_owner_id`, `tg_*` — `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`; só são usadas internamente em policies/triggers.
- `vincular_colaborador` — manter `EXECUTE TO authenticated` (já valida `has_role(owner)` internamente).

**1.4. `iniciarOs` / `finalizarOs` sem checagem de owner**
Hoje `update(...).eq("id", data.id)` sem `.eq("owner_id", ...)` — RLS protege, mas a server fn deveria validar escopo via `getOwnerScope()`. Vou adicionar o filtro explícito para evitar erros mascarados.

---

### 2. Performance

**2.1. Índices faltantes** (gargalos óbvios em `ordens_servico` filtrado por `owner_id + created_at` em quase todo dashboard)
```sql
CREATE INDEX IF NOT EXISTS idx_os_owner_created ON ordens_servico(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_owner_status ON ordens_servico(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_os_cliente ON ordens_servico(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_funcionario ON ordens_servico(funcionario_id) WHERE funcionario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_owner_data ON agendamentos(owner_id, data_agendada);
CREATE INDEX IF NOT EXISTS idx_interacoes_owner_tipo ON interacoes_clientes(owner_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
```

**2.2. Dashboard — agregar no banco em vez de no Node**
`getDashboardMetrics` puxa todas as OS dos últimos 90d e itera em JS. Para owner com volume, vira lento. Criar uma RPC `get_dashboard_metrics(_owner uuid)` que faz GROUP BY no Postgres e retorna JSON pronto. Reduz payload e latência (~5–10×).

**2.3. Query cache no cliente**
`router.tsx` usa `staleTime: 30s` para tudo. Subir para `60s` no dashboard/relatórios (dados não mudam segundo a segundo) e manter `30s` na fila. `defaultPreloadStaleTime: 0` já está correto.

**2.4. Code-splitting de recharts**
Recharts pesa ~100kb gzip. Lazy-import dentro de `relatorios.tsx` e `dashboard.tsx` com `React.lazy` — corta tempo inicial das outras rotas.

**2.5. `getOportunidades` e `listClientes` fazem N varreduras em JS**
Mover para uma view materializada `mv_cliente_stats(owner_id, cliente_id, ultima_visita, visitas_90d, total_90d)` refrescada por trigger leve. Opcional — só vale a pena se o usuário tiver >500 clientes.

---

### 3. Bugs e rotas

**3.1. `interacoes_clientes` — coluna `descricao` pode não existir**
Verificar schema; se for `mensagem` ou outro nome, `logWhatsappEnvio` quebra silenciosamente. Vou conferir e ajustar.

**3.2. `_authenticated/route.tsx` faz query extra a cada navegação**
O `beforeLoad` consulta `user_roles` em toda transição. Cachear no router context (uma vez por sessão) com invalidação no `SIGNED_IN/OUT`.

**3.3. Rota inexistente: `meu-trabalho` para colaborador**
O guard redireciona, mas não vi confirmação de que `getMeuTrabalho` lida com colaborador sem `funcionarios.auth_user_id` vinculado — pode dar tela em branco. Adicionar empty-state.

**3.4. `tg_os_entregue_credita_pontos` muta `NEW` em AFTER UPDATE**
Atribuição a `NEW.entregue_em` em trigger AFTER não tem efeito. Mover para BEFORE UPDATE ou remover a linha.

**3.5. Não há `404` para `/agendar/$slug` inválido**
A rota assume slug existe; adicionar `notFoundComponent` e `errorComponent`.

**3.6. `vite.config.ts` / SSR**
Tudo OK — sem mudanças.

---

### 4. Assistente mais inteligente (IA conversacional)

Hoje `/assistente` mostra 3–4 insights estáticos calculados em JS. Vou transformá-lo em chat com IA real usando **Lovable AI Gateway** (`LOVABLE_API_KEY` já configurado, custo zero para Gemini Flash gratuito).

**4.1. Backend: `chatAssistente` server route streaming**
- Nova rota `src/routes/api/assistente-chat.ts` com `streamText` da AI SDK + provider Lovable AI (`google/gemini-2.5-flash`).
- System prompt com contexto do negócio: nome da empresa, MRR, ticket médio, clientes inativos, top serviços, fila atual.
- Tool calling para a IA puxar dados quando o usuário perguntar:
  - `getClientesInativos(dias)`
  - `getReceitaPorPeriodo(de, ate)`
  - `getTopClientes(limit)`
  - `enviarWhatsApp(cliente_id, mensagem)` (com confirmação do usuário)
  - `criarOportunidade(cliente_id, tipo)`

**4.2. UI: `/assistente` redesenhada**
- Chat full-screen estilo ChatGPT: input fixo embaixo, mensagens com markdown (`react-markdown`).
- Sugestões rápidas no topo: "Quais clientes devo chamar hoje?", "Qual meu melhor dia da semana?", "Crie mensagem WhatsApp para inativos".
- Cards de insights atuais viram **mensagem de boas-vindas** no chat.
- Histórico salvo em nova tabela `assistente_conversas(owner_id, messages jsonb, created_at)` com RLS.

**4.3. Insights proativos automáticos**
- Cron diário (pg_cron) às 8h gera 1 insight novo via IA e insere em `assistente_insights`. Aparece como notificação no app.
- Tipos: "5 clientes próximos de virar inativos esta semana", "Domingo está crescendo 20%", etc.

**4.4. Ações executáveis direto do chat**
Quando a IA sugerir uma ação (ex: "enviar promo para 8 clientes inativos"), renderizar um botão "Executar" que dispara `logWhatsappEnvio` em batch + abre links wa.me em sequência.

---

### Sequência de execução sugerida

1. **Segurança** (migração SQL) — 1 commit
2. **Performance — índices + RPC dashboard** — 1 commit
3. **Bugs de rota e trigger** — 1 commit
4. **Assistente IA (chat + tools)** — 2 commits (backend, frontend)
5. **Insights proativos com cron** — opcional, último

---

### Notas técnicas
- Todas as migrações respeitam o padrão `GRANT` → `ENABLE RLS` → `POLICY`.
- Lovable AI Gateway elimina necessidade de secret de OpenAI/Anthropic.
- Streaming via `result.toUIMessageStreamResponse()` da AI SDK v5.
- `react-markdown` + `remark-gfm` já compatíveis com bundler atual.
- Nenhuma mudança em `src/integrations/supabase/*` auto-gerados.

### Pergunta antes de implementar
Quer que eu execute **tudo** em sequência (etapas 1→5), ou prefere começar só por **Segurança + Performance** e avaliar o Assistente IA depois?
