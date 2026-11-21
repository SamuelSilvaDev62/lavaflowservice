import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { getFila, updateOrdemStatus, logWhatsappEnvio, getWhatsappLogs, getDadosMensagemPronto, type OsStatus } from "@/lib/lavaflow.functions";
import { brl, dateTimeBr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { buildReadyVehicleMessage, getFidelidadeTemplates } from "@/lib/fidelidade-messages";
import { canAdvanceWorkOrder } from "@/lib/os-transitions";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors, TouchSensor } from "@dnd-kit/core";
import { MessageCircle, Check, Send, Phone, ChevronRight, X, Filter, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

const filaSearchSchema = z.object({
  etapa: z.enum(["aguardando", "em_lavagem", "finalizacao", "pronto"]).optional(),
});

export const Route = createFileRoute("/_authenticated/fila")({
  component: FilaPage,
  validateSearch: filaSearchSchema,
});

const columns: Array<{ key: OsStatus; label: string; short: string; color: string; emoji: string }> = [
  { key: "aguardando", label: "Aguardando", short: "Fila", color: "bg-muted", emoji: "🕓" },
  { key: "em_lavagem", label: "Em lavagem", short: "Lavando", color: "bg-primary/10", emoji: "🧼" },
  { key: "finalizacao", label: "Finalização", short: "Final", color: "bg-warning/10", emoji: "✨" },
  { key: "pronto", label: "Pronto", short: "Pronto", color: "bg-success/10", emoji: "✅" },
  { key: "entregue", label: "Entregue", short: "Entregue", color: "bg-accent", emoji: "🚗" },
];

async function disparaWhatsappPronto(
  ordem: any,
  getDados: (v: { ordemId: string }) => Promise<any>,
  logFn: (v: { cliente_id: string; descricao: string }) => Promise<any>,
) {
  const tel = ordem.clientes?.telefone;
  const nome = ordem.clientes?.nome ?? "Cliente";
  const placa = ordem.veiculos?.placa ?? "";
  const cliente_id = ordem.cliente_id;
  if (!tel) {
    toast.warning(`${nome} sem telefone — envio manual necessário.`);
    return;
  }
  // Abrir a aba imediatamente pelo clique do usuário evita bloqueio de pop-up.
  // Não fazemos abertura automática após a mutation nem afirmamos que houve envio.
  const win = window.open("about:blank", "_blank");
  if (!win) {
    toast.error("Habilite pop-ups ou use o link do WhatsApp para abrir a mensagem.");
    return;
  }
  win.opener = null;
  let msg = `Olá ${nome.split(" ")[0]}! Seu veículo ${placa} está pronto para retirada. 🚗`;
  let cenario = "padrao";
  try {
    const dados = await getDados({ ordemId: ordem.id });
    const built = buildReadyVehicleMessage({
      cliente: dados.cliente,
      ordem: dados.ordem,
      config: dados.config,
      recompensas: dados.recompensas,
      templates: getFidelidadeTemplates(),
    });
    msg = built.message;
    cenario = built.cenario;
  } catch (err) {
    console.warn("Falha ao gerar mensagem de fidelidade, usando fallback", err);
  }
  try {
    win.location.replace(waLink(tel, msg));
  } catch {
    win.close();
    toast.error("Não foi possível abrir o WhatsApp.");
    return;
  }
  // Registro de abertura NÃO é uma confirmação de mensagem enviada.
  logFn({ cliente_id, descricao: `WhatsApp aberto (envio não confirmado) · OS pronta · ${placa || nome} · fidelidade:${cenario}` })
    .then(() => toast.info(`WhatsApp aberto para ${nome.split(" ")[0]}. Confirme o envio no aplicativo.`))
    .catch(() => toast.info("WhatsApp aberto. Envio não confirmado."));
}

function nextStatus(s: OsStatus): OsStatus | null {
  const idx = columns.findIndex(c => c.key === s);
  return idx >= 0 && idx < columns.length - 1 ? columns[idx + 1].key : null;
}

function FilaPage() {
  const { etapa: etapaFoco } = Route.useSearch();
  const navigate = Route.useNavigate();
  const getFn = useServerFn(getFila);
  const updFn = useServerFn(updateOrdemStatus);
  const logFn = useServerFn(logWhatsappEnvio);
  const logsFn = useServerFn(getWhatsappLogs);
  const dadosFn = useServerFn(getDadosMensagemPronto);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["fila"], queryFn: () => getFn() });
  const { data: logsData } = useQuery({ queryKey: ["wa-logs"], queryFn: () => logsFn() });

  const [activeMobile, setActiveMobile] = useState<OsStatus>("aguardando");
  const [selected, setSelected] = useState<any | null>(null);

  const mut = useMutation({
    mutationFn: (v: { id: string; status: OsStatus }) => updFn({ data: v }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["fila"] });
      qc.invalidateQueries({ queryKey: ["wa-logs"] });
      if (vars.status === "pronto") {
        toast.info("OS marcada como pronta. Abra o WhatsApp manualmente no card para avisar o cliente.");
      }
      setSelected(null);
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
    if (!ordem || !canAdvanceWorkOrder(ordem.status, status)) {
      toast.warning("A OS só pode avançar. Para corrigir uma etapa anterior, procure a liderança.");
      return;
    }
    mut.mutate({ id, status });
  }

  function reenviarWhats(ordem: any) {
    disparaWhatsappPronto(ordem, (p) => dadosFn({ data: p }), (p) => logFn({ data: p }));
    qc.invalidateQueries({ queryKey: ["wa-logs"] });
  }


  const ordensList = data?.ordens ?? [];
  const totalFila = ordensList.length;
  const countBy = (s: OsStatus) => ordensList.filter(o => o.status === s).length;
  const emOperacao = countBy("aguardando") + countBy("em_lavagem") + countBy("finalizacao") + countBy("pronto");
  const receitaProducao = ordensList
    .filter(o => o.status === "em_lavagem" || o.status === "finalizacao" || o.status === "pronto")
    .reduce((s, o) => s + Number(o.valor ?? 0), 0);


  const etapaVisivel = etapaFoco ?? activeMobile;
  const itemsMobile = ordensList.filter(o => o.status === etapaVisivel);
  const colunaFoco = columns.find(c => c.key === etapaFoco);
  const itensFiltrados = etapaFoco ? ordensList.filter(o => o.status === etapaFoco) : [];

  return (
    <>
      <div className="sm:hidden">
        <h1 className="font-display text-2xl font-bold">Fila</h1>
        <p className="text-xs text-muted-foreground mb-3">Toque num card para mover de etapa.</p>
      </div>
      <div className="hidden sm:block">
        <PageHeader title="Fila de atendimento" subtitle="Arraste os cards para mudar de etapa. Ao marcar 'Pronto', abra o WhatsApp pelo card e confirme o envio." />
      </div>

      {colunaFoco && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/[0.055] p-3.5 sm:p-4" role="status">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Filter className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>Etapa selecionada: <strong>{colunaFoco.label}</strong></span>
            <Badge variant="secondary">{countBy(colunaFoco.key)} OS</Badge>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => { setActiveMobile(etapaFoco ?? "aguardando"); navigate({ search: {} }); }}>
            Ver todas as etapas
          </Button>
        </div>
      )}

      {/* Resumo compacto — sem duplicar os contadores das etapas */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{emOperacao}</span>
        <span>{emOperacao === 1 ? "veículo em operação" : "veículos em operação"}</span>
        <span className="text-border">·</span>
        <span className="font-semibold text-foreground tabular-nums">{brl(receitaProducao)}</span>
        <span>em produção</span>
      </div>


      {isLoading && <div className="h-96 rounded-xl bg-muted animate-pulse" />}
      {!isLoading && totalFila === 0 && (
        <div className="mb-4">
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <p className="font-display font-semibold">Fila vazia 🧼</p>
              <p className="text-sm text-muted-foreground mt-1">Nenhum carro em atendimento agora.</p>
              <Button asChild size="sm" className="mt-3"><Link to="/ordens">Criar nova OS</Link></Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MOBILE: tabs de status + lista */}
      <div className="sm:hidden">
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b">
          <div className="grid grid-cols-5 gap-1">
            {columns.map(c => {
              const n = countBy(c.key);
              const active = c.key === etapaVisivel;
              return (
                <button key={c.key} onClick={() => { setActiveMobile(c.key); if (etapaFoco) navigate({ search: {} }); }}
                  className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-[10px] font-medium transition ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border text-foreground/70"}`}>
                  <span className="w-full truncate text-center leading-tight">{c.emoji} {c.short}</span>
                  <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2 mt-3">
          {itemsMobile.length === 0 && totalFila > 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma OS nesta etapa.</p>
          )}
          {itemsMobile.map(o => (
            <button key={o.id} onClick={() => setSelected(o)}
              className="w-full text-left bg-card border rounded-xl p-3 shadow-sm active:scale-[0.99] transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{o.clientes?.nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.servicos?.nome ?? "Serviço"} · {brl(o.valor)}</p>
                </div>
                <span className="shrink-0 text-xs font-mono bg-muted px-2 py-0.5 rounded">{o.veiculos?.placa ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>⏱ {tempoNaEtapa(o)}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* DESKTOP: deeplink abre a etapa filtrada; sem filtro, conserva o Kanban com drag & drop. */}
      <div className="hidden sm:block">
        {colunaFoco ? (
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">{colunaFoco.label}</h2>
                  <p className="text-xs text-muted-foreground">Clique em uma OS para consultar os detalhes ou mudar sua etapa.</p>
                </div>
                <Badge variant="secondary">{itensFiltrados.length} registros</Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {itensFiltrados.map(o => (
                  <button key={o.id} type="button" onClick={() => setSelected(o)}
                    className="group min-w-0 rounded-2xl border border-border/70 bg-muted/20 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{o.clientes?.nome ?? "Cliente"}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{o.servicos?.nome ?? "Serviço"}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                      <span className="rounded-lg bg-card px-2 py-1 font-mono text-xs">{o.veiculos?.placa ?? "Sem placa"}</span>
                      <span className="text-sm font-semibold tabular-nums">{brl(o.valor)}</span>
                    </div>
                  </button>
                ))}
              </div>
              {itensFiltrados.length === 0 && (
                <div className="py-14 text-center text-sm text-muted-foreground">Nenhuma OS nesta etapa.</div>
              )}
            </CardContent>
          </Card>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              {columns.map((c) => {
                const items = ordensList.filter((o) => o.status === c.key);
                return <Column key={c.key} col={c} items={items} onAdvance={(id, s) => mut.mutate({ id, status: s })} onReenviar={reenviarWhats} />;
              })}
            </div>
          </DndContext>
        )}
      </div>

      {/* Bottom sheet detalhes (mobile-first, mas funciona em qualquer largura) */}
      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="max-h-[85vh]">
          {selected && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{selected.clientes?.nome ?? "Cliente"}</span>
                  <DrawerClose asChild><Button size="icon" variant="ghost" className="h-8 w-8"><X className="h-4 w-4" /></Button></DrawerClose>
                </DrawerTitle>
                <DrawerDescription className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{columns.find(c => c.key === selected.status)?.emoji} {columns.find(c => c.key === selected.status)?.label}</Badge>
                  <span className="font-mono">{selected.veiculos?.placa ?? "—"}</span>
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-2 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Serviço:</span> {selected.servicos?.nome ?? "—"}</p>
                <p><span className="text-muted-foreground">Valor:</span> <span className="font-semibold">{brl(selected.valor)}</span></p>
                <p><span className="text-muted-foreground">Entrada:</span> {dateTimeBr(selected.created_at)}</p>
                <p><span className="text-muted-foreground">Tempo na etapa:</span> {tempoNaEtapa(selected)}</p>
                {selected.funcionarios?.nome && <p><span className="text-muted-foreground">Atendente:</span> {selected.funcionarios.nome}</p>}
              </div>

              <div className="p-4 pt-3 space-y-2">
                {nextStatus(selected.status) && (
                  <Button className="w-full h-12" onClick={() => mut.mutate({ id: selected.id, status: nextStatus(selected.status)! })}>
                    <Check className="h-4 w-4 mr-2" />
                    Avançar para {columns.find(c => c.key === nextStatus(selected.status))?.label}
                  </Button>
                )}
                {selected.clientes?.telefone && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" className="h-11" asChild>
                      <a href={`tel:${selected.clientes.telefone}`}><Phone className="h-4 w-4 mr-2" />Ligar</a>
                    </Button>
                    <Button variant="outline" className="h-11" onClick={() => reenviarWhats(selected)}>
                      <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {(logsData?.logs ?? []).length > 0 && (
        <details className="mt-6 rounded-xl border bg-card/60 px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
            <Send className="h-3.5 w-3.5 shrink-0 text-success" />
            Logs WhatsApp ({logsData!.logs.length})
          </summary>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {logsData!.logs.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-2 border-l-2 border-success/40 py-1 pl-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.clientes?.nome ?? "Cliente"}</p>
                  <p className="truncate text-muted-foreground">{l.descricao}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">{dateTimeBr(l.created_at)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

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




function tempoNaEtapa(ordem: any): string {
  const ref = ordem.status === "em_lavagem" ? ordem.iniciado_em
    : ordem.status === "pronto" ? ordem.finalizado_em
    : ordem.status === "entregue" ? ordem.entregue_em
    : ordem.created_at;
  if (!ref) return "—";
  const mins = Math.floor((Date.now() - new Date(ref).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
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
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
        <span>Entrada: {dateTimeBr(ordem.created_at)}</span>
        <span className="font-medium">⏱ {tempoNaEtapa(ordem)}</span>
      </div>
      {ordem.funcionarios?.nome && <p className="text-[10px] text-muted-foreground mt-0.5">👤 {ordem.funcionarios.nome}</p>}

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
