import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFila, updateOrdemStatus, logWhatsappEnvio, getWhatsappLogs, type OsStatus } from "@/lib/lavaflow.functions";
import { brl, dateTimeBr } from "@/lib/format";
import { waLink, getTemplate, renderTemplate } from "@/lib/whatsapp";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors, TouchSensor } from "@dnd-kit/core";
import { MessageCircle, Check, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fila")({
  component: FilaPage,
});

const columns: Array<{ key: OsStatus; label: string; color: string }> = [
  { key: "aguardando", label: "Aguardando", color: "bg-muted" },
  { key: "em_lavagem", label: "Em lavagem", color: "bg-primary/10" },
  { key: "finalizacao", label: "Finalização", color: "bg-warning/10" },
  { key: "pronto", label: "Pronto", color: "bg-success/10" },
  { key: "entregue", label: "Entregue", color: "bg-accent" },
];

function disparaWhatsappPronto(ordem: any, logFn: (v: { cliente_id: string; descricao: string }) => Promise<any>) {
  const tel = ordem.clientes?.telefone;
  const nome = ordem.clientes?.nome ?? "Cliente";
  const placa = ordem.veiculos?.placa ?? "";
  const cliente_id = ordem.cliente_id;
  if (!tel) {
    toast.warning(`${nome} sem telefone — envio manual necessário.`);
    return;
  }
  const msg = renderTemplate(getTemplate("pronto_para_retirada"), { nome, placa });
  // Sincronamente abrir janela (preserva user gesture do drag/click)
  const win = window.open(waLink(tel, msg), "_blank", "noopener");
  if (!win) {
    toast.error("Bloqueio de pop-up impediu o envio. Use o botão WhatsApp do card.");
    return;
  }
  logFn({ cliente_id, descricao: `OS pronta · ${placa || nome} · template "pronto_para_retirada"` })
    .then(() => toast.success(`WhatsApp aberto para ${nome.split(" ")[0]} ✓ registrado nos logs`))
    .catch(() => toast.success(`WhatsApp aberto para ${nome.split(" ")[0]}`));
}

function FilaPage() {
  const getFn = useServerFn(getFila);
  const updFn = useServerFn(updateOrdemStatus);
  const logFn = useServerFn(logWhatsappEnvio);
  const logsFn = useServerFn(getWhatsappLogs);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["fila"], queryFn: () => getFn() });
  const { data: logsData } = useQuery({ queryKey: ["wa-logs"], queryFn: () => logsFn() });

  const mut = useMutation({
    mutationFn: (v: { id: string; status: OsStatus }) => updFn({ data: v }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["fila"] });
      qc.invalidateQueries({ queryKey: ["wa-logs"] });
      if (vars.status === "pronto") {
        const ordem = data?.ordens.find((o) => o.id === vars.id);
        if (ordem) disparaWhatsappPronto(ordem, (p) => logFn({ data: p }));
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));

  function onDragEnd(ev: DragEndEvent) {
    const id = ev.active.id as string;
    const status = ev.over?.id as OsStatus | undefined;
    if (!status) return;
    const ordem = data?.ordens.find((o) => o.id === id);
    if (ordem?.status === status) return;
    mut.mutate({ id, status });
  }

  function reenviarWhats(ordem: any) {
    disparaWhatsappPronto(ordem, (p) => logFn({ data: p }));
    qc.invalidateQueries({ queryKey: ["wa-logs"] });
  }

  const totalFila = data?.ordens.length ?? 0;
  return (
    <>
      <PageHeader title="Fila de atendimento" subtitle="Arraste os cards para mudar de etapa. Ao marcar 'Pronto', o WhatsApp dispara automaticamente." />
      {isLoading && <div className="h-96 rounded-xl bg-muted animate-pulse" />}
      {!isLoading && totalFila === 0 && (
        <div className="mb-4">
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <p className="font-display font-semibold">Fila vazia 🧼</p>
              <p className="text-sm text-muted-foreground mt-1">Nenhum carro em atendimento agora. Cada nova OS aparece aqui automaticamente.</p>
              <Button asChild size="sm" className="mt-3"><Link to="/ordens">Criar nova OS</Link></Button>
            </CardContent>
          </Card>
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {columns.map((c) => {
            const items = data?.ordens.filter((o) => o.status === c.key) ?? [];
            return <Column key={c.key} col={c} items={items} onAdvance={(id, s) => mut.mutate({ id, status: s })} onReenviar={reenviarWhats} />;
          })}
        </div>
      </DndContext>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-success" />Logs de envio WhatsApp</h3>
          {(logsData?.logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda. Mova uma OS para 'Pronto' para disparar.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {logsData!.logs.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between text-xs border-l-2 border-success/40 pl-3 py-1">
                  <div>
                    <p className="font-medium text-sm">{l.clientes?.nome ?? "Cliente"}</p>
                    <p className="text-muted-foreground">{l.descricao}</p>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">{dateTimeBr(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Column({ col, items, onAdvance, onReenviar }: { col: { key: OsStatus; label: string; color: string }; items: any[]; onAdvance: (id: string, s: OsStatus) => void; onReenviar: (o: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef} className={`rounded-xl border ${isOver ? "border-primary bg-primary/5" : "border-border"} ${col.color} p-3 min-h-[400px]`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm">{col.label}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((o) => <OrdemCard key={o.id} ordem={o} status={col.key} onAdvance={onAdvance} onReenviar={onReenviar} />)}
        {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Vazio</p>}
      </div>
    </div>
  );
}

function OrdemCard({ ordem, status, onAdvance, onReenviar }: { ordem: any; status: OsStatus; onAdvance: (id: string, s: OsStatus) => void; onReenviar: (o: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ordem.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const cliente = ordem.clientes?.nome ?? "—";
  const placa = ordem.veiculos?.placa ?? "—";
  const tel = ordem.clientes?.telefone ?? "";

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}
      className={`bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm">{cliente}</p>
        <span className="text-xs font-mono text-muted-foreground">{placa}</span>
      </div>
      <p className="text-xs text-muted-foreground">{ordem.servicos?.nome ?? "Serviço"} · {brl(ordem.valor)}</p>
      <p className="text-[10px] text-muted-foreground mt-1">Entrada: {dateTimeBr(ordem.created_at)}</p>
      {ordem.funcionarios?.nome && <p className="text-[10px] text-muted-foreground">👤 {ordem.funcionarios.nome}</p>}

      {status === "pronto" && (
        <div className="flex gap-1 mt-3" onPointerDown={(e) => e.stopPropagation()}>
          {tel && <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onReenviar(ordem)}>
            <MessageCircle className="h-3 w-3 mr-1" />Reenviar
          </Button>}
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => onAdvance(ordem.id, "entregue")}><Check className="h-3 w-3 mr-1" />Entregar</Button>
        </div>
      )}
    </div>
  );
}
