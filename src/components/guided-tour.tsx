import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getOnboardingState, dismissTour } from "@/lib/onboarding.functions";

const STEPS: DriveStep[] = [
  {
    element: '[data-tour="dash-assistente"]',
    popover: {
      title: "🤖 Assistente LavaFlow",
      description:
        "Aqui está seu consultor de crescimento. Ele lê seus dados em tempo real e diz o que fazer hoje para faturar mais.",
    },
  },
  {
    element: '[data-tour="dash-score"]',
    popover: {
      title: "Score de Saúde",
      description:
        "Um número de 0 a 100 que mede a saúde do seu lava-rápido — retenção, crescimento, MRR e ticket médio. Acima de 70 é excelente.",
    },
  },
  {
    element: '[data-tour="dash-kpis"]',
    popover: {
      title: "KPIs que importam",
      description:
        "Receita Recuperável (quanto está perdendo com inativos), Faturamento do mês e Receita Recorrente. Tudo numa olhada.",
    },
  },
  {
    element: '[data-tour="dash-oportunidades"]',
    popover: {
      title: "Oportunidades de hoje",
      description:
        "Top 3 ações priorizadas por impacto financeiro. Comece pela primeira — é a que mais dinheiro traz hoje.",
    },
  },
  {
    element: '[data-tour="dash-checklist"]',
    popover: {
      title: "Checklist de setup",
      description:
        "Marque cada passo para configurar seu negócio em minutos. Cada tela vazia tem CTAs que mostram o impacto em receita.",
    },
  },
  {
    element: '[data-tour="oportunidades"]',
    popover: {
      title: "Menu Oportunidades",
      description: "Lista completa de ações automáticas: recuperar clientes, vender assinatura, premiar fiéis.",
    },
  },
  {
    element: '[data-tour="assistente"]',
    popover: {
      title: "Assistente completo",
      description: "Análises detalhadas e recomendações personalizadas do seu negócio.",
    },
  },
  {
    element: '[data-tour="clientes"]',
    popover: {
      title: "Sua base de clientes",
      description: "Histórico completo, veículos, quem está sumindo e quem é VIP.",
    },
  },
  {
    element: '[data-tour="assinaturas"]',
    popover: {
      title: "Receita recorrente",
      description: "Crie planos mensais e transforme clientes ocasionais em receita previsível todo mês.",
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

    // Garante que o tour rode no dashboard
    if (pathname !== "/dashboard") {
      router.navigate({ to: "/dashboard" });
      return;
    }

    started.current = true;

    const t = setTimeout(() => {
      // Filtra steps cujos elementos existem no DOM
      const steps = STEPS.filter((s) => {
        const sel = typeof s.element === "string" ? s.element : null;
        return sel ? !!document.querySelector(sel) : true;
      });
      if (steps.length === 0) return;

      const d = driver({
        showProgress: true,
        allowClose: true,
        smoothScroll: true,
        stagePadding: 6,
        stageRadius: 12,
        nextBtnText: "Próximo →",
        prevBtnText: "← Voltar",
        doneBtnText: "Começar a usar",
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
