import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Car, TrendingUp, Sparkles, Users, MessageCircle, Award, BarChart3, Repeat } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "LavaFlow — Aumente o faturamento do seu lava-rápido" },
      { name: "description", content: "Plataforma de crescimento para lava-rápidos: recupere clientes, crie receita recorrente e tome decisões com dados." },
      { property: "og:title", content: "LavaFlow — Aumente o faturamento do seu lava-rápido" },
      { property: "og:description", content: "Recupere clientes, fidelize e crie receita recorrente." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 grid place-content-center">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Lava<span className="text-primary">Flow</span></span>
          </div>
          <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 lg:py-28 text-center">
        <p className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase mb-6">Crescimento para lava-rápidos</p>
        <h1 className="font-display text-4xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.05]">
          O sistema que <span className="text-primary">aumenta o faturamento</span> do seu lava-rápido.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Recupere clientes perdidos, crie receita recorrente com assinaturas e descubra oportunidades de venda automaticamente.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button asChild size="lg"><Link to="/auth">Começar grátis</Link></Button>
          <Button asChild size="lg" variant="outline"><a href="#features">Ver recursos</a></Button>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-4 py-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: TrendingUp, t: "Painel de crescimento", d: "MRR, retenção e ticket médio em tempo real." },
          { icon: Sparkles, t: "Oportunidades automáticas", d: "Saiba exatamente qual cliente abordar hoje." },
          { icon: MessageCircle, t: "Reativação por WhatsApp", d: "Envie mensagens em massa para inativos." },
          { icon: Repeat, t: "Assinaturas mensais", d: "Crie planos e ganhe receita previsível." },
          { icon: Award, t: "Fidelidade automática", d: "Pontos creditados a cada lavagem entregue." },
          { icon: BarChart3, t: "Decisões com dados", d: "Relatórios de receita por serviço e equipe." },
        ].map((f) => (
          <div key={f.t} className="p-6 rounded-xl border bg-card">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-content-center mb-3"><f.icon className="h-5 w-5" /></div>
            <h3 className="font-display font-semibold">{f.t}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
          <span>© LavaFlow</span>
          <span>Feito para crescer com você</span>
        </div>
      </footer>
    </div>
  );
}
