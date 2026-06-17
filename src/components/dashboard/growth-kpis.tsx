import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, UserMinus, Gift, Repeat, ArrowRight } from "lucide-react";
import { brl, num } from "@/lib/format";

type Props = {
  receitaRecuperavel: number;
  clientesEmRisco: number;
  proximasRecompensas: number;
  potencialAssinatura: number;
  candidatosAssinatura: number;
};

function KpiCard({
  to, icon: Icon, accent, label, value, hint, search,
}: {
  to: string; icon: any; accent: string; label: string; value: string; hint: string;
  search?: Record<string, string>;
}) {
  return (
    <Link to={to as any} search={search as any}>
      <Card className="h-full hover:border-primary/50 hover:shadow-md transition cursor-pointer">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
            <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg grid place-content-center shrink-0 ${accent}`}>
              <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </div>
          </div>
          <p className="font-display text-xl sm:text-2xl font-bold mt-2 tabular-nums">{value}</p>
          <p className="text-[11px] mt-1 text-muted-foreground flex items-center gap-1">
            {hint} <ArrowRight className="h-3 w-3" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function GrowthKPIs(p: Props) {
  const hasAny =
    p.receitaRecuperavel > 0 ||
    p.clientesEmRisco > 0 ||
    p.proximasRecompensas > 0 ||
    p.potencialAssinatura > 0;
  if (!hasAny) return null;

  return (
    <>
      <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mt-2 mb-3">
        Oportunidades de crescimento
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          to="/oportunidades"
          icon={AlertTriangle}
          accent="bg-destructive/10 text-destructive"
          label="Receita recuperável"
          value={brl(p.receitaRecuperavel)}
          hint="Clientes a reconquistar"
        />
        <KpiCard
          to="/clientes/inativos"
          icon={UserMinus}
          accent="bg-warning/10 text-warning-foreground"
          label="Clientes em risco"
          value={num(p.clientesEmRisco)}
          hint="Sem voltar há 45-90 dias"
        />
        <KpiCard
          to="/clientes"
          search={{ filtro: "recompensa_disponivel" }}
          icon={Gift}
          accent="bg-success/10 text-success"
          label="Próximas recompensas"
          value={num(p.proximasRecompensas)}
          hint="Quase prontos para resgatar"
        />
        <KpiCard
          to="/assinaturas"
          icon={Repeat}
          accent="bg-primary/10 text-primary"
          label="Potencial assinatura"
          value={p.potencialAssinatura > 0 ? `${brl(p.potencialAssinatura)}/mês` : `${p.candidatosAssinatura} clientes`}
          hint="Clientes prontos para o plano"
        />
      </div>
    </>
  );
}
