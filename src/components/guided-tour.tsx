import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getOnboardingState, dismissTour } from "@/lib/onboarding.functions";

export function GuidedTour() {
  const fetchState = useServerFn(getOnboardingState);
  const finish = useServerFn(dismissTour);

  const { data } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  useEffect(() => {
    if (!data) return;
    // Só dispara após escolha do modal (status !== pending) e antes de concluir tour
    if (data.status === "pending") return;
    if (data.tourCompletedAt) return;

    // Aguardar render dos elementos
    const t = setTimeout(() => {
      const d = driver({
        showProgress: true,
        nextBtnText: "Próximo",
        prevBtnText: "Voltar",
        doneBtnText: "Concluir",
        progressText: "{{current}} de {{total}}",
        steps: [
          { element: '[data-tour="dashboard"]', popover: { title: "Dashboard", description: "Seu painel de crescimento em tempo real: faturamento, MRR, retenção e ticket médio." } },
          { element: '[data-tour="oportunidades"]', popover: { title: "Oportunidades", description: "Ações automáticas para vender mais — recuperar clientes, oferecer assinatura, premiar fiéis." } },
          { element: '[data-tour="assistente"]', popover: { title: "Assistente", description: "Insights inteligentes do seu negócio com recomendações práticas." } },
          { element: '[data-tour="clientes"]', popover: { title: "Clientes", description: "Sua base completa, com histórico e quem está sumindo." } },
          { element: '[data-tour="assinaturas"]', popover: { title: "Assinaturas", description: "Crie receita recorrente todo mês com planos mensais." } },
        ],
        onDestroyed: () => { finish().catch(() => {}); },
      });
      d.drive();
    }, 600);

    return () => clearTimeout(t);
  }, [data, finish]);

  return null;
}
