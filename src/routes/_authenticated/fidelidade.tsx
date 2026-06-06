import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getFidelidade, updateFidelidadeConfig, upsertRecompensa } from "@/lib/lavaflow.functions";
import { Plus, Award, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fidelidade")({
  component: Page,
});

function Page() {
  const fn = useServerFn(getFidelidade);
  const upCfg = useServerFn(updateFidelidadeConfig);
  const upRec = useServerFn(upsertRecompensa);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["fidelidade"], queryFn: () => fn() });

  const [cfg, setCfg] = useState({ pontos_por_lavagem: 10, pontos_por_real: 1 });
  useEffect(() => { if (data?.config) setCfg({ pontos_por_lavagem: data.config.pontos_por_lavagem, pontos_por_real: Number(data.config.pontos_por_real) }); }, [data?.config]);

  const cfgMut = useMutation({
    mutationFn: () => upCfg({ data: cfg }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fidelidade"] }); toast.success("Configuração salva"); },
  });

  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState({ nome: "", custo_pontos: 100 });
  const recMut = useMutation({
    mutationFn: () => upRec({ data: { ...rec, ativo: true } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fidelidade"] }); setOpen(false); setRec({ nome: "", custo_pontos: 100 }); toast.success("Recompensa criada"); },
  });

  return (
    <>
      <PageHeader title="Fidelidade" subtitle="Recompense clientes que voltam." />

      <Card className="mb-6">
        <CardContent className="p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-primary" />Configuração</h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div><Label>Pontos por lavagem</Label><Input type="number" inputMode="numeric" placeholder="0" value={cfg.pontos_por_lavagem === 0 ? "" : cfg.pontos_por_lavagem} onChange={(e) => setCfg({ ...cfg, pontos_por_lavagem: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
            <div><Label>Pontos por R$ gasto</Label><Input type="number" step="0.1" inputMode="decimal" placeholder="0" value={cfg.pontos_por_real === 0 ? "" : cfg.pontos_por_real} onChange={(e) => setCfg({ ...cfg, pontos_por_real: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
          </div>
          <Button onClick={() => cfgMut.mutate()} disabled={cfgMut.isPending}>Salvar</Button>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold">Recompensas</h3>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Nova</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova recompensa</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); recMut.mutate(); }} className="space-y-3">
                    <div><Label>Nome</Label><Input required value={rec.nome} onChange={(e) => setRec({ ...rec, nome: e.target.value })} /></div>
                    <div><Label>Custo (pontos)</Label><Input type="number" inputMode="numeric" placeholder="0" required value={rec.custo_pontos === 0 ? "" : rec.custo_pontos} onChange={(e) => setRec({ ...rec, custo_pontos: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
                    <Button type="submit" className="w-full" disabled={recMut.isPending}>Criar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {data?.recompensas.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-sm font-mono text-primary">{r.custo_pontos} pts</span>
                </div>
              ))}
              {data?.recompensas.length === 0 && <p className="text-sm text-muted-foreground">Crie recompensas para engajar.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Star className="h-4 w-4 text-warning" />Top clientes</h3>
            <div className="space-y-2">
              {data?.top.map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between p-2">
                  <span className="text-sm"><span className="text-muted-foreground mr-2">#{i + 1}</span>{c.nome}</span>
                  <span className="font-mono font-semibold text-primary">{c.pontos_saldo}</span>
                </div>
              ))}
              {data?.top.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      {isLoading && <div className="h-32 mt-4 rounded-xl bg-muted animate-pulse" />}
    </>
  );
}
