import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateClienteCompleto } from "@/lib/lavaflow.functions";
import { toast } from "sonner";

export function EditarClienteDialog({
  open, onOpenChange, cliente, veiculo,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  cliente: any; veiculo?: any;
}) {
  const fn = useServerFn(updateClienteCompleto);
  const qc = useQueryClient();
  const [f, setF] = useState({
    nome: "", telefone: "", whatsapp: "", email: "", observacoes: "",
    placa: "", modelo: "", marca: "", cor: "",
  });

  useEffect(() => {
    if (open && cliente) {
      setF({
        nome: cliente.nome ?? "",
        telefone: cliente.telefone ?? "",
        whatsapp: cliente.whatsapp ?? "",
        email: cliente.email ?? "",
        observacoes: cliente.observacoes ?? "",
        placa: veiculo?.placa ?? "",
        modelo: veiculo?.modelo ?? "",
        marca: veiculo?.marca ?? "",
        cor: veiculo?.cor ?? "",
      });
    }
  }, [open, cliente, veiculo]);

  const mut = useMutation({
    mutationFn: () => fn({
      data: {
        id: cliente.id,
        nome: f.nome,
        telefone: f.telefone || null,
        whatsapp: f.whatsapp || null,
        email: f.email || null,
        observacoes: f.observacoes || null,
        veiculo: f.placa ? {
          id: veiculo?.id,
          placa: f.placa, modelo: f.modelo || null, marca: f.marca || null, cor: f.cor || null,
        } : undefined,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", cliente.id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente atualizado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!f.nome.trim()) { toast.error("Nome obrigatório"); return; } mut.mutate(); }}
          className="space-y-3"
        >
          <div>
            <Label>Nome *</Label>
            <Input required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Telefone</Label><Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-semibold mb-2">Veículo principal {veiculo ? "" : "(opcional)"}</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Placa</Label><Input value={f.placa} onChange={(e) => setF({ ...f, placa: e.target.value.toUpperCase() })} /></div>
              <div><Label>Cor</Label><Input value={f.cor} onChange={(e) => setF({ ...f, cor: e.target.value })} /></div>
              <div><Label>Marca</Label><Input value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} /></div>
            </div>
          </div>

          <Button type="submit" className="w-full h-12" disabled={mut.isPending}>Salvar alterações</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
