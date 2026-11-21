import { createFileRoute, useRouter } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { queryOptions, useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireRole } from "@/components/require-role";
import { useFeature } from "@/hooks/use-entitlement";
import { OPERACIONAL } from "@/lib/rbac";
import { listOrdensPage, createOrdem, listClientes, listServicos, listFuncionarios, updateOrdemStatus, atualizarUpsellOportunidade, type OsStatus } from "@/lib/lavaflow.functions";
import { DEFAULT_ORDER_FILTERS, ORDER_STATUS_LABELS, ORDER_PAGE_SIZE, type OrderFilters } from "@/lib/ordens-model";
import { brl, dateTimeBr } from "@/lib/format";
import { Plus, ClipboardList, Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, Car, UserRound, Clock3, CheckCheck, CircleDollarSign, ListChecks, LoaderCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""), period: fallback(z.string(), "30").default("30"),
  status: fallback(z.string(), "all").default("all"), service: fallback(z.string(), "all").default("all"),
  employee: fallback(z.string(), "all").default("all"), sort: fallback(z.string(), "recent").default("recent"),
  page: fallback(z.number(), 1).default(1),
});
function safeFilters(search: OrderFilters): OrderFilters {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return { ...search, q: search.q.slice(0, 120),
    period: ["today", "7", "30", "all"].includes(search.period) ? search.period : "30",
    status: search.status === "all" || search.status in ORDER_STATUS_LABELS ? search.status : "all",
    service: uuid.test(search.service) ? search.service : "all",
    employee: uuid.test(search.employee) || search.employee === "none" ? search.employee : "all",
    sort: ["recent", "oldest", "value"].includes(search.sort) ? search.sort : "recent",
    page: Number.isFinite(search.page) ? Math.max(1, Math.floor(search.page)) : 1,
  };
}
const ordersQuery = (filters: OrderFilters) => queryOptions({
  queryKey: ["ordens", "paginated", filters], queryFn: () => listOrdensPage({ data: filters }), staleTime: 20_000,
});
export const Route = createFileRoute("/_authenticated/ordens")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => safeFilters(search),
  loader: async ({ context, deps }) => { await context.queryClient.ensureQueryData(ordersQuery(deps)); },
  head: () => ({ meta: [
    { title: "Ordens de serviço | LavaFlow" },
    { name: "description", content: "Acompanhe ordens de serviço, valores do período, responsáveis e checklists do seu estabelecimento." },
    { property: "og:title", content: "Ordens de serviço | LavaFlow" },
    { property: "og:description", content: "Controle os atendimentos e acompanhe a operação do seu lava-rápido." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireRole roles={OPERACIONAL}><Page /></RequireRole>,
  pendingMs: 100, pendingComponent: OrdersSkeleton,
  errorComponent: OrdersError,
  notFoundComponent: () => <p className="p-6">Ordens de serviço não encontradas.</p>,
});

const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABELS) as OsStatus[];
const statusTone: Record<OsStatus, string> = {
  aguardando: "bg-warning/10 text-warning", em_lavagem: "bg-primary/10 text-primary",
  finalizacao: "bg-accent text-accent-foreground", pronto: "bg-success/10 text-success", entregue: "bg-success/10 text-success",
};
const checklistLabel = (status: string) => status === "concluido" ? "Concluído" : status === "pulado" ? "Pulado" : status === "pendente" ? "Pendente" : "Não informado";
type Order = Awaited<ReturnType<typeof listOrdensPage>>["ordens"][number];

function Page() {
  const filters = safeFilters(Route.useSearch());
  const navigate = Route.useNavigate();
  const { data, isFetching } = useSuspenseQuery(ordersQuery(filters));
  const servicesFn = useServerFn(listServicos);
  const employeesFn = useServerFn(listFuncionarios);
  const { data: services } = useQuery({ queryKey: ["servicos"], queryFn: () => servicesFn() });
  const { data: employees } = useQuery({ queryKey: ["funcionarios"], queryFn: () => employeesFn() });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const change = (patch: Partial<OrderFilters>) => navigate({ search: (previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }), replace: true, resetScroll: false });
  const clear = () => navigate({ search: DEFAULT_ORDER_FILTERS, replace: true, resetScroll: false });
  const filtered = Boolean(filters.q || filters.status !== "all" || filters.service !== "all" || filters.employee !== "all");
  const metrics = [
    { label: "Total de OS", value: data.summary.total, icon: ClipboardList, tone: "text-primary", note: "Criadas no período" },
    { label: "Em andamento", value: data.summary.active, icon: Clock3, tone: "text-primary", note: "Inclui aguardando e pronto" },
    { label: "Entregues", value: data.summary.delivered, icon: CheckCheck, tone: "text-success", note: "Atendimentos entregues" },
    { label: "Valor das OS do período", value: brl(data.summary.value), icon: CircleDollarSign, tone: "text-primary", note: "Valor registrado nas ordens" },
    { label: "Checklist pendente", value: data.summary.pending, icon: ListChecks, tone: "text-warning", note: "Checklist inicial pendente" },
  ];
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><ClipboardList className="h-6 w-6" /></div><div className="min-w-0"><h1 className="font-display text-2xl font-bold">Ordens de serviço</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe cada atendimento, da chegada à entrega.</p></div></div>
      <NewOrder services={services?.servicos ?? []} employees={employees?.funcionarios ?? []} />
    </header>
    <section aria-label="Resumo das ordens no período" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-5">
      {metrics.map((m) => <div key={m.label} className="neo-surface min-w-0 rounded-2xl p-4"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{m.label}</p><m.icon className={`h-4 w-4 shrink-0 ${m.tone}`} /></div><p className="mt-3 break-words font-display text-2xl font-bold tabular-nums">{m.value}</p><p className="mt-2 text-xs text-muted-foreground">{m.note}</p></div>)}
    </section>
    <section aria-label="Filtros de ordens" className="space-y-3 border-y border-border/60 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Pesquisar cliente, serviço, placa ou OS" placeholder="Buscar cliente, serviço, placa ou OS…" value={filters.q} maxLength={120} onChange={(e) => change({ q: e.target.value })} className="h-11 pl-10" /></div>
        <FilterSelect label="Período" value={filters.period} onChange={(period) => change({ period })} options={[["today", "Hoje"], ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["all", "Todo o período"]]} />
        <Button variant="outline" className="min-h-11 lg:hidden" aria-expanded={filtersOpen} aria-controls="order-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal />Filtros{filtered && <span className="h-2 w-2 rounded-full bg-primary" />}</Button>
      </div>
      <div id="order-filters" className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-5`}>
        <FilterSelect label="Status" value={filters.status} onChange={(status) => change({ status })} options={[["all", "Todos os status"], ...STATUS_OPTIONS.map((s): [string, string] => [s, ORDER_STATUS_LABELS[s]])]} />
        <FilterSelect label="Serviço" value={filters.service} onChange={(service) => change({ service })} options={[["all", "Todos os serviços"], ...(services?.servicos ?? []).map((s): [string, string] => [s.id, s.nome])]} />
        <FilterSelect label="Colaborador" value={filters.employee} onChange={(employee) => change({ employee })} options={[["all", "Todos os responsáveis"], ["none", "Sem responsável"], ...(employees?.funcionarios ?? []).map((f): [string, string] => [f.id, f.nome])]} />
        <FilterSelect label="Ordenação" value={filters.sort} onChange={(sort) => change({ sort })} options={[["recent", "Mais recentes"], ["oldest", "Mais antigas"], ["value", "Maior valor"]]} />
        <Button variant="ghost" className="min-h-11" onClick={clear}><RotateCcw />Limpar filtros</Button>
      </div>
    </section>
    <section aria-label="Lista de ordens" aria-busy={isFetching} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-base font-semibold">Atendimentos <span className="ml-1 text-sm font-normal tabular-nums text-muted-foreground">({data.total})</span></h2><span className="text-xs text-muted-foreground">{isFetching ? "Atualizando…" : "Resumo considera o período selecionado"}</span></div>
      {data.ordens.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-center"><ClipboardList className="h-10 w-10 text-primary/60" /><h3 className="font-display text-lg font-semibold">{filtered ? "Nenhuma OS corresponde aos filtros" : "Nenhuma OS neste período"}</h3><p className="max-w-sm text-sm text-muted-foreground">{filtered ? "Tente outro cliente, placa ou serviço." : "Selecione outro período ou registre um novo atendimento."}</p><Button variant="outline" onClick={clear}><RotateCcw />Limpar filtros</Button></div> : <>
        <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card lg:block"><Table className="table-fixed"><TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead className="w-[26%] pl-5">Cliente / Serviço</TableHead className="w-[14%]">Responsável</TableHead className="w-[14%]">Data / Hora</TableHead className="w-[12%]">Checklist</TableHead className="w-[12%] text-right">Valor</TableHead className="w-[15%]">Status</TableHead className="w-[7%] pr-4 text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data.ordens.map((o) => <OrderRow key={o.id} order={o} mode="desktop" />)}</TableBody></Table></div>
        <div className="space-y-3 lg:hidden">{data.ordens.map((o) => <OrderRow key={o.id} order={o} mode="mobile" />)}</div>
      </>}
      {data.total > 0 && <nav aria-label="Paginação das ordens" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"><p className="text-xs tabular-nums text-muted-foreground">{(data.page - 1) * ORDER_PAGE_SIZE + 1}–{Math.min(data.page * ORDER_PAGE_SIZE, data.total)} de {data.total} OS</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Página anterior" disabled={data.page <= 1 || isFetching} onClick={() => change({ page: data.page - 1 })}><ChevronLeft /></Button><span className="text-sm tabular-nums">{data.page} / {data.pages}</span><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Próxima página" disabled={data.page >= data.pages || isFetching} onClick={() => change({ page: data.page + 1 })}><ChevronRight /></Button></div></nav>}
    </section>
  </div>;
}
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <div className="min-w-0 space-y-1"><p className="text-xs font-medium text-muted-foreground">{label}</p><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="h-11 min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, text]) => <SelectItem key={v} value={v}>{text}</SelectItem>)}</SelectContent></Select></div>;
}
const OrderRow = memo(function OrderRow({ order: o, mode }: { order: Order; mode: "mobile" | "desktop" }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const update = useServerFn(updateOrdemStatus);
  const mut = useMutation({ mutationFn: (status: OsStatus) => update({ data: { id: o.id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens"] }); qc.invalidateQueries({ queryKey: ["fila"] }); toast.success("Status atualizado"); },
    onError: (e) => toast.error(e.message || "Falha ao atualizar status"),
  });
  const status = o.status as OsStatus;
  const control = <Select value={status} disabled={mut.isPending} onValueChange={(v) => mut.mutate(v as OsStatus)}><SelectTrigger aria-label={`Alterar status da OS ${o.id.slice(0, 8)}`} className={`h-11 min-w-0 rounded-full border-0 text-xs font-medium shadow-none ${statusTone[status]} [&>span]:truncate`}><SelectValue />{mut.isPending && <LoaderCircle className="h-3 w-3 animate-spin" />}</SelectTrigger><SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>;
  const detailsId = `order-${mode}-${o.id}`;
  const toggle = <Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-primary" title={expanded ? "Recolher detalhes" : "Ver detalhes"} aria-label={`${expanded ? "Recolher" : "Ver"} detalhes da OS ${o.id.slice(0, 8)}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp /> : <Eye />}</Button>;
  const identity = <><p className="break-words font-semibold">{o.clientes?.nome ?? "Cliente não informado"}</p><p className="mt-1 break-words text-xs text-muted-foreground">{o.servicos?.nome ?? "Sem serviço vinculado"}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">#{o.id.slice(0, 8)}</p></>;
  const checklist = <Badge variant="secondary" className={`whitespace-normal text-[11px] ${o.checklist_inicial_status === "pendente" ? "bg-warning/10 text-warning" : o.checklist_inicial_status === "concluido" ? "bg-success/10 text-success" : ""}`}>{checklistLabel(o.checklist_inicial_status)}</Badge>;
  if (mode === "desktop") return <><TableRow className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest("button, [role=combobox]")) setExpanded(!expanded); }}><TableCell className="py-4 pl-5">{identity}</TableCell><TableCell className="break-words text-xs"><span className="inline-flex items-start gap-1.5"><UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{o.funcionarios?.nome ?? "Sem responsável"}</span></TableCell><TableCell className="text-xs text-muted-foreground">{dateTimeBr(o.created_at)}</TableCell><TableCell>{checklist}</TableCell><TableCell className="text-right font-semibold tabular-nums">{brl(o.valor)}</TableCell><TableCell onClick={(e) => e.stopPropagation()}>{control}</TableCell><TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>{toggle}</TableCell></TableRow>{expanded && <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="p-0"><div id={detailsId}><OrderDetails order={o} /></div></TableCell></TableRow>}</>;
  return <article className="neo-surface-sm min-w-0 overflow-hidden rounded-2xl"><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">{identity}</div><p className="shrink-0 text-base font-bold tabular-nums">{brl(o.valor)}</p></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{o.funcionarios?.nome ?? "Sem responsável"}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{dateTimeBr(o.created_at)}</span></div><div className="flex items-center gap-2"><div className="min-w-0 flex-1">{control}</div>{checklist}{toggle}</div></div>{expanded && <div id={detailsId}><OrderDetails order={o} /></div>}</article>;
});
function OrderDetails({ order: o }: { order: Order }) {
  const { allowed } = useFeature("oportunidades");
  const update = useServerFn(atualizarUpsellOportunidade);
  const qc = useQueryClient();
  const mut = useMutation({ mutationFn: (data: { id: string; status: "oferecida" | "aceita" | "recusada" }) => update({ data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens"] }); qc.invalidateQueries({ queryKey: ["fila"] }); toast.success("Oportunidade atualizada"); }, onError: (e) => toast.error(e.message || "Falha ao atualizar oportunidade"),
  });
  return <div className="space-y-5 border-t border-border/60 bg-muted/25 p-4 lg:p-6">
    <div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Veículo</p><p className="mt-1 flex items-center gap-2 text-sm font-medium"><Car className="h-4 w-4 text-primary" />{o.veiculos?.placa ?? "Sem veículo vinculado"}</p></div><div><p className="text-xs text-muted-foreground">Checklist inicial</p><p className="mt-1 text-sm font-medium">{checklistLabel(o.checklist_inicial_status)}</p><p className="mt-1 text-xs text-muted-foreground">{o.checklist_funcionario?.nome ?? "Autor não registrado"}{o.checklist_inicial_em ? ` · ${dateTimeBr(o.checklist_inicial_em)}` : " · Data não registrada"}</p></div><div><p className="text-xs text-muted-foreground">Status do atendimento</p><p className="mt-1 text-sm font-medium">{ORDER_STATUS_LABELS[o.status as OsStatus]}</p></div></div>
    <ol aria-label="Etapas do atendimento" className="grid grid-cols-2 gap-2 sm:grid-cols-5">{STATUS_OPTIONS.map((s, i) => <li key={s} className={`flex items-center gap-2 text-xs ${i <= STATUS_OPTIONS.indexOf(o.status as OsStatus) ? "text-primary" : "text-muted-foreground"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${i <= STATUS_OPTIONS.indexOf(o.status as OsStatus) ? "bg-primary/10" : "bg-muted"}`}>{i + 1}</span>{ORDER_STATUS_LABELS[s]}</li>)}</ol>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">{o.iniciado_em && <span>Iniciado: {dateTimeBr(o.iniciado_em)}</span>}{o.finalizado_em && <span>Pronto: {dateTimeBr(o.finalizado_em)}</span>}{o.entregue_em && <span>Entregue: {dateTimeBr(o.entregue_em)}</span>}</div>
    {o.observacoes && <div><p className="text-xs font-semibold">Observações</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{o.observacoes}</p></div>}
    <div><h3 className="text-sm font-semibold">Origem da receita</h3>{o.origens_receita.length ? <div className="mt-2 flex flex-wrap gap-2">{o.origens_receita.map((r) => <Badge key={r.id} variant="outline" className="max-w-full whitespace-normal break-words">{originLabel(r.origem)}{Number(r.valor) > 0 ? ` · ${brl(Number(r.valor))}` : ""}</Badge>)}</div> : <p className="mt-1 text-xs text-muted-foreground">Nenhuma origem registrada para esta OS.</p>}</div>
    {o.upsell_oportunidades.length > 0 && <section className="space-y-3 border-t border-border/60 pt-4"><h3 className="text-sm font-semibold">Oportunidades do checklist</h3>{o.upsell_oportunidades.map((u) => <div key={u.id} className="space-y-2 border-b border-border/50 pb-3 last:border-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{u.servico_sugerido}</p><p className="mt-1 break-words text-xs text-muted-foreground">{u.motivo}</p><p className="mt-1 text-xs text-muted-foreground">{u.valor_estimado != null ? `Valor estimado: ${brl(Number(u.valor_estimado))}` : "Valor estimado não informado"}</p></div><Badge variant="secondary">{({ sugerida: "Sugerida", oferecida: "Oferecida", aceita: "Aceita", recusada: "Recusada", ignorada: "Ignorada" } as Record<string, string>)[u.status] ?? u.status}</Badge></div>{allowed && <div className="flex flex-wrap gap-2">{([['oferecida', 'Oferecida'], ['aceita', 'Cliente aceitou'], ['recusada', 'Cliente recusou']] as const).map(([status, label]) => <Button key={status} className="min-h-11" variant={status === "aceita" ? "default" : "outline"} disabled={mut.isPending || u.status === status} onClick={() => mut.mutate({ id: u.id, status })}>{mut.isPending && mut.variables?.id === u.id && mut.variables.status === status && <LoaderCircle className="animate-spin" />}{label}</Button>)}</div>}</div>)}</section>}
  </div>;
}
function NewOrder({ services, employees }: { services: { id: string; nome: string; preco_padrao: number }[]; employees: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cliente_id: "", servico_id: "", funcionario_id: "", valor: 0 });
  const create = useServerFn(createOrdem);
  const clientsFn = useServerFn(listClientes);
  const qc = useQueryClient();
  const { data: clients, isError } = useQuery({ queryKey: ["clientes"], queryFn: () => clientsFn(), enabled: open });
  const mut = useMutation({ mutationFn: () => create({ data: { ...form, servico_id: form.servico_id || null, funcionario_id: form.funcionario_id || null, valor: Number(form.valor) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens"] }); qc.invalidateQueries({ queryKey: ["fila"] }); setOpen(false); toast.success("OS criada"); setForm({ cliente_id: "", servico_id: "", funcionario_id: "", valor: 0 }); },
    onError: (e) => toast.error(e.message || "Falha ao criar OS"),
  });
  return <Dialog open={open} onOpenChange={(v) => { if (!mut.isPending) setOpen(v); }}><DialogTrigger asChild><Button variant="premium" className="min-h-11"><Plus />Nova OS</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Nova ordem de serviço</DialogTitle></DialogHeader><form onSubmit={(e) => { e.preventDefault(); if (!form.cliente_id) { toast.error("Selecione um cliente"); return; } mut.mutate(); }} className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor="os-client">Cliente</Label><Select value={form.cliente_id} onValueChange={(cliente_id) => setForm((f) => ({ ...f, cliente_id }))}><SelectTrigger id="os-client" className="h-11"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{clients?.clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>{isError && <p className="text-xs text-destructive">Não foi possível carregar os clientes.</p>}</div>
    <div className="space-y-1.5"><Label htmlFor="os-service">Serviço (opcional)</Label><Select value={form.servico_id || "none"} onValueChange={(v) => { const s = services.find((x) => x.id === v); setForm((f) => ({ ...f, servico_id: v === "none" ? "" : v, valor: s?.preco_padrao ?? f.valor })); }}><SelectTrigger id="os-service" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem serviço vinculado</SelectItem>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome} · {brl(s.preco_padrao)}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1.5"><Label htmlFor="os-employee">Responsável (opcional)</Label><Select value={form.funcionario_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, funcionario_id: v === "none" ? "" : v }))}><SelectTrigger id="os-employee" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem responsável</SelectItem>{employees.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1.5"><Label htmlFor="os-value">Valor (R$)</Label><Input id="os-value" className="h-11" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" value={form.valor === 0 ? "" : form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value === "" ? 0 : Number(e.target.value) }))} /></div><Button type="submit" className="min-h-11 w-full" disabled={mut.isPending || !form.cliente_id}>{mut.isPending && <LoaderCircle className="animate-spin" />}{mut.isPending ? "Criando…" : "Criar OS"}</Button>
  </form></DialogContent></Dialog>;
}
function OrdersSkeleton() { return <div aria-label="Carregando ordens" className="space-y-6"><Skeleton className="h-14 w-64" /><div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="skeleton-shimmer h-32 rounded-2xl" />)}</div><Skeleton className="h-24 w-full" />{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="skeleton-shimmer h-24 w-full rounded-2xl" />)}</div>; }
function OrdersError() {
  const router = useRouter();
  const qc = useQueryClient();
  return <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><h1 className="font-display text-xl font-semibold">Não foi possível carregar as ordens</h1><p className="text-sm text-muted-foreground">Seus dados estão preservados. Tente novamente.</p><Button onClick={async () => { await qc.invalidateQueries({ queryKey: ["ordens"] }); await router.invalidate(); }}><RotateCcw />Tentar novamente</Button></div>;
}
function originLabel(origin: string) {
  return ({ CLIENTE_RECUPERADO: "Cliente recuperado", FIDELIDADE: "Fidelidade", UPSELL_CHECKLIST: "Upsell do checklist", CONSULTOR_IA: "Consultor", CAMPANHA: "Campanha", ANIVERSARIO: "Aniversário", LEVA_ETRAZ: "Leva e Traz" } as Record<string, string>)[origin] ?? origin;
}
