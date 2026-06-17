import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowRight, X } from "lucide-react";
import { getOnboardingState, finishOnboarding } from "@/lib/onboarding.functions";
import { useMemo } from "react";

type Step = { id: string; label: string; hint: string; to: string; done: boolean };

export function SetupChecklist() {
  const fetchState = useServerFn(getOnboardingState);
  const finish = useServerFn(finishOnboarding);
  const qc = useQueryClient();

  const { data: state } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  const dismiss = useMutation({
    mutationFn: () => finish(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });

  const steps: Step[] = useMemo(() => {
    if (!state) return [];
    return [
      { id: "empresa", label: "Configurar empresa", hint: "Nome, WhatsApp e endereço do seu lava-rápido.", to: "/configuracoes", done: state.empresaConfigurada },
      { id: "servico", label: "Cadastrar primeiro serviço", hint: "Comece pelo serviço que você mais vende.", to: "/configuracoes", done: state.counts.servicos > 0 },
      { id: "funcionario", label: "Cadastrar primeiro funcionário", hint: "Para acompanhar produtividade e comissão.", to: "/equipe", done: state.counts.funcionarios > 0 },
      { id: "cliente", label: "Cadastrar primeiro cliente", hint: "Cada cliente vira histórico, pontos e oportunidades.", to: "/clientes", done: state.counts.clientes > 0 },
      { id: "ordem", label: "Criar primeira OS", hint: "Coloque um veículo na fila e veja o fluxo funcionando.", to: "/fila", done: state.counts.ordens > 0 },
      { id: "fidelidade", label: "Configurar fidelidade", hint: "Crie recompensas para reter clientes.", to: "/fidelidade", done: (state.counts as any).recompensas > 0 || (state.completedSteps ?? []).includes("fidelidade_configurada") },
      { id: "plano", label: "Criar primeiro plano de assinatura", hint: "Receita recorrente — o ativo mais valioso.", to: "/assinaturas", done: state.counts.planos > 0 },
    ];
  }, [state]);

  if (!state) return null;
  const completed = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  // Esconde só quando 100% concluído OU o usuário dispensou explicitamente
  if (pct === 100 || state.status === "done") return null;
  if (state.status === "pending") return null;


  return (
    <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-semibold">Configure seu negócio</h3>
            <p className="text-xs text-muted-foreground mt-1">{completed} de {steps.length} concluídos · {pct}%</p>
          </div>
          <button onClick={() => dismiss.mutate()} className="text-muted-foreground hover:text-foreground" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Progress value={pct} className="h-2 mb-4" />
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.id}>
              <Link
                to={s.to}
                className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-accent transition group"
              >
                <span className={`h-5 w-5 mt-0.5 rounded-full grid place-content-center text-xs shrink-0 ${s.done ? "bg-success text-success-foreground" : "border-2 border-muted-foreground/30"}`}>
                  {s.done && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${s.done ? "text-muted-foreground line-through" : "font-medium"}`}>{s.label}</span>
                  {!s.done && <span className="block text-[11px] text-muted-foreground mt-0.5">{s.hint}</span>}
                </span>
                {!s.done && <ArrowRight className="h-3 w-3 mt-1 text-muted-foreground group-hover:text-primary shrink-0" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
