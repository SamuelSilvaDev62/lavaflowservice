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
import { Badge } from "@/components/ui/badge";
import { listFuncionarios, upsertFuncionario } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listFuncionarios);
  const up = useServerFn(upsertFuncionario);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["funcionarios"], queryFn: () => fn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cargo: "", telefone: "" });
  const mut = useMutation({
    mutationFn: () => up({ data: { ...form, ativo: true } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funcionarios"] }); setOpen(false); setForm({ nome: "", cargo: "", telefone: "" }); toast.success("Adicionado"); },
  });

  const sorted = [...(data?.funcionarios ?? [])].sort((a, b) => b.receita_mes - a.receita_mes);

  return (
    <>
      <PageHeader title="Equipe" subtitle="Acompanhe a produtividade individual."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
                <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending}>Adicionar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}
      <div className="space-y-2">
        {sorted.map((f, i) => (
          <Card key={f.id}><CardContent className="p-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg grid place-content-center font-display font-bold ${i === 0 ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
              {i === 0 ? <Trophy className="h-5 w-5" /> : `#${i + 1}`}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{f.nome} {!f.ativo && <Badge variant="outline" className="ml-2">Inativo</Badge>}</p>
              <p className="text-xs text-muted-foreground">{f.cargo ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="font-display font-bold">{brl(f.receita_mes)}</p>
              <p className="text-xs text-muted-foreground">{f.lavagens_mes} lavagens (30d)</p>
            </div>
          </CardContent></Card>
        ))}
        {sorted.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Cadastre sua equipe para começar.</p>}
      </div>
    </>
  );
}
