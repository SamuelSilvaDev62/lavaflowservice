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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  listAgendamentos, createAgendamento, agendamentoStats, updateAgendamentoStatus,
  iniciarAtendimento, listClientes, listServicos, getEmpresa,
  type AgendamentoStatus,
} from "@/lib/lavaflow.functions";
import { dateBr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import { Plus, MessageCircle, Play, Check, X as XIcon, AlertTriangle, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

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

function Page() {
  const [date, setDate] = useState(todayIso());
  const [open, setOpen] = useState(false);
  const list = useServerFn(listAgendamentos);
  const stats = useServerFn(agendamentoStats);
  const emp = useServerFn(getEmpresa);
  const { data: ag, isLoading } = useQuery({ queryKey: ["agendamentos", date], queryFn: () => list({ data: { date } }) });
  const { data: st } = useQuery({ queryKey: ["agendamento-stats"], queryFn: () => stats() });
  const { data: empresa } = useQuery({ queryKey: ["empresa"], queryFn: () => emp() });

  const linkPublico = empresa?.empresa?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${empresa.empresa.slug}`
    : "";

  return (
    <>
      <PageHeader title="Agendamentos" subtitle="Organize sua agenda e reduza filas."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova reserva</Button></DialogTrigger>
            <NovoAgendamentoDialog onClose={() => setOpen(false)} defaultDate={date} />
          </Dialog>
        }
      />

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Agendados hoje" value={st?.hoje ?? 0} />
        <KpiCard label="Confirmados" value={st?.confirmadosHoje ?? 0} tone="primary" />
        <KpiCard label="Em atendimento" value={st?.emAndamentoHoje ?? 0} tone="warning" />
        <KpiCard label="Não compareceu (mês)" value={st?.naoCompareceuMes ?? 0} tone="destructive" />
      </div>

      {linkPublico && (
        <Card className="mb-5"><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Link público de agendamento</p>
            <p className="text-xs text-muted-foreground break-all">{linkPublico}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(linkPublico); toast.success("Link copiado"); }}>
            Copiar link
          </Button>
        </CardContent></Card>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Label className="text-xs">Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>

      <Tabs defaultValue="agenda">
        <TabsList><TabsTrigger value="agenda">Agenda</TabsTrigger><TabsTrigger value="lista">Lista</TabsTrigger></TabsList>

        <TabsContent value="agenda">
          {isLoading ? <div className="h-40 bg-muted rounded-xl animate-pulse" />
            : (ag?.agendamentos.length ?? 0) === 0 ? (
              <EmptyState icon={CalendarDays} title="Nenhum agendamento neste dia"
                description="Crie a primeira reserva ou compartilhe seu link público para o cliente agendar sozinho." />
            ) : (
              <div className="space-y-2">
                {ag!.agendamentos.map((a: any) => <AgendamentoCard key={a.id} a={a} />)}
              </div>
            )}
        </TabsContent>

        <TabsContent value="lista">
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
    </>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "primary"|"warning"|"destructive" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "";
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
    </CardContent></Card>
  );
}

function AgendamentoCard({ a }: { a: any }) {
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
    onSuccess: () => { invalidate(); toast.success("Atualizado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const start = useMutation({
    mutationFn: () => ini({ data: { id: a.id } }),
    onSuccess: () => { invalidate(); toast.success("Atendimento iniciado — OS criada na fila"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const tel = a.clientes?.telefone;
  const msgConfirm = `Olá ${a.clientes?.nome}!\n\nSeu horário foi reservado com sucesso.\n\n📅 Data: ${dateBr(a.data_agendada)}\n⏰ Horário: ${a.hora_agendada?.slice(0,5)}\n🚗 Serviço: ${a.servicos?.nome ?? "—"}\n\nAguardamos você.`;
  const msgLembrete = `Olá ${a.clientes?.nome}!\n\nPassando para lembrar do seu agendamento ${dateBr(a.data_agendada)} às ${a.hora_agendada?.slice(0,5)}.\n\nEstamos te esperando 🚗✨`;

  return (
    <Card><CardContent className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold tabular-nums">{a.hora_agendada?.slice(0,5)}</p>
            <Badge className={STATUS_COLOR[a.status as AgendamentoStatus]}>{STATUS_LABEL[a.status as AgendamentoStatus]}</Badge>
          </div>
          <p className="font-medium mt-1 truncate">{a.clientes?.nome}</p>
          <p className="text-xs text-muted-foreground">{a.servicos?.nome ?? "Sem serviço"} {a.veiculos?.placa ? `· ${a.veiculos.placa}` : ""}</p>
          {a.observacoes && <p className="text-xs text-muted-foreground mt-1">{a.observacoes}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {a.status === "agendado" && (
          <Button size="sm" variant="outline" onClick={() => setStatus.mutate("confirmado")}><Check className="h-3 w-3 mr-1" /> Confirmar</Button>
        )}
        {(a.status === "agendado" || a.status === "confirmado") && (
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}><Play className="h-3 w-3 mr-1" /> Iniciar atendimento</Button>
        )}
        {tel && (
          <>
            <Button size="sm" variant="outline" asChild>
              <a href={waLink(tel, msgConfirm)} target="_blank" rel="noreferrer"><MessageCircle className="h-3 w-3 mr-1" /> Confirmar WhatsApp</a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={waLink(tel, msgLembrete)} target="_blank" rel="noreferrer"><MessageCircle className="h-3 w-3 mr-1" /> Lembrete</a>
            </Button>
          </>
        )}
        {a.status !== "concluido" && a.status !== "cancelado" && a.status !== "nao_compareceu" && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("nao_compareceu")}><AlertTriangle className="h-3 w-3 mr-1" /> Não compareceu</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("cancelado")}><XIcon className="h-3 w-3 mr-1" /> Cancelar</Button>
          </>
        )}
      </div>
    </CardContent></Card>
  );
}

function NovoAgendamentoDialog({ onClose, defaultDate }: { onClose: () => void; defaultDate: string }) {
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
    <DialogContent>
      <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (!f.cliente_id) return toast.error("Selecione um cliente"); mut.mutate(); }} className="space-y-3">
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
        <Button type="submit" className="w-full" disabled={mut.isPending}>Salvar agendamento</Button>
      </form>
    </DialogContent>
  );
}
