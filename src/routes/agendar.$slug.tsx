import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEmpresaPublica, getHorariosDisponiveis, solicitarAgendamentoPublico } from "@/lib/lavaflow.functions";
import { Car, CheckCircle2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agendar/$slug")({
  component: Page,
  head: ({ params }) => ({
    meta: [
      { title: `Agendar lavagem - ${params.slug}` },
      { name: "description", content: "Reserve seu horário online em poucos cliques." },
      { property: "og:title", content: `Agendar lavagem` },
      { property: "og:description", content: "Reserve seu horário online em poucos cliques." },
    ],
  }),
});

function todayIso() { return new Date().toISOString().slice(0, 10); }

function Page() {
  const { slug } = Route.useParams();
  const emp = useServerFn(getEmpresaPublica);
  const slots = useServerFn(getHorariosDisponiveis);
  const enviar = useServerFn(solicitarAgendamentoPublico);

  const { data, isLoading, error } = useQuery({
    queryKey: ["empresa-publica", slug],
    queryFn: () => emp({ data: { slug } }),
    retry: false,
  });

  const [f, setF] = useState({
    nome: "", telefone: "", veiculo: "", servico_id: "",
    data: todayIso(), hora: "", observacoes: "",
  });
  const [sent, setSent] = useState(false);

  const { data: slotsData } = useQuery({
    queryKey: ["slots", slug, f.data],
    queryFn: () => slots({ data: { slug, data: f.data } }),
    enabled: !!data,
  });

  const mut = useMutation({
    mutationFn: () => enviar({ data: {
      slug, nome: f.nome, telefone: f.telefone, veiculo: f.veiculo || undefined,
      servico_id: f.servico_id || null, data: f.data, hora: f.hora,
      observacoes: f.observacoes || undefined,
    } }),
    onSuccess: () => setSent(true),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível enviar"),
  });

  if (isLoading) return <div className="min-h-screen grid place-content-center">Carregando.</div>;
  if (error || !data) return <div className="min-h-screen grid place-content-center px-6 text-center text-muted-foreground">Link inválido ou empresa não encontrada.</div>;

  const { empresa, servicos } = data;

  if (sent) {
    return (
      <div className="min-h-screen bg-background grid place-content-center px-6">
        <Card className="max-w-md"><CardContent className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
          <h1 className="text-2xl font-bold">Solicitação enviada!</h1>
          <p className="text-sm text-muted-foreground">
            {empresa.nome_fantasia} recebeu seu pedido. Em breve você receberá uma confirmação.
          </p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-3 py-5 sm:px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-xl font-bold leading-tight">{empresa.nome_fantasia}</h1>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {empresa.telefone && <span className="inline-flex min-w-0 items-center gap-1 break-words"><Phone className="h-3 w-3 shrink-0" />{empresa.telefone}</span>}
                {empresa.endereco && <span className="inline-flex min-w-0 items-center gap-1 break-words"><MapPin className="h-3 w-3 shrink-0" />{empresa.endereco}</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-5 sm:px-4 sm:py-6">
        <Card><CardContent className="space-y-4 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Agende sua lavagem</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!f.nome || !f.telefone) return toast.error("Preencha nome e telefone");
            if (!f.hora) return toast.error("Escolha um horário");
            mut.mutate();
          }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Seu nome *</Label><Input required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>WhatsApp *</Label><Input required value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} placeholder="(11) 99999-9999" /></div>
            </div>
            <div className="space-y-2"><Label>Veículo</Label><Input value={f.veiculo} onChange={(e) => setF({ ...f, veiculo: e.target.value })} placeholder="Ex: Civic prata ABC-1234" /></div>
            <div className="space-y-2"><Label>Serviço</Label>
              <Select value={f.servico_id} onValueChange={(v) => setF({ ...f, servico_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha um serviço" /></SelectTrigger>
                <SelectContent>{servicos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Data *</Label><Input type="date" required min={todayIso()} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value, hora: "" })} /></div>
            <div>
              <Label>Horário *</Label>
              <div className="mt-2 grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">
                {(slotsData?.slots ?? []).length === 0 && <p className="text-xs text-muted-foreground col-span-full">Sem horários disponíveis nesta data.</p>}
                {slotsData?.slots.map((s) => (
                  <button key={s.hora} type="button" disabled={!s.disponivel}
                    onClick={() => setF({ ...f, hora: s.hora })}
                    className={`h-10 rounded-md border px-2 text-sm tabular-nums transition-colors ${
                      f.hora === s.hora ? "bg-primary text-primary-foreground border-primary"
                        : s.disponivel ? "hover:bg-accent" : "opacity-40 cursor-not-allowed line-through"
                    }`}>
                    {s.hora}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
            <Button type="submit" className="h-11 w-full" disabled={mut.isPending}>Enviar solicitação</Button>
          </form>
        </CardContent></Card>
      </main>
    </div>
  );
}
