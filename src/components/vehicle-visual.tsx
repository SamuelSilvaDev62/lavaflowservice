import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type VehicleSize = "sm" | "md" | "lg";
type VehicleType = "hatch" | "sedan" | "suv" | "pickup" | "motorcycle" | "van" | "generic";

type VehicleVisualProps = {
  brand?: string | null;
  model?: string | null;
  year?: number | string | null;
  color?: string | null;
  vehicleType?: VehicleType | null;
  fallbackType?: VehicleType;
  size?: VehicleSize;
  show360Effect?: boolean;
  className?: string;
};

const sizeClass: Record<VehicleSize, string> = {
  sm: "h-20 w-28",
  md: "h-28 w-40",
  lg: "h-36 w-56",
};

const fallbackShape: Record<VehicleType, string> = {
  hatch: "rounded-[42%_48%_28%_24%]",
  sedan: "rounded-[50%_46%_22%_24%]",
  suv: "rounded-[34%_34%_18%_18%]",
  pickup: "rounded-[22%_18%_18%_18%]",
  motorcycle: "rounded-full",
  van: "rounded-[24%_24%_16%_16%]",
  generic: "rounded-[42%_42%_22%_22%]",
};

function slug(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferType(model?: string | null, fallback: VehicleType = "generic"): VehicleType {
  const text = slug(model);
  if (/(hilux|s10|ranger|toro|saveiro|strada|amarok)/.test(text)) return "pickup";
  if (/(compass|renegade|tracker|hr-v|creta|t-cross|kicks|sw4)/.test(text)) return "suv";
  if (/(gol|onix|hb20|argo|fit|ka|polo)/.test(text)) return "hatch";
  if (/(sprinter|ducato|kombi|van)/.test(text)) return "van";
  if (/(moto|cg|fan|biz|pcx|yamaha|honda-cb)/.test(text)) return "motorcycle";
  if (/(civic|corolla|versa|virtus|jetta|sentra|cruze)/.test(text)) return "sedan";
  return fallback;
}

export function VehicleVisual({
  brand,
  model,
  year,
  color,
  vehicleType,
  fallbackType = "generic",
  size = "md",
  show360Effect = false,
  className,
}: VehicleVisualProps) {
  const [failed, setFailed] = useState(0);
  const type = vehicleType ?? inferType(model, fallbackType);
  const sources = useMemo(() => {
    const b = slug(brand);
    const m = slug(model);
    const y = slug(year);
    const paths = [];
    if (b && m && y) paths.push(`/vehicles/${b}-${m}-${y}.webp`, `/vehicles/${b}-${m}-${y}.png`);
    if (b && m) paths.push(`/vehicles/${b}-${m}.webp`, `/vehicles/${b}-${m}.png`);
    paths.push(`/vehicles/generic-${type}.webp`, `/vehicles/generic-${type}.png`, "/vehicles/generic-car.webp", "/vehicles/generic-car.png");
    return paths;
  }, [brand, model, year, type]);
  const src = sources[failed];
  const label = [brand, model, year].filter(Boolean).join(" ") || "Veiculo";

  return (
    <div className={cn("relative grid place-items-center", sizeClass[size], className)} aria-label={label}>
      {src ? (
        <img
          src={src}
          alt={label}
          loading="lazy"
          className="relative z-10 max-h-[78%] max-w-full object-contain drop-shadow-[0_16px_22px_rgba(15,23,42,0.18)]"
          onError={() => setFailed((current) => current + 1)}
        />
      ) : (
        <div className="relative z-10 h-[42%] w-[82%]">
          <div
            className={cn(
              "absolute inset-x-[8%] bottom-[22%] h-[55%] bg-gradient-to-br from-sky-200 via-primary/35 to-slate-500 shadow-[0_14px_24px_rgba(15,23,42,.20)]",
              fallbackShape[type],
            )}
            style={color ? { background: `linear-gradient(135deg, ${color}, rgba(14,165,233,.36), rgba(15,23,42,.45))` } : undefined}
          />
          <div className="absolute left-[24%] top-[12%] h-[32%] w-[34%] rounded-t-[70%] bg-white/70 shadow-inner" />
          <div className="absolute bottom-0 left-[20%] h-[28%] w-[28%] rounded-full border-[5px] border-slate-800 bg-slate-200" />
          <div className="absolute bottom-0 right-[18%] h-[28%] w-[28%] rounded-full border-[5px] border-slate-800 bg-slate-200" />
        </div>
      )}
      {show360Effect && (
        <div className="pointer-events-none absolute bottom-1 z-0 flex flex-col items-center">
          <div className="vehicle-visual-orbit h-4 w-24 rounded-[50%] border border-dashed border-primary/45" />
          <span className="-mt-1 text-[10px] font-medium text-primary/75">360°</span>
        </div>
      )}
    </div>
  );
}
