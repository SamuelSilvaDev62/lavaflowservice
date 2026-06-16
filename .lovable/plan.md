## Plano de Otimização e PWA — LavaFlow

Auditei o projeto e identifiquei os principais gargalos. O plano abaixo agrupa correções por impacto/esforço, mantendo o comportamento atual do app (sem mudar regras de negócio).

---

### 1. Bundle inicial menor (carrega mais rápido em 4G)

- **Lazy load de `recharts`** no `dashboard.tsx` e `relatorios.tsx` via `React.lazy` + `<Suspense>`. Reduz ~150 KB do bundle inicial.
- **Lazy load de `react-markdown`** no assistente (carrega só ao abrir a página).
- **Lazy load de `qrcode`** no `qr-code-dialog.tsx` (carrega só ao abrir o diálogo).
- **Lazy load do `guided-tour`** (driver.js) — só quando o usuário clica em "iniciar tour".
- **Google Fonts otimizado** no `__root.tsx`: usar `preconnect` + `display=swap` (já existe `swap`, falta `preconnect` para `fonts.gstatic.com`).

### 2. Eliminar cascata de loading (HTML → JS → fetch → spinner)

- Adicionar **`loader` + `ensureQueryData`** nas rotas autenticadas principais: `dashboard`, `fila`, `clientes/index`, `assinaturas`, `oportunidades`, `relatorios`. Dispara o fetch em paralelo com o JS, eliminando o spinner inicial.
- Mover **check de role do `AppLayout`** (hoje `useEffect` direto) para `useQuery` cacheado, evitando refetch a cada navegação.
- Configurar **`defaultPreload: 'intent'`** no router para prefetch ao passar o mouse / focar links.
- Adicionar **skeletons estruturais** (não spinners) nas rotas mais visitadas.

### 3. Queries de banco mais rápidas

- **Índices Postgres** (migração SQL):
  - `ordens_servico (owner_id, created_at DESC)` — usado em dashboard, relatórios, oportunidades, clientes inativos.
  - `ordens_servico (owner_id, status)` — usado no kanban da fila.
  - `clientes (owner_id, ultima_visita)` — usado em clientes inativos.
- **Limites e colunas explícitas** em queries que hoje fazem `select("*")` sem `.limit()`:
  - `getClienteInativos`, `getOportunidades`, `getDashboardMetrics`, `listClientes`, `getRelatorios`: restringir janela (ex. últimos 90 dias já filtrado) e selecionar apenas colunas necessárias.
- **`staleTime` por rota**: `fila` recebe `staleTime: 0` + `refetchInterval: 15s`; demais ficam em 60s (atual).

### 4. PWA instalável (Add to Home Screen + cache offline básico)

Usar `vite-plugin-pwa` com `generateSW` seguindo as regras de skill PWA do projeto:

- `public/manifest.webmanifest` com nome "LavaFlow", `display: standalone`, `theme_color` alinhado ao tema, ícones 192/512 + maskable.
- Ícones PWA gerados a partir da identidade visual atual (verde/escuro), salvos em `public/icons/`.
- Tags no `__root.tsx`: `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`.
- Service Worker via `vite-plugin-pwa`:
  - `registerType: 'autoUpdate'`, `injectRegister: null`, `devOptions.enabled: false`.
  - Navegação HTML: `NetworkFirst` (nunca cache-first).
  - Assets hashados: `CacheFirst`.
  - Excluir `/api/*` e `/~oauth` do cache.
- Wrapper de registro `src/pwa/register-sw.ts` que **só registra em produção** e **nunca em preview Lovable / iframe / `?sw=off`** (cumpre a regra obrigatória do skill).
- Resultado: o app fica instalável no celular (ícone na home), abre como app standalone e mostra shell mesmo offline.

### 5. Mobile UX

- Garantir `TouchSensor` no `@dnd-kit` da fila (drag funcional em touch sem long-press atrapalhar scroll).
- Skeletons em vez de telas brancas durante o fetch inicial.
- `theme-color` correto para a status bar do mobile.

---

### Arquivos afetados

**Criados:**
- `vite-plugin-pwa` adicionado ao `vite.config.ts`
- `public/manifest.webmanifest`
- `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- `src/pwa/register-sw.ts`
- `src/components/ui/skeleton-*.tsx` (skeletons de dashboard/fila/lista)
- `supabase/migrations/<ts>_perf_indices.sql`

**Editados:**
- `src/router.tsx` (defaultPreload + preserva client por request)
- `src/routes/__root.tsx` (manifest, theme-color, apple-touch-icon, preconnect fonts, registro SW)
- `src/routes/_authenticated/{dashboard,fila,clientes/index,assinaturas,oportunidades,relatorios}.tsx` (loaders + ensureQueryData + lazy charts + skeletons)
- `src/routes/_authenticated/assistente.tsx` (react-markdown lazy)
- `src/components/qr-code-dialog.tsx` (qrcode lazy)
- `src/components/app-layout.tsx` (role via useQuery)
- `src/components/guided-tour.tsx` (driver.js lazy)
- `src/lib/lavaflow.functions.ts` (limites + colunas explícitas nas queries pesadas)
- `package.json` (`vite-plugin-pwa` + `workbox-window`)

---

### Detalhes técnicos

- O `vite-plugin-pwa` é compatível com o template `@lovable.dev/vite-tanstack-config` (apenas adicionar ao array `vite.plugins` via override).
- O Service Worker **não** registra em `id-preview--*.lovable.app` nem em iframe (regra obrigatória do skill PWA), só na URL publicada.
- Os índices Postgres são criados via migração padrão (`CREATE INDEX`, não `CONCURRENTLY`, pois roda dentro de transação).
- Nenhuma mudança de schema de dados ou regra de negócio — apenas índices, limites de query e estrutura de loading.

---

### Ganho esperado

- **Bundle inicial:** ~−40% (lazy de recharts/markdown/qrcode/driver).
- **Primeiro render do dashboard:** ~−1s (loader + ensureQueryData elimina cascata).
- **Queries do dashboard/fila:** −50 a −300 ms (índices compostos).
- **Mobile:** instalável como app, abre instantâneo nas próximas visitas, shell funciona offline.

Posso executar tudo de uma vez ou prefere dividir em etapas (ex.: primeiro PWA + bundle, depois loaders + índices)?