import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { marcarPagamentoComissao, listPagamentosComissao } from "@/lib/lavaflow.functions";
import { brl, dateBr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export function MarcarPagamentoDialog({
  open, onOpenChange, funcionarioId, funcionarioNome, funcionarioTelefone, valorEstimado, periodoInicio, periodoFim,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  funcionarioId: string; funcionarioNome: string; funcionarioTelefone?: string | null;
  valorEstimado: number; periodoInicio: string; periodoFim: string;
}) {
  const fn = useServerFn(marcarPagamentoComissao);
  const hist = useServerFn(listPagamentosComissao);
  const qc = useQueryClient();
  const [obs, setObs] = useState("");
  const [ultimoPagamento, setUltimoPagamento] = useState<any>(null);

  const { data: pagtos } = useQuery({
    queryKey: ["pagamentos-comissao", funcionarioId],
    queryFn: () => hist({ data: { funcionario_id: funcionarioId, limit: 8 } }),
    enabled: open,
  });

  function pagamentoMsg(p: any) {
    return [
      `Ola ${funcionarioNome.split(" ")[0]}!`,
      "",
      "Pagamento de comissao registrado:",
      `Periodo: ${dateBr(p.periodo_inicio)} a ${dateBr(p.periodo_fim)}`,
      `Servicos: ${p.quantidade_servicos ?? 0}`,
      `Valor: ${brl(p.valor)}`,
      p.observacao ? `Observacao: ${p.observacao}` : null,
      "",
      "Obrigado pelo trabalho!",
    ].filter(Boolean).join("\n");
  }

  function enviarResumo(p: any) {
    const msg = pagamentoMsg(p);
    if (funcionarioTelefone) {
      window.open(waLink(funcionarioTelefone, msg), "_blank", "noopener");
      return;
    }
    navigator.clipboard.writeText(msg);
    toast.success("Resumo copiado");
  }

  const mut = useMutation({
    mutationFn: () => fn({
      data: { funcionario_id: funcionarioId, periodo_inicio: periodoInicio, periodo_fim: periodoFim, observacao: obs || undefined },
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["equipe-painel"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-comissao"] });
      toast.success(`Pagamento de ${brl(res?.valor ?? valorEstimado)} registrado`);
      setUltimoPagamento({
        id: res?.pagamento_id ?? "novo",
        valor: res?.valor ?? valorEstimado,
        quantidade_servicos: res?.quantidade_servicos ?? 0,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        observacao: obs || null,
      });
      setObs("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar pagamento - {funcionarioNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Valor a pagar (periodo {dateBr(periodoInicio)} - {dateBr(periodoFim)})</p>
            <p className="text-3xl font-display font-bold">{brl(valorEstimado)}</p>
          </div>
          <div>
            <Label>Observacao (opcional)</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="PIX, dinheiro, transferencia..." />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || valorEstimado <= 0} className="w-full h-12">
            Confirmar pagamento
          </Button>

          {ultimoPagamento && (
            <div className="rounded-lg border p-3 space-y-2">
              <div>
                <p className="text-xs font-semibold">Pagamento registrado</p>
                <p className="text-xs text-muted-foreground">
                  {ultimoPagamento.quantidade_servicos} servicos - {dateBr(ultimoPagamento.periodo_inicio)} a {dateBr(ultimoPagamento.periodo_fim)}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => enviarResumo(ultimoPagamento)}>
                {funcionarioTelefone ? <MessageCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {funcionarioTelefone ? "Enviar resumo ao colaborador" : "Copiar resumo"}
              </Button>
            </div>
          )}

          {pagtos && pagtos.pagamentos.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Historico de pagamentos</p>
              <div className="space-y-2 text-sm">
                {pagtos.pagamentos.map((p: any) => (
                  <div key={p.id} className="rounded-md bg-muted/60 p-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{dateBr(p.pago_em)} - {dateBr(p.periodo_inicio)} a {dateBr(p.periodo_fim)}</span>
                      <span className="font-medium">{brl(p.valor)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{p.quantidade_servicos ?? 0} servicos</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => enviarResumo(p)}>
                        {funcionarioTelefone ? <MessageCircle className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                        {funcionarioTelefone ? "Enviar" : "Copiar"}
                      </Button>
                    </div>
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
