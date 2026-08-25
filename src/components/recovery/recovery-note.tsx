import { Link } from "@tanstack/react-router";
import { ArrowRight, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Evita duplicar o antigo fluxo de reativação dentro de Campanhas.
 * O ranking e a seleção acontecem no Recovery Engine; Campanhas fica responsável pela execução rastreada.
 */
export function RecoveryTrackingNote() {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold">Recuperação de clientes agora vive no Recovery Engine</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Ele prioriza os clientes pelo histórico individual e prepara campanhas que podem ter receita atribuída após o envio confirmado.
            </p>
          </div>
        </div>
        <Link to="/oportunidades" className="inline-flex shrink-0 items-center text-sm font-medium text-primary hover:underline">
          Abrir Recovery <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
