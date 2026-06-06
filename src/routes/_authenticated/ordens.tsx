import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listOrdens, createOrdem, listClientes, listServicos, listFuncionarios } from "@/lib/lavaflow.functions";
import { brl, dateTimeBr } from "@/lib/format";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ordens")({
  component: Page,
});

const statusColor: Record<string, string> = {
  aguardando: "bg-muted", em_lavagem: "bg-primary/10 text-primary",
  finalizacao: "bg-warning/10", pronto: "bg-success/10 text-success", entregue: "bg-accent",
};

function Page() {
  const list = useServerFn(listOrdens);
  const create = useServerFn(createOrdem);
  const cli = useServerFn(listClientes);
  const sv = useServerFn(listServicos);
  const fn = useServerFn(listFuncionarios);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ordens"], queryFn: () => list() });
  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: () => cli() });
  const { data: servicos } = useQuery({ queryKey: ["servicos"], queryFn: () => sv() });
  const { data: func } = useQuery({ queryKey: ["funcionarios"], queryFn: () => fn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cliente_id: "", servico_id: "", funcionario_id: "", valor: 0 });
  const mut = useMutation({
    mutationFn: () => create({ data: { ...form, servico_id: form.servico_id || null, funcionario_id: form.funcionario_id || null, valor: Number(form.valor) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens"] }); qc.invalidateQueries({ queryKey: ["fila"] }); setOpen(false); toast.success("OS criada"); setForm({ cliente_id: "", servico_id: "", funcionario_id: "", valor: 0 }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <>
      <PageHeader title="Ordens de serviço" subtitle="Histórico completo de atendimentos."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova OS</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova ordem de serviço</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (!form.cliente_id) return toast.error("Selecione um cliente"); mut.mutate(); }} className="space-y-3">
                <div><Label>Cliente</Label>
                  <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{clientes?.clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Serviço</Label>
                  <Select value={form.servico_id} onValueChange={(v) => { const s = servicos?.servicos.find((x: any) => x.id === v); setForm({ ...form, servico_id: v, valor: s?.preco_padrao ?? form.valor }); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{servicos?.servicos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome} · {brl(s.preco_padrao)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Funcionário</Label>
                  <Select value={form.funcionario_id} onValueChange={(v) => setForm({ ...form, funcionario_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>{func?.funcionarios.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending}>Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}
      <Card><CardContent className="p-0">
        <div className="divide-y">
          {data?.ordens.map((o: any) => (
            <div key={o.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{o.clientes?.nome ?? "—"} <span className="text-xs text-muted-foreground font-mono">{o.veiculos?.placa ?? ""}</span></p>
                <p className="text-xs text-muted-foreground">{o.servicos?.nome ?? "Serviço"} · {o.funcionarios?.nome ?? "Sem responsável"} · {dateTimeBr(o.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{brl(o.valor)}</p>
                <Badge variant="outline" className={statusColor[o.status]}>{o.status.replace("_", " ")}</Badge>
              </div>
            </div>
          ))}
          {data?.ordens.length === 0 && <p className="p-10 text-center text-muted-foreground text-sm">Nenhuma ordem ainda.</p>}
        </div>
      </CardContent></Card>
    </>
  );
}
