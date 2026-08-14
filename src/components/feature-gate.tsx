import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Sparkles, TrendingUp } from "lucide-react";
import { useFeature } from "@/hooks/use-entitlement";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getGrowthPreview } from "@/lib/growth.functions";
import { brl } from "@/lib/format";
import { FEATURE_LABELS, GROWTH_PRICE_BRL, isFreeFeature, type FeatureKey } from "@/lib/plans";

/** Copy contextual por recurso — dor primeiro, preço depois. Sem PII. */
const PAYWALL_COPY: Partial<Record<FeatureKey, { titulo: string; texto: (p?: any) => string }>> = {
  oportunidades: {
    titulo: "Onde está o dinheiro que você ainda não cobrou",
    texto: (p) =>
      p?.oportunidades?.potencialEstimado > 0
        ? `Encontramos ${brl(p.oportunidades.potencialEstimado)} em oportunidades no seu negócio. Veja onde está esse potencial e o que fazer com o Growth.`
        : "O Growth mostra onde está o potencial escondido na sua base e o que fazer com ele.",
  },
  clientes_inativos: {
    titulo: "Clientes se afastando sem você perceber",
    texto: (p) =>
      p?.oportunidades?.candidatosRetorno > 0
        ? `${p.oportunidades.candidatosRetorno} clientes podem estar se afastando. O Growth prioriza quem abordar e quanto esse retorno pode valer.`
        : "O Growth prioriza quem abordar primeiro e estima quanto esse retorno pode valer.",
  },
  ai_assistant: {
    titulo: "Pergunte ao seu próprio negócio",
    texto: () =>
      "O Consultor analisa seus dados reais — faturamento, agenda, clientes e equipe — e responde em linguagem simples.",
  },
  analises_inteligentes: {
    titulo: "Análises que explicam seus números",
    texto: () => "O Growth interpreta seus dados reais e aponta o que merece atenção agora.",
  },
  recomendacoes: {
    titulo: "Recomendações baseadas na sua operação",
    texto: () => "O Growth sugere próximos passos a partir do histórico real do seu lava-rápido.",
  },
  assinaturas: {
    titulo: "Transforme clientes recorrentes em receita previsível",
    texto: (p) =>
      p?.oportunidades?.candidatosAssinatura > 0
        ? `${p.oportunidades.candidatosAssinatura} clientes já têm perfil de plano mensal. O Growth ajuda a converter essa recorrência em receita previsível.`
        : "Crie planos mensais e transforme clientes fiéis em receita previsível.",
  },
  relatorios_avancados: {
    titulo: "Descubra o que realmente faz seu faturamento crescer",
    texto: () =>
      "Relatórios avançados e Receita Influenciada mostram quais serviços, dias e ações sustentam o resultado.",
  },
  receita_influenciada: {
    titulo: "Saiba quais ações influenciaram sua receita",
    texto: () => "O Growth atribui a receita influenciada pelas ações que você executou.",
  },
  campanhas: {
    titulo: "Falar com a base certa, na hora certa",
    texto: () =>
      "Campanhas organizam quem abordar por WhatsApp, um cliente por vez, e registram o resultado.",
  },
  fidelidade: {
    titulo: "Dê motivo para o cliente voltar",
    texto: () => "Pontos e recompensas aumentam a frequência de quem já confia em você.",
  },
  growth_engine: {
    titulo: "Growth Engine",
    texto: () => "O Growth encontra oportunidades na sua operação e diz o que fazer com elas.",
  },
};

export function UpgradeCard({ feature }: { feature: FeatureKey }) {
  const fetchPreview = useServerFn(getGrowthPreview);
  const { data } = useQuery({
    queryKey: ["growth-preview"],
    queryFn: () => fetchPreview(),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const copy = PAYWALL_COPY[feature];
  const titulo = copy?.titulo ?? `${FEATURE_LABELS[feature]} faz parte do Growth`;
  const texto = copy?.texto?.(data) ?? "Assine o Growth para liberar este recurso.";

  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Recurso Growth
          </p>
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{texto}</p>
        </div>

        {data?.oportunidades?.total ? (
          <div className="mx-auto flex max-w-sm items-center justify-center gap-4 rounded-2xl bg-muted/40 p-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              {data.oportunidades.total} oportunidades
            </span>
            <span className="tabular-nums text-muted-foreground">
              {brl(data.oportunidades.potencialEstimado)} de potencial estimado
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/planos">
              <Sparkles className="mr-2 h-4 w-4" />
              {data?.trialElegivel ? "Testar Growth por 7 dias" : `Assinar Growth · ${brl(GROWTH_PRICE_BRL)}/mês`}
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Seu plano Free continua funcionando normalmente. Valores são potencial estimado a partir do
          seu ticket médio e histórico — não são receita garantida.
        </p>
      </CardContent>
    </Card>
  );
}

/** Bloqueio elegante de UI. A proteção real também existe no backend. */
export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { allowed, isLoading } = useFeature(feature);
  if (isFreeFeature(feature)) return <>{children}</>;
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (!allowed) return <>{fallback ?? <UpgradeCard feature={feature} />}</>;
  return <>{children}</>;
}
