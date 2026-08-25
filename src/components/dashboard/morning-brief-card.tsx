import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { FeatureGate } from "@/components/feature-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMorningBrief } from "@/lib/morning-brief.functions";

type MorningBriefItemType = "atencao" | "oportunidade" | "positivo" | "info";

const TYPE_META: Record<MorningBriefItemType, {
  label: string;
  icon: typeof Sparkles;
  className: string;
}> = {
  atencao: {
    label: "Atenção",
    icon: AlertTriangle,
    className: "border-warning/30 bg-warning/10 text-warning-foreground",
  },
  oportunidade: {
    label: "Oportunidade",
    icon: TrendingUp,
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  positivo: {
    label: "Positivo",
    icon: CheckCircle2,
    className: "border-success/20 bg-success/10 text-success",
  },
  info: {
    label: "Contexto",
    icon: Sparkles,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

function LockedMorningBrief() {
  return (
    <Card className="mb-4 overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Morning Brief · Growth</p>
            <h2 className="mt-1 font-display text-lg font-semibold">Seu negócio resumido antes de você perguntar</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              O Growth cruza receita recente, agenda, operação e clientes com chance de retorno para dizer o que merece ação hoje.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/planos">Liberar no Growth <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function BriefContent() {
  const fetchBrief = useServerFn(getMorningBrief);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["morning-brief"],
    queryFn: () => fetchBrief(),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return <div className="mb-4 h-56 rounded-2xl skeleton-shimmer" />;
  }

  if (isError || !data) {
    return (
      <Card className="mb-4">
        <CardContent className="p-5">
          <p className="text-sm font-medium">Morning Brief indisponível agora.</p>
          <p className="mt-1 text-xs text-muted-foreground">A Central do Dia continua funcionando normalmente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 overflow-hidden border-primary/20">
      <CardContent className="p-0">
        <div className="border-b bg-primary/[0.04] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Morning Brief
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold">{data.titulo}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{data.resumo}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">Atualiza automaticamente</span>
          </div>
        </div>

        <div className="divide-y">
          {data.itens.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">
              Ainda não há histórico suficiente para um resumo útil. Continue registrando agenda, clientes e ordens.
            </div>
          ) : data.itens.map((item) => {
            const meta = TYPE_META[item.tipo as MorningBriefItemType];
            const Icon = meta.icon;
            return (
              <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={meta.className}>
                      <Icon className="mr-1 h-3 w-3" />{meta.label}
                    </Badge>
                    {item.metrica ? <span className="text-xs font-semibold tabular-nums text-foreground">{item.metrica}</span> : null}
                  </div>
                  <p className="mt-2 font-display text-sm font-semibold">{item.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detalhe}</p>
                </div>
                {item.acaoLabel && item.acaoRota ? (
                  <Button asChild variant="ghost" size="sm" className="justify-self-start sm:justify-self-end">
                    <Link to={item.acaoRota as any}>{item.acaoLabel}<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function MorningBriefCard() {
  return (
    <FeatureGate feature="analises_inteligentes" fallback={<LockedMorningBrief />}>
      <BriefContent />
    </FeatureGate>
  );
}
