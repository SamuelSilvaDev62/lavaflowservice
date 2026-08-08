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
    <Card className="w-full max-w-full overflow-hidden transition-premium hover-lift">
      <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <header className="flex flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-content-center rounded-2xl bg-primary/10 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 basis-[12rem]">
            <div className="flex flex-wrap items-center gap-2">
              {objective && <Badge variant="secondary" className="max-w-full whitespace-normal break-words text-left">{objective}</Badge>}
              {status && (
                <span className={cn("inline-flex max-w-full items-center break-words rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", statusChip[statusTone])}>
                  {status}
                </span>
              )}
            </div>
            <h3 className="mt-2 break-words font-display text-base font-semibold sm:text-lg">{title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {audienceLabel && (
                <span className="inline-flex min-w-0 items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{audienceLabel}</span></span>
              )}
              {date && (
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 shrink-0" />{date}</span>
              )}
              {channels.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  {channels[0]}
                </span>
              )}
            </div>
          </div>
          {metric && (
            <div className="min-w-0 shrink-0 text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
              <p className="break-words font-display text-lg font-bold tabular-nums text-success">{metric.value}</p>
            </div>
          )}
        </header>

        <div className="min-w-0 space-y-3">{children}</div>

        {actions && <div className="flex flex-wrap gap-2 [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
      </CardContent>
    </Card>
  );
}

export const CampaignCard = memo(CampaignCardBase);
