import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { marcarPagamentoComissao, listPagamentosComissao } from "@/lib/lavaflow.functions";
import { brl, dateBr } from "@/lib/format";
import { toast } from "sonner";

export function MarcarPagamentoDialog({
  open, onOpenChange, funcionarioId, funcionarioNome, valorEstimado, periodoInicio, periodoFim,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  funcionarioId: string; funcionarioNome: string;
  valorEstimado: number; periodoInicio: string; periodoFim: string;
}) {
  const fn = useServerFn(marcarPagamentoComissao);
  const hist = useServerFn(listPagamentosComissao);
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  const { data: pagtos } = useQuery({
    queryKey: ["pagamentos-comissao", funcionarioId],
    queryFn: () => hist({ data: { funcionario_id: funcionarioId, limit: 5 } }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => fn({
      data: { funcionario_id: funcionarioId, periodo_inicio: periodoInicio, periodo_fim: periodoFim, observacao: obs || undefined },
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["equipe-painel"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-comissao"] });
      toast.success(`Pagamento de ${brl(res?.valor ?? valorEstimado)} registrado`);
      setObs("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar pagamento — {funcionarioNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Valor a pagar (período {dateBr(periodoInicio)} – {dateBr(periodoFim)})</p>
            <p className="text-3xl font-display font-bold">{brl(valorEstimado)}</p>
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="PIX, dinheiro, transferência…" />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || valorEstimado <= 0} className="w-full h-12">
            Confirmar pagamento
          </Button>
          {pagtos && pagtos.pagamentos.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Últimos pagamentos</p>
              <div className="space-y-1 text-sm">
                {pagtos.pagamentos.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{dateBr(p.pago_em)} · {dateBr(p.periodo_inicio)}–{dateBr(p.periodo_fim)}</span>
                    <span className="font-medium">{brl(p.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
