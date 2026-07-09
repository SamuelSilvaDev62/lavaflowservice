import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter, useRouterState } from "@tanstack/react-router";
import type { DriveStep } from "driver.js";
import { getOnboardingState, dismissTour } from "@/lib/onboarding.functions";

const STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: "Operacao do Dia",
      description: "Acompanhe agenda, fila, faturamento previsto e alertas urgentes em uma tela operacional.",
    },
  },
  {
    element: '[data-tour="clientes"]',
    popover: {
      title: "Clientes",
      description: "Consulte sua base, historico e veiculos sem misturar isso com recomendacoes de crescimento.",
    },
  },
  {
    element: '[data-tour="assinaturas"]',
    popover: {
      title: "Assinaturas",
      description: "Gerencie planos mensais e receita recorrente.",
    },
  },
];

export function GuidedTour() {
  const fetchState = useServerFn(getOnboardingState);
  const finish = useServerFn(dismissTour);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const started = useRef(false);

  const { data } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  useEffect(() => {
    if (!data || started.current) return;
    if (data.status === "pending") return;
    if (data.tourCompletedAt) return;

    if (pathname !== "/dashboard") {
      router.navigate({ to: "/dashboard" });
      return;
    }

    started.current = true;

    const t = setTimeout(async () => {
      const steps = STEPS.filter((s) => {
        const sel = typeof s.element === "string" ? s.element : null;
        return sel ? !!document.querySelector(sel) : true;
      });
      if (steps.length === 0) return;

      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
      ]);

      const d = driver({
        showProgress: true,
        allowClose: true,
        smoothScroll: true,
        stagePadding: 6,
        stageRadius: 12,
        nextBtnText: "Proximo",
        prevBtnText: "Voltar",
        doneBtnText: "Comecar a usar",
        progressText: "{{current}} de {{total}}",
        steps,
        onDestroyed: () => {
          finish().catch(() => {});
        },
      });
      d.drive();
    }, 700);

    return () => clearTimeout(t);
  }, [data, pathname, router, finish]);

  return null;
}
