import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Sparkles, Bot, ListChecks, ClipboardList, Users, UserMinus,
  CreditCard, Award, UsersRound, BarChart3, Settings, Menu, X, LogOut, Car, Briefcase, CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WelcomeModal } from "@/components/welcome-modal";
import { GuidedTour } from "@/components/guided-tour";
import { OperationalAlerts } from "@/components/operational-alerts";
import { useRole } from "@/hooks/use-role";
import { ADMINS, GESTAO, OPERACIONAL, isColaborador, type AppRole, ROLE_LABELS } from "@/lib/rbac";

type NavItem = { to: string; label: string; icon: any; tour?: string; roles: AppRole[] };
type NavGroup = { label: string; items: NavItem[] };

const groupsAll: NavGroup[] = [
  { label: "Visão", items: [
    { to: "/dashboard", label: "Operação do Dia", icon: LayoutDashboard, tour: "dashboard", roles: GESTAO },
    { to: "/oportunidades", label: "Oportunidades", icon: Sparkles, tour: "oportunidades", roles: OPERACIONAL },
    { to: "/assistente", label: "Assistente LavaFlow", icon: Bot, tour: "assistente", roles: GESTAO },
  ]},
  { label: "Operação", items: [
    { to: "/fila", label: "Fila", icon: ListChecks, roles: OPERACIONAL },
    { to: "/ordens", label: "Ordens de serviço", icon: ClipboardList, roles: OPERACIONAL },
    { to: "/agendamentos", label: "Agendamentos", icon: CalendarDays, roles: OPERACIONAL },
  ]},
  { label: "Crescimento", items: [
    { to: "/clientes", label: "Clientes", icon: Users, tour: "clientes", roles: OPERACIONAL },
    { to: "/clientes/inativos", label: "Inativos", icon: UserMinus, roles: OPERACIONAL },
    { to: "/assinaturas", label: "Assinaturas", icon: CreditCard, tour: "assinaturas", roles: OPERACIONAL },
    { to: "/fidelidade", label: "Fidelidade", icon: Award, roles: ADMINS },
  ]},
  { label: "Gestão", items: [
    { to: "/equipe", label: "Equipe", icon: UsersRound, roles: GESTAO },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: GESTAO },
    { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ADMINS },
  ]},
];

const colabGroups: NavGroup[] = [
  { label: "Operação", items: [
    { to: "/meu-trabalho", label: "Meu Trabalho", icon: Briefcase, roles: ["lavador", "colaborador"] },
  ]},
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useRole();

  useEffect(() => setOpen(false), [pathname]);

  const colab = isColaborador(role);
  const groups: NavGroup[] = colab
    ? colabGroups
    : groupsAll
        .map((g) => ({ ...g, items: g.items.filter((it) => !role || it.roles.includes(role)) }))
        .filter((g) => g.items.length > 0);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 backdrop-blur px-4 h-14">
        <Link to={colab ? "/meu-trabalho" : "/dashboard"} className="inline-flex items-center gap-2 font-display text-lg font-bold leading-none tracking-tight">
          Lava<span className="text-primary">Flow</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="grid h-10 w-10 place-content-center rounded-md hover:bg-accent" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 grid place-content-center">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
          <Link to={colab ? "/meu-trabalho" : "/dashboard"} className="font-display text-lg font-bold tracking-tight">
            Lava<span className="text-primary">Flow</span>
          </Link>
        </div>
        {role && (
          <div className="px-5 pt-3 pb-1">
            <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-sidebar-accent/60 text-sidebar-accent-foreground">
              {ROLE_LABELS[role]}
            </span>
          </div>
        )}
        <nav className="px-3 py-4 space-y-5 overflow-y-auto h-[calc(100vh-9rem)]">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((it: any) => {
                  const Icon = it.icon;
                  const active = pathname === it.to || (it.to !== "/dashboard" && pathname.startsWith(it.to));
                  return (
                    <li key={it.to}>
                      <Link to={it.to} data-tour={it.tour} className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}>
                        <Icon className="h-4 w-4" />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-sidebar-foreground/80">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <main className="lg:pl-64 min-h-screen">
        <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {!colab && <WelcomeModal />}
      {!colab && <GuidedTour />}
      {!colab && <OperationalAlerts />}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
