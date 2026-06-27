import { memo, useMemo } from "react";
import { Sunrise, Sun, Moon, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type Slot = { hora: string; disponivel: boolean };

interface Props {
  slots: Slot[];
  value?: string;
  onChange: (hora: string) => void;
  loading?: boolean;
  duracaoMin?: number | null;
}

const PERIODS = [
  { id: "manha", label: "Manhã", icon: Sunrise, from: 0, to: 12 },
  { id: "tarde", label: "Tarde", icon: Sun, from: 12, to: 18 },
  { id: "noite", label: "Noite", icon: Moon, from: 18, to: 24 },
] as const;

function formatDuracao(min?: number | null) {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

export const TimeSlotPicker = memo(function TimeSlotPicker({ slots, value, onChange, loading, duracaoMin }: Props) {
  const grouped = useMemo(() => {
    const out = PERIODS.map((p) => ({
      ...p,
      slots: slots.filter((s) => {
        const h = parseInt(s.hora.slice(0, 2), 10);
        return h >= p.from && h < p.to;
      }),
    }));
    return out;
  }, [slots]);

  // Próximo disponível = recomendado
  const recomendado = useMemo(() => slots.find((s) => s.disponivel)?.hora, [slots]);
  const dur = formatDuracao(duracaoMin);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-2xl border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
        Sem horários disponíveis nesta data. Escolha outro dia.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map((p) => {
        if (!p.slots.length) return null;
        const Icon = p.icon;
        return (
          <div key={p.id} className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden />
              <span>{p.label}</span>
              <div className="ml-2 h-px flex-1 bg-border" aria-hidden />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {p.slots.map((s) => {
                const active = value === s.hora;
                const isReco = recomendado === s.hora && !active;
                return (
                  <button
                    key={s.hora}
                    type="button"
                    disabled={!s.disponivel}
                    onClick={() => onChange(s.hora)}
                    className={cn(
                      "relative min-h-12 rounded-2xl border bg-card px-2 text-base font-semibold tabular-nums transition-premium press-scale",
                      active && "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-neo)]",
                      !active && s.disponivel && "hover-lift hover:border-primary/40",
                      !s.disponivel && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {isReco && (
                      <span className="absolute -top-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning-foreground shadow-sm">
                        <Star className="h-2.5 w-2.5" aria-hidden /> Reco
                      </span>
                    )}
                    {s.hora}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {dur && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Duração estimada: {dur}
        </p>
      )}
    </div>
  );
});
