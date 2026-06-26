import { memo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SectionSummaryItem {
  label: string;
  tone?: "success" | "warning" | "info";
  icon?: LucideIcon;
}

export interface SectionSummaryProps {
  eyebrow?: string;
  title: string;
  items: SectionSummaryItem[];
  cta?: { label: string; onClick: () => void; pending?: boolean };
  footer?: ReactNode;
}

const toneClass: Record<NonNullable<SectionSummaryItem["tone"]>, string> = {
  success: "text-success",
  warning: "text-warning-foreground",
  info: "text-muted-foreground",
};

function SectionSummaryBase({ eyebrow, title, items, cta, footer }: SectionSummaryProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
          )}
          <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">{title}</h2>
        </div>
        <ul className="space-y-2.5">
          {items.map((item, i) => {
            const Icon = item.icon ?? CheckCircle2;
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClass[item.tone ?? "info"]}`} />
                <span className="leading-relaxed">{item.label}</span>
              </li>
            );
          })}
        </ul>
        {cta && (
          <div>
            <Button onClick={cta.onClick} disabled={cta.pending} variant="premium">
              {cta.label}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}

export const SectionSummary = memo(SectionSummaryBase);
