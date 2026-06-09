import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMeuTrabalho, iniciarOs, finalizarOs } from "@/lib/lavaflow.functions";
import { brl, dateTimeBr } from "@/lib/format";
import { Play, Check, Car, Clock, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/meu-trabalho")({
  component: Page,
});

function Page() {
  const fn = useServerFn(getMeuTrabalho);
  const startFn = useServerFn(iniciarOs);
  const finishFn = useServerFn(finalizarOs);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["meu-trabalho"], queryFn: () => fn() });

  const startMut = useMutation({
    mutationFn: (id: string) => startFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meu-trabalho"] }); toast.success("Lavagem iniciada"); },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });
  const finishMut = useMutation({
    mutationFn: (id: string) => finishFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meu-trabalho"] }); toast.success("Veículo pronto ✓"); },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const c = data?.cards;
  const nome = data?.funcionario?.nome ?? "Colaborador";

  return (
    <>
      <PageHeader title={`Olá, ${nome.split(" ")[0]}`} subtitle="Atualize aqui o andamento de cada veículo." />

      {!data?.funcionario && !isLoading && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="p-4 text-sm">
            Sua conta ainda não foi vinculada a um funcionário. Peça ao proprietário para vincular seu e-mail em Equipe.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard icon={Car} label="Concluídas hoje" value={String(c?.concluidasHoje ?? 0)} />
        <MetricCard icon={Clock} label="Tempo médio" value={c?.tempoMedioMin ? `${c.tempoMedioMin} min` : "—"} />
        <MetricCard icon={DollarSign} label="Comissão (mês)" value={brl(c?.comissaoMes ?? 0)} />
        <MetricCard icon={TrendingUp} label="Lavagens (7d)" value={String(c?.lavagensSemana ?? 0)} />
      </div>

      <h2 className="font-display font-semibold mb-2">Veículos em atendimento</h2>
      {isLoading && <div className="h-40 rounded-xl bg-muted animate-pulse" />}
      {!isLoading && (data?.fila ?? []).length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum veículo aguardando agora 🧼</CardContent></Card>
      )}
      <div className="space-y-2">
        {(data?.fila ?? []).map((o: any) => (
          <Card key={o.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{o.clientes?.nome ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.veiculos?.modelo ?? "—"} · <span className="font-mono">{o.veiculos?.placa ?? "—"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{o.servicos?.nome ?? "Serviço"} · {brl(o.valor)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Entrada: {dateTimeBr(o.created_at)}</p>
                </div>
                <Badge variant={o.status === "em_lavagem" ? "default" : "secondary"}>
                  {o.status === "em_lavagem" ? "Em lavagem" : "Aguardando"}
                </Badge>
              </div>
              <div className="flex gap-2 mt-3">
                {o.status === "aguardando" && (
                  <Button size="sm" className="flex-1" disabled={startMut.isPending} onClick={() => startMut.mutate(o.id)}>
                    <Play className="h-4 w-4 mr-1" />Iniciar
                  </Button>
                )}
                {o.status === "em_lavagem" && (
                  <Button size="sm" className="flex-1" disabled={finishMut.isPending} onClick={() => finishMut.mutate(o.id)}>
                    <Check className="h-4 w-4 mr-1" />Finalizar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Icon className="h-3.5 w-3.5" />{label}
        </div>
        <p className="font-display font-bold text-xl mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
