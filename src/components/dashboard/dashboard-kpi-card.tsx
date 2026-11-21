import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

type DashboardKpiCardProps = {
  icon: LucideIcon;
  to: "/agendamentos" | "/fila";
  actionLabel: string;
  label: string;
  value: string;
  hint: string;
  accent?: "blue" | "green" | "amber" | "slate";
};

const ACCENTS = {
  blue: "bg-primary/10 text-primary",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  slate: "bg-muted text-foreground",
} as const;

/** Compact executive metric: no invented trend or percentage. */
export function DashboardKpiCard({
  icon: Icon, to, actionLabel, label, value, hint, accent = "blue",
}: DashboardKpiCardProps) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. ${actionLabel}`}
      className="group block h-full min-w-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
    <Card className="h-full min-w-0 cursor-pointer border border-border/60 bg-card shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md group-focus-visible:border-primary">
      <CardContent className="flex h-full min-h-36 flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 text-xs font-medium leading-5 text-muted-foreground sm:text-sm">{label}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${ACCENTS[accent]}`}>
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" aria-hidden />
          </span>
        </div>
        <div className="min-w-0">
          <p className="break-words font-display text-2xl font-bold leading-tight tracking-tight tabular-nums sm:text-[28px]">{value}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{hint}</p>
          <p className="mt-2 text-[11px] font-semibold text-primary opacity-80 transition-opacity group-hover:opacity-100">{actionLabel}</p>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
