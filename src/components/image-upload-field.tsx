import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadTenantFile, urlToPath, type MediaBucket } from "@/lib/storage/upload";
import { useOwnerId } from "@/hooks/use-owner-id";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  bucket: MediaBucket;
  value?: string | null;
  onChange: (publicUrl: string | null, path: string | null) => void;
  prefix?: string;
  label?: string;
  hint?: string;
  className?: string;
  /** Aspect ratio for preview: 'square' | 'video' | 'wide' */
  aspect?: "square" | "video" | "wide";
}

const aspectClass: Record<NonNullable<ImageUploadFieldProps["aspect"]>, string> = {
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[3/1]",
};

export function ImageUploadField({
  bucket,
  value,
  onChange,
  prefix,
  label,
  hint,
  className,
  aspect = "video",
}: ImageUploadFieldProps) {
  const { ownerId } = useOwnerId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!ownerId) {
      toast.error("Sessão não carregada. Tente novamente.");
      return;
    }
    setLoading(true);
    try {
      const replacePath = value ? urlToPath(bucket, value) ?? undefined : undefined;
      const { path, publicUrl } = await uploadTenantFile({
        bucket,
        file,
        ownerId,
        prefix,
        replacePath,
      });
      onChange(publicUrl, path);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar imagem");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!value) return;
    const path = urlToPath(bucket, value);
    onChange(null, null);
    if (path) {
      try {
        await supabase.storage.from(bucket).remove([path]);
      } catch {
        /* silent */
      }
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/40",
          aspectClass[aspect],
        )}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading || !ownerId}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-xs">{loading ? "Enviando..." : "Clique para enviar"}</span>
          </button>
        )}
        {value && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
              className="pointer-events-auto h-8"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="ml-1">Trocar</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={loading}
              onClick={handleRemove}
              className="pointer-events-auto h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
