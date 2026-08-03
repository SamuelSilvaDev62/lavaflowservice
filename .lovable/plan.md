# Portal operacional dedicado em `/work`

Separar a experiência do lavador da área administrativa, mantendo o mesmo backend, autenticação, tenant e regras de negócio.

## 1) Diagnóstico do estado atual

- **Rotas**: tudo autenticado vive sob `src/routes/_authenticated/`, com o gate em `_authenticated/route.tsx` (`ssr: false`) que verifica sessão e consulta `user_roles`. Se todos os papéis do usuário são `lavador`/`colaborador`, ele já é redirecionado para `/meu-trabalho`.
- **Layout único**: `_authenticated/route.tsx` envolve TODAS as telas em `AppLayout`. O lavador recebe a mesma casca administrativa (header mobile com logo/hambúrguer, sidebar fixa `lg:pl-64`, botão Sair) só com o menu reduzido (`colabGroups`). A bottom-tab é escondida via `!colab`, mas o layout continua sendo o administrativo.
- **Tela do lavador**: `_authenticated/meu-trabalho.tsx` já é um mockup mobile-first próprio (header navy, stat strip, job card com timer, fila compacta) e usa `-m-4` para "furar" o padding do `AppLayout` — sintoma claro de layout inadequado.
- **Papéis**: `src/lib/rbac.ts` define `AppRole`, conjuntos (`ADMINS`, `GESTAO`, `OPERACIONAL`, `COLABORADORES`) e `isColaborador()`. `useRole()` lê o papel via server fn; `<RequireRole>` bloqueia conteúdo no cliente.
- **Backend disponível**: `getMeuTrabalho`, `iniciarOs`, `finalizarOs`, `equipeConcluirChecklistInicial`, `equipePularChecklistInicial` já existem em `src/lib/lavaflow.functions.ts`, com permissões por funcionário (`perm_iniciar_atendimento`, `perm_finalizar_atendimento`, `perm_realizar_checklist`) e auditoria em `equipe_auditoria`.
- **Modo Equipe (PIN)**: `/modo-equipe` + `/equipe/$slug` são um fluxo paralelo, sem sessão Supabase (token de `equipe_sessoes`). Ele NÃO deve ser tocado nem fundido com `/work`.
- **Lacuna**: o payload de `getMeuTrabalho` não expõe hoje "próximo agendamento atribuído" (a tela mostra `"Livre"` hardcoded) nem histórico do dia com detalhe; fotos de checklist existem no schema (`itens jsonb`, `fotos: []`) mas sem upload ligado na tela do lavador.

## 2) Arquitetura proposta

Um segundo subtree autenticado, irmão de `_authenticated`, com layout próprio:

```text
src/routes/
  _authenticated/            área administrativa (AppLayout, sidebar, bottom-tab)
  _work/                     NOVO: portal operacional
    route.tsx                gate: sessão + papel operacional -> WorkLayout
    index.tsx                /work  -> Meu Trabalho (agora + próximo veículo)
    os.$id.tsx               /work/os/:id -> checklist + fotos + iniciar/finalizar
    historico.tsx            /work/historico -> últimos serviços do colaborador
```

- `_work/route.tsx`: `ssr: false`, valida sessão (redirect `/auth`), lê `user_roles`; se o papel NÃO é lavador/colaborador, redireciona para `/dashboard` (admins não usam o portal). Envolve em `WorkLayout`.
- `_authenticated/route.tsx`: troca o redirect de `/meu-trabalho` por `/work`.
- `WorkLayout` (novo, `src/components/work/work-layout.tsx`): full-screen mobile-first, sem sidebar, sem bottom-tab administrativa, sem `WelcomeModal`/`GuidedTour`/`OperationalAlerts`. Só header do colaborador (nome, cargo, turno, Sair) e um rodapé mínimo de 2–3 itens do próprio portal (Agora · Histórico), o que satisfaz "sem bottom navigation com Painel/Agenda/Fila/OS".
- Reuso: o visual atual de `meu-trabalho.tsx` (tokens locais `C`, `JobCard`, `MiniJob`, `SectionLabel`, `Stat`) migra para `src/components/work/*` e passa a ser compartilhado pelas telas do portal. Backend, `useRole`, `rbac.ts` e as server fns permanecem exatamente como estão.
- `/meu-trabalho` continua existindo como rota de compatibilidade que redireciona para `/work` (evita links/atalhos quebrados), e sai da sidebar administrativa.

## 3) Arquivos/áreas que precisariam mudar

