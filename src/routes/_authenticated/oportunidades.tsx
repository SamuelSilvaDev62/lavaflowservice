import { FeatureGate } from "@/components/feature-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOportunidades, getClientesComRecompensa } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { waLink, getTemplate, renderTemplate, type WhatsAppTemplateKey } from "@/lib/whatsapp";
import { MessageCircle, TrendingUp, Gift, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/oportunidades")({
  component: () => (
    <RequireRole roles={GESTAO}>
      <FeatureGate feature="oportunidades"><Page /></FeatureGate>
    </RequireRole>
  ),
});

const prioColor: Record<number, string> = {
  4: "bg-destructive/10 text-destructive border-destructive/20",
  3: "bg-warning/10 text-warning-foreground border-warning/30",
  2: "bg-accent text-accent-foreground border-accent",
  1: "bg-muted text-muted-foreground border-border",
};
const prioLabel: Record<number, string> = { 4: "Crítica", 3: "Alta", 2: "Média", 1: "Baixa" };

function Page() {
  const fn = useServerFn(getOportunidades);
  const recFn = useServerFn(getClientesComRecompensa);
  const { data, isLoading } = useQuery({ queryKey: ["oportunidades"], queryFn: () => fn() });
  const { data: rec } = useQuery({ queryKey: ["clientes-recompensa"], queryFn: () => recFn() });

  const valorPotencialFidelidade = rec ? rec.qtd * (rec.ticketMedio ?? 50) : 0;
  const totalReceita = (data?.oportunidades.reduce((s, o) => s + o.receitaPotencial, 0) ?? 0) + valorPotencialFidelidade;

  return (
    <>
      <PageHeader
        title="Oportunidades de hoje"
        subtitle="Ações priorizadas para aumentar seu faturamento agora."
        actions={<div className="text-sm font-medium flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg"><TrendingUp className="h-4 w-4" /> Potencial: {brl(totalReceita)}</div>}
      />

      {rec && rec.qtd > 0 && (
        <Card className="mb-3 border-l-4 border-success bg-success/5">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-success text-success-foreground grid place-content-center shrink-0">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold">{rec.qtd} clientes podem resgatar benefícios</p>
              <p className="text-sm text-muted-foreground mt-0.5">Ainda não realizaram o resgate. Avise-os e traga-os de volta.</p>
              <p className="text-xs text-success font-medium mt-1">Potencial de retorno: {brl(valorPotencialFidelidade)}</p>
              <Button asChild size="sm" className="mt-3 h-8 text-xs">
                <Link to="/clientes" search={{ filtro: "recompensa_disponivel" }}>Ver clientes <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>}

      {data && data.oportunidades.length === 0 && !rec?.qtd && (
        <Card><CardContent className="p-10 text-center">
          <p className="font-display text-lg">Você está em dia! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">Nenhuma oportunidade pendente. Continue acompanhando.</p>
        </CardContent></Card>
      )}


      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.oportunidades.map((o) => {
          const tplKey = (o.tipo.startsWith("reativacao") ? o.tipo : "convite_assinatura") as WhatsAppTemplateKey;
          const msg = renderTemplate(getTemplate(tplKey), { nome: o.cliente_nome });
          return (
            <Card key={o.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: o.prioridade >= 3 ? "var(--color-primary)" : "var(--color-border)" }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className={prioColor[o.prioridade]}>{prioLabel[o.prioridade]}</Badge>
                  <span className="text-xs font-medium text-success">+{brl(o.receitaPotencial)}</span>
                </div>
                <div>
                  <p className="font-display font-semibold">{o.titulo}</p>
                  <p className="text-sm text-muted-foreground mt-1">{o.descricao}</p>
                </div>
                {o.telefone && (
                  <Button asChild size="sm" className="w-full" variant="default">
                    <a href={waLink(o.telefone, msg)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-1" /> Enviar WhatsApp
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
