import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listAgendamentos, createAgendamento, agendamentoStats, updateAgendamentoStatus,
  iniciarAtendimento, listClientes, listServicos, getEmpresa, listFuncionarios, updateAgendamento,
  getColaboradoresDisponiveis, type AgendamentoStatus,
} from "@/lib/lavaflow.functions";
import { brl, dateBr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import {
  Plus, MessageCircle, Play, Check, X as XIcon, AlertTriangle, CalendarDays,
  Link2, ChevronDown, Phone, Calendar as CalendarIcon, ChevronRight, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  component: Page,
});

const STATUS_LABEL: Record<AgendamentoStatus, string> = {
  agendado: "Agendado", confirmado: "Confirmado", em_andamento: "Em atendimento",
  concluido: "Concluído", cancelado: "Cancelado", nao_compareceu: "Não compareceu",
};
const STATUS_COLOR: Record<AgendamentoStatus, string> = {
  agendado: "bg-muted text-foreground",
  confirmado: "bg-primary/10 text-primary",
  em_andamento: "bg-warning/10",
  concluido: "bg-success/10 text-success",
  cancelado: "bg-destructive/10 text-destructive",
  nao_compareceu: "bg-destructive/10 text-destructive",
};

function todayIso() { return new Date().toISOString().slice(0, 10); }
function addDaysIso(baseIso: string, days: number) {
  const d = new Date(baseIso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoFromDate(d);
}
function isoFromDate(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function buildDayStrip(centerIso: string, days = 14) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 1);
  const out: { iso: string; date: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    out.push({ iso: isoFromDate(d), date: d });
  }
  if (!out.find((x) => x.iso === centerIso)) {
    const extra = new Date(centerIso + "T00:00:00");
    out.push({ iso: centerIso, date: extra });
    out.sort((a, b) => a.iso.localeCompare(b.iso));
  }
  return out;
}
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const WEEKDAY_LONG = ["Domingo", "Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado"];

