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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listFuncionarios,
  upsertFuncionarioFull,
  vincularColaborador,
  getEquipeMetrics,
} from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { Plus, Trophy, UsersRound, Car, Clock, DollarSign, Link2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: Page,
});

const defaultForm = {
  id: "" as string | undefined,
  nome: "",
  cargo: "",
  telefone: "",
  email: "",
  comissao_tipo: "fixo" as "fixo" | "percentual",
  comissao_valor: 0,
  ativo: true,
};

function Page() {
  const fn = useServerFn(listFuncionarios);
  const up = useServerFn(upsertFuncionarioFull);
  const vinc = useServerFn(vincularColaborador);
  const metricsFn = useServerFn(getEquipeMetrics);
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes">("semana");

  const { data, isLoading } = useQuery({ queryKey: ["funcionarios"], queryFn: () => fn() });
  const { data: metrics } = useQuery({ queryKey: ["equipe-metrics", periodo], queryFn: () => metricsFn({ data: { periodo } }) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  const mut = useMutation({
    mutationFn: () => up({ data: { ...form, id: form.id || undefined, email: form.email || null } }),
    onSuccess: async (res: any) => {
      // Se editando e tem email + ainda não foi vinculado, dispara vínculo
      if (form.id && form.email) {
        try { await vinc({ data: { funcionario_id: form.id, email: form.email } }); }
        catch (e: any) { toast.warning(`Salvo, mas não foi possível vincular: ${e?.message ?? "verifique se o colaborador já criou conta em /auth"}`); }
      }
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["equipe-metrics"] });
      setOpen(false); setForm({ ...defaultForm });
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const sorted = [...(data?.funcionarios ?? [])].sort((a: any, b: any) => b.receita_mes - a.receita_mes);

  function openNew() { setForm({ ...defaultForm }); setOpen(true); }
  function openEdit(f: any) {
    setForm({
      id: f.id, nome: f.nome ?? "", cargo: f.cargo ?? "", telefone: f.telefone ?? "",
      email: f.email ?? "",
      comissao_tipo: f.comissao_tipo ?? "fixo",
      comissao_valor: Number(f.comissao_valor ?? 0),
      ativo: f.ativo ?? true,
    });
    setOpen(true);
  }

  const c = metrics?.cards;

  return (
    <>
      <PageHeader title="Equipe" subtitle="Acompanhe a produtividade individual e configure comissões."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
            <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div>
              <Label>E-mail de acesso</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                     placeholder="colaborador@email.com" />
              <p className="text-[11px] text-muted-foreground mt-1">
                <Link2 className="h-3 w-3 inline mr-1" />
                Peça ao colaborador para criar a conta em <code>/auth</code> com este e-mail antes de vincular.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo de comissão</Label>
                <select className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.comissao_tipo}
                        onChange={(e) => setForm({ ...form, comissao_tipo: e.target.value as any })}>
                  <option value="fixo">Valor fixo (R$)</option>
                  <option value="percentual">Percentual (%)</option>
                </select>
              </div>
              <div>
                <Label>{form.comissao_tipo === "percentual" ? "% por OS" : "R$ por OS"}</Label>
                <Input type="number" step="0.01" min="0" value={form.comissao_valor}
                       onChange={(e) => setForm({ ...form, comissao_valor: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {form.id ? "Salvar alterações" : "Adicionar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dashboard da equipe */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold">Painel da equipe</h2>
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <TabsList>
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Metric icon={Car} label="Veículos lavados hoje" value={String(c?.lavadosHoje ?? 0)} />
          <Metric icon={UsersRound} label="Colaboradores ativos hoje" value={String(c?.colabAtivosHoje ?? 0)} />
          <Metric icon={Clock} label="Tempo médio" value={c?.tempoMedio ? `${c.tempoMedio} min` : "—"} />
          <Metric icon={DollarSign} label="Valor gerado" value={brl(c?.valorEquipe ?? 0)} />
        </div>
      </div>

      {/* Ranking */}
      {(metrics?.ranking ?? []).length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-display font-semibold mb-3">Ranking</h3>
            <div className="space-y-2">
              {metrics!.ranking.slice(0, 10).map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <span className={`h-8 w-8 rounded-md grid place-content-center font-bold ${
                    i === 0 ? "bg-warning/20" : i === 1 ? "bg-muted" : i === 2 ? "bg-accent" : "bg-muted/50"
                  }`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span className="flex-1 font-medium">{r.nome}</span>
                  <span className="text-muted-foreground text-xs">{r.lavagens} lav.</span>
                  <span className="font-display font-bold">{brl(r.receita)}</span>
                  <span className="text-xs text-success ml-2">{brl(r.comissao)} com.</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="font-display font-semibold mb-3">Colaboradores cadastrados</h2>
      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}
      {!isLoading && sorted.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Cadastre sua equipe"
          description="Acompanhe quem traz mais receita, quantas lavagens cada colaborador entrega e libere acesso ao app Meu Trabalho."
          highlight="Equipes monitoradas produzem em média 20% mais"
          ctas={[{ label: "Adicionar colaborador", onClick: openNew }]}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((f: any, i: number) => (
            <Card key={f.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg grid place-content-center font-display font-bold ${i === 0 ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i === 0 ? <Trophy className="h-5 w-5" /> : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {f.nome}
                    {!f.ativo && <Badge variant="outline">Inativo</Badge>}
                    {f.auth_user_id && <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" />Vinculado</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.cargo ?? "—"} · Comissão: {f.comissao_tipo === "percentual" ? `${f.comissao_valor}%` : brl(Number(f.comissao_valor ?? 0))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">{brl(f.receita_mes)}</p>
                  <p className="text-xs text-muted-foreground">{f.lavagens_mes} lavagens (30d)</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="h-3.5 w-3.5" />{label}</div>
        <p className="font-display font-bold text-xl mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
