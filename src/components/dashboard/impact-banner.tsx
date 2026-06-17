import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { brl } from "@/lib/format";

export function ImpactBanner({ clientes, faturamento }: { clientes: number; faturamento: number }) {
  const today = new Date();
  // Esconde no início do mês quando ainda não há sinal
  if (clientes === 0 && today.getDate() < 5) return null;
  if (clientes === 0 && faturamento === 0) return null;

  return (
    <Card className="mb-4 overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-content-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">Impacto do mês</p>
            <p className="text-sm sm:text-base leading-snug">
              O LavaFlow ajudou você a recuperar{" "}
              <strong className="text-primary">{clientes}</strong>{" "}
              {clientes === 1 ? "cliente" : "clientes"} e gerar{" "}
              <strong className="text-primary tabular-nums">{brl(faturamento)}</strong>{" "}
              em faturamento adicional.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
