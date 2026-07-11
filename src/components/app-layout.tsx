import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  Briefcase,
  CalendarDays,
  Car,
  ClipboardList,
  CreditCard,
  Megaphone,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  Image as ImageIcon,
  Users,
  UsersRound,
  X,
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
  { label: "Operação", items: [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard, tour: "dashboard", roles: GESTAO },
    { to: "/agendamentos", label: "Agenda", icon: CalendarDays, roles: OPERACIONAL },
    { to: "/fila", label: "Fila", icon: ListChecks, roles: OPERACIONAL },
    { to: "/ordens", label: "OS", icon: ClipboardList, roles: OPERACIONAL },
    { to: "/meu-trabalho", label: "Meu Trabalho", icon: Briefcase, roles: OPERACIONAL },
  ]},
  { label: "Relacionamento", items: [
    { to: "/clientes", label: "Clientes", icon: Users, tour: "clientes", roles: OPERACIONAL },
    { to: "/fidelidade", label: "Fidelidade", icon: Award, roles: ADMINS },
    { to: "/assinaturas", label: "Assinaturas", icon: CreditCard, tour: "assinaturas", roles: GESTAO },
    { to: "/campanhas", label: "Campanhas", icon: Megaphone, roles: GESTAO },
  ]},
  { label: "Gestão", items: [
    { to: "/equipe", label: "Equipe", icon: UsersRound, roles: GESTAO },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: GESTAO },
    { to: "/midia", label: "Mídia", icon: ImageIcon, roles: ADMINS },
    { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ADMINS },
  ]},
];

const colabGroups: NavGroup[] = [
  { label: "Operação", items: [
    { to: "/meu-trabalho", label: "Meu Trabalho", icon: Briefcase, roles: ["lavador", "colaborador"] },
  ]},
];

const BOTTOM_TAB_ROUTES = ["/dashboard", "/agendamentos", "/fila", "/ordens", "/meu-trabalho"] as const;

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
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => !role || it.roles.includes(role)),
        }))
        .filter((g) => g.items.length > 0);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-background/80 backdrop-blur-xl px-4 h-16 shadow-[var(--shadow-neo-sm)]">
        <Link to={colab ? "/meu-trabalho" : "/dashboard"} className="inline-flex items-center gap-2 font-display text-lg font-bold leading-none tracking-tight">
          <span className="grid h-9 w-9 place-content-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-[var(--shadow-neo-sm)]">
            <Car className="h-4 w-4 text-primary-foreground" />
          </span>
          Lava<span className="text-primary">Flow</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="grid h-11 w-11 place-content-center rounded-2xl bg-card shadow-[var(--shadow-neo-sm)] transition-all duration-200 hover:shadow-[var(--shadow-neo)] active:shadow-[var(--shadow-neo-inset)]" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-out lg:translate-x-0 shadow-[var(--shadow-neo)]",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="h-20 flex items-center gap-3 px-6">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 grid place-content-center shadow-[var(--shadow-neo-sm)]">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <Link to={colab ? "/meu-trabalho" : "/dashboard"} className="font-display text-xl font-bold tracking-tight">
            Lava<span className="text-primary">Flow</span>
          </Link>
        </div>
        {role && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            <span className="inline-block text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-sidebar-accent/70 text-sidebar-accent-foreground font-semibold">
              {ROLE_LABELS[role]}
            </span>
          </div>
        )}
        <nav className="px-4 py-3 space-y-6 overflow-y-auto h-[calc(100dvh-10rem)]">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">{g.label}</p>
              <ul className="space-y-1">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const active = pathname === it.to || (it.to !== "/dashboard" && pathname.startsWith(it.to));
                  return (
                    <li key={it.to}>
                      <Link to={it.to} data-tour={it.tour} className={cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-250",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-neo-inset)]"
                          : "text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40",
                      )}>
                        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary" />}
                        <Icon className={cn("h-5 w-5 transition-transform duration-200 group-hover:scale-110", active && "text-primary")} />
                        <span>{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-4">
          <Button variant="outline" size="sm" onClick={signOut} className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-200" onClick={() => setOpen(false)} />}

      <main className="lg:pl-64 min-h-screen pb-20 lg:pb-0">
        <div className="px-4 lg:px-10 py-6 lg:py-10 max-w-7xl mx-auto animate-in fade-in duration-300">{children}</div>
      </main>

      {!colab && (() => {
        const opGroup = groups.find((g) => g.label === "Operação");
        const tabs = (opGroup?.items ?? []).filter((it) => BOTTOM_TAB_ROUTES.includes(it.to as any))
          .sort((a, b) => BOTTOM_TAB_ROUTES.indexOf(a.to as any) - BOTTOM_TAB_ROUTES.indexOf(b.to as any));
        if (tabs.length < 2) return null;
        return (
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]">
            <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
              {tabs.map((it) => {
                const Icon = it.icon;
                const active = pathname === it.to || (it.to !== "/dashboard" && pathname.startsWith(it.to));
                return (
                  <li key={it.to}>
                    <Link to={it.to} className={cn(
                      "relative flex flex-col items-center justify-center gap-1 h-16 text-[10px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}>
                      {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-primary" />}
                      <Icon className={cn("h-5 w-5", active && "scale-110")} />
                      <span className="leading-none">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        );
      })()}


      {!colab && <WelcomeModal />}
      {!colab && <GuidedTour />}
      {!colab && <OperationalAlerts />}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
