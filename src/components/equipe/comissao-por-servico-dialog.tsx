import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listServicos, listComissoesServico, upsertComissoesServico } from "@/lib/lavaflow.functions";
import { toast } from "sonner";

type Item = { servico_id: string; tipo: "fixo" | "percentual"; valor: number };

export function ComissaoPorServicoDialog({
  open, onOpenChange, funcionarioId, funcionarioNome,
}: { open: boolean; onOpenChange: (v: boolean) => void; funcionarioId: string; funcionarioNome: string }) {
  const sv = useServerFn(listServicos);
  const ls = useServerFn(listComissoesServico);
  const up = useServerFn(upsertComissoesServico);
  const qc = useQueryClient();

  const { data: servicos } = useQuery({ queryKey: ["servicos"], queryFn: () => sv(), enabled: open });
  const { data: existentes } = useQuery({
    queryKey: ["comissoes-servico", funcionarioId],
    queryFn: () => ls({ data: { funcionario_id: funcionarioId } }),
    enabled: open && !!funcionarioId,
  });

  const [itens, setItens] = useState<Record<string, Item>>({});

  useEffect(() => {
    if (!servicos?.servicos) return;
    const map: Record<string, Item> = {};
    servicos.servicos.forEach((s: any) => {
      const ex = existentes?.itens.find((i: any) => i.servico_id === s.id);
      map[s.id] = {
        servico_id: s.id,
        tipo: (ex?.tipo as "fixo" | "percentual") ?? "fixo",
        valor: Number(ex?.valor ?? 0),
      };
    });
    setItens(map);
  }, [servicos, existentes]);

  const mut = useMutation({
    mutationFn: () => up({ data: { funcionario_id: funcionarioId, itens: Object.values(itens) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comissoes-servico", funcionarioId] });
      qc.invalidateQueries({ queryKey: ["equipe-painel"] });
      toast.success("Tarifas salvas");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comissão por serviço — {funcionarioNome}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Defina quanto o colaborador recebe por cada tipo de serviço entregue. Deixe 0 para não pagar.
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {(servicos?.servicos ?? []).map((s: any) => {
            const it = itens[s.id];
            if (!it) return null;
            return (
              <div key={s.id} className="grid grid-cols-[1fr,90px,110px] gap-2 items-end border rounded-md p-2">
                <div>
                  <Label className="text-xs">{s.nome}</Label>
                  <p className="text-[10px] text-muted-foreground">Preço base R$ {Number(s.preco_padrao).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-[10px]">Tipo</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                    value={it.tipo}
                    onChange={(e) => setItens({ ...itens, [s.id]: { ...it, tipo: e.target.value as any } })}
                  >
                    <option value="fixo">R$</option>
                    <option value="percentual">%</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">{it.tipo === "percentual" ? "%" : "R$"}</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={it.valor}
                    onChange={(e) => setItens({ ...itens, [s.id]: { ...it, valor: Number(e.target.value) || 0 } })}
                  />
                </div>
              </div>
            );
          })}
          {(servicos?.servicos ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Cadastre serviços antes.</p>
          )}
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">Salvar tarifas</Button>
      </DialogContent>
    </Dialog>
  );
}
