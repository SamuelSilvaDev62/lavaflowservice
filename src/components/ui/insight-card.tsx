import { memo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { X, Sparkles } from "lucide-react";

export type InsightTone = "opportunity" | "warning" | "critical" | "info" | "success";

const toneChip: Record<InsightTone, string> = {
  opportunity: "chip-soft-opportunity",
  warning: "chip-soft-warning",
  critical: "chip-soft-critical",
  info: "chip-soft-info",
  success: "chip-soft-success",
};

const toneIconBg: Record<InsightTone, string> = {
  opportunity: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning-foreground",
  critical: "bg-destructive/10 text-destructive",
  info: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
};

export interface InsightCardProps {
  icon?: LucideIcon;
  tone?: InsightTone;
  toneLabel?: string;
  category?: string;
  title: string;
  description: string;
  impact?: string;
  impactLabel?: string;
  primaryAction?: { label: string; onClick: () => void; pending?: boolean; icon?: LucideIcon };
  secondaryAction?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  footer?: ReactNode;
}

function InsightCardBase({
  icon: Icon = Sparkles,
  tone = "opportunity",
  toneLabel = "Oportunidade",
  category,
  title,
  description,
  impact,
  impactLabel = "Impacto estimado",
  primaryAction,
  secondaryAction,
  onDismiss,
  footer,
}: InsightCardProps) {
  const PrimaryIcon = primaryAction?.icon ?? Sparkles;
  return (
    <Card className="group relative overflow-hidden transition-premium hover-lift">
      <CardContent className="flex flex-col gap-4 p-5">
        <header className="flex items-start gap-3">
          <div className={cn("grid h-11 w-11 shrink-0 place-content-center rounded-2xl", toneIconBg[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", toneChip[tone])}>
                {toneLabel}
              </span>
              {category && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {category}
                </span>
              )}
            </div>
            <h3 className="mt-2 font-display text-base font-semibold leading-snug sm:text-lg">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dispensar"
              className="grid h-8 w-8 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        {impact && (
          <div className="flex items-end justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{impactLabel}</span>
            <span className="font-display text-xl font-bold tabular-nums text-success">{impact}</span>
          </div>
        )}

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2">
            {primaryAction && (
              <Button size="sm" onClick={primaryAction.onClick} disabled={primaryAction.pending}>
                <PrimaryIcon className="mr-1.5 h-4 w-4" />
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}

        {footer}
      </CardContent>
    </Card>
  );
}

export const InsightCard = memo(InsightCardBase);
