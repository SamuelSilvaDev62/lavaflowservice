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
import { listOrdens, createOrdem, listClientes, listServicos, listFuncionarios, updateOrdemStatus, atualizarUpsellOportunidade, type OsStatus } from "@/lib/lavaflow.functions";
import { brl, dateTimeBr } from "@/lib/format";
import { Plus, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

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
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" inputMode="decimal" placeholder="0,00" value={form.valor === 0 ? "" : form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending}>Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}
      {!isLoading && (data?.ordens.length ?? 0) === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Registre sua primeira lavagem"
          description="Cada ordem alimenta seu painel, métricas, fidelidade e o assistente — é o coração do LavaFlow."
          highlight="Registrar todas as OS revela exatamente quanto você fatura por dia"
          ctas={[{ label: "Criar primeira OS", onClick: () => setOpen(true) }]}
        />
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y">
            {data?.ordens.map((o: any) => <OrdemRow key={o.id} o={o} />)}
          </div>
        </CardContent></Card>
      )}
    </>
  );
}

const STATUS_OPTIONS: OsStatus[] = ["aguardando", "em_lavagem", "finalizacao", "pronto", "entregue"];

function OrdemRow({ o }: { o: any }) {
  const upd = useServerFn(updateOrdemStatus);
  const updUpsell = useServerFn(atualizarUpsellOportunidade);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (status: OsStatus) => upd({ data: { id: o.id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens"] }); qc.invalidateQueries({ queryKey: ["fila"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });
  const upsellMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "oferecida" | "aceita" | "recusada" | "ignorada" }) => updUpsell({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens"] }); toast.success("Oportunidade atualizada"); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar oportunidade"),
  });
  return (
    <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{o.clientes?.nome ?? "—"} <span className="text-xs text-muted-foreground font-mono">{o.veiculos?.placa ?? ""}</span></p>
        <p className="text-xs text-muted-foreground">{o.servicos?.nome ?? "Serviço"} · {o.funcionarios?.nome ?? "Sem responsável"} · {dateTimeBr(o.created_at)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Checklist inicial: {o.checklist_inicial_status === "concluido" ? "concluido" : o.checklist_inicial_status === "pulado" ? "pulado" : "pendente"}
          {o.checklist_funcionario?.nome ? ` · ${o.checklist_funcionario.nome}` : ""}
          {o.checklist_inicial_em ? ` · ${dateTimeBr(o.checklist_inicial_em)}` : ""}
        </p>
        {(o.origens_receita?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Origem da venda:</span>
            {o.origens_receita.map((r: any) => (
              <Badge key={r.id} variant="outline" className="text-[11px]">
                {origemReceitaLabel(r.origem)} {Number(r.valor ?? 0) > 0 ? `Â· ${brl(Number(r.valor))}` : ""}
              </Badge>
            ))}
          </div>
        )}
        {(o.upsell_oportunidades?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary">Oportunidades identificadas pelo checklist</p>
            {o.upsell_oportunidades.map((u: any) => (
              <div key={u.id} className="rounded-md bg-card p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{u.servico_sugerido}</p>
                    <p className="text-xs text-muted-foreground">{u.motivo}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.valor_estimado != null ? `Valor estimado: ${brl(Number(u.valor_estimado))}` : "Valor estimado: sem servico vinculado"}
                    </p>
                  </div>
                  <Badge variant="secondary">{u.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => upsellMut.mutate({ id: u.id, status: "oferecida" })}>Oferecido</Button>
                  <Button size="sm" onClick={() => upsellMut.mutate({ id: u.id, status: "aceita" })}>Cliente aceitou</Button>
                  <Button size="sm" variant="outline" onClick={() => upsellMut.mutate({ id: u.id, status: "recusada" })}>Cliente recusou</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="font-semibold">{brl(o.valor)}</p>
        <Select value={o.status} onValueChange={(v) => mut.mutate(v as OsStatus)}>
          <SelectTrigger className={`h-8 w-[140px] text-xs ${statusColor[o.status]}`}><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

function origemReceitaLabel(origem: string) {
  const labels: Record<string, string> = {
    CLIENTE_RECUPERADO: "Cliente recuperado",
    FIDELIDADE: "Fidelidade",
    UPSELL_CHECKLIST: "Upsell Checklist",
    CONSULTOR_IA: "Consultor IA",
    CAMPANHA: "Campanha",
    ANIVERSARIO: "Aniversario",
    LEVA_ETRAZ: "Leva e Traz",
  };
  return labels[origem] ?? origem;
}
