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
import { listClientes, createCliente } from "@/lib/lavaflow.functions";
import { brl, dateBr, daysBetween } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: Page,
});

function Page() {
  const list = useServerFn(listClientes);
  const create = useServerFn(createCliente);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["clientes"], queryFn: () => list() });

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", origem_cliente: "Indicação" });
  const mut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); setOpen(false); setForm({ nome: "", telefone: "", origem_cliente: "Indicação" }); toast.success("Cliente cadastrado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const filtered = (data?.clientes ?? []).filter((c) => c.nome.toLowerCase().includes(q.toLowerCase()) || (c.telefone ?? "").includes(q));

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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone..." className="pl-9" />
      </div>

      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}

      <Card><CardContent className="p-0"><div className="divide-y">
        {filtered.map((c) => {
          const dias = c.ultima_visita ? daysBetween(c.ultima_visita) : null;
          return (
            <Link key={c.id} to="/clientes/$id" params={{ id: c.id }} className="p-4 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors">
              <div className="min-w-0">
                <p className="font-medium truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.telefone ?? "sem telefone"} · {c.visitas} visitas · {brl(c.total_gasto)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{dias == null ? "Nunca" : `${dias}d atrás`}</p>
                <p className="text-xs font-mono text-primary">{c.pontos_saldo} pts</p>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && <p className="p-10 text-center text-muted-foreground text-sm">Nenhum cliente.</p>}
      </div></CardContent></Card>
    </>
  );
}
