import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPlanoPublico, criarAssinaturaPendente } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Check, Sparkles, MapPin, Phone, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/plano/$slug")({
  component: Page,
  head: ({ params }) => ({
    meta: [
      { title: `Assine nosso plano · ${params.slug}` },
      { name: "description", content: "Plano mensal de lavagens com benefícios exclusivos." },
      { property: "og:title", content: "Plano mensal de lavagens" },
      { property: "og:description", content: "Assine e economize todo mês." },
    ],
  }),
});

function Page() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPlanoPublico);
  const enviar = useServerFn(criarAssinaturaPendente);
  const { data, isLoading, error } = useQuery({
    queryKey: ["plano-publico", slug],
    queryFn: () => fn({ data: { slug } }),
    retry: false,
  });

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nome: "", telefone: "", veiculo: "", placa: "", observacoes: "" });
  const [sent, setSent] = useState(false);

  const mut = useMutation({
    mutationFn: () => enviar({ data: { slug, ...f } }),
    onSuccess: () => setSent(true),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar"),
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center"><div className="h-16 w-16 rounded-full bg-muted animate-pulse" /></div>;
  if (error || !data) return <div className="min-h-screen grid place-items-center p-6"><Card><CardContent className="p-8 text-center"><p className="font-display text-xl font-bold mb-2">Plano não encontrado</p><p className="text-sm text-muted-foreground">Verifique o link com o estabelecimento.</p></CardContent></Card></div>;

  const { plano, empresa } = data;
  const waMsg = `Olá! Acabei de assinar o plano *${plano.nome}* (${brl(plano.valor_mensal)}/mês). Vou fazer o pagamento via PIX.`;
  const ownerWa = empresa?.whatsapp || empresa?.telefone || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/20">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-6">
          {empresa?.logo_url && <img src={empresa.logo_url} alt={empresa.nome_fantasia ?? ""} className="h-14 mx-auto mb-3 rounded-lg" />}
          <p className="text-sm text-muted-foreground">{empresa?.nome_fantasia}</p>
        </div>

        <Card className="overflow-hidden border-primary/30 shadow-xl">
          <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 sm:p-8 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-80" />
            <h1 className="font-display text-2xl sm:text-3xl font-bold">{plano.nome}</h1>
            {plano.descricao && <p className="text-sm opacity-90 mt-2">{plano.descricao}</p>}
            <p className="font-display text-4xl sm:text-5xl font-black mt-4 tabular-nums">{brl(plano.valor_mensal)}<span className="text-base font-medium opacity-80">/mês</span></p>
            <p className="text-sm opacity-90 mt-1">{plano.quantidade_lavagens} lavagens por mês</p>
          </div>

          <CardContent className="p-6 sm:p-8">
            {plano.beneficios && plano.beneficios.length > 0 && (
              <ul className="space-y-2.5 mb-6">
                {plano.beneficios.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5"><Check className="h-5 w-5 text-success shrink-0 mt-0.5" /><span className="text-sm">{b}</span></li>
                ))}
              </ul>
            )}

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSent(false); }}>
              <DialogTrigger asChild><Button size="lg" className="w-full font-display font-bold text-base h-12">Assinar agora</Button></DialogTrigger>
              <DialogContent>
                {!sent ? (
                  <>
                    <DialogHeader><DialogTitle>Seus dados</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
                      <div><Label>Nome*</Label><Input required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
                      <div><Label>Telefone (WhatsApp)*</Label><Input required placeholder="(11) 99999-9999" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Veículo</Label><Input placeholder="Ex: Civic preto" value={f.veiculo} onChange={(e) => setF({ ...f, veiculo: e.target.value })} /></div>
                        <div><Label>Placa</Label><Input placeholder="ABC1D23" value={f.placa} onChange={(e) => setF({ ...f, placa: e.target.value.toUpperCase() })} /></div>
                      </div>
                      <div><Label>Observações</Label><Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
                      <Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "Enviando..." : "Confirmar assinatura"}</Button>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-4 space-y-4">
                    <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
                    <div>
                      <p className="font-display text-xl font-bold">Tudo certo!</p>
                      <p className="text-sm text-muted-foreground mt-1">Falta só confirmar o pagamento via PIX.</p>
                    </div>
                    {plano.chave_pix ? (
                      <div className="bg-accent/50 rounded-lg p-4 text-left">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Chave PIX</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-sm font-mono break-all">{plano.chave_pix}</code>
                          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(plano.chave_pix ?? ""); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Button>
                        </div>
                        <p className="text-sm mt-2">Valor: <strong>{brl(plano.valor_mensal)}</strong></p>
                      </div>
                    ) : (
                      <p className="text-sm">Combine o pagamento diretamente com o estabelecimento.</p>
                    )}
                    {ownerWa && (
                      <Button asChild className="w-full"><a href={waLink(ownerWa, waMsg)} target="_blank" rel="noreferrer">Avisar pagamento no WhatsApp</a></Button>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <div className="mt-6 pt-5 border-t space-y-1.5 text-xs text-muted-foreground">
              {empresa?.endereco && <p className="flex gap-1.5 items-start"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{empresa.endereco}</p>}
              {ownerWa && <p className="flex gap-1.5 items-center"><Phone className="h-3.5 w-3.5" />{ownerWa}</p>}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">Powered by LavaFlow</p>
      </div>
    </div>
  );
}
