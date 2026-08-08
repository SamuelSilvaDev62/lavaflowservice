# Rodada final de estabilização — auditoria e plano

Sem novas funcionalidades. Três frentes: remover o fluxo de colaborador, corrigir o "só carrega no refresh" e cortar trabalho redundante no bootstrap.

## 1) Auditoria técnica curta

**Fluxo de colaborador (a remover)**
- `src/routes/_authenticated/meu-trabalho.tsx` — única tela do fluxo; único consumidor de `getMeuTrabalho`, `iniciarOs`, `finalizarOs` (confirmado por busca: nenhum outro arquivo importa essas fns).
- `src/routes/_authenticated/route.tsx`:12-21 — consulta extra em `user_roles` a cada navegação só para decidir `isColab` e redirecionar para `/meu-trabalho`.
- `src/components/app-layout.tsx` — item "Meu Trabalho" na sidebar e na bottom-tab, `colabGroups`, flag `colab` usada em 6 pontos (logo, sidebar, bottom-tab, WelcomeModal, GuidedTour, OperationalAlerts).
- `src/lib/rbac.ts` — `COLABORADORES`, `isColaborador()` (usados só pelo layout/gate).

**Fluxo PIN de quiosque (separado, NÃO é o mesmo código)**
- `/modo-equipe` + `/equipe/$slug` usam `equipeIniciarAtendimento`, `equipeFinalizarAtendimento`, `equipe*ChecklistInicial`, `autenticarEquipePin`, sessão própria em `equipe_sessoes` — sem sessão Supabase. `src/routes/_authenticated/equipe.tsx`:137 gera o link `/equipe/{slug}` e `src/routes/lp.tsx` menciona o modo. É um fluxo à parte do "Meu Trabalho" (ver Perguntas).

**Bootstrap autenticado hoje (cold start em `/`)**
```text
/  index.tsx  useEffect → auth.getUser()            (rede)
   → navigate /dashboard
   → _authenticated beforeLoad → auth.getUser()     (rede, de novo)
                               → select user_roles  (rede)
   → AppLayout → useRole() → getCurrentUserRole     (server fn + rede)
   → dashboard → queries de dados
```
Quatro idas e voltas de auth/role em série antes do primeiro dado útil, duas delas redundantes. `getUser()` sempre revalida na rede; `beforeLoad` roda em cada navegação para o subtree.

**PWA**
- `vite.config.ts` gera `sw.js` com `registerType: "autoUpdate"`, `navigateFallback: "/"`, `NetworkFirst` (timeout 4s) para navegações, `CacheFirst` para JS/CSS com hash, sem `cleanupOutdatedCaches`.
- `src/pwa/register-sw.ts` registra com os guardas corretos (dev/preview/iframe/`?sw=off`), mas não trata atualização de controlador nem `sw=off` como limpeza completa.
- `public/manifest.webmanifest` tem `start_url: "/dashboard"` — rota protegida; app instalado abre direto num gate que pode redirecionar.

**Outros pontos de bootstrap**
- `src/routes/__root.tsx` `AuthListener`: `router.invalidate()` + `qc.invalidateQueries()` global em `SIGNED_IN`/`USER_UPDATED` — invalidação de tudo, inclusive no primeiro sign-in, em cima de um cache que acabou de ser preenchido.
- `src/routes/auth.tsx` faz `getUser()` no mount e usa `redirect_uri` = `origin + "/dashboard"` (rota protegida) no OAuth.

## 2) Hipóteses de causa do "não carrega na primeira abertura"

Em ordem de probabilidade:

- **H1 — Service worker servindo shell velho (mais provável).** `navigateFallback: "/"` + `CacheFirst` de assets com hash + ausência de `cleanupOutdatedCaches`: depois de um deploy, o SW pode responder a navegação com o HTML antigo precacheado, que referencia chunks que já não existem → tela branca. O refresh (ou a segunda visita, já com o SW novo ativo) funciona. Além disso `navigateFallback: "/"` é errado para este app: `/` é um gate client-only, não o shell de `/dashboard`.
- **H2 — Corrida de sessão no gate.** `_authenticated` usa `getUser()` (chamada de rede). Em rede fria/lenta, um erro transitório faz `error || !data.user` → redirect para `/auth` mesmo com sessão válida; no refresh o token já está quente e passa.
- **H3 — Cascata dupla de redirect.** `/` decide via `useEffect` (depois do render) e o gate decide de novo; qualquer falha de uma das chamadas deixa a tela no spinner de `index.tsx` sem tratamento de erro/timeout.
- **H4 — `start_url: "/dashboard"` no app instalado** entra direto na rota protegida; combinada com H1/H2, é o caminho onde a falha aparece mais.
- **H5 — Erro de SSR/hidratação silenciado.** `src/server.ts` normaliza 500 para uma página HTML de erro; um throw pré-dispatch aparece como página que "não carrega" e melhora no refresh. Verificar Server Logs antes de descartar.

H1 e H2 explicam o padrão relatado; as duas serão corrigidas.

## 3) Mudanças propostas

**A. Remoção do fluxo de colaborador**
1. Apagar `src/routes/_authenticated/meu-trabalho.tsx`.
2. Apagar `getMeuTrabalho`, `iniciarOs`, `finalizarOs` de `src/lib/lavaflow.functions.ts` (sem outros consumidores). Manter intactas todas as fns `equipe*`, comissões, pagamentos e equipe.
3. `src/routes/_authenticated/route.tsx`: remover a query em `user_roles` e o redirect para `/meu-trabalho`.
4. `src/components/app-layout.tsx`: remover o item "Meu Trabalho", `colabGroups`, a flag `colab` e os condicionais derivados (logo passa a apontar sempre `/dashboard`; WelcomeModal/GuidedTour/OperationalAlerts sempre montados).
5. `src/lib/rbac.ts`: remover `COLABORADORES` e `isColaborador`; manter `AppRole`, `ADMINS`, `GESTAO`, `OPERACIONAL`, `TODOS`, `ROLE_LABELS`, `canAny` (RBAC e RLS inalterados).
6. Zero mudanças de banco: nenhuma migração, o enum `app_role` e as policies ficam como estão.

