import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  component: PoliticaDePrivacidade,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — LavaFlow" },
      {
        name: "description",
        content:
          "Política de Privacidade do LavaFlow: dados coletados, finalidade, compartilhamento, segurança e direitos do titular.",
      },
    ],
  }),
});

function PoliticaDePrivacidade() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-slate-800">
      <h1 className="text-3xl font-bold">Política de Privacidade — LavaFlow</h1>
      <p className="text-sm text-slate-500">Última atualização: 23/06/2026</p>

      <h2 className="text-xl font-semibold">1. Dados coletados</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Nome, e-mail e telefone dos usuários.</li>
        <li>Dados operacionais do lava-rápido (agendamentos, OS, etc.).</li>
        <li>Conteúdo publicado nas redes sociais com autorização.</li>
      </ul>

      <h2 className="text-xl font-semibold">2. Finalidade</h2>
      <p>
        Usamos esses dados exclusivamente para operar a plataforma, automatizar
        comunicação com clientes e gerar relatórios de desempenho.
      </p>

      <h2 className="text-xl font-semibold">3. Compartilhamento</h2>
      <p>
        Não vendemos dados. Compartilhamos somente com provedores de
        infraestrutura (Supabase, Meta, OpenAI) estritamente para prestar o
        serviço.
      </p>

      <h2 className="text-xl font-semibold">4. Segurança</h2>
      <p>
        Todo tráfego é criptografado (HTTPS) e protegido por RLS. Acesso
        interno é restrito por funções e chaves de API.
      </p>

      <h2 className="text-xl font-semibold">5. Direitos do titular</h2>
      <p>
        Para visualizar, corrigir ou excluir seus dados, envie e-mail para{" "}
        <a
          href="mailto:privacy@lavaflow.com"
          className="text-blue-600 underline"
        >
          privacy@lavaflow.com
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold">6. Contato</h2>
      <p>privacy@lavaflow.com</p>
    </main>
  );
}
