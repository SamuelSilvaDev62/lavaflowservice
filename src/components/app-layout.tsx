import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Sparkles, Bot, ListChecks, ClipboardList, Users, UserMinus,
  CreditCard, Award, UsersRound, BarChart3, Settings, Menu, X, LogOut, Car,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WelcomeModal } from "@/components/welcome-modal";
import { GuidedTour } from "@/components/guided-tour";

const groups: Array<{ label: string; items: Array<{ to: string; label: string; icon: any; tour?: string }> }> = [
  { label: "Crescimento", items: [
    { to: "/dashboard", label: "Painel Executivo", icon: LayoutDashboard, tour: "dashboard" },
    { to: "/oportunidades", label: "Oportunidades", icon: Sparkles, tour: "oportunidades" },
    { to: "/assistente", label: "Assistente LavaFlow", icon: Bot, tour: "assistente" },
  ]},
  { label: "Operação", items: [
    { to: "/fila", label: "Fila", icon: ListChecks },
    { to: "/ordens", label: "Ordens de serviço", icon: ClipboardList },
  ]},
  { label: "Crescimento", items: [
    { to: "/clientes", label: "Clientes", icon: Users, tour: "clientes" },
    { to: "/clientes/inativos", label: "Inativos", icon: UserMinus },
    { to: "/assinaturas", label: "Assinaturas", icon: CreditCard, tour: "assinaturas" },
    { to: "/fidelidade", label: "Fidelidade", icon: Award },
  ]},
  { label: "Gestão", items: [
    { to: "/equipe", label: "Equipe", icon: UsersRound },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/configuracoes", label: "Configurações", icon: Settings },
  ]},
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 backdrop-blur px-4 h-14">
        <Link to="/dashboard" className="font-display text-lg font-bold tracking-tight">
          Lava<span className="text-primary">Flow</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-md hover:bg-accent" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 grid place-content-center">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
          <Link to="/dashboard" className="font-display text-lg font-bold tracking-tight">
            Lava<span className="text-primary">Flow</span>
          </Link>
        </div>
        <nav className="px-3 py-4 space-y-5 overflow-y-auto h-[calc(100vh-8rem)]">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
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

      <WelcomeModal />
      <GuidedTour />
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
