import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getClienteDetalhe, addVeiculo, getExtratoFidelidade } from "@/lib/lavaflow.functions";
import { brl, dateBr, daysBetween } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { buildExtratoMessage, getFidelidadeTemplates } from "@/lib/fidelidade-messages";
import { ArrowLeft, Car, Plus, MessageCircle, Gift, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EditarClienteDialog } from "@/components/clientes/editar-cliente-dialog";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const fn = useServerFn(getClienteDetalhe);
  const addV = useServerFn(addVeiculo);
  const extratoFn = useServerFn(getExtratoFidelidade);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cliente", id], queryFn: () => fn({ data: { id } }) });

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [veic, setVeic] = useState({ placa: "", modelo: "", cor: "" });
  const mut = useMutation({
    mutationFn: () => addV({ data: { cliente_id: id, ...veic } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cliente", id] }); setOpen(false); setVeic({ placa: "", modelo: "", cor: "" }); toast.success("Veículo adicionado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  async function enviarExtrato() {
    if (!data?.cliente?.telefone) {
      toast.warning("Cliente sem telefone cadastrado.");
      return;
    }
    try {
      const ext = await extratoFn({ data: { clienteId: id } });
      const tpls = getFidelidadeTemplates();
      const msg = buildExtratoMessage({
        cliente: { nome: ext.cliente?.nome ?? "Cliente", pontos_saldo: Number(ext.cliente?.pontos_saldo ?? 0) },
        movimentos: ext.movimentos,
        recompensas: ext.recompensas,
        template: tpls.fidelidade_extrato,
      });
      window.open(waLink(data.cliente.telefone, msg), "_blank", "noopener");
      toast.success("Extrato aberto no WhatsApp");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar extrato");
    }
  }

  if (isLoading || !data?.cliente) return <div className="h-96 rounded-xl bg-muted animate-pulse" />;

  const c = data.cliente;
  const lastDays = data.ordens[0] ? daysBetween(data.ordens[0].created_at) : null;
  const scoreColor = data.score >= 70 ? "text-success" : data.score >= 40 ? "text-warning-foreground" : "text-destructive";

  return (
    <>
      <Link to="/clientes" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader title={c.nome} subtitle={c.telefone ?? "Sem telefone"}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" />Editar
            </Button>
            {c.telefone && (
              <Button variant="outline" onClick={enviarExtrato}>
                <Gift className="h-4 w-4 mr-1" />Extrato Fidelidade
              </Button>
            )}
            {c.telefone && (
              <Button asChild variant="outline">
                <a href={waLink(c.telefone, `Olá ${c.nome.split(" ")[0]}!`)} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</a>
              </Button>
            )}
          </div>
        }
      />

      <EditarClienteDialog
        open={editOpen} onOpenChange={setEditOpen}
        cliente={c} veiculo={data.veiculos[0]}
      />


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Relacionamento</p><p className={`font-display text-2xl font-bold ${scoreColor}`}>{data.score}<span className="text-base text-muted-foreground">/100</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total gasto</p><p className="font-display text-2xl font-bold">{brl(data.totalGasto)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Visitas</p><p className="font-display text-2xl font-bold">{data.visitas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pontos</p><p className="font-display text-2xl font-bold text-primary">{c.pontos_saldo}</p></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold flex items-center gap-2"><Car className="h-4 w-4" />Veículos</h3>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
                    <div><Label>Placa</Label><Input required value={veic.placa} onChange={(e) => setVeic({ ...veic, placa: e.target.value.toUpperCase() })} /></div>
                    <div><Label>Modelo</Label><Input value={veic.modelo} onChange={(e) => setVeic({ ...veic, modelo: e.target.value })} /></div>
                    <div><Label>Cor</Label><Input value={veic.cor} onChange={(e) => setVeic({ ...veic, cor: e.target.value })} /></div>
                    <Button type="submit" className="w-full" disabled={mut.isPending}>Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {data.veiculos.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                  <span className="font-mono font-semibold">{v.placa}</span>
                  <span className="text-sm text-muted-foreground">{[v.marca, v.modelo, v.cor].filter(Boolean).join(" · ") || "—"}</span>
                </div>
              ))}
              {data.veiculos.length === 0 && <p className="text-sm text-muted-foreground">Sem veículos.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-display font-semibold mb-3">Histórico</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.ordens.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-l-2 border-primary/30 pl-3 py-1">
                  <div>
                    <p>{o.servicos?.nome ?? "Serviço"}</p>
                    <p className="text-xs text-muted-foreground">{dateBr(o.created_at)} · {o.status}</p>
                  </div>
                  <span className="font-medium">{brl(o.valor)}</span>
                </div>
              ))}
              {data.ordens.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma OS ainda.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
