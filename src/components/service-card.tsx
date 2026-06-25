import { useState, memo } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ServiceCardProps {
  nome: string;
  preco?: number | null;
  categoria?: string | null;
  tempoMin?: number | null;
  fotoUrl?: string | null;
  descricao?: string | null;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

function formatDuracao(min?: number | null) {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export const ServiceCard = memo(function ServiceCard({
  nome,
  preco,
  categoria,
  tempoMin,
  fotoUrl,
  descricao,
  selected,
  onClick,
  className,
}: ServiceCardProps) {
  const [loaded, setLoaded] = useState(false);
  const duracao = formatDuracao(tempoMin);
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={!interactive}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl bg-card text-left transition-premium",
        interactive ? "cursor-pointer hover-lift press-scale" : "cursor-default",
        selected
          ? "shadow-[var(--shadow-neo-inset)] ring-2 ring-primary"
          : "shadow-[var(--shadow-neo-sm)] hover:shadow-[var(--shadow-neo)]",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {!loaded && <div className="absolute inset-0 skeleton-shimmer" aria-hidden />}
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={nome}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              loaded ? "image-fade-in opacity-100" : "opacity-0",
            )}
          />
        ) : (
          <div className="absolute inset-0 grid place-content-center text-xs text-muted-foreground">Sem imagem</div>
        )}
        {categoria && (
          <Badge variant="secondary" className="absolute left-2 top-2 backdrop-blur bg-card/80 capitalize">
            {categoria}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-display font-semibold leading-tight truncate">{nome}</h3>
          {typeof preco === "number" && preco > 0 && (
            <span className="shrink-0 font-display text-xl font-bold tabular-nums text-primary">{brl(preco)}</span>
          )}
        </div>
        {descricao && <p className="line-clamp-2 text-xs text-muted-foreground">{descricao}</p>}
        {duracao && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span>{duracao}</span>
          </p>
        )}
      </div>
    </button>
  );
});
