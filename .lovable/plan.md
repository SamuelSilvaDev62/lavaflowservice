## B.1 — Navegação em 3 áreas + bottom-tab mobile

Escopo enxuto e restrito a `src/components/app-layout.tsx`. Sem mexer em rotas, RBAC ou telas.

### 1) Sidebar (desktop) — 3 grupos definitivos

Renomear labels dos itens para os nomes curtos pedidos, mantendo os `to` atuais:

- **Operação**: Painel (`/dashboard`), Agenda (`/agendamentos`), Fila (`/fila`), OS (`/ordens`), Meu Trabalho (`/meu-trabalho`).
- **Relacionamento**: Clientes (`/clientes`), Fidelidade (`/fidelidade`), Assinaturas (`/assinaturas`), Campanhas (`/campanhas`).
- **Gestão**: Equipe (`/equipe`), Relatórios (`/relatorios`), Mídia (`/midia`), Configurações (`/configuracoes`).

Regras de visibilidade:
- "Meu Trabalho" passa a aparecer para todos os papéis operacionais (`OPERACIONAL`) — hoje só o colaborador vê. Colaborador puro continua com o menu reduzido atual (redireciona para `/meu-trabalho`).
- Fidelidade continua restrita a `ADMINS`; Campanhas/Assinaturas continuam `GESTAO`. Nenhum item novo, nenhum item removido.

### 2) Bottom-tab (mobile)

Nova `<nav>` fixa no rodapé, visível apenas em `<lg` e apenas quando o usuário não é colaborador puro (colaborador só tem uma tela, não precisa de tabs). Itens = os 5 de Operação, na ordem:

```text
[ Painel ] [ Agenda ] [ Fila ] [ OS ] [ Meu Trabalho ]
```

- Componente inline no `AppLayout`, `fixed bottom-0 inset-x-0 z-40 lg:hidden`, altura ~64px, safe-area (`pb-[env(safe-area-inset-bottom)]`).
- Cada tab: ícone (lucide, mesmos já importados) + label 10px, estado ativo com cor `primary` e barra superior de 2px.
- Filtro por RBAC: cada tab só renderiza se o papel atual está em `roles` do item correspondente (mesma lógica que a sidebar já usa). Se sobrar <2 tabs, esconde a barra.
- `main` ganha `pb-20 lg:pb-0` para não cobrir conteúdo.
- Header mobile atual (logo + menu hamburguer) permanece — o drawer ainda serve para acessar Relacionamento/Gestão.

### 3) Fora de escopo

- Nada de novas rotas, permissões, telas ou tokens de tema.
- Sem mexer em `Meu Trabalho`, Dashboard ou fluxo do colaborador.
- Sem tour/onboarding novo (o `data-tour="dashboard"` no item Painel é preservado).

### Perguntas

1. Confirma que "Meu Trabalho" deve aparecer no bottom-tab para **owner/admin/gerente/atendente/lavador** (todos operacionais) ou apenas para papéis que executam serviço (lavador/atendente)?
2. Ao clicar em "Meu Trabalho" sem estar vinculado a um funcionário, seguimos abrindo a tela com estado vazio (comportamento atual) ou escondemos a tab pra quem não tem `funcionario_id`?