import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { getInsights } from "@/lib/lavaflow.functions";
import { Bot, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistente")({
  component: Page,
});

const iconMap = { positivo: CheckCircle2, alerta: AlertTriangle, info: Info };
const colorMap = { positivo: "text-success bg-success/10", alerta: "text-destructive bg-destructive/10", info: "text-primary bg-primary/10" };

function Page() {
  const fn = useServerFn(getInsights);
  const { data, isLoading } = useQuery({ queryKey: ["insights"], queryFn: () => fn() });

  return (
    <>
      <PageHeader title="Assistente de crescimento" subtitle="Análises inteligentes baseadas nas suas operações." />
      <Card className="mb-6 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-content-center"><Bot className="h-5 w-5" /></div>
          <div>
            <p className="font-display font-semibold">Recomendações automáticas</p>
            <p className="text-sm text-muted-foreground">Os insights abaixo são gerados em tempo real conforme suas vendas evoluem.</p>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>}

      <div className="space-y-3">
        {data?.insights.map((i) => {
          const Icon = iconMap[i.tipo];
          return (
            <Card key={i.id}>
              <CardContent className="p-4 flex gap-4">
                <div className={`h-9 w-9 shrink-0 rounded-lg grid place-content-center ${colorMap[i.tipo]}`}><Icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold">{i.titulo}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{i.descricao}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
