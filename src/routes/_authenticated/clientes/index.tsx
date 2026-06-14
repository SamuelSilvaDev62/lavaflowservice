import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listClientes, createCliente, getClientesComRecompensa } from "@/lib/lavaflow.functions";
import { brl, daysBetween } from "@/lib/format";
import { Plus, Search, Users, Gift, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

const searchSchema = z.object({
  filtro: z.enum(["recompensa_disponivel"]).optional(),
});

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: Page,
  validateSearch: searchSchema,
});

function Page() {
  const list = useServerFn(listClientes);
  const create = useServerFn(createCliente);
  const recFn = useServerFn(getClientesComRecompensa);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["clientes"], queryFn: () => list() });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filtroRecompensa = search.filtro === "recompensa_disponivel";
  const { data: recData } = useQuery({
    queryKey: ["clientes-recompensa"],
    queryFn: () => recFn(),
    enabled: filtroRecompensa,
  });

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", origem_cliente: "Indicação" });
  const mut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); setOpen(false); setForm({ nome: "", telefone: "", origem_cliente: "Indicação" }); toast.success("Cliente cadastrado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  let lista = data?.clientes ?? [];
  if (filtroRecompensa && recData) {
    const ids = new Set(recData.clientes.map((c: any) => c.id));
    lista = lista.filter((c) => ids.has(c.id));
  }
  const filtered = lista.filter((c) => c.nome.toLowerCase().includes(q.toLowerCase()) || (c.telefone ?? "").includes(q));

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${data?.clientes.length ?? 0} clientes cadastrados.`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
                <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label>WhatsApp</Label><Input placeholder="(11) 99999-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div><Label>Origem</Label><Input value={form.origem_cliente} onChange={(e) => setForm({ ...form, origem_cliente: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending}>Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {filtroRecompensa && (
        <Badge variant="outline" className="mb-3 bg-success/10 text-success border-success/30 gap-2 py-1.5 px-3">
          <Gift className="h-3 w-3" /> Filtrando: clientes com recompensa disponível
          <button onClick={() => navigate({ search: {} })} className="ml-1 hover:opacity-70"><X className="h-3 w-3" /></button>
        </Badge>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone..." className="pl-9" />
      </div>

      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}

      {!isLoading && (data?.clientes.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="Sua base de clientes começa aqui"
          description="Cada cliente cadastrado vira histórico, fidelidade e oportunidade de receita recorrente."
          highlight="Lava-rápidos com base ativa faturam até 3× mais com retorno"
          ctas={[
            { label: "Cadastrar primeiro cliente", onClick: () => setOpen(true) },
          ]}
        />
      ) : (
        <Card><CardContent className="p-0"><div className="divide-y">
          {filtered.map((c) => {
            const dias = c.ultima_visita ? daysBetween(c.ultima_visita) : null;
            const temRecompensa = filtroRecompensa && recData?.clientes.find((r: any) => r.id === c.id);
            return (
              <Link key={c.id} to="/clientes/$id" params={{ id: c.id }} className="p-4 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.telefone ?? "sem telefone"} · {c.visitas} visitas · {brl(c.total_gasto)}</p>
                  {temRecompensa && (temRecompensa as any).recompensa && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1"><Gift className="h-3 w-3" /> Pode resgatar: {(temRecompensa as any).recompensa}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{dias == null ? "Nunca" : `${dias}d atrás`}</p>
                  <p className="text-xs font-mono text-primary">{c.pontos_saldo} pts</p>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && <p className="p-10 text-center text-muted-foreground text-sm">Nenhum cliente encontrado.</p>}
        </div></CardContent></Card>
      )}
    </>
  );
}
