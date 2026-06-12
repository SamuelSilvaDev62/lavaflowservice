## Separar a landing page em `/lp`

### O que muda

1. **Nova rota `/lp`** — recebe todo o conteúdo atual da landing (Hero, features, screenshots, pricing, FAQ, CTAs).
   - Metadados SEO (title, description, og:*) migram para esta rota.
   - Preload da imagem do dashboard também migra.
   - Canonical aponta para `/lp`.

2. **Rota `/` vira porta de entrada do app**
   - Sem UI de marketing.
   - Lógica: checar sessão Supabase.
     - Autenticado → `navigate({ to: "/dashboard", replace: true })`
     - Não autenticado → `navigate({ to: "/auth", replace: true })`
   - Enquanto checa, mostra um splash mínimo (logo + spinner) para evitar flash em branco.
   - `head()` mínimo: title "LavaFlow" + `<meta name="robots" content="noindex">` (não queremos indexar a porta de entrada vazia).

3. **Links internos atualizados**
   - Qualquer botão/link "Voltar para o site" ou logo no header das telas autenticadas que hoje vá para `/` passa a apontar para `/lp`.
   - Botões "Entrar" / "Começar agora" dentro da LP continuam indo para `/auth`.

### Arquivos afetados

- `src/routes/lp.tsx` — **novo**. Recebe o componente `Landing` e os metadados que hoje vivem em `index.tsx`. Mesma lógica de "se já logado, vai para /dashboard" continua válida lá dentro.
- `src/routes/index.tsx` — **reescrita**. Vira apenas o redirect + splash.
- Busca rápida por `to="/"` em `src/` e troca para `to="/lp"` onde o destino for marketing (logo da LP, footer, etc.). Links de logout que vão para `/auth` continuam como estão.

### Não faz parte deste plano

- Não mexer em `_authenticated/*`, server functions, RLS, ou assistente.
- Não alterar `og:image` / assets.
- Sem redirect 301 server-side de `/` → `/lp` (a raiz continua útil como porta do app).

### Observação SEO

A URL pública divulgada da marca passa a ser `/lp`. Se a LP já tem tráfego orgânico em `/`, considere depois adicionar um link "Conheça o LavaFlow" visível na tela de `/auth` para não perder visitantes que digitarem o domínio raiz.
