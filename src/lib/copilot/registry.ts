import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  RefreshCcw,
  Users,
  Wallet,
  Eye,
  Trophy,
  Gift,
  Wrench,
} from "lucide-react";

export type CopilotAction = {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning";
  to?: string;
  href?: string;
  run?: () => void | Promise<void>;
};

export type CopilotContext = {
  pathname: string;
  greeting: string;
};

/**
 * Sugestões determinísticas por rota. Nada de IA generativa aqui — é apenas
 * um atalho contextual que economiza cliques. Cada item navega/abre dialog.
 */
export function getCopilotActionsForRoute(pathname: string): CopilotAction[] {
  if (pathname.startsWith("/dashboard")) {
    return [
      { id: "agenda-hoje", label: "Ver agenda de hoje", icon: CalendarClock, to: "/agendamentos", tone: "primary" },
      { id: "reagendar-noshow", label: "Reagendar no-shows", description: "Clientes que faltaram nos últimos 7 dias", icon: RefreshCcw, to: "/agendamentos?status=nao_compareceu" },
      { id: "ordens-pendentes", label: "Concluir OS pendentes", icon: Wrench, to: "/ordens" },
      { id: "insights", label: "Ver oportunidades", icon: Sparkles, to: "/inteligencia" },
    ];
  }
  if (pathname.startsWith("/agendamentos")) {
    return [
      { id: "novo-agendamento", label: "Novo agendamento", icon: CalendarClock, to: "/agendamentos?novo=1", tone: "primary" },
      { id: "marcar-concluido", label: "Marcar como concluído", description: "Atualize o status da reserva selecionada", icon: CheckCircle2 },
      { id: "confirmar-whatsapp", label: "Confirmar via WhatsApp", icon: MessageCircle },
      { id: "ver-fila", label: "Ver fila operacional", icon: Eye, to: "/fila" },
    ];
  }
  if (pathname.startsWith("/ordens")) {
    return [
      { id: "avancar-status", label: "Avançar status da OS", icon: CheckCircle2, tone: "primary" },
      { id: "marcar-entregue", label: "Marcar entregue", icon: CheckCircle2, tone: "success" },
      { id: "fila", label: "Abrir fila", icon: Eye, to: "/fila" },
    ];
  }
  if (pathname.startsWith("/clientes")) {
    return [
      { id: "novo-cliente", label: "Cadastrar cliente", icon: Users, to: "/clientes?novo=1", tone: "primary" },
      { id: "oferta-retorno", label: "Enviar oferta de retorno", description: "Para clientes inativos há mais de 30 dias", icon: Gift, to: "/clientes/inativos" },
    ];
  }
  if (pathname.startsWith("/equipe")) {
    return [
      { id: "marcar-pagamento", label: "Marcar pagamento de comissão", icon: Wallet, tone: "primary" },
      { id: "ranking-mes", label: "Ver ranking do mês", icon: Trophy },
    ];
  }
  if (pathname.startsWith("/inteligencia")) {
    return [
      { id: "criar-campanha", label: "Criar campanha", icon: Sparkles, to: "/campanhas?novo=1", tone: "primary" },
    ];
  }
  if (pathname.startsWith("/fila")) {
    return [
      { id: "avancar-fila", label: "Avançar próxima OS", icon: CheckCircle2, tone: "primary" },
    ];
  }
  return [
    { id: "ir-dashboard", label: "Abrir Painel Executivo", icon: Eye, to: "/dashboard" },
    { id: "ir-agenda", label: "Abrir Agendamentos", icon: CalendarClock, to: "/agendamentos" },
  ];
}

export function contextLabel(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Painel Executivo";
  if (pathname.startsWith("/agendamentos")) return "Agendamentos";
  if (pathname.startsWith("/ordens")) return "Ordens de Serviço";
  if (pathname.startsWith("/clientes")) return "Clientes";
  if (pathname.startsWith("/equipe")) return "Equipe";
  if (pathname.startsWith("/inteligencia")) return "Consultor Inteligente";
  if (pathname.startsWith("/fila")) return "Fila operacional";
  if (pathname.startsWith("/campanhas")) return "Campanhas";
  if (pathname.startsWith("/relatorios")) return "Relatórios";
  return "LavaFlow";
}
