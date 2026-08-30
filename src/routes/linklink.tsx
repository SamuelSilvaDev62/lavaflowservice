import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Braces,
  CheckCircle2,
  Layers3,
  Sparkles,
  Workflow,
} from "lucide-react";

export const Route = createFileRoute("/linklink")({
  head: () => ({
    meta: [
      { title: "Link&Link — Tecnologia e soluções digitais para negócios" },
      {
        name: "description",
        content:
          "A Link&Link desenvolve produtos digitais, sistemas web, automações e soluções com IA para ajudar pequenos negócios a operar melhor e crescer.",
      },
      { property: "og:title", content: "Link&Link — Tecnologia e soluções digitais para negócios" },
      {
        property: "og:description",
        content:
          "Produtos digitais, sistemas web, automações e soluções com IA para pequenos negócios.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Link&Link" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Link&Link — Tecnologia e soluções digitais para negócios" },
      {
        name: "twitter:description",
        content:
          "Produtos digitais, sistemas web, automações e soluções com IA para pequenos negócios.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: LinkLinkLanding,
});

const services = [
  {
    icon: Layers3,
    title: "Produtos digitais e SaaS",
    text: "Criamos soluções próprias e plataformas digitais orientadas a problemas reais de operação e crescimento.",
  },
  {
    icon: Braces,
    title: "Sistemas e experiências web",
    text: "Aplicações responsivas, simples de usar e construídas para funcionar no dia a dia do negócio.",
  },
  {
    icon: Bot,
    title: "Automações e IA",
    text: "Aplicamos automação e inteligência artificial para reduzir trabalho manual e apoiar melhores decisões.",
  },
  {
    icon: Workflow,
    title: "Estratégia e prototipação",
    text: "Transformamos ideias em protótipos testáveis antes de ampliar investimento, escopo e complexidade.",
  },
];

function LinkLinkLanding() {
  return (
    <main className="min-h-screen bg-[#0b0d10] text-white selection:bg-white selection:text-black">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_10%,rgba(255,255,255,.12),transparent_24%),radial-gradient(circle_at_85%_35%,rgba(255,255,255,.06),transparent_20%)]" />

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-8">
          <a href="#inicio" className="text-lg font-semibold tracking-[-0.04em]">
            Link&Link
          </a>
          <a
            href="#solucoes"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Conhecer soluções
          </a>
        </div>
      </header>

      <section id="inicio" className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28 lg:px-8 lg:pb-32 lg:pt-36">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/60">
              <Sparkles className="h-3.5 w-3.5" />
              Tecnologia aplicada a negócios reais
            </div>
            <h1 className="text-5xl font-semibold leading-[0.94] tracking-[-0.065em] sm:text-7xl lg:text-8xl">
              Tecnologia e soluções digitais para negócios.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/62 sm:text-xl">
              A Link&Link desenvolve produtos digitais, sistemas web, automações e soluções com IA para ajudar pequenos negócios a operar melhor, se relacionar com clientes e crescer.
            </p>
            <a
              href="#solucoes"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:translate-y-[-1px]"
            >
              Conhecer soluções <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Sobre a Link&Link</p>
          <div>
            <h2 className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
              Menos complexidade. Mais utilidade.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
              Somos uma operação de tecnologia focada em transformar problemas operacionais e comerciais em produtos digitais simples, úteis e viáveis. Partimos do problema, validamos rapidamente e construímos somente o que faz diferença na rotina do negócio.
            </p>
          </div>
        </div>
      </section>

      <section id="solucoes" className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-white/40">O que fazemos</p>
            <h2 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
              Construção digital com foco em resultado prático.
            </h2>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
            {services.map(({ icon: Icon, title, text }) => (
              <article key={title} className="bg-[#0b0d10] p-7 sm:p-8">
                <Icon className="h-5 w-5 text-white/75" />
                <h3 className="mt-8 text-xl font-medium tracking-[-0.025em]">{title}</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/52">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/40">Produto em destaque</p>
              <h2 className="mt-4 text-5xl font-semibold tracking-[-0.065em] sm:text-6xl">LavaFlow</h2>
            </div>
            <div>
              <p className="text-lg leading-8 text-white/62">
                Plataforma de gestão e inteligência comercial para empresas de lavagem e estética automotiva, desenvolvida pela Link&Link para conectar operação, relacionamento com clientes e oportunidades de crescimento em uma única experiência.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm text-white/65">
                {["Operação", "Relacionamento", "Inteligência comercial", "Automação"].map((item) => (
                  <span key={item} className="rounded-full border border-white/12 px-3 py-1.5">
                    {item}
                  </span>
                ))}
              </div>
              <Link
                to="/auth"
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white underline decoration-white/25 underline-offset-4 transition hover:decoration-white"
              >
                Conhecer o LavaFlow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-white/40">Tecnologia responsável</p>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
              Integrações com consentimento e finalidade clara.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/58 sm:text-lg">
              Quando uma solução utiliza serviços de terceiros, a Link&Link prioriza integrações oficiais, autorização do usuário e uso de dados compatível com a finalidade informada. Recursos externos só são tratados como conectados após autorização e validação técnica apropriadas.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Autorização do usuário", "APIs oficiais quando disponíveis", "Sem afirmar conexões inexistentes"].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-white/62">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-10 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 sm:px-10 sm:py-14">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Contato</p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
              Tem um problema de negócio que pode virar uma solução digital?
            </h2>
            <span className="text-sm text-white/45">Canal de contato em configuração.</span>
          </div>
        </div>
      </section>

      <footer className="relative z-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 text-sm text-white/38 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>© 2026 Link&Link.</span>
          <span>Tecnologia e soluções digitais para negócios.</span>
        </div>
      </footer>
    </main>
  );
}
