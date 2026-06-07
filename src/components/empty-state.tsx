import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export type EmptyStateCTA = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctas,
  highlight,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctas?: EmptyStateCTA[];
  highlight?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-dashed">
      <CardContent className="p-8 sm:p-12">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary grid place-content-center mb-4">
            <Icon className="h-7 w-7" />
          </div>
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
          {highlight && (
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
              💡 {highlight}
            </p>
          )}
          {ctas && ctas.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {ctas.map((c, i) =>
                c.to ? (
                  <Button asChild key={i} variant={c.variant ?? (i === 0 ? "default" : "outline")} size="sm">
                    <Link to={c.to}>
                      {c.label} <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button key={i} onClick={c.onClick} variant={c.variant ?? (i === 0 ? "default" : "outline")} size="sm">
                    {c.label}
                  </Button>
                ),
              )}
            </div>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
