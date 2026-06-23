import { supabase } from "@/integrations/supabase/client";

export type MediaBucket =
  | "service-images"
  | "company-logos"
  | "reward-images"
  | "employee-photos"
  | "vehicle-assets"
  | "os-anexos";

export const PUBLIC_BUCKETS: MediaBucket[] = [
  "service-images",
  "company-logos",
  "reward-images",
  "employee-photos",
  "vehicle-assets",
];

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_DIM = 1600;
const WEBP_QUALITY = 0.82;

function uuid(): string {
  // crypto.randomUUID available in modern browsers/edge
  return (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function compressToWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob = canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY })
      : await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/webp",
            WEBP_QUALITY,
          ),
        );
    return blob;
  } catch {
    return file;
  }
}

export interface UploadParams {
  bucket: MediaBucket;
  file: File;
  ownerId: string;
  prefix?: string;
  /** Optional path to delete after successful upload (for replace). */
  replacePath?: string;
}

export interface UploadResult {
  path: string;
  publicUrl: string | null;
}

export async function uploadTenantFile(params: UploadParams): Promise<UploadResult> {
  const { bucket, file, ownerId, prefix, replacePath } = params;
  if (!ownerId) throw new Error("ownerId obrigatório");
  if (!file) throw new Error("arquivo obrigatório");
  if (file.size > MAX_BYTES) throw new Error("Arquivo excede 8MB");
  if (!file.type.startsWith("image/") && bucket !== "os-anexos") {
    throw new Error("Apenas imagens são permitidas");
  }

  const blob = bucket === "os-anexos" ? file : await compressToWebp(file);
  const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop() || "bin";
  const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || "file";
  const path = [ownerId, prefix, `${Date.now()}-${uuid().slice(0, 8)}-${safeBase}.${ext}`]
    .filter(Boolean)
    .join("/");

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: blob.type || "application/octet-stream",
  });
  if (error) throw error;

  if (replacePath && replacePath !== path) {
    await supabase.storage.from(bucket).remove([replacePath]).catch(() => {});
  }

  const publicUrl = PUBLIC_BUCKETS.includes(bucket)
    ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    : null;

  return { path, publicUrl };
}

export async function deleteTenantFile(bucket: MediaBucket, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/** Convert a public URL back into the storage path (best-effort). */
export function urlToPath(bucket: MediaBucket, url?: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export function pathToPublicUrl(bucket: MediaBucket, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
