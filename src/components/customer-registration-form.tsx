import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createCliente } from "@/lib/lavaflow.functions";
import {
  customerRegistrationSchema,
  submissionGuard,
  type RegisteredCustomer,
} from "@/lib/customer-registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CustomerRegistrationForm({
  onSaved,
  onCancel,
  allowBooking = false,
}: {
  onSaved: (customer: RegisteredCustomer, book: boolean) => void;
  onCancel: () => void;
  allowBooking?: boolean;
}) {
  const create = useServerFn(createCliente);
  const qc = useQueryClient();
  const guard = useRef(submissionGuard());
  const [form, setForm] = useState({ nome: "", telefone: "", origem_cliente: "Indicação" });
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<{ customer: RegisteredCustomer; book: boolean } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: async (book: boolean) => ({
      ...(await create({ data: customerRegistrationSchema.parse(form) })),
      book,
    }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      void qc.invalidateQueries({ queryKey: ["customer-options"] });
      if (result.existente) {
        setExisting({ customer: result.cliente, book: result.book });
        return;
      }
      toast.success("Cliente cadastrado");
      onSaved(result.cliente, result.book);
    },
    onError: (cause: Error) =>
      setError(cause.message || "Não foi possível cadastrar o cliente. Tente novamente."),
    onSettled: () => guard.current.release(),
  });
  const submit = (book: boolean) => {
    if (!guard.current.enter()) return;
    const parsed = customerRegistrationSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados.");
      guard.current.release();
      return;
    }
    setError("");
    setExisting(null);
    mutation.mutate(book);
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="space-y-4"
    >
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="novo-cliente-nome">Nome</Label>
          <Input
            id="novo-cliente-nome"
            required
            maxLength={120}
            autoComplete="name"
            value={form.nome}
            onChange={(e) => {
              setExisting(null);
              setForm({ ...form, nome: e.target.value });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-cliente-whatsapp">WhatsApp</Label>
          <Input
            id="novo-cliente-whatsapp"
            type="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="(11) 99999-0000"
            value={form.telefone}
            onChange={(e) => {
              setExisting(null);
              setForm({ ...form, telefone: e.target.value });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-cliente-origem">Origem do cliente</Label>
          <Input
            id="novo-cliente-origem"
            maxLength={50}
            value={form.origem_cliente}
            onChange={(e) => setForm({ ...form, origem_cliente: e.target.value })}
          />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {existing && (
        <div className="space-y-2 border-t pt-3">
          <p role="status" className="text-sm">
            Já existe um cadastro compatível: <strong>{existing.customer.nome}</strong>
            {existing.customer.telefone ? ` · ${existing.customer.telefone}` : ""}.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            onClick={() => onSaved(existing.customer, existing.book)}
          >
            Usar cliente existente
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={mutation.isPending || !form.nome.trim() || !!existing}
        >
          {mutation.isPending ? "Salvando..." : "Salvar cliente"}
        </Button>
        {allowBooking && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            disabled={mutation.isPending || !form.nome.trim() || !!existing}
            onClick={() => submit(true)}
          >
            Salvar e agendar
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
