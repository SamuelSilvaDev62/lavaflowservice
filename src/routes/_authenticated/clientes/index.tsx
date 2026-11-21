import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listClientes, createCliente, getClientesComRecompensa } from "@/lib/lavaflow.functions";
import { brl, daysBetween } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import {
  ArrowUpRight, CalendarClock, CheckCircle2, ChevronRight, Gift, MessageCircle,
  Plus, RotateCw, Search, SlidersHorizontal, ChevronDown, UsersRound,
  Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

const searchSchema = z.object({
  filtro: z.enum(["recompensa_disponivel"]).optional(),
});

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: Page,
  validateSearch: searchSchema,
});

type Segmento = "todos" | "com_visitas" | "sem_visitas";
type Ordenacao = "nome" | "mais_visitas" | "ultima_visita" | "maior_valor";

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toLocaleUpperCase("pt-BR")).join("") || "?";
}

function ClientSummary({ label, value, icon: Icon, hint, tone, onClick, active, action }: {
  label: string; value: string; icon: typeof UsersRound; hint: string;
  tone?: "green" | "blue"; onClick: () => void; active?: boolean; action: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active}
      aria-label={label + ": " + value + ". " + action}
      className="group h-full w-full rounded-3xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      <Card className={"h-full min-w-0 cursor-pointer border bg-card shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md " + (active ? "border-primary/35" : "border-border/60 group-hover:border-primary/25")}>
        <CardContent className="flex h-full min-h-32 flex-col justify-between gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="text-xs font-medium leading-5 text-muted-foreground sm:text-sm">{label}</p>
            <span className="flex shrink-0 items-center gap-1">
              <span className={"grid h-9 w-9 place-items-center rounded-xl " + (tone === "green" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary" aria-hidden />
            </span>
          </div>
          <div className="min-w-0">
            <p className="break-words font-display text-2xl font-bold tracking-tight tabular-nums sm:text-[27px]">{value}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
            <p className="mt-1 text-[11px] font-semibold text-primary">{action}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function Page() {
  const list = useServerFn(listClientes);
  const create = useServerFn(createCliente);
  const recFn = useServerFn(getClientesComRecompensa);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["clientes"], queryFn: () => list() });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filtroRecompensa = search.filtro === "recompensa_disponivel";
  const { data: recData, isLoading: loadingRecompensas, isError: erroRecompensas } = useQuery({
    queryKey: ["clientes-recompensa"],
    queryFn: () => recFn(),
    enabled: filtroRecompensa,
  });

  const [q, setQ] = useState("");
  const [segmento, setSegmento] = useState<Segmento>("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("nome");
  const [open, setOpen] = useState(false);
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", origem_cliente: "Indicação" });
  const mut = useMutation({
    mutationFn: () => create({ data: { ...form, nome: form.nome.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setOpen(false);
      setForm({ nome: "", telefone: "", origem_cliente: "Indicação" });
      toast.success("Cliente cadastrado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível cadastrar o cliente."),
  });

  const clientes = data?.clientes ?? [];
  const totalClientes = clientes.length;
  const comVisitas = clientes.filter(c => Number(c.visitas ?? 0) > 0).length;
  const semVisitas = totalClientes - comVisitas;
  const valorRegistrado90 = clientes.reduce((sum, c) => sum + Number(c.total_gasto ?? 0), 0);

  const queryNome = q.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const queryDigitos = q.replace(/\D/g, "");
  const recompensaIds = filtroRecompensa && recData
    ? new Set(recData.clientes.map(c => c.id)) : null;

  const filtered = clientes.filter(c => {
    const nome = String(c.nome ?? "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const telefone = String(c.telefone ?? "").replace(/\D/g, "");
    const matchesSearch = !queryNome || nome.includes(queryNome) || (!!queryDigitos && telefone.includes(queryDigitos));
    const matchesSegmento = segmento === "todos" ||
      (segmento === "com_visitas" && Number(c.visitas ?? 0) > 0) ||
      (segmento === "sem_visitas" && Number(c.visitas ?? 0) === 0);
    return matchesSearch && matchesSegmento && (!filtroRecompensa || (recompensaIds ? recompensaIds.has(c.id) : false));
  }).sort((a, b) => {
    if (ordenacao === "mais_visitas") return Number(b.visitas ?? 0) - Number(a.visitas ?? 0) || a.nome.localeCompare(b.nome, "pt-BR");
    if (ordenacao === "maior_valor") return Number(b.total_gasto ?? 0) - Number(a.total_gasto ?? 0) || a.nome.localeCompare(b.nome, "pt-BR");
    if (ordenacao === "ultima_visita") return String(b.ultima_visita ?? "").localeCompare(String(a.ultima_visita ?? "")) || a.nome.localeCompare(b.nome, "pt-BR");
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  return (
    <div className="space-y-5 pb-8">
      <header className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-br from-primary/[0.09] via-card to-card p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-primary/[0.06] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-3 border border-primary/10 bg-card/70 text-[10px] font-semibold uppercase tracking-widest text-primary">
              Relacionamento
            </Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Clientes<span className="text-primary">.</span></h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Sua base de relacionamentos em um só lugar. Encontre clientes, acompanhe atendimentos e fortaleça o retorno.
            </p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">{totalClientes} {totalClientes === 1 ? "cliente cadastrado" : "clientes cadastrados"}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full shrink-0 gap-2 sm:w-auto" variant="premium">
                <Plus className="h-4 w-4" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Comece com nome e contato. As demais informações ficam disponíveis no perfil.</p>
              <form onSubmit={e => { e.preventDefault(); if (!mut.isPending && form.nome.trim()) mut.mutate(); }} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="novo-cliente-nome">Nome</Label><Input id="novo-cliente-nome" required maxLength={120} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="novo-cliente-whatsapp">WhatsApp</Label><Input id="novo-cliente-whatsapp" type="tel" placeholder="(11) 99999-0000" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="novo-cliente-origem">Origem do cliente</Label><Input id="novo-cliente-origem" value={form.origem_cliente} onChange={e => setForm({ ...form, origem_cliente: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={mut.isPending || !form.nome.trim()}>
                  {mut.isPending ? "Cadastrando..." : "Cadastrar cliente"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {isLoading ? (
        <div role="status" aria-label="Carregando clientes" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-3xl bg-muted" />)}</div>
          <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        </div>
      ) : isError || !data ? (
        <Card className="border border-destructive/20"><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-display text-lg font-semibold">Não foi possível carregar os clientes</p>
          <p className="text-sm text-muted-foreground">Tente novamente para consultar os registros da sua empresa.</p>
          <Button variant="outline" className="gap-2" onClick={() => refetch()}><RotateCw className="h-4 w-4" /> Tentar novamente</Button>
        </CardContent></Card>
      ) : (
        <>
          <section aria-label="Resumo da carteira" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <ClientSummary icon={UsersRound} label="Clientes cadastrados" value={String(totalClientes)}
              hint="Total de cadastros" action="Ver todos"
              active={segmento === "todos" && ordenacao === "nome" && !q && !filtroRecompensa}
              onClick={() => { setQ(""); setSegmento("todos"); setOrdenacao("nome"); if (filtroRecompensa) navigate({ search: {} }); }} />
            <ClientSummary icon={CheckCircle2} label="Com atendimentos" value={String(comVisitas)}
              hint="Com OS nos últimos 90 dias" tone="green" action="Filtrar carteira"
              active={segmento === "com_visitas" && !q && !filtroRecompensa}
              onClick={() => { setQ(""); setSegmento("com_visitas"); if (filtroRecompensa) navigate({ search: {} }); }} />
            <ClientSummary icon={CalendarClock} label="Sem atendimentos" value={String(semVisitas)}
              hint="Sem OS nos últimos 90 dias" action="Ver clientes"
              active={segmento === "sem_visitas" && !q && !filtroRecompensa}
              onClick={() => { setQ(""); setSegmento("sem_visitas"); if (filtroRecompensa) navigate({ search: {} }); }} />
            <ClientSummary icon={Wallet} label="Valor registrado em OS" value={brl(valorRegistrado90)}
              hint="Ordens dos últimos 90 dias; não indica pagamento" tone="green" action="Ordenar por valor"
              active={ordenacao === "maior_valor" && segmento === "todos" && !q && !filtroRecompensa}
              onClick={() => { setQ(""); setSegmento("todos"); setOrdenacao("maior_valor"); if (filtroRecompensa) navigate({ search: {} }); }} />
          </section>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold">Carteira de clientes</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Busque, filtre e abra o perfil completo de cada pessoa.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input aria-label="Buscar clientes por nome ou telefone" value={q} onChange={e => setQ(e.target.value)}
                      placeholder="Buscar nome ou telefone..." className="h-10 pl-9" />
                    {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="relative sm:w-48">
                    <Label htmlFor="ordem-clientes" className="sr-only">Ordenar clientes</Label>
                    <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <select id="ordem-clientes" value={ordenacao} onChange={e => setOrdenacao(e.target.value as Ordenacao)}
                      className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm">
                      <option value="nome">Nome (A–Z)</option>
                      <option value="ultima_visita">Atendimento recente</option>
                      <option value="mais_visitas">Mais atendimentos</option>
                      <option value="maior_valor">Maior valor de OS</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar carteira">
                {([
                  ["todos", "Todos", totalClientes],
                  ["com_visitas", "Com atendimentos", comVisitas],
                  ["sem_visitas", "Sem atendimentos", semVisitas],
                ] as const).map(([value, label, count]) => (
                  <button key={value} type="button" aria-pressed={segmento === value} onClick={() => setSegmento(value)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${segmento === value ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
                    {label} <span className="tabular-nums opacity-75">{count}</span>
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">{filtered.length} exibidos</span>
              </div>

              {filtroRecompensa && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Gift className="h-4 w-4" /> Clientes com recompensa disponível
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={() => navigate({ search: {} })}><X className="h-3.5 w-3.5" /> Remover filtro</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {filtroRecompensa && (loadingRecompensas || erroRecompensas) ? (
            <Card className="border border-border/60"><CardContent className="p-8 text-center text-sm text-muted-foreground">
              {loadingRecompensas ? "Consultando recompensas disponíveis..." : "Não foi possível consultar recompensas. Remova o filtro ou tente novamente."}
            </CardContent></Card>
          ) : totalClientes === 0 ? (
            <EmptyState icon={UsersRound} title="Sua base de clientes começa aqui"
              description="Cadastre seu primeiro cliente e acompanhe os atendimentos, o histórico e o relacionamento."
              ctas={[{ label: "Cadastrar primeiro cliente", onClick: () => setOpen(true) }]} />
          ) : filtered.length === 0 ? (
            <Card className="border border-border/60"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Search className="h-7 w-7 text-muted-foreground" />
              <p className="font-display font-semibold">Nenhum cliente encontrado</p>
              <p className="max-w-sm text-sm text-muted-foreground">Altere a busca ou os filtros para ver outros clientes.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => { setQ(""); setSegmento("todos"); if (filtroRecompensa) navigate({ search: {} }); }}>Limpar filtros</Button>
            </CardContent></Card>
          ) : (
            <section className="grid items-start gap-2.5 lg:grid-cols-2" aria-label="Lista de clientes">
              {filtered.map(c => {
                const visits = Number(c.visitas ?? 0);
                const days = c.ultima_visita ? daysBetween(c.ultima_visita) : null;
                const rec = filtroRecompensa ? recData?.clientes.find(r => r.id === c.id) : null;
                const phone = c.telefone?.trim() || "";
                const canMessage = phone.replace(/\D/g, "").length >= 10;
                const expanded = expandedClienteId === c.id;
                const detailsId = "cliente-detalhes-" + c.id;
                const fromOnlineBooking = c.origem_cliente === "Agendamento online";
                return (
                  <Card key={c.id} className={"min-w-0 overflow-hidden border bg-card shadow-sm transition-all duration-200 " + (expanded ? "border-primary/25 shadow-md" : "border-border/60 hover:border-primary/25 hover:shadow-md")}>
                    <CardContent className="p-0">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        aria-label={c.nome + ". " + (expanded ? "Ocultar" : "Mostrar") + " detalhes do cliente"}
                        onClick={() => setExpandedClienteId(id => id === c.id ? null : c.id)}
                        className="group flex min-h-20 w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/25 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5"
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-sm font-bold text-primary" aria-hidden>
                          {initials(c.nome)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold sm:text-base">{c.nome}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{phone || "Telefone não informado"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {fromOnlineBooking && <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">Reserva online</Badge>}
                          <Badge variant={visits ? "secondary" : "outline"} className="hidden text-[10px] min-[400px]:inline-flex">
                            {visits ? "Com histórico" : "Sem OS recentes"}
                          </Badge>
                          <ChevronDown className={"h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-primary " + (expanded ? "rotate-180" : "")} aria-hidden />
                        </span>
                      </button>
                      <div id={detailsId} hidden={!expanded}>
                        {expanded && (
                          <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                            {fromOnlineBooking && (
                              <p className="text-xs font-medium text-primary">Cadastrado pelo agendamento online</p>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="min-w-0 rounded-xl bg-muted/35 p-2.5">
                                <p className="text-[10px] text-muted-foreground">OS · 90 dias</p>
                                <p className="mt-1 font-display text-base font-bold tabular-nums">{visits}</p>
                              </div>
                              <div className="min-w-0 rounded-xl bg-muted/35 p-2.5">
                                <p className="text-[10px] text-muted-foreground">Valor das OS</p>
                                <p className="mt-1 break-words font-display text-xs font-bold tabular-nums sm:text-sm">{brl(Number(c.total_gasto ?? 0))}</p>
                              </div>
                              <div className="min-w-0 rounded-xl bg-primary/[0.05] p-2.5">
                                <p className="text-[10px] text-muted-foreground">Pontos</p>
                                <p className="mt-1 font-display text-base font-bold tabular-nums text-primary">{c.pontos_saldo ?? 0}</p>
                              </div>
                            </div>
                            {rec && (rec as any).recompensa && (
                              <p className="flex items-start gap-2 rounded-xl bg-emerald-500/[0.07] p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                                <Gift className="h-3.5 w-3.5 shrink-0" /> Pode resgatar: {(rec as any).recompensa}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
                              <p className="text-[11px] text-muted-foreground">
                                {days == null ? "Sem OS nos últimos 90 dias" : days === 0 ? "Último atendimento hoje" : "Último atendimento há " + days + (days === 1 ? " dia" : " dias")}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                {canMessage && (
                                  <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                                    <a href={waLink(phone, "Olá " + c.nome.split(" ")[0] + "!")} target="_blank" rel="noopener noreferrer" aria-label={"Conversar com " + c.nome + " no WhatsApp"}>
                                      <MessageCircle className="h-4 w-4" /> WhatsApp
                                    </a>
                                  </Button>
                                )}
                                <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                                  <Link to="/clientes/$id" params={{ id: c.id }}>Ver perfil <ChevronRight className="h-4 w-4" /></Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
          {totalClientes > 0 && (
            <p className="px-1 text-xs text-muted-foreground">Visitas e valores registrados consideram ordens de serviço dos últimos 90 dias; pontos representam o saldo atual.</p>
          )}
        </>
      )}
    </div>
  );
}
