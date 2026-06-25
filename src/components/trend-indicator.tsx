import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type Trend = "up" | "down" | "flat";

export interface TrendIndicatorProps {
  /** Variação numérica (ex.: 12 = +12%). Se omitido, mostra apenas o ícone. */
  value?: number;
  /** Inverte semântica (ex.: cancelamentos: alta = ruim). */
  invert?: boolean;
  /** Sufixo (default: %). */
  suffix?: string;
  /** Casas decimais (default: 0). */
  digits?: number;
  className?: string;
  /** Rótulo curto opcional ("vs. semana passada"). */
  label?: string;
}

function resolveTrend(value?: number): Trend {
  if (value === undefined || value === null || Number.isNaN(value)) return "flat";
  if (Math.abs(value) < 0.5) return "flat";
  return value > 0 ? "up" : "down";
}

export function TrendIndicator({ value, invert = false, suffix = "%", digits = 0, className, label }: TrendIndicatorProps) {
  const trend = resolveTrend(value);
  const positive = invert ? trend === "down" : trend === "up";
  const negative = invert ? trend === "up" : trend === "down";

  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const tone = positive
    ? "text-success bg-success/10"
    : negative
      ? "text-destructive bg-destructive/10"
      : "text-muted-foreground bg-muted";

  const formatted =
    value === undefined || Number.isNaN(value)
      ? "Estável"
      : `${value > 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums transition-premium",
        tone,
        className,
      )}
      aria-label={label ? `${formatted} ${label}` : formatted}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {formatted}
      {label && <span className="ml-1 font-normal text-[10px] opacity-80">{label}</span>}
    </span>
  );
}