**B. Correção do primeiro carregamento (PWA)**
7. `vite.config.ts`: `navigateFallback: null`, `cleanupOutdatedCaches: true`, manter `NetworkFirst` para navegações (sem cache de HTML como fallback de deploy) e `CacheFirst` só para assets com hash.
8. `src/pwa/register-sw.ts`: registrar com `updateViaCache: "none"`; ao detectar SW novo assumindo o controle (`controllerchange`), recarregar uma única vez (com guarda anti-loop); em contexto recusado, além de desregistrar, limpar as caches Workbox da própria app (sem tocar caches de terceiros).
9. `public/manifest.webmanifest`: `start_url` de `/dashboard` para `/` (o gate decide o destino). Observação: apps já instalados só pegam o novo `start_url` ao reinstalar.

**C. Bootstrap mais rápido e sem duplicação**
10. `src/routes/index.tsx`: decidir em `beforeLoad` (client-only) com `getSession()` (leitura local, sem rede) + `redirect()`, em vez de `useEffect` + `navigate`, eliminando um round-trip e o flash de spinner.
11. `src/routes/_authenticated/route.tsx`: usar `getSession()` para o caminho comum e só cair em `getUser()` quando não houver sessão local; devolver `user` no context. Não redirecionar em erro de rede transitório sem sessão local ausente.
12. Papel único no cache: o `beforeLoad` do subtree passa a semear `queryClient.setQueryData(["current-user-role"], …)`, ou `useRole` passa a ser a única fonte (uma chamada por sessão, `staleTime` longo). O objetivo é **uma** resolução de papel por sessão, não três leituras (select direto + RPC + refetch).
13. `src/hooks/use-role.ts`: substituir o `refetch()` no listener local por invalidação pontual da chave `current-user-role` (o listener global já existe no root; hoje há dois assinantes concorrentes de `onAuthStateChange`).
14. `src/routes/__root.tsx`: no `AuthListener`, trocar `qc.invalidateQueries()` (global) por invalidação de `current-user-role` + `router.invalidate()`; manter a limpeza no sign-out.
15. `src/routes/auth.tsx`: `redirect_uri` para `window.location.origin` (rota pública), guardando o destino pretendido e navegando depois que a sessão estiver hidratada; trocar o `getUser()` do mount por `getSession()`.
16. `src/router.tsx`: `defaultPreload: "intent"` mantido; revisar `defaultPreloadStaleTime: 0` (hoje força refetch em hover, custo extra em mobile).

Nada de mudanças em Supabase, RLS, GRANTs, papéis, comissões, equipe, agenda, OS ou clientes.

## 4) Riscos e regressões a testar

- **Órfãos de rota**: link/atalho antigo para `/meu-trabalho` passa a cair no 404 do root. Testar navegação direta e o manifest/atalhos.
- **Usuários com papel `lavador`/`colaborador`**: hoje são forçados para `/meu-trabalho`. Sem o fluxo, entram na área principal e a sidebar filtra por papel — `lavador` pode ficar com o menu vazio (nenhum grupo). Precisa de decisão (ver Perguntas) para não gerar tela sem navegação.
- **Remoção de fns**: confirmar por busca que `getMeuTrabalho`/`iniciarOs`/`finalizarOs` não são usadas por nenhuma outra tela antes de apagar; o quiosque usa as `equipe*`, que ficam.
- **SW kill-switch**: quem já tem o SW antigo instalado só melhora depois de o navegador ver o worker novo; testar 1ª visita, 2ª visita e deploy seguido de reabertura, incluindo app instalado no celular.
- **Reload no `controllerchange`**: risco de loop de recarga se a guarda estiver errada — testar com rede lenta e offline.
- **`getSession()` sem revalidação**: token expirado localmente pode passar do gate e falhar na primeira server fn (que valida o bearer). Aceitável porque a fn 401 → redirect, mas testar sessão expirada e após 1h de idle.
- **OAuth Google**: mudar o `redirect_uri` mexe no caminho de login; testar login Google no preview, no publicado e no app instalado.
- **Invalidação mais estreita**: garantir que dados continuam atualizando após troca de usuário (login A → logout → login B não deve mostrar dados de A).
- **Sem regressão administrativa**: smoke test em Painel, Agenda, Fila, OS, Clientes, Equipe (comissões, pagamento, comissão por serviço), Relatórios, Assinaturas, Campanhas, Fidelidade, Mídia, Configurações; `/modo-equipe` e `/equipe/$slug` inalterados; `tsgo` limpo.

## Ordem sugerida

1. Remoção do fluxo de colaborador (A) — isolada e reversível.
2. Correção do PWA/primeiro load (B) — validar em produção publicada.
3. Enxugamento de auth/roles/bootstrap (C) — passo a passo, com smoke test entre cada mudança.

## Perguntas

1. `/modo-equipe` + `/equipe/$slug` (acesso da equipe por PIN, sem login Supabase) deve **permanecer** — entendo que sim, é o canal operacional que sobra — ou também sai nesta rodada?
2. Para usuários com papel `lavador`: (a) manter o papel apenas para vínculo/comissões, sem acesso à área administrativa (bloqueado com mensagem), (b) dar a eles acesso somente a Fila/OS, ou (c) deixar de oferecer `lavador` como papel de login?
