import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Car, TrendingUp, Sparkles, MessageCircle, Award, Repeat, Users,
  Check, X, ArrowRight, Star, BarChart3, Trophy, Clock, DollarSign,
  Instagram, Phone, ChevronRight, Smartphone,
} from "lucide-react";
import dashboardAsset from "@/assets/landing/app-dashboard.webp.asset.json";
import kanbanAsset from "@/assets/landing/app-kanban.webp.asset.json";

const SHOTS = {
  dashboard: { url: dashboardAsset.url, alt: "Painel executivo do LavaFlow com receita e oportunidades" },
  kanban: { url: kanbanAsset.url, alt: "Kanban de fila de atendimento do LavaFlow com veículos por etapa" },
} as const;

export const Route = createFileRoute("/lp")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "LavaFlow — O sistema que faz seu lava-rápido faturar mais" },
      { name: "description", content: "Recupere clientes, use o WhatsApp a seu favor, crie assinaturas e acompanhe sua equipe. A plataforma de crescimento dos lava-rápidos." },
      { property: "og:title", content: "LavaFlow — Aumente o faturamento do seu lava-rápido" },
      { property: "og:description", content: "Recupere clientes, organize a operação e crie receita recorrente com o LavaFlow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preload", as: "image", href: dashboardAsset.url, fetchpriority: "high" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <LogosStrip />
      <Benefits />
      <MockupShowcase />
      <ProblemSolution />
      <TeamSection />
      <Loyalty />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ---------------- NAV ---------------- */
function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/lp" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/50 grid place-content-center shadow-lg shadow-primary/30">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">Lava<span className="text-primary">Flow</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#beneficios" className="hover:text-foreground transition">Funcionalidades</a>
          <a href="#planos" className="hover:text-foreground transition">Planos</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          <a href="#contato" className="hover:text-foreground transition">Contato</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Entrar</Link></Button>
          <Button asChild size="sm" className="shadow-sm"><a href="/auth">Começar grátis<ArrowRight className="h-3.5 w-3.5 ml-1" /></a></Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- HERO ---------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/20 blur-[120px] opacity-60" />
        <div className="absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-14 lg:pt-24 pb-16 lg:pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="h-3 w-3" /> Plataforma de crescimento
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            Aumente o <span className="text-primary">faturamento</span> do seu lava-rápido.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl">
            Organize clientes, agenda, ordens de serviço e equipe de graça para sempre. Quando quiser
            crescer, o Growth mostra onde estão as oportunidades de receita.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-primary/30">
              <a href="/auth">Começar grátis <ArrowRight className="h-4 w-4 ml-1" /></a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#beneficios">Conhecer o Sistema</a>
            </Button>
          </div>
          <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><Check className="h-4 w-4 text-primary" />Grátis para sempre</div>
            <div className="flex items-center gap-1"><Check className="h-4 w-4 text-primary" />Sem cartão</div>
            <div className="flex items-center gap-1"><Check className="h-4 w-4 text-primary" />Cancele quando quiser</div>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end animate-fade-in">
          <PhoneMockup eager />
        </div>
      </div>
    </section>
  );
}

