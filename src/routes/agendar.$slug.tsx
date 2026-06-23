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
import { Badge } from "@/components/ui/badge";
import { getEmpresaPublica, getHorariosDisponiveis, solicitarAgendamentoPublico } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { CalendarDays, Car, CheckCircle2, Clock, Instagram, MapPin, Phone, Sparkles } from "lucide-react";
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
  const destaque = (servicos ?? []).slice(0, 4);
  const selectedServico = (servicos ?? []).find((s: any) => s.id === f.servico_id);

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
      <header className="border-b bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {empresa.logo_url ? (
              <img src={empresa.logo_url} alt={empresa.nome_fantasia} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
                <Car className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="break-words font-display text-xl font-bold leading-tight">{empresa.nome_fantasia}</p>
              {empresa.endereco && <p className="truncate text-xs text-muted-foreground">{empresa.endereco}</p>}
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {empresa.instagram && <Button asChild size="sm" variant="outline"><a href={`https://instagram.com/${String(empresa.instagram).replace("@", "")}`} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4" /></a></Button>}
            {(empresa.whatsapp || empresa.telefone) && <Button asChild size="sm"><a href={`https://wa.me/${String(empresa.whatsapp ?? empresa.telefone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1fr_440px] lg:py-8">
        <section className="space-y-5">
          <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-neo-sm)] sm:p-7">
            <Badge variant="secondary" className="mb-3">Agendamento online</Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{empresa.nome_fantasia}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Escolha o servico, reserve um horario disponivel e aguarde a confirmacao da equipe.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Info icon={CalendarDays} label="Agenda online" />
              <Info icon={Clock} label={empresa.horario_funcionamento ?? "Horarios flexiveis"} />
              <Info icon={Sparkles} label="Servicos automotivos" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {empresa.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{empresa.telefone}</span>}
              {empresa.endereco && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{empresa.endereco}</span>}
            </div>
          </div>

          <Card><CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Servicos em destaque</h2>
              <Badge variant="outline">{servicos.length} disponiveis</Badge>
            </div>
            {destaque.length === 0 ? (
              <p className="text-sm text-muted-foreground">Os servicos serao exibidos assim que estiverem disponiveis para agendamento online.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {destaque.map((s: any) => (
                  <button key={s.id} type="button" onClick={() => setF({ ...f, servico_id: s.id })} className="overflow-hidden rounded-lg border bg-background text-left transition-colors hover:bg-accent">
                    <ServiceImage src={s.foto_url} alt={s.nome} />
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{s.nome}</p>
                        {s.categoria && <Badge variant="outline" className="shrink-0">{s.categoria}</Badge>}
                      </div>
                      {s.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.descricao}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                        {s.preco_padrao != null && <span className="font-semibold">{brl(Number(s.preco_padrao))}</span>}
                        {s.tempo_estimado_min != null && <span className="text-xs text-muted-foreground">{s.tempo_estimado_min} min</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent></Card>
        </section>

        <section className="lg:sticky lg:top-5 lg:self-start">
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
                <SelectContent>{servicos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome} - {brl(Number(s.preco_padrao ?? 0))}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedServico && (
              <div className="overflow-hidden rounded-xl border bg-background">
                <ServiceImage src={selectedServico.foto_url} alt={selectedServico.nome} compact />
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{selectedServico.nome}</p>
                      {selectedServico.categoria && <p className="text-xs text-muted-foreground">{selectedServico.categoria}</p>}
                    </div>
                    <p className="font-semibold">{brl(Number(selectedServico.preco_padrao ?? 0))}</p>
                  </div>
                  {selectedServico.descricao && <p className="text-sm text-muted-foreground">{selectedServico.descricao}</p>}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {selectedServico.tempo_estimado_min != null && <span>{selectedServico.tempo_estimado_min} min</span>}
                    {selectedServico.pontos_gerados > 0 && <span>{selectedServico.pontos_gerados} pontos</span>}
                  </div>
                </div>
              </div>
            )}
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
        </section>
      </main>
    </div>
  );
}

function Info({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <Icon className="h-4 w-4 text-primary" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function ServiceImage({ src, alt, compact = false }: { src?: string | null; alt: string; compact?: boolean }) {
  const height = compact ? "h-24" : "h-28";
  if (src) {
    return <img src={src} alt={alt} className={`${height} w-full object-cover`} loading="lazy" />;
  }
  return (
    <div className={`${height} grid place-content-center bg-muted/60 text-muted-foreground`}>
      <Car className="h-7 w-7" />
    </div>
  );
}
