import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesCustomer, type RegisteredCustomer } from "@/lib/customer-registration";

type Props = {
  id?: string;
  customers: RegisteredCustomer[];
  value: string;
  onValueChange: (id: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  disabled?: boolean;
};

export function CustomerCombobox({ id, customers, value, onValueChange, loading, error, onRetry, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const selected = customers.find(c => c.id === value);
  const matches = customers.filter(c => matchesCustomer(c, query));
  const close = () => { setOpen(false); setQuery(""); };
  return <div className="space-y-1" onKeyDown={e => { if (e.key === "Escape" && open) { e.stopPropagation(); close(); } }}>
    <Button id={id} type="button" variant="outline" disabled={disabled} aria-expanded={open} aria-controls={listId}
      className="min-h-11 w-full justify-between gap-2 font-normal" onClick={() => open ? close() : setOpen(true)}>
      <span className="truncate">{selected?.nome ?? "Selecione o cliente"}</span><ChevronDown className="h-4 w-4 shrink-0" />
    </Button>
    {open && <div id={listId} className="space-y-2 rounded-xl border bg-popover p-2">
      <Input aria-label="Pesquisar cliente por nome ou telefone" placeholder="Buscar nome ou telefone..." value={query}
        onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} />
      {loading ? <p role="status" className="p-2 text-sm">Carregando clientes...</p> : error ?
        <div role="alert" className="space-y-2 p-2 text-sm">Não foi possível carregar os clientes.
          <Button type="button" variant="outline" onClick={onRetry}>Tentar novamente</Button></div> :
        <div className="max-h-[min(30dvh,15rem)] overflow-y-auto overscroll-contain" role="group" aria-label="Resultados da pesquisa">
          {matches.slice(0, 100).map(c => <button key={c.id} type="button" aria-pressed={value === c.id}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-accent focus-visible:outline-primary"
            onClick={() => { onValueChange(c.id); close(); }}>
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{c.nome}</span>
              {c.telefone && <span className="block text-xs text-muted-foreground">{c.telefone}</span>}</span>
            {value === c.id && <Check className="h-4 w-4 shrink-0" />}
          </button>)}
          {!matches.length && <p role="status" className="p-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
          {matches.length > 100 && <p className="p-2 text-xs text-muted-foreground">Refine a busca para ver mais clientes.</p>}
        </div>}
    </div>}
  </div>;
}
