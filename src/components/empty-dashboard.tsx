import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CreditCard, Award, Sparkles } from "lucide-react";

const cta = [
  { to: "/clientes", icon: Users, title: "Cadastre seu primeiro cliente", desc: "Comece sua base e veja a recorrência crescer." },
  { to: "/assinaturas", icon: CreditCard, title: "Criar plano de assinatura", desc: "Receita previsível todo mês." },
  { to: "/fidelidade", icon: Award, title: "Configurar fidelidade", desc: "Premie quem volta mais — venda mais sem esforço." },
];

export function EmptyDashboard() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary text-primary-foreground items-center justify-center mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold">Seu painel está pronto para crescer</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
            Cadastre clientes, registre lavagens e veja métricas, oportunidades e receita recorrente aparecerem aqui em tempo real.
          </p>
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        {cta.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.to} to={c.to}>
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition">
                <CardContent className="p-5">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-content-center mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-semibold">{c.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
