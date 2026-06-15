import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";

export function QrCodeDialog({ open, onOpenChange, url, title = "Compartilhe seu plano" }: {
  open: boolean; onOpenChange: (o: boolean) => void; url: string; title?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    if (!open || !url) return;
    QRCode.toDataURL(url, { width: 400, margin: 2 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [open, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {dataUrl ? <img src={dataUrl} alt="QR Code" className="mx-auto rounded-lg border bg-white" /> : <div className="h-64 bg-muted animate-pulse rounded-lg" />}
          <div className="bg-muted rounded-lg p-3 text-xs break-all font-mono">{url}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy className="h-4 w-4 mr-1" />Copiar link</Button>
            {dataUrl && (
              <Button asChild variant="outline"><a href={dataUrl} download="qrcode-plano.png"><Download className="h-4 w-4 mr-1" />Baixar QR</a></Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
