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
  type AgendamentoStatus,
} from "@/lib/lavaflow.functions";
import { dateBr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import {
  Plus, MessageCircle, Play, Check, X as XIcon, AlertTriangle, CalendarDays,
  Link2, ChevronDown, Phone, Calendar as CalendarIcon, ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
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

function Page() {
  const [date, setDate] = useState(todayIso());
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const isMobile = useIsMobile();

  const list = useServerFn(listAgendamentos);
  const stats = useServerFn(agendamentoStats);
  const emp = useServerFn(getEmpresa);
  const { data: ag, isLoading } = useQuery({ queryKey: ["agendamentos", date], queryFn: () => list({ data: { date } }) });
  const { data: st } = useQuery({ queryKey: ["agendamento-stats"], queryFn: () => stats() });
  const { data: empresa } = useQuery({ queryKey: ["empresa"], queryFn: () => emp() });

  const linkPublico = empresa?.empresa?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${empresa.empresa.slug}`
    : "";

  const dayStrip = useMemo(() => buildDayStrip(date), [date]);
  const todayStr = todayIso();

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

      {/* KPIs — grid no desktop, scroll horizontal no mobile */}
      <div className="-mx-4 px-4 mb-4 flex gap-2 overflow-x-auto snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible">
        <KpiCard label="Hoje" value={st?.hoje ?? 0} />
        <KpiCard label="Confirmados" value={st?.confirmadosHoje ?? 0} tone="primary" />
        <KpiCard label="Em atendimento" value={st?.emAndamentoHoje ?? 0} tone="warning" />
        <KpiCard label="Não compareceu" value={st?.naoCompareceuMes ?? 0} tone="destructive" sub="mês" />
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
      <div className="mb-4 flex items-center gap-2">
        <div className="-mx-4 px-4 flex-1 flex gap-2 overflow-x-auto snap-x snap-mandatory sm:mx-0 sm:px-0">
          {dayStrip.map(({ iso, date: d }) => {
            const active = iso === date;
            const isToday = iso === todayStr;
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={cn(
                  "snap-start shrink-0 flex flex-col items-center justify-center rounded-xl border w-14 h-16 transition-colors",
                  active ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent",
                )}
              >
                <span className={cn("text-[10px] uppercase font-medium", active ? "opacity-90" : "text-muted-foreground")}>
                  {isToday ? "hoje" : WD[d.getDay()]}
                </span>
                <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
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

      <Tabs defaultValue="agenda">
        <TabsList className="sticky top-0 z-20 bg-background/95 backdrop-blur">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-3">
          {isLoading ? <div className="h-40 bg-muted rounded-xl animate-pulse" />
            : (ag?.agendamentos.length ?? 0) === 0 ? (
              <EmptyState icon={CalendarDays} title="Nenhum agendamento neste dia"
                description="Toque no botão + para criar a primeira reserva ou compartilhe seu link público." />
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
                    <p className="font-medium truncate">{a.hora_agendada?.slice(0,5)} · {a.clientes?.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.servicos?.nome ?? "—"} · {a.veiculos?.placa ?? "—"}</p>
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
          <DrawerContent className="px-4 pb-6 max-h-[90vh]">
            <DrawerHeader className="px-0"><DrawerTitle>Nova reserva</DrawerTitle></DrawerHeader>
            <NovoAgendamentoForm onClose={() => setOpen(false)} defaultDate={date} />
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

function KpiCard({ label, value, tone, sub }: { label: string; value: number; tone?: "primary"|"warning"|"destructive"; sub?: string }) {
  const cls = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "";
  return (
    <Card className="snap-start shrink-0 min-w-[120px] sm:min-w-0">
      <CardContent className="p-3 sm:p-4">
        <p className="text-xs text-muted-foreground truncate">{label}{sub && <span className="opacity-70"> ({sub})</span>}</p>
        <p className={cn("text-2xl font-bold mt-0.5 tabular-nums", cls)}>{value}</p>
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
    onSuccess: () => { invalidate(); toast.success("Atendimento iniciado — OS criada na fila"); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const tel = a.clientes?.telefone;
  const msgConfirm = `Olá ${a.clientes?.nome}!\n\nSeu horário foi reservado com sucesso.\n\n📅 Data: ${dateBr(a.data_agendada)}\n⏰ Horário: ${a.hora_agendada?.slice(0,5)}\n🚗 Serviço: ${a.servicos?.nome ?? "—"}\n\nAguardamos você.`;
  const msgLembrete = `Olá ${a.clientes?.nome}!\n\nPassando para lembrar do seu agendamento ${dateBr(a.data_agendada)} às ${a.hora_agendada?.slice(0,5)}.\n\nEstamos te esperando 🚗✨`;
  const ativo = a.status !== "concluido" && a.status !== "cancelado" && a.status !== "nao_compareceu";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Card className="active:scale-[0.99] transition-transform cursor-pointer">
          <CardContent className="p-3 flex items-stretch gap-3">
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
              <p className="font-semibold truncate">{a.clientes?.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {a.servicos?.nome ?? "Sem serviço"}{a.veiculos?.placa ? ` · ${a.veiculos.placa}` : ""}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge className={cn("text-[10px] py-0 h-4", STATUS_COLOR[a.status as AgendamentoStatus])}>
                  {STATUS_LABEL[a.status as AgendamentoStatus]}
                </Badge>
                {a.funcionarios?.nome && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">👤 {a.funcionarios.nome}</Badge>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />
          </CardContent>
        </Card>
      </DrawerTrigger>

      <DrawerContent className="px-4 pb-6 max-h-[90vh]">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle>{a.hora_agendada?.slice(0,5)} · {a.clientes?.nome}</DrawerTitle>
          <Badge className={cn("w-fit mt-1", STATUS_COLOR[a.status as AgendamentoStatus])}>
            {STATUS_LABEL[a.status as AgendamentoStatus]}
          </Badge>
        </DrawerHeader>

        <div className="space-y-1 text-sm mb-4">
          <Row label="Serviço" value={a.servicos?.nome ?? "—"} />
          <Row label="Veículo" value={a.veiculos?.placa ?? "—"} />
          <Row label="Data" value={dateBr(a.data_agendada)} />
          {a.observacoes && <Row label="Observações" value={a.observacoes} />}
        </div>

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
    <DialogContent>
      <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
      <NovoAgendamentoForm onClose={onClose} defaultDate={defaultDate} />
    </DialogContent>
  );
}

function NovoAgendamentoForm({ onClose, defaultDate }: { onClose: () => void; defaultDate: string }) {
  const cli = useServerFn(listClientes);
  const sv = useServerFn(listServicos);
  const create = useServerFn(createAgendamento);
  const qc = useQueryClient();
  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: () => cli() });
  const { data: servicos } = useQuery({ queryKey: ["servicos"], queryFn: () => sv() });
  const [f, setF] = useState({
    cliente_id: "", servico_id: "", data_agendada: defaultDate, hora_agendada: "09:00", observacoes: "",
  });
  const mut = useMutation({
    mutationFn: () => create({ data: {
      cliente_id: f.cliente_id,
      servico_id: f.servico_id || null,
      data_agendada: f.data_agendada,
      hora_agendada: f.hora_agendada,
      observacoes: f.observacoes || null,
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["agendamento-stats"] });
      toast.success("Agendamento criado");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!f.cliente_id) return toast.error("Selecione um cliente"); mut.mutate(); }} className="space-y-3 overflow-y-auto">
      <div><Label>Cliente</Label>
        <Select value={f.cliente_id} onValueChange={(v) => setF({ ...f, cliente_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{clientes?.clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Serviço</Label>
        <Select value={f.servico_id} onValueChange={(v) => setF({ ...f, servico_id: v })}>
          <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
          <SelectContent>{servicos?.servicos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="date" required value={f.data_agendada} onChange={(e) => setF({ ...f, data_agendada: e.target.value })} /></div>
        <div><Label>Horário</Label><Input type="time" required value={f.hora_agendada} onChange={(e) => setF({ ...f, hora_agendada: e.target.value })} /></div>
      </div>
      <div><Label>Observações</Label><Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
      <Button type="submit" className="w-full h-12" disabled={mut.isPending}>Salvar agendamento</Button>
    </form>
  );
}
