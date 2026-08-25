import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getEquipeGanhos } from "@/lib/equipe-worker.functions";
import { equipeConcluirChecklistInicial, equipeFinalizarAtendimento, equipeIniciarAtendimento, equipePularChecklistInicial, getModoEquipe } from "@/lib/lavaflow.functions";
import { Banknote, Car, CheckCircle2, ClipboardCheck, Clock, DollarSign, LogOut, Play, TrendingUp, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/modo-equipe")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Modo Equipe - LavaFlow" },
      { name: "description", content: "Interface operacional para colaboradores LavaFlow." },
    ],
  }),
});

function initials(name?: string) {
  return (name ?? "LF").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function brl(value?: number | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  if (status === "aguardando") return "Aguardando";
  if (status === "em_lavagem") return "Em lavagem";
  if (status === "pronto") return "Pronto";
  return status;
}

function checklistLabel(status?: string | null) {
  if (status === "concluido") return "Checklist concluído";
  if (status === "pulado") return "Checklist pulado";
  return "Checklist pendente";
}

const checklistItems = [
  ["riscos_visiveis", "Riscos visíveis"],
  ["amassados", "Amassados"],
  ["vidro_trincado", "Vidro trincado"],
  ["retrovisor_danificado", "Retrovisor danificado"],
  ["farol_lanterna_danificado", "Farol ou lanterna danificado"],
  ["rodas_avarias", "Rodas com avarias"],
  ["bancos_manchados", "Bancos manchados"],
  ["objetos_pessoais", "Objetos pessoais no veículo"],
  ["chave_recebida", "Chave recebida"],
  ["arranhoes_superficiais", "Arranhões superficiais"],
  ["pintura_opaca", "Pintura opaca"],
  ["farol_amarelado", "Farol amarelado"],
  ["mau_cheiro_interno", "Mau cheiro interno"],
  ["rodas_muito_sujas", "Rodas muito sujas"],
] as const;

const emptyChecklist = Object.fromEntries(checklistItems.map(([key]) => [key, false])) as Record<string, boolean>;

function tempoEmAtendimento(start?: string | null) {
  if (!start) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(start).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("lavaflow_team_token") ?? "";
}

function Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const modoFn = useServerFn(getModoEquipe);
  const ganhosFn = useServerFn(getEquipeGanhos);
  const iniciarFn = useServerFn(equipeIniciarAtendimento);
  const concluirChecklistFn = useServerFn(equipeConcluirChecklistInicial);
  const pularChecklistFn = useServerFn(equipePularChecklistInicial);
  const finalizarFn = useServerFn(equipeFinalizarAtendimento);
  const [token, setToken] = useState("");
  const [finalizar, setFinalizar] = useState<any>(null);
  const [checklistOrdem, setChecklistOrdem] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(emptyChecklist);
  const [obs, setObs] = useState("");
  const [checklistObs, setChecklistObs] = useState("");

  const trocarColaborador = useCallback(() => {
    const slug = window.localStorage.getItem("lavaflow_team_slug");
    window.localStorage.removeItem("lavaflow_team_token");
    setToken("");
    navigate({ to: slug ? `/equipe/${slug}` : "/auth" });
  }, [navigate]);

  useEffect(() => {
    const saved = getToken();
    setToken(saved);
    if (!saved) {
      const slug = window.localStorage.getItem("lavaflow_team_slug");
      navigate({ to: slug ? `/equipe/${slug}` : "/auth" });
    }
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    let timer: number | undefined;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => trocarColaborador(), 5 * 60 * 1000);
    };
    ["click", "keydown", "touchstart", "mousemove"].forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      ["click", "keydown", "touchstart", "mousemove"].forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [token, trocarColaborador]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["modo-equipe", token],
    queryFn: () => modoFn({ data: { token } }),
    enabled: !!token,
    refetchInterval: 30000,
    retry: false,
  });

  const { data: ganhos, isLoading: ganhosLoading, isError: ganhosError } = useQuery({
    queryKey: ["modo-equipe-ganhos", token],
    queryFn: () => ganhosFn({ data: { token } }),
    enabled: !!token,
    refetchInterval: 30000,
    retry: false,
  });

  const iniciar = useMutation({
    mutationFn: (ordem_id: string) => iniciarFn({ data: { token, ordem_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modo-equipe"] });
      toast.success("Atendimento iniciado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const concluirChecklist = useMutation({
    mutationFn: () => concluirChecklistFn({ data: { token, ordem_id: checklistOrdem.id, itens: checklist as any, observacoes: checklistObs || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modo-equipe"] });
      setChecklistOrdem(null);
      setChecklist(emptyChecklist);
      setChecklistObs("");
      toast.success("Checklist concluído e atendimento iniciado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const pularChecklist = useMutation({
    mutationFn: () => pularChecklistFn({ data: { token, ordem_id: checklistOrdem.id, observacoes: checklistObs || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modo-equipe"] });
      setChecklistOrdem(null);
      setChecklist(emptyChecklist);
      setChecklistObs("");
      toast.success("Checklist pulado e atendimento iniciado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const finalizarMut = useMutation({
    mutationFn: () => finalizarFn({ data: { token, ordem_id: finalizar.id, observacoes: obs || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modo-equipe"] });
      qc.invalidateQueries({ queryKey: ["modo-equipe-ganhos"] });
      setFinalizar(null);
      setObs("");
      toast.success("Veículo marcado como pronto. A comissão entra nos ganhos após a entrega.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  if (error) {
    return (
      <div className="grid min-h-screen place-content-center bg-background px-4 text-center">
        <Card><CardContent className="space-y-4 p-6">
          <p className="font-semibold">Sessão expirada</p>
          <Button onClick={trocarColaborador}>Voltar ao acesso da equipe</Button>
        </CardContent></Card>
      </div>
    );
  }

  const funcionario = data?.funcionario;
  const fila = data?.fila ?? [];
  const exigirChecklist = data?.config?.exigirChecklistInicial !== false;

  function iniciarFluxo(o: any) {
    if (o.status === "em_lavagem") {
      toast.info("Atendimento em andamento");
      return;
    }
    if (o.status !== "aguardando") return;
    if (o.checklist_inicial_status !== "concluido" && o.checklist_inicial_status !== "pulado") {
      setChecklistOrdem(o);
      setChecklist(emptyChecklist);
      setChecklistObs("");
      return;
    }
    iniciar.mutate(o.id);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 rounded-xl">
              <AvatarImage src={funcionario?.avatar_url ?? undefined} />
              <AvatarFallback className="rounded-xl">{funcionario ? initials(funcionario.nome) : <UserRound className="h-5 w-5" />}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold">Meu Trabalho</p>
              <p className="truncate text-xs text-muted-foreground">{funcionario?.nome ?? "Equipe"} · {funcionario?.cargo ?? "Operação"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={trocarColaborador} className="h-10 rounded-lg bg-card shadow-soft">
            <LogOut className="mr-1 h-4 w-4" /> Trocar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {isLoading && <div className="h-56 rounded-xl bg-muted animate-pulse" />}

        {data && (
          <>
            <section className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground shadow-glow">
                <CardContent className="flex min-h-40 flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-primary-foreground/80">Ganhos hoje</p>
                      {ganhosLoading ? (
                        <div className="mt-2 h-10 w-36 animate-pulse rounded-lg bg-primary-foreground/15" />
                      ) : (
                        <p className="mt-1 font-display text-4xl font-bold tabular-nums">{ganhosError ? "—" : brl(ganhos?.ganhosHoje)}</p>
                      )}
                    </div>
                    <div className="grid h-11 w-11 place-content-center rounded-xl bg-primary-foreground/15">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>
                  {ganhosError ? (
                    <p className="mt-5 text-xs text-primary-foreground/80">Resumo financeiro temporariamente indisponível.</p>
                  ) : (
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary-foreground/80">
                      <span>{ganhos?.servicosHoje ?? 0} {ganhos?.servicosHoje === 1 ? "serviço entregue" : "serviços entregues"}</span>
                      <span>{brl(ganhos?.faturamentoHoje)} faturados hoje</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <MoneyMetric
                  icon={Banknote}
                  label="A receber"
                  value={ganhosError ? "—" : brl(ganhos?.aReceber)}
                  hint="Comissões ainda não pagas"
                />
                <MoneyMetric
                  icon={TrendingUp}
                  label="Recebido no mês"
                  value={ganhosError ? "—" : brl(ganhos?.recebidoMes)}
                  hint={ganhosError ? "Resumo financeiro indisponível" : (ganhos?.regraLabel ?? "Regra de comissão")}
                />
              </div>
            </section>

            <p className="-mt-1 px-1 text-[11px] text-muted-foreground">
              Valores atualizados automaticamente. A comissão passa a contar como ganho quando a OS é entregue.
            </p>

            <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric icon={Car} label="Atribuídos" value={String(data.cards.veiculosAtribuidos)} />
              <Metric icon={Wrench} label="Em atendimento" value={String(data.cards.emAtendimento)} />
              <Metric icon={Clock} label="Próximo serviço" value={data.cards.proximoServico} />
              <Metric icon={CheckCircle2} label="Concluídos hoje" value={String(data.cards.concluidosHoje)} />
            </section>

            <section>
              <h2 className="mb-2 font-display text-lg font-semibold">Próximos veículos</h2>
              {fila.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
                    <div className="mb-3 grid h-11 w-11 place-content-center rounded-xl bg-muted text-muted-foreground">
                      <Car className="h-5 w-5" />
                    </div>
                    <p className="font-medium">Nenhum veículo atribuído agora</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Quando um novo serviço for direcionado para você, ele aparecerá aqui automaticamente.
                    </p>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-2">
                {fila.map((o: any) => {
                  const tempo = tempoEmAtendimento(o.iniciado_em);
                  return (
                    <Card key={o.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold">{o.clientes?.nome ?? "Cliente"}</p>
                              <Badge variant={o.status === "em_lavagem" ? "default" : "secondary"}>{statusLabel(o.status)}</Badge>
                              <Badge variant={o.checklist_inicial_status === "pendente" ? "outline" : "secondary"} className={o.checklist_inicial_status === "pendente" ? "border-warning/60 text-warning-foreground" : ""}>
                                {checklistLabel(o.checklist_inicial_status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {o.veiculos?.modelo ?? "Veículo"} {o.veiculos?.placa ? `· ${o.veiculos.placa}` : ""} · {o.servicos?.nome ?? "Serviço"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              {tempo ? ` · ${tempo} em atendimento` : ""}
                            </p>
                            {(o.upsell_oportunidades?.length ?? 0) > 0 && (
                              <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary">
                                Possível serviço adicional identificado.
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:w-64">
                            <Button
                              className="h-12"
                              disabled={iniciar.isPending || !funcionario?.perm_iniciar_atendimento}
                              onClick={() => iniciarFluxo(o)}
                            >
                              {o.checklist_inicial_status === "pendente" ? <ClipboardCheck className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                              {o.status === "em_lavagem" ? "Continuar" : o.checklist_inicial_status === "pendente" ? "Checklist" : "Iniciar"}
                            </Button>
                            <Button
                              variant="outline"
                              className="h-12"
                              disabled={o.status !== "em_lavagem" || !funcionario?.perm_finalizar_atendimento}
                              onClick={() => setFinalizar(o)}
                            >
                              Finalizar
                            </Button>
                            {(o.upsell_oportunidades?.length ?? 0) > 0 && (
                              <Button
                                type="button"
                                variant="secondary"
                                className="col-span-2 h-10"
                                onClick={() => toast.success("Recepção avisada sobre a oportunidade")}
                              >
                                Avisar recepção
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <Button onClick={trocarColaborador} className="fixed bottom-4 left-4 right-4 h-12 rounded-xl shadow-glow sm:hidden">
        Trocar colaborador
      </Button>

      <Dialog open={!!finalizar} onOpenChange={(v) => !v && setFinalizar(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Finalizar atendimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Adicione uma observação final, se necessário.</p>
            <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: cliente pediu atenção no porta-malas" />
            <Button className="h-12 w-full" onClick={() => finalizarMut.mutate()} disabled={finalizarMut.isPending}>
              Marcar como pronto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checklistOrdem} onOpenChange={(v) => !v && setChecklistOrdem(null)}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Checklist Inicial</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="font-semibold">{checklistOrdem?.clientes?.nome ?? "Cliente"}</p>
              <p className="text-xs text-muted-foreground">
                {checklistOrdem?.veiculos?.modelo ?? "Veículo"} {checklistOrdem?.veiculos?.placa ? `- ${checklistOrdem.veiculos.placa}` : ""}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {checklistItems.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Checkbox checked={!!checklist[key]} onCheckedChange={(v) => setChecklist({ ...checklist, [key]: v === true })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <Textarea rows={3} value={checklistObs} onChange={(e) => setChecklistObs(e.target.value)} placeholder="Observações do checklist" />
            <div className="grid gap-2 sm:grid-cols-2">
              {!exigirChecklist && (
                <Button variant="outline" className="h-12" onClick={() => pularChecklist.mutate()} disabled={pularChecklist.isPending || concluirChecklist.isPending}>
                  Pular checklist
                </Button>
              )}
              <Button className="h-12 sm:col-start-2" onClick={() => concluirChecklist.mutate()} disabled={concluirChecklist.isPending || pularChecklist.isPending || !funcionario?.perm_realizar_checklist}>
                Concluir checklist
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoneyMetric({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="flex h-full min-h-40 flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <p className="truncate font-display text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
