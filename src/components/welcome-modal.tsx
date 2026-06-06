import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Rocket, Loader2 } from "lucide-react";
import { getOnboardingState, setOnboardingChoice } from "@/lib/onboarding.functions";
import { toast } from "sonner";

export function WelcomeModal() {
  const fetchState = useServerFn(getOnboardingState);
  const setChoice = useServerFn(setOnboardingChoice);
  const qc = useQueryClient();
  const [pendingChoice, setPendingChoice] = useState<"demo" | "empty" | null>(null);

  const { data } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  const mut = useMutation({
    mutationFn: (choice: "demo" | "empty") => setChoice({ data: { choice } }),
    onSuccess: async (_, choice) => {
      await qc.invalidateQueries();
      if (choice === "demo") toast.success("Sistema populado com dados de demonstração 🎉");
      else toast.success("Pronto! Vamos configurar do zero.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar"),
    onSettled: () => setPendingChoice(null),
  });

  const open = !!data && data.status === "pending";

  function pick(choice: "demo" | "empty") {
    setPendingChoice(choice);
    mut.mutate(choice);
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-8">
          <h2 className="font-display text-3xl font-bold">Bem-vindo ao LavaFlow 👋</h2>
          <p className="mt-2 text-primary-foreground/85">
            Em menos de 2 minutos você vai sentir como o LavaFlow ajuda a aumentar o faturamento do seu lava-rápido.
          </p>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <button
            disabled={mut.isPending}
            onClick={() => pick("demo")}
            className="text-left rounded-xl border-2 border-primary/60 bg-primary/5 hover:bg-primary/10 transition p-5 disabled:opacity-50"
          >
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-content-center mb-3">
              {pendingChoice === "demo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <h3 className="font-display font-semibold text-lg">Explorar com dados de demonstração</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Criamos clientes, ordens, planos e métricas para você ver tudo funcionando agora.
            </p>
            <p className="text-xs text-primary font-medium mt-3">Recomendado para conhecer o sistema →</p>
          </button>

          <button
            disabled={mut.isPending}
            onClick={() => pick("empty")}
            className="text-left rounded-xl border bg-card hover:bg-accent transition p-5 disabled:opacity-50"
          >
            <div className="h-10 w-10 rounded-lg bg-muted grid place-content-center mb-3">
              {pendingChoice === "empty" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
            </div>
            <h3 className="font-display font-semibold text-lg">Começar do zero</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastrar meu negócio, equipe e clientes manualmente. Vamos te guiar passo a passo.
            </p>
            <p className="text-xs text-muted-foreground font-medium mt-3">Para quem já vai usar de verdade →</p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