/* ---------- Reusable phone mockup ---------- */
function PhoneMockup({ variant = "dashboard", eager = false }: { variant?: "dashboard" | "kanban"; eager?: boolean }) {
  const shot = SHOTS[variant];
  return (
    <div className="relative">
      {/* floating mini cards */}
      <div className="hidden sm:block absolute -left-8 top-24 z-20 animate-fade-in">
        <Card className="shadow-xl border-primary/10">
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-success/15 text-success grid place-content-center"><TrendingUp className="h-4 w-4" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground">Receita hoje</p>
              <p className="font-display font-bold text-sm">R$ 1.840</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="hidden sm:block absolute -right-6 bottom-16 z-20 animate-fade-in">
        <Card className="shadow-xl border-primary/10">
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary grid place-content-center"><Sparkles className="h-4 w-4" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground">Oportunidades</p>
              <p className="font-medium text-xs">12 hoje</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-[280px] h-[570px] rounded-[40px] bg-foreground p-3 shadow-2xl shadow-primary/20">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 bg-foreground rounded-b-2xl z-10" />
        <div className="w-full h-full rounded-[32px] bg-background overflow-hidden relative">
          <img
            src={shot.url}
            alt={shot.alt}
            width={390}
            height={844}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            {...(eager ? { fetchPriority: "high" as const } : {})}
            className="block w-full h-full object-cover object-top"
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- LOGOS / TRUST ---------------- */
function LogosStrip() {
  return (
    <div className="border-y bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-muted-foreground text-xs uppercase tracking-widest">
        <span>Feito para</span>
        <span className="font-display font-bold">Lava-rápidos</span>
        <span>·</span>
        <span className="font-display font-bold">Lava-jatos</span>
        <span>·</span>
        <span className="font-display font-bold">Estéticas Automotivas</span>
        <span>·</span>
        <span className="font-display font-bold">Detalhamento</span>
      </div>
    </div>
  );
}

/* ---------------- BENEFITS ---------------- */
function Benefits() {
  const items = [
    { e: "🚗", t: "Organize sua operação", d: "Controle veículos, clientes e serviços em tempo real." },
    { e: "💰", t: "Aumente seu faturamento", d: "Descubra oportunidades de crescimento automaticamente." },
    { e: "🔄", t: "Crie receita recorrente", d: "Venda planos de assinatura para seus clientes." },
    { e: "🎯", t: "Fidelize clientes", d: "Programa de pontos integrado ao seu dia a dia." },
    { e: "📱", t: "WhatsApp pronto para enviar", d: "Mensagens prontas para avisar que o veículo está pronto." },
    { e: "👥", t: "Controle sua equipe", d: "Acompanhe produtividade e desempenho." },
  ];
  return (
    <section id="beneficios" className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">Funcionalidades</p>
        <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Tudo o que você precisa para crescer.</h2>
        <p className="mt-4 text-muted-foreground">Cada recurso foi pensado para gerar mais receita e menos trabalho operacional.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((i) => (
          <Card key={i.t} className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/60">
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-2xl grid place-content-center mb-4 group-hover:scale-110 transition-transform">{i.e}</div>
              <h3 className="font-display font-semibold text-lg">{i.t}</h3>
              <p className="text-sm text-muted-foreground mt-1">{i.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- MOCKUP SHOWCASE (carousel) ---------------- */
function MockupShowcase() {
  const slides = [
    { k: "dashboard" as const, t: "Painel Executivo", d: "Indicadores em tempo real, receita por período e ticket médio." },
    { k: "kanban" as const, t: "Kanban Operacional", d: "Veja cada veículo na esteira de produção em um toque." },
  ];
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % slides.length), 4500); return () => clearInterval(id); }, [slides.length]);
  const s = slides[i];
  return (
    <section className="relative bg-gradient-to-b from-muted/30 to-background border-y">
      <div className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
        <div className="text-center mb-12">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">Demonstração</p>
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Visualize o LavaFlow em ação</h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="flex justify-center order-2 lg:order-1">
            <div key={s.k} className="animate-fade-in"><PhoneMockup variant={s.k} /></div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="space-y-3">
              {slides.map((sl, idx) => (
                <button key={sl.k} onClick={() => setI(idx)} className={`w-full text-left p-5 rounded-2xl border transition-all ${idx === i ? "bg-card shadow-lg border-primary/30" : "bg-card/40 hover:bg-card"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl grid place-content-center ${idx === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {sl.k === "dashboard" ? <BarChart3 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-semibold">{sl.t}</p>
                      <p className="text-xs text-muted-foreground">{sl.d}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform ${idx === i ? "translate-x-1 text-primary" : "text-muted-foreground"}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- PROBLEM vs SOLUTION ---------------- */
function ProblemSolution() {
  const before = ["Clientes esquecem de retornar", "Controle feito em papel", "Falta de organização", "Nenhuma previsibilidade de receita", "Equipe sem métricas"];
  const after = ["Clientes fidelizados", "Operação organizada", "Receita recorrente", "Produtividade monitorada", "Crescimento baseado em dados"];
  return (
    <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Do caos ao controle.</h2>
        <p className="mt-4 text-muted-foreground">Veja a transformação que o LavaFlow gera na operação do seu lava-rápido.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <Badge variant="outline" className="mb-4 border-destructive/40 text-destructive">Antes do LavaFlow</Badge>
            <ul className="space-y-3">
              {before.map((b) => (<li key={b} className="flex items-start gap-2 text-sm"><X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />{b}</li>))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <Badge className="mb-4 bg-primary text-primary-foreground">Depois do LavaFlow</Badge>
            <ul className="space-y-3">
              {after.map((a) => (<li key={a} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />{a}</li>))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}




/* ---------------- TEAM ---------------- */
function TeamSection() {
  const ranking = [
    { n: "Carlos M.", l: 142, r: "R$ 8.520", c: "R$ 426" },
    { n: "Bruno S.", l: 128, r: "R$ 7.680", c: "R$ 384" },
    { n: "Diego R.", l: 96, r: "R$ 5.760", c: "R$ 288" },
    { n: "Felipe A.", l: 71, r: "R$ 4.260", c: "R$ 213" },
  ];
  return (
    <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
      <Card className="shadow-xl border-primary/10 order-2 lg:order-1">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4"><Trophy className="h-5 w-5 text-warning" /><p className="font-display font-bold">Ranking da equipe</p></div>
          <div className="space-y-2">
            {ranking.map((r, i) => (
              <div key={r.n} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <div className={`h-9 w-9 rounded-lg grid place-content-center font-bold ${i === 0 ? "bg-warning/20" : i === 1 ? "bg-muted" : i === 2 ? "bg-accent" : "bg-muted/50"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{r.n}</p>
                  <p className="text-xs text-muted-foreground">{r.l} lavagens</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-sm">{r.r}</p>
                  <p className="text-[10px] text-success">{r.c} com.</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="order-1 lg:order-2">
        <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">Equipe</p>
        <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Saiba exatamente quem está produzindo.</h2>
        <p className="mt-5 text-muted-foreground">Cada colaborador tem seu próprio app. Você acompanha ranking, produtividade, lavagens realizadas e comissão acumulada em tempo real.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { i: Users, t: "Acesso individual" },
            { i: Clock, t: "Tempo por etapa" },
            { i: DollarSign, t: "Comissão automática" },
            { i: TrendingUp, t: "Produtividade" },
          ].map((b) => (
            <div key={b.t} className="flex items-center gap-2 p-3 rounded-xl border">
              <b.i className="h-4 w-4 text-primary" /><span className="text-sm">{b.t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- LOYALTY ---------------- */
function Loyalty() {
  const items = [
    { i: Award, t: "Programa de pontos", d: "Cada lavagem credita pontos automaticamente." },
    { i: Repeat, t: "Assinaturas mensais", d: "Crie planos e ganhe receita previsível." },
    { i: MessageCircle, t: "Recuperação por WhatsApp", d: "Mensagens prontas para clientes inativos." },
  ];
  return (
    <section className="bg-muted/30 border-y">
      <div className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">Fidelização</p>
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Transforme clientes ocasionais em clientes recorrentes.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((it) => (
            <Card key={it.t} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-content-center mb-4"><it.i className="h-6 w-6" /></div>
                <h3 className="font-display font-semibold">{it.t}</h3>
                <p className="text-sm text-muted-foreground mt-1">{it.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- PROVA DENTRO DO PRODUTO ---------------- */
function Testimonials() {
  const itens = [
    { i: Clock, t: "Operação registrada", d: "Lavagens, tempo por etapa e faturamento do dia, direto do que sua equipe executa." },
    { i: Users, t: "Clientes em risco", d: "Quem parou de voltar dentro do intervalo típico do seu próprio histórico." },
    { i: Repeat, t: "Candidatos a recorrência", d: "Clientes com frequência suficiente para entrar em fidelidade ou plano de assinatura." },
    { i: DollarSign, t: "Potencial estimado", d: "Estimativa a partir do seu ticket médio real — projeção, não promessa." },
    { i: TrendingUp, t: "Receita Influenciada", d: "Só aparece quando houver eventos atribuídos reais na sua operação." },
    { i: Check, t: "Sem números inventados", d: "Todo indicador vem dos seus dados. Se ainda não há histórico, o LavaFlow diz isso." },
  ];
  return (
    <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
      <div className="text-center mb-12">
        <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">Prova dentro do produto</p>
        <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">O que o LavaFlow consegue medir.</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          A prova é o seu próprio painel: cada número abaixo é calculado com os dados da sua operação.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {itens.map((it) => (
          <Card key={it.t}>
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-content-center mb-4"><it.i className="h-6 w-6" /></div>
              <h3 className="font-display font-semibold">{it.t}</h3>
              <p className="text-sm text-muted-foreground mt-1">{it.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- PRICING ---------------- */
function Pricing() {
  const plans = [
    {
      n: "LavaFlow Free",
      p: "0",
      d: "Para organizar e operar seu lava-rápido.",
      f: [
        "Clientes e veículos",
        "Serviços e agenda",
        "Ordens de serviço e fila (Kanban)",
        "Equipe e configurações",
        "Painel operacional do dia",
        "Grátis para sempre · sem cartão",
      ],
      hl: false,
    },
    {
      n: "LavaFlow Growth",
      p: "99",
      d: "Para transformar seus dados em ações de crescimento.",
      f: [
        "Tudo do Free",
        "Oportunidades do seu negócio",
        "Recuperação de clientes inativos",
        "Campanhas e mensagens de WhatsApp",
        "Programa de fidelidade e assinaturas",
        "Consultor IA e relatórios avançados",
      ],
      hl: true,
    },
  ];
  return (
    <section id="planos" className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
      <div className="text-center mb-12">
        <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">Planos</p>
        <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Free organiza. Growth encontra oportunidades.</h2>
        <p className="mt-4 text-muted-foreground">Comece grátis para sempre. Cresça quando fizer sentido — sem fidelidade.</p>
      </div>
      <div className="grid gap-4 items-stretch md:grid-cols-2 md:max-w-3xl md:mx-auto">
        {plans.map((p) => (
          <Card key={p.n} className={`relative flex flex-col ${p.hl ? "border-primary shadow-2xl shadow-primary/20 lg:-translate-y-4 scale-[1.02]" : ""}`}>
            {p.hl && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">Mais popular</Badge>}
            <CardContent className="p-6 flex flex-col flex-1">
              <p className="font-display font-bold text-lg">{p.n}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.d}</p>
              <div className="my-5">
                <span className="text-xs text-muted-foreground">R$</span>
                <span className="font-display font-bold text-4xl">{p.p}</span>
                <span className="text-xs text-muted-foreground">{p.p === "0" ? " para sempre" : "/mês"}</span>
              </div>
              <ul className="space-y-2 flex-1">
                {p.f.map((f) => (<li key={f} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />{f}</li>))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={p.hl ? "default" : "outline"}>
                <a href="/auth">{p.hl ? "Começar grátis e liberar o Growth depois" : "Começar grátis"}</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
function Faq() {
  const items = [
    { q: "O sistema funciona no celular?", a: "Sim. O LavaFlow é 100% responsivo e otimizado para smartphones, tablets e desktops." },
    { q: "Preciso instalar algo?", a: "Não. Tudo roda direto no navegador, sem download ou instalação." },
    { q: "Posso usar WhatsApp?", a: "Sim. Mensagens prontas para avisar que o veículo está pronto e campanhas de recuperação de inativos, enviadas com um toque pelo WhatsApp." },
    { q: "Meus funcionários podem acessar?", a: "Sim. Cada colaborador tem o próprio acesso com permissões por perfil, e você acompanha produtividade e comissão." },
    { q: "Existe fidelidade?", a: "Não. Você pode cancelar quando quiser, sem multa." },
    { q: "O plano gratuito expira?", a: "Não. O LavaFlow Free é grátis para sempre e nunca bloqueia sua operação: clientes, agenda, ordens de serviço, fila e equipe seguem funcionando. O Growth (R$ 99/mês) é opcional e libera as ações de crescimento." },
  ];
  return (
    <section id="faq" className="bg-muted/30 border-y">
      <div className="max-w-3xl mx-auto px-4 py-20 lg:py-28">
        <div className="text-center mb-10">
          <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight">Perguntas frequentes</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {items.map((it, i) => (
            <AccordionItem key={i} value={`i${i}`} className="border rounded-xl px-4 bg-card">
              <AccordionTrigger className="text-left">{it.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{it.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */
function FinalCta() {
  return (
    <section id="contato" className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/70 p-10 lg:p-16 text-center text-primary-foreground shadow-2xl shadow-primary/30">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
        <div className="relative">
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tight max-w-2xl mx-auto">Pronto para aumentar o faturamento do seu lava-rápido?</h2>
          <p className="mt-4 opacity-90 max-w-xl mx-auto">Comece hoje. Em poucos minutos seu lava-rápido está digital.</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" variant="secondary" className="shadow-lg">
              <Link to="/auth">Solicitar Demonstração <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
              <a href="https://wa.me/" target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1" />Falar no WhatsApp</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER ---------------- */
function Footer() {
  return (
    <footer className="border-t">
      <div className="max-w-6xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/50 grid place-content-center"><Car className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-display text-lg font-bold">Lava<span className="text-primary">Flow</span></span>
          </div>
          <p className="text-sm text-muted-foreground">A plataforma de crescimento dos lava-rápidos.</p>
        </div>
        <div>
          <p className="font-display font-semibold mb-3 text-sm">Produto</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#beneficios" className="hover:text-foreground">Funcionalidades</a></li>
            <li><a href="#planos" className="hover:text-foreground">Planos</a></li>
            <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
          </ul>
        </div>
        <div>
          <p className="font-display font-semibold mb-3 text-sm">Conta</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Login</Link></li>
            <li><a href="#contato" className="hover:text-foreground">Contato</a></li>
          </ul>
        </div>
        <div>
          <p className="font-display font-semibold mb-3 text-sm">Redes</p>
          <div className="flex gap-2">
            <a href="https://wa.me/" target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg border grid place-content-center hover:bg-muted transition"><Phone className="h-4 w-4" /></a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg border grid place-content-center hover:bg-muted transition"><Instagram className="h-4 w-4" /></a>
          </div>
        </div>
      </div>
      <div className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} LavaFlow · Todos os direitos reservados</span>
          <span>Feito para crescer com você</span>
        </div>
      </div>
    </footer>
  );
}
