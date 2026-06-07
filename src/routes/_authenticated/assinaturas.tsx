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
import { getAssinaturas, upsertPlano } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { Plus, Repeat, Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: Page,
});

function Page() {
  const fn = useServerFn(getAssinaturas);
  const up = useServerFn(upsertPlano);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["assinaturas"], queryFn: () => fn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", valor_mensal: 0, quantidade_lavagens: 4, beneficios: "" });
  const mut = useMutation({
    mutationFn: () => up({ data: { ...form, beneficios: form.beneficios.split("\n").filter(Boolean), ativo: true } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assinaturas"] }); setOpen(false); setForm({ nome: "", valor_mensal: 0, quantidade_lavagens: 4, beneficios: "" }); toast.success("Plano criado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <>
      <PageHeader title="Assinaturas" subtitle="Receita previsível mês a mês."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo plano</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo plano</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
                <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor mensal</Label><Input type="number" step="0.01" inputMode="decimal" placeholder="0,00" required value={form.valor_mensal === 0 ? "" : form.valor_mensal} onChange={(e) => setForm({ ...form, valor_mensal: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
                  <div><Label>Lavagens/mês</Label><Input type="number" inputMode="numeric" placeholder="0" required value={form.quantidade_lavagens === 0 ? "" : form.quantidade_lavagens} onChange={(e) => setForm({ ...form, quantidade_lavagens: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
                </div>
                <div><Label>Benefícios (1 por linha)</Label><Textarea rows={3} value={form.beneficios} onChange={(e) => setForm({ ...form, beneficios: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending}>Criar plano</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex gap-1 items-center"><Repeat className="h-3 w-3" />MRR</p><p className="font-display text-2xl font-bold text-success">{brl(data?.mrr ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex gap-1 items-center"><Users className="h-3 w-3" />Assinantes</p><p className="font-display text-2xl font-bold">{data?.ativas ?? 0}</p></CardContent></Card>
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
        <>
          <h3 className="font-display font-semibold mb-3">Planos</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {data?.planos.map((p: any) => (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-display font-bold">{p.nome}</h4>
                    {p.ativo ? <Badge>Ativo</Badge> : <Badge variant="outline">Pausado</Badge>}
                  </div>
                  <p className="font-display text-3xl font-bold text-primary">{brl(p.valor_mensal)}<span className="text-xs text-muted-foreground">/mês</span></p>
                  <p className="text-sm text-muted-foreground mt-1">{p.quantidade_lavagens} lavagens/mês</p>
                  <ul className="mt-3 space-y-1 text-sm">{(p.beneficios ?? []).map((b: string, i: number) => <li key={i}>· {b}</li>)}</ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <h3 className="font-display font-semibold mb-3">Assinantes ativos</h3>
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
        {data?.assinaturas.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nenhum assinante ainda.</p>}
      </div></CardContent></Card>
    </>
  );
}
