import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { BookingStepper } from "@/components/booking-stepper";
import { ServiceCard } from "@/components/service-card";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { brl, dateBr } from "@/lib/format";
import { getEmpresaPublica, getHorariosDisponiveis, solicitarAgendamentoPublico } from "@/lib/lavaflow.functions";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agendar/$slug")({
  component: Page,
  head: ({ params }) => ({
    meta: [
      { title: `Agendar lavagem - ${params.slug}` },
      { name: "description", content: "Reserve seu horário online em menos de um minuto." },
      { property: "og:title", content: "Agendar lavagem" },
      { property: "og:description", content: "Reserve seu horário online em menos de um minuto." },
    ],
  }),
});

type Servico = {
  id: string;
  nome: string;
  preco_padrao?: number | null;
  descricao?: string | null;
  tempo_estimado_min?: number | null;
  categoria?: string | null;
  foto_url?: string | null;
  pontos_gerados?: number | null;
};

function todayIsoSP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function dateToIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function phoneHref(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : undefined;
}

const STEPS = [
  { key: "servico", label: "Serviço" },
  { key: "data", label: "Data" },
  { key: "hora", label: "Horário" },
  { key: "confirmar", label: "Confirmar" },
];

function Page() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const emp = useServerFn(getEmpresaPublica);
  const slotsFn = useServerFn(getHorariosDisponiveis);
  const enviar = useServerFn(solicitarAgendamentoPublico);

  const { data, isLoading, error } = useQuery({
    queryKey: ["empresa-publica", slug],
    queryFn: () => emp({ data: { slug } }),
    retry: false,
  });

  const [step, setStep] = useState(0);
  const [servicoId, setServicoId] = useState("");
  const [dataSel, setDataSel] = useState<string>(todayIsoSP());
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [obs, setObs] = useState("");
  const [sent, setSent] = useState(false);

  const tz = "America/Sao_Paulo";
  const { data: slotsData, isFetching: loadingSlots } = useQuery({
    queryKey: ["slots", slug, dataSel],
    queryFn: () => slotsFn({ data: { slug, data: dataSel, tz } }),
    enabled: !!data && step >= 2,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const servicos = ((data?.servicos ?? []) as Servico[]);
  const empresa: any = data?.empresa;
  const selectedServico = servicos.find((s) => s.id === servicoId);

  const diasSemana = (data?.config?.dias_semana as number[] | undefined) ?? [1, 2, 3, 4, 5, 6];

  const mut = useMutation({
    mutationFn: () =>
      enviar({
        data: {
          slug,
          nome,
          telefone,
          veiculo: veiculo || undefined,
          servico_id: servicoId || null,
          data: dataSel,
          hora,
          observacoes: obs || undefined,
        },
      }),
    onSuccess: () => {
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["slots", slug] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível enviar"),
  });

  const canNext = useMemo(() => {
    if (step === 0) return !!servicoId;
    if (step === 1) return !!dataSel;
    if (step === 2) return !!hora;
    if (step === 3) return nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 8;
    return false;
  }, [step, servicoId, dataSel, hora, nome, telefone]);

  if (isLoading) {
    return <div className="grid min-h-dvh place-content-center bg-background text-sm text-muted-foreground">Carregando…</div>;
  }
  if (error || !data || !empresa) {
    return <div className="grid min-h-dvh place-content-center px-6 text-center text-muted-foreground">Link inválido ou empresa não encontrada.</div>;
  }

  if (sent) {
    return <SentScreen empresa={empresa} servico={selectedServico} dataSel={dataSel} hora={hora} onReset={() => { setSent(false); setStep(0); setServicoId(""); setHora(""); }} />;
  }

  return (
    <div className="min-h-dvh bg-background pb-32">
      <Header empresa={empresa} />

      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5">
        <Hero empresa={empresa} />

        <BookingStepper steps={STEPS} currentIndex={step} />

        <section className="animate-fade-in" key={`step-${step}`}>
          {step === 0 && (
            <ServicosStep
              servicos={servicos}
              selectedId={servicoId}
              onSelect={(id) => { setServicoId(id); setStep(1); }}
            />
          )}
          {step === 1 && (
            <DataStep
              value={dataSel}
              onChange={(d) => { setDataSel(d); setHora(""); setStep(2); }}
              diasSemana={diasSemana}
            />
          )}
          {step === 2 && (
            <HoraStep
              dataSel={dataSel}
              slots={slotsData?.slots ?? []}
              hora={hora}
              onChange={setHora}
              loading={loadingSlots}
              duracaoMin={selectedServico?.tempo_estimado_min}
            />
          )}
          {step === 3 && (
            <ConfirmarStep
              servico={selectedServico}
              dataSel={dataSel}
              hora={hora}
              nome={nome} setNome={setNome}
              telefone={telefone} setTelefone={setTelefone}
              veiculo={veiculo} setVeiculo={setVeiculo}
              obs={obs} setObs={setObs}
            />
          )}
        </section>
      </main>

      {/* Sticky bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {step > 0 ? (
            <Button variant="outline" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <SummaryPill servico={selectedServico} dataSel={dataSel} hora={hora} />
          {step < 3 ? (
            <Button size="lg" disabled={!canNext} onClick={() => setStep((s) => Math.min(3, s + 1))} className="ml-auto">
              Continuar <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" disabled={!canNext || mut.isPending} onClick={() => mut.mutate()} className="ml-auto">
              {mut.isPending ? "Enviando…" : "Confirmar"}
              <CheckCircle2 className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ empresa }: { empresa: any }) {
  const whats = phoneHref(empresa.whatsapp ?? empresa.telefone);
  return (
    <header className="border-b bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {empresa.logo_url ? (
            <img src={empresa.logo_url} alt={empresa.nome_fantasia} className="h-10 w-10 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-10 w-10 shrink-0 place-content-center rounded-2xl bg-primary">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <p className="truncate font-display text-base font-bold">{empresa.nome_fantasia}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {empresa.instagram && (
            <Button asChild size="icon" variant="ghost" aria-label="Instagram">
              <a href={`https://instagram.com/${String(empresa.instagram).replace("@", "")}`} target="_blank" rel="noreferrer">
                <Instagram className="h-4 w-4" />
              </a>
            </Button>
          )}
          {whats && (
            <Button asChild size="icon" variant="ghost" aria-label="WhatsApp">
              <a href={whats} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ empresa }: { empresa: any }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4 sm:p-5">
        {empresa.logo_url ? (
          <img src={empresa.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-neo-sm)]" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-content-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-neo-sm)]">
            <Sparkles className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">{empresa.nome_fantasia}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden /> 4,9</span>
            {empresa.endereco && (
              <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{empresa.endereco}</span></span>
            )}
            {empresa.horario_funcionamento && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{empresa.horario_funcionamento}</span>
            )}
          </div>
          <Badge variant="secondary" className="mt-1">Agende em menos de 1 minuto</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ServicosStep({ servicos, selectedId, onSelect }: { servicos: Servico[]; selectedId: string; onSelect: (id: string) => void }) {
  if (!servicos.length) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum serviço disponível para agendamento online ainda.</CardContent></Card>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold">Escolha o serviço</h2>
        <p className="text-xs text-muted-foreground">Toque em um cartão para selecionar.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 list-stagger" style={{ ["--stagger" as any]: "60ms" }}>
        {servicos.map((s, i) => (
          <div key={s.id} style={{ ["--i" as any]: i }}>
            <ServiceCard
              nome={s.nome}
              preco={Number(s.preco_padrao ?? 0)}
              categoria={s.categoria}
              tempoMin={s.tempo_estimado_min}
              fotoUrl={s.foto_url}
              descricao={s.descricao}
              selected={selectedId === s.id}
              onClick={() => onSelect(s.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DataStep({ value, onChange, diasSemana }: { value: string; onChange: (d: string) => void; diasSemana: number[] }) {
  const selectedDate = useMemo(() => {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [value]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold">Escolha a data</h2>
        <p className="text-xs text-muted-foreground">Apenas dias com atendimento são selecionáveis.</p>
      </div>
      <Card>
        <CardContent className="grid place-content-center p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && onChange(dateToIso(d))}
            disabled={(d) => d < today || !diasSemana.includes(d.getDay())}
            className="pointer-events-auto"
            locale={undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HoraStep({ dataSel, slots, hora, onChange, loading, duracaoMin }: { dataSel: string; slots: { hora: string; disponivel: boolean }[]; hora: string; onChange: (h: string) => void; loading: boolean; duracaoMin?: number | null }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold">Escolha o horário</h2>
        <p className="text-xs text-muted-foreground">{dateBr(dataSel)} — toque no horário desejado.</p>
      </div>
      <TimeSlotPicker slots={slots} value={hora} onChange={onChange} loading={loading} duracaoMin={duracaoMin} />
    </div>
  );
}

function ConfirmarStep({
  servico, dataSel, hora,
  nome, setNome, telefone, setTelefone, veiculo, setVeiculo, obs, setObs,
}: any) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold">Seus dados</h2>
        <p className="text-xs text-muted-foreground">Vamos confirmar com você pelo WhatsApp.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <SummaryRow label="Serviço" value={servico?.nome ?? "—"} />
          <SummaryRow label="Data" value={dateBr(dataSel)} />
          <SummaryRow label="Horário" value={hora || "—"} />
          {servico?.tempo_estimado_min ? <SummaryRow label="Duração" value={`${servico.tempo_estimado_min} min`} /> : null}
          <SummaryRow label="Valor" value={brl(Number(servico?.preco_padrao ?? 0))} bold />
          {Number(servico?.pontos_gerados ?? 0) > 0 && (
            <SummaryRow label="Pontos" value={`+${servico.pontos_gerados}`} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Field label="Seu nome">
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" />
        </Field>
        <Field label="WhatsApp">
          <Input required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
        </Field>
        <Field label="Veículo (opcional)">
          <Input value={veiculo} onChange={(e) => setVeiculo(e.target.value)} placeholder="Ex.: Civic prata ABC-1234" />
        </Field>
        <Field label="Observações (opcional)">
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right tabular-nums", bold && "font-display text-base font-bold text-primary")}>{value}</span>
    </div>
  );
}

function SummaryPill({ servico, dataSel, hora }: { servico?: Servico; dataSel: string; hora: string }) {
  if (!servico) {
    return <div className="min-w-0 flex-1 text-xs text-muted-foreground">Comece escolhendo um serviço</div>;
  }
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-semibold">{servico.nome}</p>
      <p className="truncate text-[11px] text-muted-foreground tabular-nums">
        {dateBr(dataSel)}{hora ? ` · ${hora}` : ""} · {brl(Number(servico.preco_padrao ?? 0))}
      </p>
    </div>
  );
}

function SentScreen({ empresa, servico, dataSel, hora, onReset }: { empresa: any; servico?: Servico; dataSel: string; hora: string; onReset: () => void }) {
  const whats = phoneHref(empresa.whatsapp ?? empresa.telefone);
  return (
    <div className="grid min-h-dvh place-content-center bg-background px-4">
      <Card className="mx-auto w-full max-w-md animate-scale-in">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-content-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Tudo certo!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {empresa.nome_fantasia} recebeu seu pedido e vai confirmar pelo WhatsApp.
            </p>
          </div>
          {servico && (
            <div className="rounded-2xl border bg-muted/40 p-3 text-left text-sm">
              <p className="font-semibold">{servico.nome}</p>
              <p className="text-xs text-muted-foreground">{dateBr(dataSel)} às {hora} · {brl(Number(servico.preco_padrao ?? 0))}</p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {whats && (
              <Button asChild>
                <a href={whats} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Falar no WhatsApp</a>
              </Button>
            )}
            <Button variant="outline" onClick={onReset}>Novo agendamento</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
