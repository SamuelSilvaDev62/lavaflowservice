import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/trust")({
  component: TrustPage,
  head: () => ({
    meta: [
      { title: "Confiança e Segurança · LavaFlow" },
      {
        name: "description",
        content:
          "Como o LavaFlow protege os dados do seu lava-rápido: autenticação, controle de acesso por papel, isolamento por tenant e contato para questões de privacidade e segurança.",
      },
    ],
  }),
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar para o início
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Confiança e Segurança
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Esta página é mantida pela equipe do LavaFlow para responder dúvidas
            comuns sobre como protegemos os dados do seu lava-rápido. Não é uma
            certificação independente.
          </p>
        </header>

        <div className="space-y-10">
          <Section title="Acesso e autenticação">
            <p>
              O acesso à plataforma exige conta e login. Suportamos
              autenticação por e-mail/senha e login com Google. Sessões são
              gerenciadas por tokens de acesso de curta duração com renovação
              automática.
            </p>
            <p>
              Cada usuário recebe um papel (proprietário, admin, gerente,
              atendente ou lavador) que determina o que pode ver e fazer
              dentro do sistema. Verificações de papel são feitas no servidor
              e no banco de dados.
            </p>
          </Section>

          <Section title="Isolamento por estabelecimento (tenant)">
            <p>
              Cada lava-rápido tem seus dados isolados por meio de políticas de
              Row Level Security no banco de dados. Usuários só conseguem ler
              ou modificar dados do estabelecimento ao qual pertencem.
            </p>
            <p>
              Dados sensíveis como preços, comissões e notificações
              operacionais são restritos a papéis administrativos
              (proprietário, admin, gerente e atendente).
            </p>
          </Section>

          <Section title="Dados que coletamos">
            <p>
              Coletamos apenas os dados necessários para operar o sistema:
              informações de cadastro do estabelecimento, dados de clientes
              (nome, telefone, veículos), agendamentos, ordens de serviço,
              pagamentos e métricas de uso interno.
            </p>
            <p>
              Não vendemos dados pessoais a terceiros. Dados de clientes do
              lava-rápido pertencem ao proprietário da conta e podem ser
              exportados ou removidos sob solicitação.
            </p>
          </Section>

          <Section title="Infraestrutura e provedores">
            <p>
              A aplicação roda em infraestrutura serverless de borda e usa um
              banco PostgreSQL gerenciado, com criptografia em repouso e em
              trânsito (HTTPS/TLS) provida pelo fornecedor de plataforma.
            </p>
            <p>
              Integrações opcionais como WhatsApp, gateways de pagamento e
              modelos de IA são acionadas apenas quando o proprietário as
              habilita.
            </p>
          </Section>

          <Section title="Retenção e exclusão">
            <p>
              Mantemos os dados enquanto a conta estiver ativa. Para solicitar
              exportação ou exclusão de dados, entre em contato pelo canal
              abaixo.
            </p>
          </Section>

          <Section title="Reportar uma vulnerabilidade">
            <p>
              Se você encontrou um problema de segurança ou privacidade, por
              favor escreva para o responsável pela conta do lava-rápido ou,
              em caso de questão de plataforma, contate o suporte do LavaFlow.
              Pedimos que não divulgue publicamente a vulnerabilidade antes da
              correção.
            </p>
          </Section>

          <Section title="Responsabilidade compartilhada">
            <p>
              O LavaFlow fornece os controles técnicos (RLS, papéis,
              autenticação, criptografia em trânsito). O proprietário da conta
              é responsável por convidar apenas pessoas autorizadas, atribuir
              papéis corretos e proteger as próprias credenciais.
            </p>
          </Section>
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          Última revisão: junho de 2026. Esta página é conteúdo editorial e
          pode ser atualizada conforme a plataforma evolui.
        </footer>
      </div>
    </div>
  );
}
