import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssinaturas, upsertPlano, confirmarPagamentoAssinatura, cancelarAssinatura } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";

import { Plus, Repeat, Users, TrendingUp, Copy, Share2, QrCode, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { QrCodeDialog } from "@/components/qr-code-dialog";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: PageGuarded,
});

function PageGuarded() {
  return <RequireRole roles={GESTAO}><Page /></RequireRole>;
}

function planoUrl(slug: string) {
  if (typeof window === "undefined") return `/plano/${slug}`;
  return `${window.location.origin}/plano/${slug}`;
}

function Page() {
  const fn = useServerFn(getAssinaturas);
  const up = useServerFn(upsertPlano);
  const confirmar = useServerFn(confirmarPagamentoAssinatura);
  const cancelar = useServerFn(cancelarAssinatura);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["assinaturas"], queryFn: () => fn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", valor_mensal: 0, quantidade_lavagens: 4, beneficios: "", descricao: "", chave_pix: "" });
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => up({ data: {
      nome: form.nome,
      valor_mensal: form.valor_mensal,
      quantidade_lavagens: form.quantidade_lavagens,
      beneficios: form.beneficios.split("\n").filter(Boolean),
      descricao: form.descricao || null,
      chave_pix: form.chave_pix || null,
      ativo: true,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assinaturas"] }); setOpen(false); setForm({ nome: "", valor_mensal: 0, quantidade_lavagens: 4, beneficios: "", descricao: "", chave_pix: "" }); toast.success("Plano criado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const confirmarMut = useMutation({
    mutationFn: (id: string) => confirmar({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assinaturas"] }); toast.success("Assinatura ativada!"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const cancelarMut = useMutation({
    mutationFn: (id: string) => cancelar({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assinaturas"] }); toast.info("Cancelada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const copiarLink = (slug: string) => {
    const url = planoUrl(slug);
    navigator.clipboard.writeText(url); toast.success("Link copiado");
  };
  const compartilharWa = (slug: string, nome: string, valor: number) => {
    const msg = `Conheça nosso plano *${nome}* por ${brl(valor)}/mês 🚗✨\nAssine pelo link: ${planoUrl(slug)}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <>
      <PageHeader title="Assinaturas" subtitle="Receita previsível mês a mês."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo plano</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo plano</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
                <div><Label>Nome*</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor mensal*</Label><Input type="number" step="0.01" inputMode="decimal" placeholder="0,00" required value={form.valor_mensal === 0 ? "" : form.valor_mensal} onChange={(e) => setForm({ ...form, valor_mensal: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
                  <div><Label>Lavagens/mês*</Label><Input type="number" inputMode="numeric" placeholder="0" required value={form.quantidade_lavagens === 0 ? "" : form.quantidade_lavagens} onChange={(e) => setForm({ ...form, quantidade_lavagens: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
                </div>
                <div><Label>Descrição curta</Label><Input placeholder="Ex: Lavagem completa toda semana" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
                <div><Label>Chave PIX (opcional)</Label><Input placeholder="CPF, e-mail, telefone ou chave aleatória" value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} /></div>
                <div><Label>Benefícios (1 por linha)</Label><Textarea rows={3} value={form.beneficios} onChange={(e) => setForm({ ...form, beneficios: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending}>Criar plano</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex gap-1 items-center"><Repeat className="h-3 w-3" />MRR</p><p className="font-display text-2xl font-bold text-success">{brl(data?.mrr ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex gap-1 items-center"><Users className="h-3 w-3" />Assinantes</p><p className="font-display text-2xl font-bold">{data?.ativas ?? 0}</p></CardContent></Card>
        <Card className={data?.pendentesCount ? "border-warning/40" : ""}>
          <CardContent className="p-4"><p className="text-xs text-muted-foreground flex gap-1 items-center"><Clock className="h-3 w-3" />Pendentes</p>
          <p className={`font-display text-2xl font-bold ${data?.pendentesCount ? "text-warning" : ""}`}>{data?.pendentesCount ?? 0}</p></CardContent>
        </Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex gap-1 items-center"><TrendingUp className="h-3 w-3" />ARR projetado</p><p className="font-display text-2xl font-bold text-primary">{brl((data?.mrr ?? 0) * 12)}</p></CardContent></Card>
      </div>

      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}

      {!isLoading && (data?.planos.length ?? 0) === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Crie seu primeiro plano de assinatura"
          description="Assinaturas garantem receita previsível todo mês — sem depender só do movimento do dia."
          highlight="1 plano de R$ 99/mês × 30 assinantes = R$ 2.970 fixos por mês"
          ctas={[{ label: "Criar primeiro plano", onClick: () => setOpen(true) }]}
        />
      ) : (
        <Tabs defaultValue="planos" className="mb-6">
          <TabsList>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="pendentes">
              Pendentes{data?.pendentesCount ? <Badge variant="secondary" className="ml-2">{data.pendentesCount}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
          </TabsList>

          <TabsContent value="planos">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data?.planos.map((p: any) => (
                <Card key={p.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-display font-bold">{p.nome}</h4>
                      {p.ativo ? <Badge>Ativo</Badge> : <Badge variant="outline">Pausado</Badge>}
                    </div>
                    <p className="font-display text-3xl font-bold text-primary">{brl(p.valor_mensal)}<span className="text-xs text-muted-foreground">/mês</span></p>
                    <p className="text-sm text-muted-foreground mt-1">{p.quantidade_lavagens} lavagens/mês</p>
                    {p.descricao && <p className="text-xs text-muted-foreground mt-2">{p.descricao}</p>}
                    <ul className="mt-3 space-y-1 text-sm">{(p.beneficios ?? []).map((b: string, i: number) => <li key={i}>· {b}</li>)}</ul>

                    {p.slug && (
                      <div className="mt-4 pt-3 border-t space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Link público</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => copiarLink(p.slug)}><Copy className="h-3 w-3 mr-1" />Copiar</Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => compartilharWa(p.slug, p.nome, p.valor_mensal)}><Share2 className="h-3 w-3 mr-1" />WhatsApp</Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setQrUrl(planoUrl(p.slug))}><QrCode className="h-3 w-3 mr-1" />QR</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pendentes">
            <Card><CardContent className="p-0"><div className="divide-y">
              {(data?.pendentes ?? []).map((a: any) => (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.clientes?.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.planos_assinatura?.nome} · {brl(a.planos_assinatura?.valor_mensal)}/mês · {a.clientes?.telefone}</p>
                    {a.observacoes && <p className="text-xs text-muted-foreground mt-1">{a.observacoes}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => confirmarMut.mutate(a.id)} disabled={confirmarMut.isPending}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirmar pagamento</Button>
                    <Button size="sm" variant="outline" onClick={() => cancelarMut.mutate(a.id)} disabled={cancelarMut.isPending}><XCircle className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                  </div>
                </div>
              ))}
              {data?.pendentes.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma assinatura pendente.</p>}
            </div></CardContent></Card>
          </TabsContent>

          <TabsContent value="ativos">
            <Card><CardContent className="p-0"><div className="divide-y">
              {data?.assinaturas.map((a: any) => (
                <div key={a.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{a.clientes?.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.planos_assinatura?.nome} · próxima cobrança {a.proxima_cobranca}</p>
                  </div>
                  <span className="font-semibold">{brl(a.planos_assinatura?.valor_mensal)}</span>
                </div>
              ))}
              {data?.assinaturas.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nenhum assinante ativo ainda.</p>}
            </div></CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      <QrCodeDialog open={!!qrUrl} onOpenChange={(o) => !o && setQrUrl(null)} url={qrUrl ?? ""} />
    </>
  );
}
