import { memo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Users, MessageCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CampaignCardProps {
  title: string;
  objective?: string;
  audienceLabel?: string;
  status?: string;
  statusTone?: "active" | "draft" | "done" | "paused";
  channels?: ("whatsapp" | "email" | "sms")[];
  date?: string;
  metric?: { label: string; value: string };
  actions?: ReactNode;
  children?: ReactNode;
}

const statusChip: Record<NonNullable<CampaignCardProps["statusTone"]>, string> = {
  active: "chip-soft-opportunity",
  draft: "chip-soft-info",
  done: "chip-soft-success",
  paused: "chip-soft-warning",
};

function CampaignCardBase({
  title,
  objective,
  audienceLabel,
  status,
  statusTone = "draft",
  channels = ["whatsapp"],
  date,
  metric,
  actions,
  children,
}: CampaignCardProps) {
  return (
    <Card className="transition-premium hover-lift">
      <CardContent className="flex flex-col gap-4 p-5">
        <header className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-content-center rounded-2xl bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {objective && <Badge variant="secondary">{objective}</Badge>}
              {status && (
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", statusChip[statusTone])}>
                  {status}
                </span>
              )}
            </div>
            <h3 className="mt-2 truncate font-display text-base font-semibold sm:text-lg">{title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {audienceLabel && (
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{audienceLabel}</span>
              )}
              {date && (
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{date}</span>
              )}
              {channels.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {channels[0]}
                </span>
              )}
            </div>
          </div>
          {metric && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
              <p className="font-display text-lg font-bold tabular-nums text-success">{metric.value}</p>
            </div>
          )}
        </header>

        {children}

        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}

export const CampaignCard = memo(CampaignCardBase);
