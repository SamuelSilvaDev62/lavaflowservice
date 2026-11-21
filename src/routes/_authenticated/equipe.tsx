import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus, Trophy, UsersRound, Car, DollarSign, Link2, Pencil, Wallet, Sliders, CheckCircle2, ExternalLink, ShieldCheck, Search, Copy, ArrowUpRight, CalendarDays, CreditCard, UserRound, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ComissaoPorServicoDialog } from "@/components/equipe/comissao-por-servico-dialog";
import { MarcarPagamentoDialog } from "@/components/equipe/marcar-pagamento-dialog";

import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: PageGuarded,
});

function PageGuarded() {
  return <RequireRole roles={GESTAO}><Page /></RequireRole>;
}

type Periodo = "semana" | "quinzena" | "mes" | "custom";

const defaultForm = {
  id: undefined as string | undefined,
  nome: "",
  avatar_url: "",
  cargo: "",
  telefone: "",
  email: "",
  pin: "",
  pin_digits: 4 as 4 | 6,
  perm_iniciar_atendimento: true,
  perm_finalizar_atendimento: true,
  perm_realizar_checklist: true,
  perm_ver_apenas_atribuidos: true,
  perm_ver_todos_veiculos: false,
  comissao_tipo: "fixo" as "fixo" | "percentual",
  comissao_valor: 0,
  comissao_modo: "global" as "global" | "por_servico",
  ativo: true,
  role: "lavador" as "admin" | "gerente" | "atendente" | "lavador",
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
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "sem_comissao" | "inativos">("todos");

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
  const [pagamentoOpen, setPagamentoOpen] = useState<{ id: string; nome: string; telefone?: string | null; valor: number } | null>(null);

  const mut = useMutation({
    mutationFn: () => {
      const { role: _r, ...rest } = form;
      return up({ data: { ...rest, id: rest.id || undefined, email: rest.email || null } });
    },
    onSuccess: async () => {
      if (form.id && form.email) {
        try { await vinc({ data: { funcionario_id: form.id, email: form.email, role: form.role } }); }
        catch (e: any) { toast.warning(`Salvo, mas não foi possível vincular: ${e?.message ?? "verifique se o colaborador já criou conta em /auth"}`); }
      }
      qc.invalidateQueries({ queryKey: ["equipe-painel"] });
      qc.invalidateQueries({ queryKey: ["tenant-members"] });
      setOpen(false); setForm({ ...defaultForm });
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  function openNew() { setForm({ ...defaultForm }); setOpen(true); }
  function openEdit(c: any) {
    setForm({
      id: c.id, nome: c.nome ?? "", avatar_url: c.avatar_url ?? "", cargo: c.cargo ?? "", telefone: c.telefone ?? "",
      email: c.email ?? "",
      pin: "",
      pin_digits: (c.pin_digits ?? 4) as 4 | 6,
      perm_iniciar_atendimento: c.perm_iniciar_atendimento ?? true,
      perm_finalizar_atendimento: c.perm_finalizar_atendimento ?? true,
      perm_realizar_checklist: c.perm_realizar_checklist ?? true,
      perm_ver_apenas_atribuidos: c.perm_ver_apenas_atribuidos ?? true,
      perm_ver_todos_veiculos: c.perm_ver_todos_veiculos ?? false,
      comissao_tipo: c.comissao_tipo ?? "fixo",
      comissao_valor: Number(c.comissao_valor ?? 0),
      comissao_modo: c.comissao_modo ?? "global",
      ativo: c.ativo ?? true,
      role: (c.role ?? "lavador") as any,
    });
    setOpen(true);
  }


  const cards = data?.cards;
  const colaboradores = data?.colaboradores ?? [];
  const canVerComissoes = data?.canVerComissoes ?? false;
  const periodoInicio = data?.periodo.inicio ?? firstOfMonthIso();
  const periodoFim = data?.periodo.fim ?? todayIso();
  const equipeSlug = data?.empresa?.slug;
  const equipeUrl = equipeSlug && typeof window !== "undefined" ? `${window.location.origin}/equipe/${equipeSlug}` : "";
  const colaboradoresFiltrados = colaboradores.filter((c: any) => {
    if (!String(c.nome ?? "").toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))) return false;
    if (filtro === "pendentes") return c.status === "a_receber" && Number(c.comissao_acumulada ?? 0) > 0;
    if (filtro === "sem_comissao") return c.status === "sem_comissao";
    if (filtro === "inativos") return !c.ativo;
    return true;
  });

  async function copiarLink() {
    if (!equipeUrl) return;
    try { await navigator.clipboard.writeText(equipeUrl); toast.success("Link do portal copiado."); }
    catch { toast.error("Não foi possível copiar o link."); }
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Gestão de pessoas</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe produção, comissões e pagamentos com clareza.</p>
        </div>
        <Button className="w-full gap-2 sm:w-auto" onClick={openNew}><Plus className="h-4 w-4" /> Novo colaborador</Button>
      </div>

      <Card className="mb-4 border-border/70">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Período de análise</div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <TabsList className="grid h-auto w-full grid-cols-4 sm:w-auto">
                <TabsTrigger className="px-2 text-xs sm:text-sm" value="semana">Semana</TabsTrigger>
                <TabsTrigger className="px-2 text-xs sm:text-sm" value="quinzena">15 dias</TabsTrigger>
                <TabsTrigger className="px-2 text-xs sm:text-sm" value="mes">Mês</TabsTrigger>
                <TabsTrigger className="px-2 text-xs sm:text-sm" value="custom">Personalizado</TabsTrigger>
              </TabsList>
            </Tabs>
            {periodo === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Data inicial" type="date" value={custom.inicio} onChange={(e) => setCustom({ ...custom, inicio: e.target.value })} className="h-10 min-w-0 flex-1 sm:w-40" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input aria-label="Data final" type="date" value={custom.fim} min={custom.inicio} onChange={(e) => setCustom({ ...custom, fim: e.target.value })} className="h-10 min-w-0 flex-1 sm:w-40" />
              </div>
            )}
            <span className="text-xs text-muted-foreground lg:ml-auto">{dateBr(periodoInicio)} a {dateBr(periodoFim)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {canVerComissoes && <Kpi icon={Wallet} label="Comissões no período" value={isLoading ? "—" : brl(cards?.totalAPagar ?? 0)} tone="success" sub="Saldo de comissões a pagar" />}
        <Kpi icon={Car} label="Lavagens realizadas" value={isLoading ? "—" : String(cards?.totalLavagens ?? 0)} sub="No período selecionado" />
        <Kpi icon={UsersRound} label="Ativos hoje" value={isLoading ? "—" : String(cards?.ativosHoje ?? 0)} sub="Colaboradores em atividade" />
        <Kpi icon={Trophy} label="Destaque do período" value={isLoading ? "—" : cards?.melhor?.nome ?? "—"} sub={cards?.melhor ? `${cards.melhor.lavagens} lavagens` : "Nenhum resultado registrado"} />
      </div>

      <Card className="mb-6 overflow-hidden border-primary/15 bg-gradient-to-r from-primary/[0.07] via-card to-card">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-semibold">Portal da equipe</h2>
              <p className="text-xs text-muted-foreground">Compartilhe o acesso por PIN com seus colaboradores.</p>
              <p className="break-all text-xs font-medium text-foreground/80">{equipeUrl || "Configure o link público da empresa para habilitar o portal."}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!equipeUrl} className="flex-1 gap-2 sm:flex-none" onClick={copiarLink}><Copy className="h-4 w-4" /> Copiar link</Button>
            <Button type="button" size="sm" variant="outline" disabled={!equipeUrl} className="flex-1 gap-2 sm:flex-none" onClick={() => equipeUrl && window.open(equipeUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" /> Abrir</Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog editar/novo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
            <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Foto / avatar URL</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <div className="flex items-center gap-2 font-medium text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" /> Acesso por PIN
              </div>
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <div>
                  <Label>{form.id ? "Novo PIN" : "PIN"}</Label>
                  <Input
                    inputMode="numeric"
                    type="password"
                    maxLength={form.pin_digits}
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, form.pin_digits) })}
                    placeholder={form.id ? "Manter atual" : "Obrigatorio"}
                  />
                </div>
                <div>
                  <Label>Tamanho</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={form.pin_digits}
                          onChange={(e) => setForm({ ...form, pin_digits: Number(e.target.value) as 4 | 6, pin: "" })}>
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">O PIN e salvo apenas com hash. Deixe em branco ao editar para manter o PIN atual.</p>
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
              <Label>Perfil de acesso</Label>
              <select className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                <option value="lavador">Lavador — só vê seus serviços</option>
                <option value="atendente">Atendente — opera clientes, agenda e OS</option>
                <option value="gerente">Gerente — vê relatórios e equipe</option>
                <option value="admin">Administrador — acesso total (sem trocar dono)</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                O perfil só é aplicado quando o colaborador é vinculado por e-mail.
              </p>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Permissoes do Modo Equipe</p>
              <Perm label="Pode iniciar atendimento" checked={form.perm_iniciar_atendimento} onChange={(v) => setForm({ ...form, perm_iniciar_atendimento: v })} />
              <Perm label="Pode finalizar atendimento" checked={form.perm_finalizar_atendimento} onChange={(v) => setForm({ ...form, perm_finalizar_atendimento: v })} />
              <Perm label="Pode realizar checklist" checked={form.perm_realizar_checklist} onChange={(v) => setForm({ ...form, perm_realizar_checklist: v })} />
              <Perm label="Visualiza apenas veiculos atribuidos" checked={form.perm_ver_apenas_atribuidos} onChange={(v) => setForm({ ...form, perm_ver_apenas_atribuidos: v, perm_ver_todos_veiculos: v ? form.perm_ver_todos_veiculos : true })} />
              <Perm label="Pode visualizar todos os veiculos" checked={form.perm_ver_todos_veiculos} onChange={(v) => setForm({ ...form, perm_ver_todos_veiculos: v })} />
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

      <section className="space-y-4" aria-label="Colaboradores">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Colaboradores <span className="ml-1 text-sm font-normal text-muted-foreground">({colaboradores.length})</span></h2>
            <p className="text-xs text-muted-foreground">Consulte o desempenho e gerencie pagamentos por pessoa.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar colaborador" placeholder="Buscar colaborador..." className="h-10 pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select aria-label="Filtrar colaboradores" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm sm:w-48">
                <option value="todos">Todos</option>
                {canVerComissoes && <option value="pendentes">Comissão pendente</option>}
                {canVerComissoes && <option value="sem_comissao">Sem comissão</option>}
                <option value="inativos">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading && <div className="h-64 animate-pulse rounded-2xl bg-muted" />}
        {!isLoading && colaboradores.length === 0 && (
          <EmptyState icon={UsersRound} title="Cadastre sua equipe" description="Acompanhe produção, comissão acumulada e registre pagamentos." ctas={[{ label: "Adicionar colaborador", onClick: openNew }]} />
        )}
        {!isLoading && colaboradores.length > 0 && colaboradoresFiltrados.length === 0 && (
          <div className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado para esses filtros.</div>
        )}
        <div className="grid gap-3">
          {colaboradoresFiltrados.map((c: any) => (
            <Card key={c.id} className="overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 font-display text-sm font-bold text-primary">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-full w-full object-cover" /> : String(c.nome ?? "").split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words text-base font-semibold">{c.nome}</h3>
                      {c.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.cargo || "Função não informada"} · {c.tipo_label}</p>
                    <div className="flex flex-wrap gap-2">
                      {c.vinculado && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Link2 className="h-3 w-3" /> Conta vinculada</span>}
                      {c.pin_configurado && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> PIN configurado</span>}
                    </div>
                  </div>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Editar colaborador ${c.nome}`} onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                </div>

                <div className={`grid gap-2 ${canVerComissoes ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                  <Stat icon={Car} label="Lavagens" value={String(c.lavagens ?? 0)} />
                  <Stat icon={DollarSign} label="Faturamento" value={brl(c.receita ?? 0)} />
                  {canVerComissoes && <Stat icon={Wallet} label="Comissão" value={brl(c.comissao_acumulada ?? 0)} highlight />}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {dateBr(periodoInicio)} — {dateBr(periodoFim)}</span>
                  {canVerComissoes && c.status === "a_receber" && <Badge variant="secondary" className="gap-1 text-amber-700"><Wallet className="h-3 w-3" /> A receber</Badge>}
                  {canVerComissoes && c.status === "pago" && <Badge variant="secondary" className="gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Pago</Badge>}
                  {canVerComissoes && c.status === "sem_comissao" && <Badge variant="outline">Sem comissão</Badge>}
                </div>
                {canVerComissoes && c.ultimo_pagamento && (
                  <p className="text-xs text-muted-foreground">Último pagamento: {dateBr(c.ultimo_pagamento.pago_em)} · {brl(c.ultimo_pagamento.valor)}</p>
                )}
                {canVerComissoes && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {c.comissao_modo === "por_servico" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setComissaoOpen({ id: c.id, nome: c.nome })}>
                        <Sliders className="mr-1.5 h-4 w-4" /> Tarifas
                      </Button>
                    )}
                    {Number(c.comissao_acumulada ?? 0) > 0 ? (
                      <Button type="button" size="sm" className="gap-1.5" onClick={() => setPagamentoOpen({ id: c.id, nome: c.nome, telefone: c.telefone, valor: c.comissao_acumulada })}>
                        <CreditCard className="h-4 w-4" /> Registrar pagamento
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">Sem valor a pagar neste período</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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
          funcionarioTelefone={pagamentoOpen.telefone}
          valorEstimado={pagamentoOpen.valor}
          periodoInicio={periodoInicio} periodoFim={periodoFim}
        />
      )}
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "success" }) {
  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        </div>
        <div className="mt-auto min-w-0">
          <p className={`break-words font-display text-xl font-bold leading-tight sm:text-2xl ${tone === "success" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${highlight ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-border/60 bg-muted/30"}`}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" />{label}</div>
      <p className={`break-words font-display text-base font-bold sm:text-lg ${highlight ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function Perm({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );
}