function dayLabel(iso: string) {
  const today = todayIso();
  if (iso === today) return "Hoje";
  if (iso === addDaysIso(today, 1)) return "Amanha";
  const d = new Date(iso + "T00:00:00");
  const diff = Math.floor((d.getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000);
  if (diff >= 2 && diff <= 6) return WEEKDAY_LONG[d.getDay()];
  if (diff >= 7 && diff <= 13) return "Proxima semana";
  return dateBr(iso);
}

function groupByDate(items: any[]) {
  const groups = new Map<string, any[]>();
  items.forEach((item) => {
    const key = item.data_agendada;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return Array.from(groups.entries());
}

function estimatedValue(items: any[]) {
  return items.reduce((sum, a) => sum + Number(a.servicos?.preco_padrao ?? 0) + Number(a.taxa_leva_traz ?? 0), 0);
}

function Page() {
  const [date, setDate] = useState(todayIso());
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [levaOnly, setLevaOnly] = useState(false);
  const isMobile = useIsMobile();
  const dayStrip = useMemo(() => buildDayStrip(date), [date]);
  const todayStr = todayIso();
  const stripFrom = dayStrip[0]?.iso ?? todayStr;
  const stripTo = dayStrip[dayStrip.length - 1]?.iso ?? addDaysIso(todayStr, 13);

  const list = useServerFn(listAgendamentos);
  const stats = useServerFn(agendamentoStats);
  const emp = useServerFn(getEmpresa);
  const { data: ag, isLoading } = useQuery({ queryKey: ["agendamentos", date, levaOnly], queryFn: () => list({ data: { date, leva_traz: levaOnly } }) });
  const { data: proximosData, isLoading: loadingProximos } = useQuery({
    queryKey: ["agendamentos-proximos", todayStr],
    queryFn: () => list({ data: { from: todayStr, to: addDaysIso(todayStr, 30) } }),
  });
  const { data: densidadeData } = useQuery({
    queryKey: ["agendamentos-densidade", stripFrom, stripTo],
    queryFn: () => list({ data: { from: stripFrom, to: stripTo } }),
  });
  const { data: st } = useQuery({ queryKey: ["agendamento-stats"], queryFn: () => stats() });
  const { data: empresa } = useQuery({ queryKey: ["empresa"], queryFn: () => emp() });

  const linkPublico = empresa?.empresa?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${empresa.empresa.slug}`
    : "";

  const agendamentosDia = ag?.agendamentos ?? [];
  const proximosAgendamentos = (proximosData?.agendamentos ?? [])
    .filter((a: any) => !["concluido", "cancelado", "nao_compareceu"].includes(a.status))
    .slice(0, 12);
  const densidadePorDia = useMemo(() => {
    const map = new Map<string, number>();
    (densidadeData?.agendamentos ?? []).forEach((a: any) => {
      if (["cancelado", "nao_compareceu"].includes(a.status)) return;
      map.set(a.data_agendada, (map.get(a.data_agendada) ?? 0) + 1);
    });
    return map;
  }, [densidadeData]);
  const pendentesDia = agendamentosDia.filter((a: any) => a.status === "agendado").length;
  const confirmadosDia = agendamentosDia.filter((a: any) => a.status === "confirmado").length;
  const levaTrazDia = agendamentosDia.filter((a: any) => a.leva_traz).length;
  const receitaPrevistaDia = estimatedValue(agendamentosDia.filter((a: any) => !["cancelado", "nao_compareceu"].includes(a.status)));

  return (
    <>
      <PageHeader
        title="Agendamentos"
        subtitle="Organize sua agenda e reduza filas."
        actions={
          !isMobile && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova reserva</Button></DialogTrigger>
              <NovoAgendamentoDialog onClose={() => setOpen(false)} defaultDate={date} />
            </Dialog>
          )
        }
      />

      {/* KPIs - grade responsiva, sem rolagem lateral */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
        <KpiCard label="Hoje" value={st?.hoje ?? 0} />
        <KpiCard label="Confirmados" value={confirmadosDia} tone="primary" />
        <KpiCard label="Pendentes" value={pendentesDia} tone="warning" />
        <KpiCard label="Leva e Traz" value={levaTrazDia} tone="primary" />
        <KpiCard label="Receita prevista" value={brl(receitaPrevistaDia)} tone="success" wide />
      </div>

      {/* Link público colapsável */}
      {linkPublico && (
        <Card className="mb-4">
          <button
            onClick={() => setLinkOpen((v) => !v)}
            className="w-full p-3 flex items-center gap-3 text-left"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-content-center shrink-0">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Link público</p>
              <p className="text-xs text-muted-foreground truncate">{linkPublico.replace(/^https?:\/\//, "")}</p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", linkOpen && "rotate-180")} />
          </button>
          {linkOpen && (
            <div className="px-3 pb-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1"
                onClick={() => { navigator.clipboard.writeText(linkPublico); toast.success("Link copiado"); }}>
                Copiar
              </Button>
              <Button size="sm" variant="outline" className="flex-1" asChild>
                <a href={`https://wa.me/?text=${encodeURIComponent(`Agende sua lavagem: ${linkPublico}`)}`} target="_blank" rel="noreferrer">
                  Compartilhar
                </a>
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Faixa de dias */}
      <div className="mb-4 flex items-start gap-2">
        <div className="grid flex-1 grid-cols-7 gap-1.5 sm:gap-2">
          {dayStrip.map(({ iso, date: d }) => {
            const active = iso === date;
            const isToday = iso === todayStr;
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-1.5 transition-colors",
                  active ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent",
                )}
              >
                <span className={cn("text-[9px] uppercase font-medium sm:text-[10px]", active ? "opacity-90" : "text-muted-foreground")}>
                  {isToday ? "hoje" : WD[d.getDay()]}
                </span>
                <span className="text-base font-bold leading-tight sm:text-lg">{d.getDate()}</span>
                <DayDots count={densidadePorDia.get(iso) ?? 0} active={active} />
              </button>
            );
          })}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 h-10 w-10"><CalendarIcon className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={new Date(date + "T00:00:00")}
              onSelect={(d) => d && setDate(isoFromDate(d))}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={levaOnly ? "default" : "outline"} onClick={() => setLevaOnly((v) => !v)}>
          <MapPin className="h-4 w-4 mr-1" /> Leva e Traz
        </Button>
        {st?.taxaComparecimento != null && (
          <span className="text-xs text-muted-foreground">Comparecimento 30 dias: {Math.round(st.taxaComparecimento * 100)}%</span>
        )}
      </div>

      <Card className="mb-4 overflow-hidden">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold">Proximos Agendamentos</h2>
              <p className="text-xs text-muted-foreground">Reservas futuras em ordem cronologica.</p>
            </div>
            <Badge variant="secondary">{proximosAgendamentos.length}</Badge>
          </div>
          {loadingProximos ? (
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
          ) : proximosAgendamentos.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum agendamento futuro encontrado.</p>
          ) : (
            <div className="space-y-4">
              {groupByDate(proximosAgendamentos).map(([iso, items]) => (
                <div key={iso}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dayLabel(iso)}</h3>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {items.map((a: any) => <AgendamentoPlanejamentoCard key={a.id} a={a} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="agenda">
        <TabsList className="sticky top-0 z-20 bg-background/95 backdrop-blur">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-3">
          {isLoading ? <div className="h-40 bg-muted rounded-xl animate-pulse" />
            : (ag?.agendamentos.length ?? 0) === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-5 text-center">
                  <CalendarDays className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">Nenhum agendamento neste dia</p>
                  <p className="mt-1 text-sm text-muted-foreground">Os proximos agendamentos continuam visiveis acima.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <DistribuicaoEquipe agendamentos={ag!.agendamentos} />
                <div className="space-y-2 pb-24">
                  {ag!.agendamentos.map((a: any) => <AgendamentoCard key={a.id} a={a} />)}
                </div>
              </>
            )}
        </TabsContent>

        <TabsContent value="lista" className="mt-3">
          {(ag?.agendamentos.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Nenhum agendamento neste dia.</p>
          ) : (
            <Card><CardContent className="p-0 divide-y">
              {ag!.agendamentos.map((a: any) => (
                <div key={a.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.hora_agendada?.slice(0,5)} - {a.clientes?.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.servicos?.nome ?? "-"} - {a.veiculos?.placa ?? "-"}</p>
                  </div>
                  <Badge className={STATUS_COLOR[a.status as AgendamentoStatus]}>{STATUS_LABEL[a.status as AgendamentoStatus]}</Badge>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* FAB mobile */}
      {isMobile && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg sm:hidden"
              aria-label="Nova reserva"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="flex max-h-[92vh] flex-col overflow-hidden px-0 pb-0">
            <DrawerHeader className="px-4 text-left"><DrawerTitle>Nova reserva</DrawerTitle></DrawerHeader>
            <NovoAgendamentoForm onClose={() => setOpen(false)} defaultDate={date} />
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

function DayDots({ count, active }: { count: number; active: boolean }) {
  const dots = Math.min(4, count);
  if (!dots) return <span className="mt-1 h-1" />;
  return (
    <span className="mt-1 flex h-1 items-center gap-0.5">
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} className={cn("h-1 w-1 rounded-full", active ? "bg-primary-foreground" : count >= 4 ? "bg-primary" : "bg-primary/60")} />
      ))}
    </span>
  );
}

function AgendamentoPlanejamentoCard({ a }: { a: any }) {
  return (
    <Card className="bg-card/80">
      <CardContent className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 text-[10px]">{dateBr(a.data_agendada)} - {a.hora_agendada?.slice(0, 5)}</Badge>
            <Badge className={cn("h-5 text-[10px]", STATUS_COLOR[a.status as AgendamentoStatus])}>
              {STATUS_LABEL[a.status as AgendamentoStatus]}
            </Badge>
            {a.leva_traz && (
              <Badge className="h-5 bg-primary/10 text-[10px] text-primary">
                <MapPin className="mr-1 h-3 w-3" />Leva e Traz
              </Badge>
            )}
          </div>
          <p className="truncate font-semibold">{a.clientes?.nome ?? "Cliente"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {a.veiculos?.placa ?? a.veiculos?.modelo ?? "Veiculo"} - {a.servicos?.nome ?? "Servico"}
          </p>
          {a.funcionarios?.nome && <p className="mt-1 truncate text-xs text-muted-foreground">Lavador: {a.funcionarios.nome}</p>}
        </div>
        <AgendamentoAbrirButton a={a} />
      </CardContent>
    </Card>
  );
}

function AgendamentoAbrirButton({ a }: { a: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline" className="w-full sm:w-auto">Abrir agendamento</Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[92vh] overflow-hidden px-4 pb-6">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle>{a.hora_agendada?.slice(0,5)} - {a.clientes?.nome}</DrawerTitle>
          <Badge className={cn("w-fit mt-1", STATUS_COLOR[a.status as AgendamentoStatus])}>
            {STATUS_LABEL[a.status as AgendamentoStatus]}
          </Badge>
        </DrawerHeader>
        <div className="space-y-1 text-sm mb-4">
          <Row label="Servico" value={a.servicos?.nome ?? "-"} />
          <Row label="Veiculo" value={a.veiculos?.placa ?? a.veiculos?.modelo ?? "-"} />
          <Row label="Data" value={dateBr(a.data_agendada)} />
          <Row label="Colaborador" value={a.funcionarios?.nome ?? "Sem definir"} />
          {a.leva_traz && <Row label="Leva e Traz" value="Ativo" />}
          {a.observacoes && <Row label="Observacoes" value={a.observacoes} />}
        </div>
        <DrawerClose asChild>
          <Button className="w-full h-11">Fechar</Button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  );
}

function KpiCard({ label, value, tone, sub, wide }: { label: string; value: number | string; tone?: "primary"|"warning"|"destructive"|"success"; sub?: string; wide?: boolean }) {
  const cls = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <Card className={cn("min-w-0", wide && "col-span-2 sm:col-span-1")}>
      <CardContent className="p-3 sm:p-4">
        <p className="text-[11px] text-muted-foreground truncate sm:text-xs">{label}{sub && <span className="opacity-70"> ({sub})</span>}</p>
        <p className={cn("mt-0.5 truncate text-xl font-bold tabular-nums sm:text-2xl", cls)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AgendamentoCard({ a }: { a: any }) {
  const [open, setOpen] = useState(false);
  const upd = useServerFn(updateAgendamentoStatus);
  const ini = useServerFn(iniciarAtendimento);
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agendamentos"] });
    qc.invalidateQueries({ queryKey: ["agendamento-stats"] });
    qc.invalidateQueries({ queryKey: ["fila"] });
    qc.invalidateQueries({ queryKey: ["ordens"] });
  };
  const setStatus = useMutation({
    mutationFn: (status: AgendamentoStatus) => upd({ data: { id: a.id, status } }),
    onSuccess: () => { invalidate(); toast.success("Atualizado"); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const start = useMutation({
    mutationFn: () => ini({ data: { id: a.id } }),
    onSuccess: () => { invalidate(); toast.success("Atendimento iniciado - OS criada na fila"); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const tel = a.clientes?.telefone;
  const msgConfirm = `Olá ${a.clientes?.nome}!\n\nSeu horário foi reservado com sucesso.\n\nData: ${dateBr(a.data_agendada)}\nHorário: ${a.hora_agendada?.slice(0,5)}\nServiço: ${a.servicos?.nome ?? "-"}\n\nAguardamos você.`;
  const msgLembrete = `Olá ${a.clientes?.nome}!\n\nPassando para lembrar do seu agendamento ${dateBr(a.data_agendada)} às ${a.hora_agendada?.slice(0,5)}.\n\nEstamos te esperando.`;
  const ativo = a.status !== "concluido" && a.status !== "cancelado" && a.status !== "nao_compareceu";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Card className="active:scale-[0.99] transition-transform cursor-pointer">
          <CardContent className="flex items-stretch gap-3 p-3">
            <div className={cn(
              "flex flex-col items-center justify-center rounded-lg px-3 min-w-[60px]",
              a.status === "confirmado" ? "bg-primary/10" :
              a.status === "em_andamento" ? "bg-warning/10" :
              a.status === "concluido" ? "bg-success/10" :
              !ativo ? "bg-destructive/10" : "bg-muted"
            )}>
              <span className="text-lg font-bold tabular-nums leading-tight">{a.hora_agendada?.slice(0,5)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold">{a.clientes?.nome}</p>
              <p className="break-words text-xs text-muted-foreground">
                {a.servicos?.nome ?? "Sem serviço"}{a.veiculos?.placa ? ` - ${a.veiculos.placa}` : ""}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge className={cn("text-[10px] py-0 h-4", STATUS_COLOR[a.status as AgendamentoStatus])}>
                  {STATUS_LABEL[a.status as AgendamentoStatus]}
                </Badge>
                {a.funcionarios?.nome && (
                  <Badge variant="outline" className="h-auto max-w-full whitespace-normal py-0 text-[10px]">Colaborador: {a.funcionarios.nome}</Badge>
                )}
                {a.leva_traz && (
                  <Badge className="h-auto max-w-full whitespace-normal bg-primary/10 py-0 text-[10px] text-primary">
                    <MapPin className="mr-1 h-3 w-3 shrink-0" />Leva e Traz
                  </Badge>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />
          </CardContent>
        </Card>
      </DrawerTrigger>

      <DrawerContent className="max-h-[92vh] overflow-hidden px-4 pb-6">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle>{a.hora_agendada?.slice(0,5)} - {a.clientes?.nome}</DrawerTitle>
          <Badge className={cn("w-fit mt-1", STATUS_COLOR[a.status as AgendamentoStatus])}>
            {STATUS_LABEL[a.status as AgendamentoStatus]}
          </Badge>
        </DrawerHeader>

        <div className="space-y-1 text-sm mb-4">
          <Row label="Serviço" value={a.servicos?.nome ?? "-"} />
          <Row label="Veículo" value={a.veiculos?.placa ?? "-"} />
          <Row label="Data" value={dateBr(a.data_agendada)} />
          <Row label="Colaborador" value={a.funcionarios?.nome ?? "Sem definir"} />
          {a.observacoes && <Row label="Observações" value={a.observacoes} />}
        </div>

        <AtribuirColaboradorInline agendamentoId={a.id} atual={a.funcionario_id ?? ""} />

        <div className="space-y-2 overflow-y-auto">
          {ativo && (a.status === "agendado" || a.status === "confirmado") && (
            <Button className="w-full h-12 justify-start" onClick={() => start.mutate()} disabled={start.isPending}>
              <Play className="h-4 w-4 mr-2" /> Iniciar atendimento
            </Button>
          )}
          {a.status === "agendado" && (
            <Button variant="outline" className="w-full h-12 justify-start" onClick={() => setStatus.mutate("confirmado")}>
              <Check className="h-4 w-4 mr-2" /> Confirmar reserva
            </Button>
          )}
          {tel && (
            <>
              <Button variant="outline" className="w-full h-12 justify-start" asChild>
                <a href={waLink(tel, msgConfirm)} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" /> Confirmar via WhatsApp
                </a>
              </Button>
              <Button variant="outline" className="w-full h-12 justify-start" asChild>
                <a href={waLink(tel, msgLembrete)} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" /> Enviar lembrete
                </a>
              </Button>
              <Button variant="outline" className="w-full h-12 justify-start" asChild>
                <a href={`tel:${tel}`}>
                  <Phone className="h-4 w-4 mr-2" /> Ligar para {tel}
                </a>
              </Button>
            </>
          )}
          {ativo && (
            <>
              <Button variant="outline" className="w-full h-12 justify-start text-destructive hover:text-destructive" onClick={() => setStatus.mutate("nao_compareceu")}>
                <AlertTriangle className="h-4 w-4 mr-2" /> Marcar não compareceu
              </Button>
              <Button variant="outline" className="w-full h-12 justify-start text-destructive hover:text-destructive" onClick={() => setStatus.mutate("cancelado")}>
                <XIcon className="h-4 w-4 mr-2" /> Cancelar reserva
              </Button>
            </>
          )}
          <DrawerClose asChild>
            <Button variant="ghost" className="w-full h-12">Fechar</Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function NovoAgendamentoDialog({ onClose, defaultDate }: { onClose: () => void; defaultDate: string }) {
  return (
    <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden p-0">
      <DialogHeader className="px-5 pt-5"><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
      <NovoAgendamentoForm onClose={onClose} defaultDate={defaultDate} />
    </DialogContent>
  );
}

function colaboradorDisponibilidadeLabel(x: any) {
  if (!x.disponivel) {
    const motivo = String(x.motivo_indisponivel ?? "").toLowerCase();
    if (motivo.includes("lotado") || Number(x.ocupacao ?? 0) >= Number(x.capacidade ?? 1)) return `${x.nome} - Lotado`;
    return `${x.nome} - Indisponível neste horário`;
  }

  const vagas = Math.max(0, Number(x.capacidade ?? 1) - Number(x.ocupacao ?? 0));
  return `${x.nome} - ${vagas} ${vagas === 1 ? "vaga disponível" : "vagas disponíveis"}`;
}

function NovoAgendamentoForm({ onClose, defaultDate }: { onClose: () => void; defaultDate: string }) {
  const cli = useServerFn(listClientes);
  const sv = useServerFn(listServicos);
  const dispFn = useServerFn(getColaboradoresDisponiveis);
  const create = useServerFn(createAgendamento);
  const qc = useQueryClient();
  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: () => cli() });
  const { data: servicos } = useQuery({ queryKey: ["servicos"], queryFn: () => sv() });
  const [f, setF] = useState({
    cliente_id: "", servico_id: "", funcionario_id: "", data_agendada: defaultDate, hora_agendada: "09:00", observacoes: "",
    leva_traz: false, endereco_retirada: "", endereco_devolucao: "", horario_retirada: "", horario_devolucao: "", observacoes_leva_traz: "", taxa_leva_traz: 0,
  });
  const { data: disponiveis } = useQuery({
    queryKey: ["colaboradores-disponiveis", f.data_agendada, f.hora_agendada, f.servico_id],
    queryFn: () => dispFn({ data: { data_agendada: f.data_agendada, hora_agendada: f.hora_agendada, servico_id: f.servico_id || null } }),
  });
  const mut = useMutation({
    mutationFn: () => create({ data: {
      cliente_id: f.cliente_id,
      servico_id: f.servico_id || null,
      funcionario_id: f.funcionario_id || null,
      data_agendada: f.data_agendada,
      hora_agendada: f.hora_agendada,
      observacoes: f.observacoes || null,
      leva_traz: f.leva_traz,
      endereco_retirada: f.leva_traz ? f.endereco_retirada || null : null,
      endereco_devolucao: f.leva_traz ? f.endereco_devolucao || null : null,
      horario_retirada: f.leva_traz ? f.horario_retirada || null : null,
      horario_devolucao: f.leva_traz ? f.horario_devolucao || null : null,
      observacoes_leva_traz: f.leva_traz ? f.observacoes_leva_traz || null : null,
      taxa_leva_traz: f.leva_traz ? Number(f.taxa_leva_traz) || 0 : 0,
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["agendamento-stats"] });
      toast.success("Agendamento criado");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const colaboradores = disponiveis?.colaboradores ?? [];
  const semColaboradorDisponivel = colaboradores.length > 0 && colaboradores.every((x: any) => !x.disponivel);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!f.cliente_id) return toast.error("Selecione um cliente"); mut.mutate(); }} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-1 sm:px-5">
      <div className="space-y-2"><Label>Cliente</Label>
        <Select value={f.cliente_id} onValueChange={(v) => setF({ ...f, cliente_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
          <SelectContent>{clientes?.clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Serviço</Label>
        <Select value={f.servico_id} onValueChange={(v) => setF({ ...f, servico_id: v, funcionario_id: "" })}>
          <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
          <SelectContent>{servicos?.servicos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label>Data</Label><Input type="date" required value={f.data_agendada} onChange={(e) => setF({ ...f, data_agendada: e.target.value, funcionario_id: "" })} /></div>
        <div className="space-y-2"><Label>Horário</Label><Input type="time" required value={f.hora_agendada} onChange={(e) => setF({ ...f, hora_agendada: e.target.value, funcionario_id: "" })} /></div>
      </div>
      <div className="space-y-2"><Label>Colaborador responsável</Label>
        <Select value={f.funcionario_id || "__none__"} onValueChange={(v) => setF({ ...f, funcionario_id: v === "__none__" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Sem definir" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem definir</SelectItem>
            {colaboradores.map((x: any) => (
              <SelectItem key={x.id} value={x.id} disabled={!x.disponivel}>
                {colaboradorDisponibilidadeLabel(x)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {semColaboradorDisponivel && (
          <p className="text-xs text-muted-foreground">
            Nenhum colaborador disponível para este horário. Escolha outro horário ou altere a data.
          </p>
        )}
      </div>
      <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
      <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
        <input type="checkbox" checked={f.leva_traz} onChange={(e) => setF({ ...f, leva_traz: e.target.checked })} />
        <span>Adicionar Leva e Traz</span>
      </label>
      {f.leva_traz && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="font-display text-sm font-semibold">Leva e Traz</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Horário de retirada</Label><Input type="time" placeholder="Selecione o horário de retirada" value={f.horario_retirada} onChange={(e) => setF({ ...f, horario_retirada: e.target.value })} /></div>
            <div className="space-y-2"><Label>Horário de devolução</Label><Input type="time" placeholder="Selecione o horário de devolução" value={f.horario_devolucao} onChange={(e) => setF({ ...f, horario_devolucao: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Endereço de retirada</Label><Input placeholder="Digite o endereço onde o veículo será buscado" value={f.endereco_retirada} onChange={(e) => setF({ ...f, endereco_retirada: e.target.value })} /></div>
          <div className="space-y-2"><Label>Endereço de devolução</Label><Input placeholder="Digite o endereço onde o veículo será entregue" value={f.endereco_devolucao} onChange={(e) => setF({ ...f, endereco_devolucao: e.target.value })} /></div>
          <div className="space-y-2"><Label>Taxa de Leva e Traz</Label><Input type="number" min="0" step="0.01" value={f.taxa_leva_traz} onChange={(e) => setF({ ...f, taxa_leva_traz: Number(e.target.value) || 0 })} /></div>
          <div className="space-y-2"><Label>Observações do transporte</Label><Textarea rows={2} value={f.observacoes_leva_traz} onChange={(e) => setF({ ...f, observacoes_leva_traz: e.target.value })} /></div>
        </div>
      )}
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t bg-background p-4 sm:px-5">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="h-11 flex-1" disabled={mut.isPending}>Salvar reserva</Button>
      </div>
    </form>
  );
}

function DistribuicaoEquipe({ agendamentos }: { agendamentos: any[] }) {
  const ativos = agendamentos.filter((a) => a.status !== "cancelado" && a.status !== "nao_compareceu");
  const counts = new Map<string, number>();
  let semDef = 0;
  ativos.forEach((a) => {
    const nome = a.funcionarios?.nome;
    if (nome) counts.set(nome, (counts.get(nome) ?? 0) + 1);
    else semDef += 1;
  });
  if (counts.size === 0 && semDef === ativos.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      <span className="text-xs text-muted-foreground self-center mr-1">Distribuição:</span>
      {Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([nome, qtd]) => (
        <Badge key={nome} variant="secondary" className="font-normal">{nome} - {qtd}</Badge>
      ))}
      {semDef > 0 && <Badge variant="outline">Sem definir - {semDef}</Badge>}
    </div>
  );
}

function AtribuirColaboradorInline({ agendamentoId, atual }: { agendamentoId: string; atual: string }) {
  const fnFunc = useServerFn(listFuncionarios);
  const upd = useServerFn(updateAgendamento);
  const qc = useQueryClient();
  const { data: funcs } = useQuery({ queryKey: ["funcionarios"], queryFn: () => fnFunc() });
  const mut = useMutation({
    mutationFn: (funcId: string | null) => upd({ data: { id: agendamentoId, funcionario_id: funcId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Colaborador atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <div className="mb-3">
      <Label className="text-xs">Atribuir colaborador</Label>
      <Select value={atual || "__none__"} onValueChange={(v) => mut.mutate(v === "__none__" ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Sem definir" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem definir</SelectItem>
          {funcs?.funcionarios.filter((x: any) => x.ativo).map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
