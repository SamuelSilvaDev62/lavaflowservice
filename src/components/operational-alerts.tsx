import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAlertasOperacionais } from "@/lib/lavaflow.functions";

export function OperationalAlerts() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const fn = useServerFn(getAlertasOperacionais);
  const { data } = useQuery({
    queryKey: ["alertas-operacionais"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  const alertas = useMemo(
    () => (data?.alertas ?? []).filter((a: any) => !hidden.includes(a.id)),
    [data, hidden],
  );
  const urgentes = alertas.filter((a: any) => a.prioridade === "alta").length;

  if (alertas.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-neo)]">
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <p className="font-display font-semibold text-sm">Alertas da operacao</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y">
            {alertas.slice(0, 8).map((a: any) => (
              <div key={a.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={a.prioridade === "alta" ? "destructive" : "secondary"}>{a.prioridade}</Badge>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => setHidden((cur) => [...cur, a.id])}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm mt-2">{a.mensagem}</p>
                {a.cta_to && (
                  <a href={a.cta_to} className="mt-2 inline-flex items-center text-xs text-primary hover:underline">
                    {a.cta_label ?? "Abrir"} <ChevronRight className="h-3 w-3 ml-0.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <Button
        onClick={() => setOpen((v) => !v)}
        variant="outline"
        size="icon"
        className="relative h-[38px] w-[38px] rounded-2xl bg-card/95 shadow-[var(--shadow-neo-sm)] hover:shadow-[var(--shadow-neo)]"
        aria-label="Abrir alertas operacionais"
      >
        <Bell className="h-[18px] w-[18px]" />
        <Badge
          variant={urgentes ? "destructive" : "secondary"}
          className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none shadow-sm"
        >
          {alertas.length}
        </Badge>
      </Button>
    </div>
  );
}
