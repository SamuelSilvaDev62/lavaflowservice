import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Copy, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { RequireRole } from "@/components/require-role";
import { ADMINS } from "@/lib/rbac";
import { useOwnerId } from "@/hooks/use-owner-id";
import { supabase } from "@/integrations/supabase/client";
import {
  PUBLIC_BUCKETS,
  pathToPublicUrl,
  uploadTenantFile,
  type MediaBucket,
} from "@/lib/storage/upload";

export const Route = createFileRoute("/_authenticated/midia")({
  component: () => (
    <RequireRole roles={ADMINS}>
      <Page />
    </RequireRole>
  ),
});

const BUCKETS: { id: MediaBucket; label: string; hint: string }[] = [
  { id: "service-images", label: "Serviços", hint: "Fotos exibidas em catálogo e agendamento online." },
  { id: "company-logos", label: "Empresa", hint: "Logos e identidade visual da empresa." },
  { id: "reward-images", label: "Recompensas", hint: "Imagens dos prêmios do programa de fidelidade." },
  { id: "employee-photos", label: "Equipe", hint: "Fotos dos colaboradores." },
  { id: "vehicle-assets", label: "Veículos", hint: "Imagens auxiliares de veículos." },
];

function Page() {
  return (
    <>
      <PageHeader title="Gerenciador de Mídia" subtitle="Organize as imagens da sua operação." />
      <Tabs defaultValue={BUCKETS[0].id}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.id} value={b.id}>
              {b.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {BUCKETS.map((b) => (
          <TabsContent key={b.id} value={b.id}>
            <BucketPanel bucket={b.id} hint={b.hint} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

interface StorageItem {
  name: string;
  id?: string | null;
  metadata?: { size?: number; mimetype?: string } | null;
  updated_at?: string | null;
}

function BucketPanel({ bucket, hint }: { bucket: MediaBucket; hint: string }) {
  const qc = useQueryClient();
  const { ownerId } = useOwnerId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const list = useQuery({
    queryKey: ["media", bucket, ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<StorageItem[]> => {
      const { data, error } = await supabase.storage.from(bucket).list(ownerId!, {
        limit: 200,
        sortBy: { column: "updated_at", order: "desc" },
      });
      if (error) throw error;
      return (data ?? []).filter((d) => d.name && d.name !== ".emptyFolderPlaceholder");
    },
  });

  async function handleFiles(files: FileList) {
    if (!ownerId) return;
    setUploading(true);
    let ok = 0;
    let fail = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadTenantFile({ bucket, file, ownerId });
        ok++;
      } catch (e: any) {
        fail++;
        toast.error(`${file.name}: ${e?.message ?? "falha"}`);
      }
    }
    setUploading(false);
    if (ok > 0) toast.success(`${ok} arquivo(s) enviado(s)`);
    qc.invalidateQueries({ queryKey: ["media", bucket] });
    void fail;
  }

  async function remove(name: string) {
    if (!ownerId) return;
    if (!confirm("Excluir definitivamente este arquivo?")) return;
    const path = `${ownerId}/${name}`;
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Arquivo removido");
    qc.invalidateQueries({ queryKey: ["media", bucket] });
  }

  const totalSize = (list.data ?? []).reduce((acc, it) => acc + (it.metadata?.size ?? 0), 0);
  const isPublic = PUBLIC_BUCKETS.includes(bucket);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{hint}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {list.data?.length ?? 0} arquivo(s) · {(totalSize / 1024 / 1024).toFixed(2)} MB ·{" "}
              <Badge variant="outline" className="text-[10px]">
                {isPublic ? "Público" : "Privado"}
              </Badge>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={uploading || !ownerId}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-2">Enviar imagens</span>
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {list.isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (list.data?.length ?? 0) === 0 ? (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-60" />
            <p className="text-sm">Nenhuma imagem ainda neste bucket.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {(list.data ?? []).map((item) => {
              const path = `${ownerId}/${item.name}`;
              const url = isPublic ? pathToPublicUrl(bucket, path) : null;
              return (
                <div key={item.name} className="group relative overflow-hidden rounded-lg border bg-card">
                  <div className="aspect-square bg-muted">
                    {url ? (
                      <img src={url} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-2 text-[11px]">
                    <p className="truncate" title={item.name}>{item.name}</p>
                    <p className="text-muted-foreground">
                      {((item.metadata?.size ?? 0) / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="pointer-events-auto h-7"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("URL copiada");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="pointer-events-auto h-7"
                      onClick={() => remove(item.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
