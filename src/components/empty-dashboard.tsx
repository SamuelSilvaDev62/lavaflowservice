import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CreditCard, Award, CalendarDays } from "lucide-react";

const cta = [
  { to: "/clientes", icon: Users, title: "Cadastrar primeiro cliente", desc: "Comece sua base e historico." },
  { to: "/agendamentos", icon: CalendarDays, title: "Abrir agenda", desc: "Organize os proximos atendimentos." },
  { to: "/assinaturas", icon: CreditCard, title: "Criar assinatura", desc: "Configure receita recorrente quando estiver pronto." },
  { to: "/fidelidade", icon: Award, title: "Configurar fidelidade", desc: "Premie quem volta mais." },
];

export function EmptyDashboard() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary text-primary-foreground items-center justify-center mb-4">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold">Sua operacao esta pronta para comecar</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
            Cadastre clientes, registre lavagens e acompanhe agenda, fila e faturamento do dia em tempo real.
          </p>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cta.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.to} to={c.to as any}>
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