| Arquivo | Mudança |
| --- | --- |
| `src/routes/_work/route.tsx` | novo gate + `WorkLayout` |
| `src/routes/_work/index.tsx` | novo: Meu Trabalho (extraído de `meu-trabalho.tsx`) |
| `src/routes/_work/os.$id.tsx` | novo: detalhe da OS com checklist, fotos, início/fim |
| `src/routes/_work/historico.tsx` | novo: histórico essencial do colaborador |
| `src/components/work/work-layout.tsx` | novo layout dedicado |
| `src/components/work/*.tsx` | `JobCard`, `MiniJob`, `SectionLabel`, tokens visuais extraídos |
| `src/routes/_authenticated/route.tsx` | redirect colaborador `/meu-trabalho` → `/work` |
| `src/routes/_authenticated/meu-trabalho.tsx` | reduzido a redirect para `/work` |
| `src/components/app-layout.tsx` | remover "Meu Trabalho" da sidebar/bottom-tab e o ramo `colabGroups`/`colab` |
| `src/lib/lavaflow.functions.ts` | estender `getMeuTrabalho` com próximo agendamento atribuído e histórico do dia; nova fn de leitura de histórico se necessário |
| `src/lib/rbac.ts` | (opcional) helper `homeRouteForRole(role)` para centralizar destino pós-login |
| `src/routes/index.tsx`, `src/routes/auth.tsx` | pós-login enviar lavador para `/work` em vez de `/dashboard` |

Não muda: schema, RLS, GRANTs, permissões por funcionário, `/modo-equipe`, `/equipe/$slug`, `src/integrations/supabase/*`.

## 4) Riscos e cuidados

- **Loop de redirect** entre `_authenticated` e `_work` se as condições não forem exatamente complementares. Regra única: lavador/colaborador ⇒ `/work`; todos os outros ⇒ área principal. Uma só fonte de verdade para essa decisão.
- **Papéis mistos**: hoje `isColab` exige que TODOS os papéis sejam de colaborador. Preservar essa semântica; um lavador que também é gerente continua na área principal (com acesso manual a `/work` permitido, sem redirect forçado).
- **Uploads de foto**: só ligar se já houver bucket e política de storage compatíveis; caso contrário tratar como etapa separada (E5) e não bloquear o resto.
- **Layout duplicado**: extrair componentes em vez de copiar/colar, senão a tela do lavador vira código órfão.
- **`-m-4` residual**: remover ao sair do `AppLayout`, senão aparece corte nas laterais.
- **Deep links antigos** para `/meu-trabalho` (QR, atalho PWA, `public/manifest.webmanifest`) — manter redirect e revisar o manifest.
- **Prerender/SSR**: manter `ssr: false` no gate, como no `_authenticated`, para não chamar auth durante build.
- Sem `src/routes/_work/index.tsx` conflitando com `/` — pathless layout com filho `index` resolve `/work` só porque o segmento é `_work`; usar arquivo `work.index.tsx`/pasta `work/` se o gerador reclamar do caminho.

## 5) Ordem de implementação (etapas pequenas)

1. **E1 — Extração visual**: mover componentes de `meu-trabalho.tsx` para `src/components/work/` sem mudar rota. Tela idêntica.
2. **E2 — Layout + rota**: criar `WorkLayout`, `_work/route.tsx` e `/work` renderizando o Meu Trabalho extraído. `/meu-trabalho` intacto ainda.
3. **E3 — Chaveamento de acesso**: redirects (`_authenticated` → `/work`, `/meu-trabalho` → `/work`, pós-login por papel) e limpeza do `AppLayout` (sem item nem ramo de colaborador).
4. **E4 — Próximo veículo + histórico**: estender o payload do backend e criar `/work/historico`; substituir o `"Livre"` hardcoded.
5. **E5 — Checklist e fotos**: `/work/os/$id` consumindo `equipeConcluirChecklistInicial`/`equipePularChecklistInicial`, com upload de fotos só se o storage já suportar.
6. **E6 — Acabamento**: safe-area, estados vazios, offline/PWA, manifest, typecheck limpo.

Cada etapa é entregável e reversível isoladamente.

## 6) Critérios de aceite e testes

- Login como `lavador`/`colaborador` cai em `/work`; nenhuma rota administrativa é alcançável (`/dashboard`, `/agendamentos`, `/fila`, `/ordens`, `/equipe` redirecionam).
- Login como `owner`/`admin`/`gerente`/`atendente` cai na área principal; acessar `/work` manualmente redireciona para `/dashboard`.
- Em `/work` não existe sidebar, menu hambúrguer administrativo, nem bottom-tab com Painel/Agenda/Fila/OS.
- `/work` mostra: veículo em atendimento, próximo veículo, checklist, fotos, iniciar/finalizar, histórico essencial.
- Iniciar/finalizar respeita `perm_iniciar_atendimento`/`perm_finalizar_atendimento` e o bloqueio de checklist inicial obrigatório (`exigir_checklist_inicial`).
- Isolamento de tenant preservado: colaborador só vê OS do próprio `owner_id` e, com `perm_ver_apenas_atribuidos`, apenas as suas.
- `/meu-trabalho` redireciona para `/work`; nenhum link morto na área administrativa.
- `/modo-equipe` (PIN) continua funcionando sem alteração.
- Sem loop de redirect em nenhuma combinação de papéis; `tsgo` limpo; smoke test manual mobile (375px) e desktop.

## Perguntas

1. Um usuário com papéis mistos (ex.: gerente + lavador) deve ficar na área principal com acesso opcional a `/work` (proposta atual) ou ser forçado ao portal?
2. O upload de fotos no checklist deve entrar já na E5 ou fica para uma onda posterior (depende de bucket/política de storage existente)?
