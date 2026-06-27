import { useState, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getCopilotActionsForRoute, contextLabel, type CopilotAction } from "@/lib/copilot/registry";

const DISMISS_PREFIX = "copilot:dismissed:";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function isDismissed(id: string) {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_PREFIX + id);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > DISMISS_TTL_MS) {
    window.localStorage.removeItem(DISMISS_PREFIX + id);
    return false;
  }
  return true;
}

function dismiss(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISS_PREFIX + id, String(Date.now()));
}

export function ContextualCopilot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0); // força re-render após dismiss

  const allActions = getCopilotActionsForRoute(pathname);
  const actions = allActions.filter((a) => !isDismissed(`${pathname}:${a.id}`));
  const label = contextLabel(pathname);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Não mostrar em rotas de equipe-mobile / modo equipe
  if (pathname.startsWith("/modo-equipe") || pathname.startsWith("/meu-trabalho")) return null;

  const handle = (a: CopilotAction) => {
    setOpen(false);
    if (a.to) {
      navigate({ to: a.to as any }).catch(() => {});
      return;
    }
    if (a.href) {
      window.open(a.href, "_blank", "noreferrer");
      return;
    }
    a.run?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Abrir Copiloto"
          className={cn(
            "fixed bottom-20 right-4 z-40 grid h-14 w-14 place-content-center rounded-full bg-primary text-primary-foreground transition-premium hover-lift press-scale sm:bottom-6",
            "shadow-[var(--shadow-neo)] hover:shadow-[var(--shadow-neo-hover)]",
          )}
        >
          <Sparkles className="h-6 w-6" aria-hidden />
          <span className="sr-only">Copiloto</span>
          <span className="absolute -top-0.5 -right-0.5 grid h-5 w-5 place-content-center rounded-full bg-warning text-[10px] font-bold text-warning-foreground tabular-nums shadow-sm">
            {actions.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[320px] p-0 sm:w-[360px]">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-content-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight">Copiloto</p>
              <p className="truncate text-[11px] text-muted-foreground">Você está em {label}</p>
            </div>
          </div>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {actions.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Sem sugestões agora. Continue navegando — o Copiloto reagrupa em 24h.
            </p>
          ) : (
            <ul className="space-y-1">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.id}>
                    <div className="group flex items-center gap-2 rounded-xl p-1 hover:bg-muted/60">
                      <button
                        type="button"
                        onClick={() => handle(a)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left"
                      >
                        <div
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-content-center rounded-lg",
                            a.tone === "primary" && "bg-primary/10 text-primary",
                            a.tone === "success" && "bg-success/15 text-success",
                            a.tone === "warning" && "bg-warning/15 text-warning-foreground",
                            (!a.tone || a.tone === "default") && "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.label}</p>
                          {a.description && (
                            <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Dispensar"
                        onClick={() => { dismiss(`${pathname}:${a.id}`); setTick((t) => t + 1); }}
                        className="grid h-7 w-7 shrink-0 place-content-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {tick < 0 && null /* keep tick reactive */}
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => { setOpen(false); navigate({ to: "/inteligencia" }).catch(() => {}); }}
          >
            Abrir Consultor Inteligente
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
