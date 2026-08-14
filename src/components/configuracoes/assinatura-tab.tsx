import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, CreditCard, Crown, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEntitlement } from "@/hooks/use-entitlement";
import { abrirPortalAssinatura } from "@/lib/billing.functions";
import { atualizarSlugPublico, getEmpresa } from "@/lib/lavaflow.functions";
import { GROWTH_PRICE_BRL, STATUS_LABELS, TIERS, tierLabel } from "@/lib/plans";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

function dataBr(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AssinaturaTab() {
  const { entitlement, stripeConfigurado, isLoading } = useEntitlement();
  const portal = useServerFn(abrirPortalAssinatura);

  const abrirPortal = useMutation({
    mutationFn: () => portal(),
    onSuccess: (r: any) => {
      if (r?.url) window.location.href = r.url;
      else toast.error("Não foi possível abrir o portal.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir o portal"),
  });

  const tierAtual = TIERS.find((t) => t.id === entitlement.tier);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
              <h2 className="font-display text-xl font-bold">
                {isLoading ? "…" : tierLabel(entitlement)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {STATUS_LABELS[entitlement.status] ?? entitlement.status}
                {entitlement.isFounders ? " · acesso completo (oferta Founders)" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {entitlement.isFounders && (
                <Badge className="gap-1"><Crown className="h-3.5 w-3.5" /> Founders</Badge>
              )}
              {entitlement.isTrial && <Badge variant="secondary">Período de teste</Badge>}
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Preço</dt>
              <dd className="font-display font-semibold tabular-nums">
                {entitlement.isFounders ? `${brl(GROWTH_PRICE_BRL)}/mês` : tierAtual ? (tierAtual.precoMensal === 0 ? "R$ 0" : `${brl(tierAtual.precoMensal)}/mês`) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {entitlement.cancelAtPeriodEnd ? "Acesso até" : "Próxima renovação"}
              </dt>
              <dd className="font-semibold tabular-nums">{dataBr(entitlement.currentPeriodEnd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Teste até</dt>
              <dd className="font-semibold tabular-nums">{dataBr(entitlement.trialEndsAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!entitlement.hasCustomer || abrirPortal.isPending || !stripeConfigurado}
              onClick={() => abrirPortal.mutate()}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {abrirPortal.isPending ? "Abrindo…" : "Gerenciar assinatura"}
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/planos">
                <Sparkles className="mr-2 h-4 w-4" />
                {entitlement.tier === "growth" ? "Ver planos" : "Conhecer o Growth"}
              </Link>
            </Button>
          </div>

          {!stripeConfigurado && (
            <p className="text-xs text-muted-foreground">
              A cobrança recorrente ainda não está configurada neste ambiente.
            </p>
          )}
          {entitlement.status === "past_due" || entitlement.status === "unpaid" ? (
            <p className="text-xs text-warning-foreground">
              Detectamos um problema no pagamento. Seus dados continuam salvos — atualize a forma de
              pagamento em “Gerenciar assinatura” para manter os recursos liberados.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ComparacaoPlanos tierAtual={entitlement.tier} />
      <LinkPublicoCard />
    </div>
  );
}

function ComparacaoPlanos({ tierAtual }: { tierAtual: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {TIERS.map((p) => (
        <Card
          key={p.id}
          className={cn(
            "relative",
            p.recomendado && "border-primary/60 ring-1 ring-primary/30",
            tierAtual === p.id && "bg-muted/40",
          )}
        >
          {p.recomendado && (
            <Badge className="absolute -top-2 left-4 gap-1">
              <Sparkles className="h-3 w-3" /> Recomendado
            </Badge>
          )}
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display font-bold">{p.nome}</h3>
              <span className="font-display font-semibold tabular-nums">
                {p.precoMensal === 0 ? "R$ 0" : `${brl(p.precoMensal)}/mês`}
              </span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {p.destaques.map((d: string) => (
                <li key={d} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="min-w-0 break-words">{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LinkPublicoCard() {
  const empresaFn = useServerFn(getEmpresa);
  const salvar = useServerFn(atualizarSlugPublico);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["empresa"], queryFn: () => empresaFn() });
  const slugAtual = (data?.empresa as any)?.slug as string | undefined;
  const [slug, setSlug] = useState("");

  const mut = useMutation({
    mutationFn: () => salvar({ data: { slug: slug || slugAtual || "" } }),
    onSuccess: (r: any) => {
      toast.success("Link público atualizado.");
      setSlug("");
      qc.invalidateQueries({ queryKey: ["empresa"] });
      void r;
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar o link"),
  });

  const url = slugAtual ? `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${slugAtual}` : "";

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="font-display font-semibold">Link público de agendamento</h3>
          <p className="text-xs text-muted-foreground">
            É único do seu estabelecimento e compartilhado por toda a equipe. Adicionar ou remover
            funcionários não altera este link.
          </p>
        </div>

        {url && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-muted px-3 py-2 text-xs">{url}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Link copiado");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Personalizar link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugAtual ?? "lava-jato-do-samuel"}
            />
            <Button
              className="w-full sm:w-auto"
              disabled={mut.isPending || slug.trim().length < 3}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Salvando…" : "Salvar link"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Apenas letras minúsculas, números e hífens. Precisa ser único entre todos os
            estabelecimentos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
