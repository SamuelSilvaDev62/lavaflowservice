import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BookingStep {
  key: string;
  label: string;
}

export function BookingStepper({
  steps,
  currentIndex,
  className,
}: {
  steps: BookingStep[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol
      className={cn("flex w-full items-center gap-1.5 sm:gap-3", className)}
      aria-label="Progresso do agendamento"
    >
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-1.5 sm:gap-3">
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-content-center rounded-full text-xs font-bold tabular-nums transition-premium",
                done && "bg-success text-success-foreground shadow-[var(--shadow-neo-sm)]",
                active && "btn-premium",
                !done && !active && "bg-muted text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden truncate text-xs font-medium sm:inline",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-premium",
                  done ? "bg-success" : "bg-muted",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
