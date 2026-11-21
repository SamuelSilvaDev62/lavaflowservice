import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DashboardKpiCardProps = {
  icon: LucideIcon;
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
  icon: Icon, label, value, hint, accent = "blue",
}: DashboardKpiCardProps) {
  return (
    <Card className="h-full min-w-0 border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full min-h-36 flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 text-xs font-medium leading-5 text-muted-foreground sm:text-sm">{label}</span>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ACCENTS[accent]}`}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="break-words font-display text-2xl font-bold leading-tight tracking-tight tabular-nums sm:text-[28px]">{value}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
