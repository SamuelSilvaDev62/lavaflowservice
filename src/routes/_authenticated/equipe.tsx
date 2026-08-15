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
  Plus, Trophy, UsersRound, Car, DollarSign, Link2, Pencil, Wallet, Sliders, CheckCircle2, ExternalLink, ShieldCheck, UserRound, KeyRound, BadgeDollarSign,
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

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle="Produtividade, comissões e pagamentos da sua equipe."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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

      <div className={`mb-5 grid grid-cols-2 gap-2 ${canVerComissoes ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {canVerComissoes && <Kpi icon={Wallet} label="Comissão a pagar" value={brl(cards?.totalAPagar ?? 0)} tone="success" />}
        <Kpi icon={Car} label="Lavagens no período" value={String(cards?.totalLavagens ?? 0)} />
        <Kpi icon={UsersRound} label="Ativos hoje" value={String(cards?.ativosHoje ?? 0)} />
        <Kpi icon={Trophy} label="Melhor do período" value={cards?.melhor?.nome ?? "—"} sub={cards?.melhor ? `${cards.melhor.lavagens} lav.` : undefined} />
      </div>

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-content-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Acesso rápido da equipe</p>
              <p className="truncate text-xs text-muted-foreground">
                {equipeUrl || "Configure o link público da empresa para liberar o acesso por PIN."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!equipeUrl}
              onClick={() => equipeUrl && navigator.clipboard?.writeText(equipeUrl).then(() => toast.success("Link copiado"))}
            >
              Copiar link
            </Button>
            <Button size="icon" type="button" variant="outline" disabled={!equipeUrl} onClick={() => equipeUrl && window.open(equipeUrl, "_blank")}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
            <FormSection icon={UserRound} title="Dados do colaborador" description="Informações básicas exibidas na gestão da equipe.">
              <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              </div>
              <div><Label>Foto do colaborador (URL)</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." /></div>
            </FormSection>

            <FormSection icon={KeyRound} title="Acesso ao LavaFlow" description="Configure PIN e, se quiser, vincule uma conta com perfil próprio.">
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <div>
                  <Label>{form.id ? "Novo PIN" : "PIN"}</Label>
                  <Input
                    inputMode="numeric"
                    type="password"
                    maxLength={form.pin_digits}
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, form.pin_digits) })}
                    placeholder={form.id ? "Manter atual" : "Obrigatório"}
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
              <p className="text-[11px] text-muted-foreground">O PIN é salvo apenas como hash. Ao editar, deixe em branco para manter o PIN atual.</p>

              <div>
                <Label>E-mail de acesso</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                       placeholder="colaborador@email.com" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <Link2 className="mr-1 inline h-3 w-3" />
                  Peça ao colaborador para criar a conta em <code>/auth</code> antes de vincular.
                </p>
              </div>
              <div>
                <Label>Perfil de acesso</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                  <option value="lavador">Lavador — só vê seus serviços</option>
                  <option value="atendente">Atendente — opera clientes, agenda e OS</option>
                  <option value="gerente">Gerente — vê relatórios e equipe</option>
                  <option value="admin">Administrador — acesso total (sem trocar dono)</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">O perfil só é aplicado quando o colaborador é vinculado por e-mail.</p>
              </div>
            </FormSection>

            <FormSection icon={ShieldCheck} title="Permissões do Modo Equipe" description="Defina o que este colaborador consegue fazer no painel operacional.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Perm label="Pode iniciar atendimento" checked={form.perm_iniciar_atendimento} onChange={(v) => setForm({ ...form, perm_iniciar_atendimento: v })} />
                <Perm label="Pode finalizar atendimento" checked={form.perm_finalizar_atendimento} onChange={(v) => setForm({ ...form, perm_finalizar_atendimento: v })} />
                <Perm label="Pode realizar checklist" checked={form.perm_realizar_checklist} onChange={(v) => setForm({ ...form, perm_realizar_checklist: v })} />
                <Perm label="Só vê veículos atribuídos" checked={form.perm_ver_apenas_atribuidos} onChange={(v) => setForm({ ...form, perm_ver_apenas_atribuidos: v, perm_ver_todos_veiculos: v ? form.perm_ver_todos_veiculos : true })} />
                <Perm label="Pode visualizar todos os veículos" checked={form.perm_ver_todos_veiculos} onChange={(v) => setForm({ ...form, perm_ver_todos_veiculos: v })} />
              </div>
            </FormSection>

            <FormSection icon={BadgeDollarSign} title="Comissão" description="A mesma regra usada nos cálculos e no painel pessoal do colaborador.">
              <div>
                <Label>Modo de comissão</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm"
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
                    <select className="h-9 w-full rounded-md border bg-background px-3 text-sm"
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
                  <Sliders className="mr-2 h-4 w-4" /> Configurar tarifas por serviço
                </Button>
              )}
              {form.comissao_modo === "por_servico" && !form.id && (
                <p className="text-xs text-muted-foreground">Salve primeiro o colaborador para definir tarifas por serviço.</p>
              )}
            </FormSection>

            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {form.id ? "Salvar alterações" : "Adicionar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <h2 className="mb-3 font-display font-semibold">Colaboradores</h2>
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
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-content-center rounded-lg bg-muted font-display font-bold">
                  {c.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{c.nome}</p>
                    {!c.ativo && <Badge variant="outline">Inativo</Badge>}
                    {c.vinculado && <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /></Badge>}
                    {c.pin_configurado && <Badge variant="outline">PIN</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.cargo ?? "—"}{canVerComissoes && c.tipo_label ? ` · ${c.tipo_label}` : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
              </div>

              <div className={`mt-3 grid gap-2 text-center ${canVerComissoes ? "grid-cols-3" : "grid-cols-2"}`}>
                <Stat label="Lavagens" value={String(c.lavagens)} />
                <Stat label="Faturamento" value={brl(c.receita)} />
                {canVerComissoes && <Stat label="Comissão" value={brl(c.comissao_acumulada)} highlight />}
              </div>

              <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-xs text-muted-foreground">
                  <p>{dateBr(periodoInicio)} – {dateBr(periodoFim)}</p>
                  {canVerComissoes && c.ultimo_pagamento && (
                    <p className="mt-0.5 truncate">Último pagamento: {dateBr(c.ultimo_pagamento.pago_em)} · {brl(c.ultimo_pagamento.valor)}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canVerComissoes && c.status === "a_receber" && <Badge className="bg-warning/15 text-warning-foreground">A receber</Badge>}
                  {canVerComissoes && c.status === "pago" && <Badge className="gap-1 bg-success/15 text-success"><CheckCircle2 className="h-3 w-3" /> Pago</Badge>}
                  {canVerComissoes && c.status === "sem_comissao" && <Badge variant="outline">Sem comissão</Badge>}

                  {canVerComissoes && (
                    <Button
                      size="sm"
                      disabled={c.comissao_acumulada <= 0}
                      onClick={() => setPagamentoOpen({ id: c.id, nome: c.nome, telefone: c.telefone, valor: c.comissao_acumulada })}
                    >
                      <DollarSign className="mr-1 h-4 w-4" /> Marcar como pago
                    </Button>
                  )}
                  {canVerComissoes && c.comissao_modo === "por_servico" && (
                    <Button size="icon" variant="outline" onClick={() => setComissaoOpen({ id: c.id, nome: c.nome })}>
                      <Sliders className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
          funcionarioTelefone={pagamentoOpen.telefone}
          valorEstimado={pagamentoOpen.valor}
          periodoInicio={periodoInicio} periodoFim={periodoFim}
        />
      )}
    </>
  );
}

function FormSection({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
      <div className="flex gap-2">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-content-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "success" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <p className={`mt-1 truncate font-display text-xl font-bold ${tone === "success" ? "text-success" : ""}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-2 ${highlight ? "bg-success/10" : "bg-muted"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-display text-sm font-bold ${highlight ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

function Perm({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border bg-background p-2.5 text-xs text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );
}
