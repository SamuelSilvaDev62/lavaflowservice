import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getEquipePainel,
  upsertFuncionarioFull,
  vincularColaborador,
} from "@/lib/lavaflow.functions";
import { brl, dateBr } from "@/lib/format";
import {
  Plus, Trophy, UsersRound, Car, DollarSign, Link2, Pencil, Wallet, Sliders, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ComissaoPorServicoDialog } from "@/components/equipe/comissao-por-servico-dialog";
import { MarcarPagamentoDialog } from "@/components/equipe/marcar-pagamento-dialog";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: Page,
});

type Periodo = "semana" | "quinzena" | "mes" | "custom";

const defaultForm = {
  id: undefined as string | undefined,
  nome: "",
  cargo: "",
  telefone: "",
  email: "",
  comissao_tipo: "fixo" as "fixo" | "percentual",
  comissao_valor: 0,
  comissao_modo: "global" as "global" | "por_servico",
  ativo: true,
};

function todayIso() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthIso() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function Page() {
  const painelFn = useServerFn(getEquipePainel);
  const up = useServerFn(upsertFuncionarioFull);
  const vinc = useServerFn(vincularColaborador);
  const qc = useQueryClient();

  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [custom, setCustom] = useState({ inicio: firstOfMonthIso(), fim: todayIso() });

  const queryArgs = periodo === "custom"
    ? { periodo, inicio: custom.inicio, fim: custom.fim }
    : { periodo };

  const { data, isLoading } = useQuery({
    queryKey: ["equipe-painel", queryArgs],
    queryFn: () => painelFn({ data: queryArgs }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [comissaoOpen, setComissaoOpen] = useState<{ id: string; nome: string } | null>(null);
  const [pagamentoOpen, setPagamentoOpen] = useState<{ id: string; nome: string; valor: number } | null>(null);

  const mut = useMutation({
    mutationFn: () => up({ data: { ...form, id: form.id || undefined, email: form.email || null } }),
    onSuccess: async () => {
      if (form.id && form.email) {
        try { await vinc({ data: { funcionario_id: form.id, email: form.email } }); }
        catch (e: any) { toast.warning(`Salvo, mas não foi possível vincular: ${e?.message ?? "verifique se o colaborador já criou conta em /auth"}`); }
      }
      qc.invalidateQueries({ queryKey: ["equipe-painel"] });
      setOpen(false); setForm({ ...defaultForm });
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  function openNew() { setForm({ ...defaultForm }); setOpen(true); }
  function openEdit(c: any) {
    setForm({
      id: c.id, nome: c.nome ?? "", cargo: c.cargo ?? "", telefone: c.telefone ?? "",
      email: c.email ?? "",
      comissao_tipo: c.comissao_tipo ?? "fixo",
      comissao_valor: Number(c.comissao_valor ?? 0),
      comissao_modo: c.comissao_modo ?? "global",
      ativo: c.ativo ?? true,
    });
    setOpen(true);
  }

  const cards = data?.cards;
  const colaboradores = data?.colaboradores ?? [];
  const periodoInicio = data?.periodo.inicio ?? firstOfMonthIso();
  const periodoFim = data?.periodo.fim ?? todayIso();

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle="Produtividade, comissões e pagamentos da sua equipe."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />

      {/* Filtro de período */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="quinzena">15 dias</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="custom">Personalizado</TabsTrigger>
          </TabsList>
        </Tabs>
        {periodo === "custom" && (
          <div className="flex gap-2">
            <Input type="date" value={custom.inicio} onChange={(e) => setCustom({ ...custom, inicio: e.target.value })} className="h-9" />
            <Input type="date" value={custom.fim} onChange={(e) => setCustom({ ...custom, fim: e.target.value })} className="h-9" />
          </div>
        )}
      </div>

      {/* KPIs da equipe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
        <Kpi icon={Wallet} label="Comissão a pagar" value={brl(cards?.totalAPagar ?? 0)} tone="success" />
        <Kpi icon={Car} label="Lavagens no período" value={String(cards?.totalLavagens ?? 0)} />
        <Kpi icon={UsersRound} label="Ativos hoje" value={String(cards?.ativosHoje ?? 0)} />
        <Kpi icon={Trophy} label="Melhor do período" value={cards?.melhor?.nome ?? "—"} sub={cards?.melhor ? `${cards.melhor.lavagens} lav.` : undefined} />
      </div>

      {/* Dialog editar/novo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                Peça ao colaborador para criar a conta em <code>/auth</code> antes de vincular.
              </p>
            </div>
            <div>
              <Label>Modo de comissão</Label>
              <select className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.comissao_modo}
                      onChange={(e) => setForm({ ...form, comissao_modo: e.target.value as any })}>
                <option value="global">Regra única (global)</option>
                <option value="por_servico">Personalizado por serviço</option>
              </select>
            </div>
            {form.comissao_modo === "global" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo</Label>
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
            )}
            {form.comissao_modo === "por_servico" && form.id && (
              <Button type="button" variant="outline" className="w-full"
                      onClick={() => { setComissaoOpen({ id: form.id!, nome: form.nome }); }}>
                <Sliders className="h-4 w-4 mr-2" /> Configurar tarifas por serviço
              </Button>
            )}
            {form.comissao_modo === "por_servico" && !form.id && (
              <p className="text-xs text-muted-foreground">Salve primeiro o colaborador para definir tarifas por serviço.</p>
            )}
            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {form.id ? "Salvar alterações" : "Adicionar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <h2 className="font-display font-semibold mb-3">Colaboradores</h2>
      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}
      {!isLoading && colaboradores.length === 0 && (
        <EmptyState
          icon={UsersRound}
          title="Cadastre sua equipe"
          description="Acompanhe receita, comissão acumulada e registre os pagamentos."
          ctas={[{ label: "Adicionar colaborador", onClick: openNew }]}
        />
      )}

      <div className="space-y-2">
        {colaboradores.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg grid place-content-center font-display font-bold bg-muted shrink-0">
                  {c.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold flex items-center gap-2 truncate">
                    {c.nome}
                    {!c.ativo && <Badge variant="outline" className="shrink-0">Inativo</Badge>}
                    {c.vinculado && <Badge variant="secondary" className="gap-1 shrink-0"><Link2 className="h-3 w-3" /></Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{c.cargo ?? "—"} · {c.tipo_label}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="🚗 Lavagens" value={String(c.lavagens)} />
                <Stat label="💰 Faturamento" value={brl(c.receita)} />
                <Stat label="💵 Comissão" value={brl(c.comissao_acumulada)} highlight />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>📅 {dateBr(periodoInicio)} – {dateBr(periodoFim)}</span>
                {c.status === "a_receber" && <Badge className="bg-warning/15 text-warning-foreground gap-1">🟢 A receber</Badge>}
                {c.status === "pago" && <Badge className="bg-success/15 text-success gap-1"><CheckCircle2 className="h-3 w-3" /> Pago</Badge>}
                {c.status === "sem_comissao" && <Badge variant="outline">Sem comissão</Badge>}
              </div>

              {c.ultimo_pagamento && (
                <p className="text-[11px] text-muted-foreground">
                  Último pagamento: {dateBr(c.ultimo_pagamento.pago_em)} · {brl(c.ultimo_pagamento.valor)}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm" className="flex-1"
                  disabled={c.comissao_acumulada <= 0}
                  onClick={() => setPagamentoOpen({ id: c.id, nome: c.nome, valor: c.comissao_acumulada })}
                >
                  <DollarSign className="h-4 w-4 mr-1" /> Marcar como pago
                </Button>
                {c.comissao_modo === "por_servico" && (
                  <Button size="sm" variant="outline" onClick={() => setComissaoOpen({ id: c.id, nome: c.nome })}>
                    <Sliders className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {comissaoOpen && (
        <ComissaoPorServicoDialog
          open={!!comissaoOpen} onOpenChange={(v) => !v && setComissaoOpen(null)}
          funcionarioId={comissaoOpen.id} funcionarioNome={comissaoOpen.nome}
        />
      )}
      {pagamentoOpen && (
        <MarcarPagamentoDialog
          open={!!pagamentoOpen} onOpenChange={(v) => !v && setPagamentoOpen(null)}
          funcionarioId={pagamentoOpen.id} funcionarioNome={pagamentoOpen.nome}
          valorEstimado={pagamentoOpen.valor}
          periodoInicio={periodoInicio} periodoFim={periodoFim}
        />
      )}
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "success" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="h-3.5 w-3.5" />{label}</div>
        <p className={`font-display font-bold text-xl mt-1 truncate ${tone === "success" ? "text-success" : ""}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-2 ${highlight ? "bg-success/10" : "bg-muted"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-display font-bold text-sm ${highlight ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}
