import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { brl, dateBr } from "@/lib/format";
import { getClientePublico, getEmpresaPublica, getHorariosDisponiveis, solicitarAgendamentoPublico } from "@/lib/lavaflow.functions";
import {
  ArrowRight,
  Award,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Gift,
  HeartHandshake,
  Instagram,
  MessageCircle,
  Phone,
  Share2,
  Sparkles,
  Star,
  Timer,
  Trophy,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agendar/$slug")({
  component: Page,
  head: ({ params }) => ({
    meta: [
      { title: `Agendar lavagem - ${params.slug}` },
      { name: "description", content: "Reserve seu horario online e acompanhe recompensas, historico e campanhas." },
      { property: "og:title", content: "Agendar lavagem" },
      { property: "og:description", content: "Reserve seu horario online e acompanhe recompensas, historico e campanhas." },
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

type Recompensa = {
  id: string;
  nome: string;
  custo_pontos: number;
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  procurados: { label: "Mais Procurados", icon: "Star" },
  promocoes: { label: "Promocoes da Semana", icon: "Fire" },
  estetica: { label: "Estetica Premium", icon: "Sparkles" },
  lavagem: { label: "Lavagens", icon: "Car" },
  protecao: { label: "Protecao", icon: "Shield" },
  higienizacao: { label: "Higienizacao", icon: "Soap" },
  polimento: { label: "Polimentos", icon: "Palette" },
  outros: { label: "Outros servicos", icon: "Plus" },
};

const DEFAULT_SERVICE_IMAGES = [
  "https://images.unsplash.com/photo-1605618313023-d0f1889126f7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=900&q=80",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCategory(value?: string | null) {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("promo")) return "promocoes";
  if (raw.includes("estet")) return "estetica";
  if (raw.includes("lav")) return "lavagem";
  if (raw.includes("prote")) return "protecao";
  if (raw.includes("higien")) return "higienizacao";
  if (raw.includes("pol")) return "polimento";
  return raw ? "outros" : "procurados";
}

function serviceImage(servico: Servico, index = 0) {
  return servico.foto_url || DEFAULT_SERVICE_IMAGES[index % DEFAULT_SERVICE_IMAGES.length];
}

function rewardImage(index = 0) {
  return DEFAULT_SERVICE_IMAGES[(index + 1) % DEFAULT_SERVICE_IMAGES.length];
}

function phoneHref(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : undefined;
}

function Page() {
  const { slug } = Route.useParams();
  const emp = useServerFn(getEmpresaPublica);
  const slots = useServerFn(getHorariosDisponiveis);
  const enviar = useServerFn(solicitarAgendamentoPublico);
  const clientePublico = useServerFn(getClientePublico);

  const { data, isLoading, error } = useQuery({
    queryKey: ["empresa-publica", slug],
    queryFn: () => emp({ data: { slug } }),
    retry: false,
  });

  const [f, setF] = useState({
    nome: "",
    telefone: "",
    veiculo: "",
    servico_id: "",
    data: todayIso(),
    hora: "",
    observacoes: "",
  });
  const [sent, setSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState("procurados");
  const [portalPhone, setPortalPhone] = useState("");
  const [clienteLookupPhone, setClienteLookupPhone] = useState("");

  const { data: slotsData } = useQuery({
    queryKey: ["slots", slug, f.data],
    queryFn: () => slots({ data: { slug, data: f.data } }),
    enabled: !!data,
  });

  const { data: clienteData, isFetching: loadingCliente } = useQuery({
    queryKey: ["cliente-publico", slug, clienteLookupPhone],
    queryFn: () => clientePublico({ data: { slug, telefone: clienteLookupPhone } }),
    enabled: clienteLookupPhone.replace(/\D/g, "").length >= 8,
  });

  const mut = useMutation({
    mutationFn: () => enviar({
      data: {
        slug,
        nome: f.nome,
        telefone: f.telefone,
        veiculo: f.veiculo || undefined,
        servico_id: f.servico_id || null,
        data: f.data,
        hora: f.hora,
        observacoes: f.observacoes || undefined,
      },
    }),
    onSuccess: () => {
      setSent(true);
      setClienteLookupPhone(f.telefone);
    },
    onError: (e: any) => toast.error(e?.message ?? "Nao foi possivel enviar"),
  });

  const servicos = (data?.servicos ?? []) as Servico[];
  const recompensas = (data?.recompensas ?? []) as Recompensa[];
  const empresa: any = data?.empresa;

  const selectedServico = servicos.find((s) => s.id === f.servico_id);
  const categories = useMemo(() => buildCategories(servicos), [servicos]);
  const shownCategory = categories.find((c) => c.id === activeCategory) ?? categories[0];
  const upsells = useMemo(() => buildUpsells(servicos, selectedServico), [servicos, selectedServico]);
  const saldo = Number(clienteData?.cliente?.pontos_saldo ?? 0);
  const proximaRecompensa = recompensas.find((r) => r.custo_pontos > saldo) ?? recompensas[0];
  const faltamPontos = proximaRecompensa ? Math.max(0, proximaRecompensa.custo_pontos - saldo) : 0;
  const progress = proximaRecompensa ? Math.min(100, Math.round((saldo / proximaRecompensa.custo_pontos) * 100)) : 0;

  if (isLoading) return <div className="min-h-screen grid place-content-center bg-background">Carregando.</div>;
  if (error || !data || !empresa) {
    return <div className="min-h-screen grid place-content-center px-6 text-center text-muted-foreground">Link invalido ou empresa nao encontrada.</div>;
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h1 className="mt-4 font-display text-3xl font-bold">Agendamento solicitado</h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
                Obrigado por escolher {empresa.nome_fantasia}. A equipe recebeu seu pedido e vai confirmar o horario.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <Button variant="outline" onClick={() => document.getElementById("recompensas")?.scrollIntoView({ behavior: "smooth" })}>
                  <Gift className="mr-2 h-4 w-4" />Ver recompensas
                </Button>
                <Button variant="outline" onClick={() => document.getElementById("servicos")?.scrollIntoView({ behavior: "smooth" })}>
                  <Sparkles className="mr-2 h-4 w-4" />Conhecer servicos
                </Button>
                <Button onClick={() => setSent(false)}>
                  <CalendarDays className="mr-2 h-4 w-4" />Novo horario
                </Button>
              </div>
            </CardContent>
          </Card>
          <PremiumPageBody
            empresa={empresa}
            servicos={servicos}
            recompensas={recompensas}
            categories={categories}
            shownCategory={shownCategory}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            selectedServico={selectedServico}
            selectServico={(id) => setF((cur) => ({ ...cur, servico_id: id }))}
            upsells={upsells}
            clienteData={clienteData}
            loadingCliente={loadingCliente}
            saldo={saldo}
            faltamPontos={faltamPontos}
            progress={progress}
            proximaRecompensa={proximaRecompensa}
            portalPhone={portalPhone}
            setPortalPhone={setPortalPhone}
            consultarCliente={() => setClienteLookupPhone(portalPhone)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header empresa={empresa} />

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:py-8">
        <section className="space-y-5">
          <Hero empresa={empresa} servicos={servicos} />
          <PremiumPageBody
            empresa={empresa}
            servicos={servicos}
            recompensas={recompensas}
            categories={categories}
            shownCategory={shownCategory}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            selectedServico={selectedServico}
            selectServico={(id) => setF((cur) => ({ ...cur, servico_id: id }))}
            upsells={upsells}
            clienteData={clienteData}
            loadingCliente={loadingCliente}
            saldo={saldo}
            faltamPontos={faltamPontos}
            progress={progress}
            proximaRecompensa={proximaRecompensa}
            portalPhone={portalPhone}
            setPortalPhone={setPortalPhone}
            consultarCliente={() => setClienteLookupPhone(portalPhone)}
          />
        </section>

        <section className="lg:sticky lg:top-5 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <Badge variant="secondary">Reserva inteligente</Badge>
                <h2 className="mt-2 text-lg font-semibold">Agende seu atendimento</h2>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!f.nome || !f.telefone) return toast.error("Preencha nome e telefone");
                  if (!f.hora) return toast.error("Escolha um horario");
                  mut.mutate();
                }}
                className="space-y-4"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="Seu nome *">
                    <Input required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
                  </Field>
                  <Field label="WhatsApp *">
                    <Input required value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                  </Field>
                </div>
                <Field label="Veiculo">
                  <Input value={f.veiculo} onChange={(e) => setF({ ...f, veiculo: e.target.value })} placeholder="Ex: Civic prata ABC-1234" />
                </Field>
                <Field label="Servico">
                  <Select value={f.servico_id} onValueChange={(v) => setF({ ...f, servico_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolha um servico" /></SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome} - {brl(Number(s.preco_padrao ?? 0))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {selectedServico && <SelectedService servico={selectedServico} />}
                {upsells.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm font-semibold">Adicione ao seu servico</p>
                    <div className="mt-2 space-y-2">
                      {upsells.map((s) => (
                        <button key={s.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-accent">
                          <span>{s.nome}</span>
                          <span className="shrink-0 font-semibold">+{brl(Number(s.preco_padrao ?? 0))}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Field label="Data *">
                  <Input type="date" required min={todayIso()} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value, hora: "" })} />
                </Field>
                <div>
                  <Label>Horario *</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5">
                    {(slotsData?.slots ?? []).length === 0 && <p className="col-span-full text-xs text-muted-foreground">Sem horarios disponiveis nesta data.</p>}
                    {slotsData?.slots.map((slot: any) => (
                      <button
                        key={slot.hora}
                        type="button"
                        disabled={!slot.disponivel}
                        onClick={() => setF({ ...f, hora: slot.hora })}
                        className={`h-10 rounded-md border px-2 text-sm tabular-nums transition-colors ${
                          f.hora === slot.hora
                            ? "border-primary bg-primary text-primary-foreground"
                            : slot.disponivel
                              ? "hover:bg-accent"
                              : "cursor-not-allowed opacity-40 line-through"
                        }`}
                      >
                        {slot.hora}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Observacoes">
                  <Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
                </Field>
                <Button type="submit" className="h-11 w-full" disabled={mut.isPending}>
                  Enviar solicitacao
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Header({ empresa }: { empresa: any }) {
  const whats = phoneHref(empresa.whatsapp ?? empresa.telefone);
  return (
    <header className="border-b bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {empresa.logo_url ? (
            <img src={empresa.logo_url} alt={empresa.nome_fantasia} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-content-center rounded-lg bg-primary">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="break-words font-display text-xl font-bold leading-tight">{empresa.nome_fantasia}</p>
            {empresa.endereco && <p className="truncate text-xs text-muted-foreground">{empresa.endereco}</p>}
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {empresa.instagram && (
            <Button asChild size="icon" variant="outline" title="Instagram">
              <a href={`https://instagram.com/${String(empresa.instagram).replace("@", "")}`} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4" /></a>
            </Button>
          )}
          {whats && (
            <Button asChild size="sm">
              <a href={whats} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ empresa, servicos }: { empresa: any; servicos: Servico[] }) {
  const featured = servicos[0];
  const image = featured ? serviceImage(featured, 0) : DEFAULT_SERVICE_IMAGES[0];
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="relative min-h-[360px]">
        <img src={image} alt={empresa.nome_fantasia} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        <div className="relative flex min-h-[360px] flex-col justify-between p-5 text-white sm:p-8">
          <div className="max-w-2xl">
            <Badge className="bg-white/15 text-white hover:bg-white/20">Agendamento online premium</Badge>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">{empresa.nome_fantasia}</h1>
            <p className="mt-3 max-w-xl text-sm text-white/80">
              Escolha servicos, acompanhe seus pontos, veja recompensas e reserve seu atendimento em poucos cliques.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat icon={Star} label="4,9 avaliacao" />
            <HeroStat icon={Clock} label={empresa.horario_funcionamento ?? "Horario flexivel"} />
            <HeroStat icon={Timer} label={`${averageMinutes(servicos)} min em media`} />
            <HeroStat icon={Award} label="Programa de pontos" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PremiumPageBody(props: {
  empresa: any;
  servicos: Servico[];
  recompensas: Recompensa[];
  categories: Array<{ id: string; label: string; icon: string; servicos: Servico[] }>;
  shownCategory: { id: string; label: string; icon: string; servicos: Servico[] };
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  selectedServico?: Servico;
  selectServico: (id: string) => void;
  upsells: Servico[];
  clienteData: any;
  loadingCliente: boolean;
  saldo: number;
  faltamPontos: number;
  progress: number;
  proximaRecompensa?: Recompensa;
  portalPhone: string;
  setPortalPhone: (value: string) => void;
  consultarCliente: () => void;
}) {
  return (
    <>
      <ServiceShowcase {...props} />
      <LoyaltySection {...props} />
      <RewardsCatalog recompensas={props.recompensas} />
      <ClientPortal {...props} />
      <CampaignPreview empresa={props.empresa} saldo={props.saldo} />
    </>
  );
}

function ServiceShowcase({
  categories,
  shownCategory,
  activeCategory,
  setActiveCategory,
  selectServico,
}: {
  categories: Array<{ id: string; label: string; icon: string; servicos: Servico[] }>;
  shownCategory: { id: string; label: string; icon: string; servicos: Servico[] };
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  selectServico: (id: string) => void;
}) {
  return (
    <section id="servicos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Vitrine de servicos</h2>
          <p className="text-sm text-muted-foreground">Servicos organizados para descobrir novas formas de cuidar do veiculo.</p>
        </div>
        <Badge variant="outline">{shownCategory.servicos.length} opcoes</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`h-10 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors ${
              activeCategory === cat.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
            }`}
          >
            {iconGlyph(cat.icon)} {cat.label}
          </button>
        ))}
      </div>
      {shownCategory.servicos.length === 0 ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">Os servicos serao exibidos assim que estiverem disponiveis para agendamento online.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownCategory.servicos.map((s, index) => (
            <button key={s.id} type="button" onClick={() => selectServico(s.id)} className="overflow-hidden rounded-lg border bg-card text-left transition-colors hover:bg-accent">
              <img src={serviceImage(s, index)} alt={s.nome} className="h-36 w-full object-cover" loading="lazy" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{s.nome}</p>
                    {s.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.descricao}</p>}
                  </div>
                  {s.categoria && <Badge variant="outline" className="shrink-0">{s.categoria}</Badge>}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{brl(Number(s.preco_padrao ?? 0))}</span>
                  <span className="text-xs text-muted-foreground">{s.tempo_estimado_min ?? 30} min</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function LoyaltySection({
  clienteData,
  loadingCliente,
  saldo,
  faltamPontos,
  progress,
  proximaRecompensa,
}: {
  clienteData: any;
  loadingCliente: boolean;
  saldo: number;
  faltamPontos: number;
  progress: number;
  proximaRecompensa?: Recompensa;
}) {
  const hasClient = !!clienteData?.cliente;
  return (
    <section className="grid gap-3 md:grid-cols-[1fr_1fr]">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Programa de fidelidade</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{hasClient ? `${saldo} pontos` : "Acumule pontos"}</h2>
            </div>
            <div className="grid h-11 w-11 place-content-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Progress value={hasClient ? progress : 35} />
            <p className="text-sm text-muted-foreground">
              {hasClient && proximaRecompensa
                ? faltamPontos > 0
                  ? `Faltam ${faltamPontos} pontos para resgatar ${proximaRecompensa.nome}.`
                  : `Voce ja pode resgatar ${proximaRecompensa.nome}.`
                : loadingCliente
                  ? "Consultando seu saldo..."
                  : "Informe seu WhatsApp em Meu LavaFlow para ver saldo, historico e premios."}
            </p>
          </div>
          <Button className="mt-4" variant="outline" onClick={() => document.getElementById("recompensas")?.scrollIntoView({ behavior: "smooth" })}>
            <Gift className="mr-2 h-4 w-4" />Ver catalogo de recompensas
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Mensagens inteligentes</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Avisos de veiculo pronto, campanhas e pontos podem levar o cliente direto para status, recompensas, avaliacao e novo agendamento.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <SmartLink icon={Car} label="Acompanhar status" />
            <SmartLink icon={Award} label="Ver pontos acumulados" />
            <SmartLink icon={Star} label="Avaliar atendimento" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RewardsCatalog({ recompensas }: { recompensas: Recompensa[] }) {
  const rewards = recompensas.length ? recompensas : [
    { id: "demo-1", nome: "Lavagem Simples", custo_pontos: 800 },
    { id: "demo-2", nome: "Higienizacao", custo_pontos: 1200 },
    { id: "demo-3", nome: "Cera Premium", custo_pontos: 1800 },
  ];
  return (
    <section id="recompensas" className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">Catalogo de recompensas</h2>
        <p className="text-sm text-muted-foreground">Premios disponiveis para transformar recorrencia em beneficios visiveis.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {rewards.map((r, index) => (
          <Card key={r.id} className="overflow-hidden">
            <img src={rewardImage(index)} alt={r.nome} className="h-28 w-full object-cover" loading="lazy" />
            <CardContent className="p-4">
              <p className="font-semibold">{r.nome}</p>
              <p className="mt-1 text-sm text-primary">{r.custo_pontos} pontos</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ClientPortal({
  clienteData,
  loadingCliente,
  portalPhone,
  setPortalPhone,
  consultarCliente,
}: {
  clienteData: any;
  loadingCliente: boolean;
  portalPhone: string;
  setPortalPhone: (value: string) => void;
  consultarCliente: () => void;
}) {
  const cliente = clienteData?.cliente;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">Meu LavaFlow</h2>
        <p className="text-sm text-muted-foreground">Area publica do cliente com agenda, historico, pontos, veiculos, campanhas e indicacoes.</p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={portalPhone} onChange={(e) => setPortalPhone(e.target.value)} placeholder="Digite seu WhatsApp" />
            <Button type="button" onClick={consultarCliente} disabled={loadingCliente}>
              <Phone className="mr-2 h-4 w-4" />Acessar
            </Button>
          </div>
          {cliente ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Servicos" value={cliente.total_servicos ?? 0} />
                <MiniStat label="Economizou" value={brl(Number(cliente.economia_estimada ?? 0))} />
                <MiniStat label="Pontos" value={cliente.pontos_saldo ?? 0} />
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <HistoryList title="Proximos agendamentos" rows={(clienteData.agendamentos ?? []).map((a: any) => `${dateBr(a.data_agendada)} ${String(a.hora_agendada).slice(0, 5)} - ${a.servicos?.nome ?? a.status}`)} />
                <HistoryList title="Ultimos servicos" rows={(clienteData.historico ?? []).map((h: any) => `${h.servicos?.nome ?? "Servico"} - ${brl(Number(h.valor ?? 0))}`)} />
                <HistoryList title="Ultimos veiculos" rows={(clienteData.veiculos ?? []).map((v: any) => `${v.placa} ${[v.marca, v.modelo].filter(Boolean).join(" ")}`)} />
                <HistoryList title="Ultimos resgates" rows={(clienteData.resgates ?? []).map((r: any) => `${r.pontos} pontos - ${dateBr(r.criado_em)}`)} empty="Nenhum resgate recente." />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline"><Share2 className="mr-2 h-4 w-4" />Indique um amigo</Button>
                <Button variant="outline"><HeartHandshake className="mr-2 h-4 w-4" />Favoritos</Button>
                <Button variant="outline"><Star className="mr-2 h-4 w-4" />Avaliar atendimento</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniFeature icon={CalendarDays} label="Agendamentos" />
              <MiniFeature icon={WalletCards} label="Pagamentos" />
              <MiniFeature icon={Award} label="Pontos" />
              <MiniFeature icon={Gift} label="Recompensas" />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function CampaignPreview({ empresa, saldo }: { empresa: any; saldo: number }) {
  return (
    <section>
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Badge variant="secondary">Campanhas e links inteligentes</Badge>
            <h2 className="mt-2 font-display text-2xl font-bold">Volte no momento certo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Exemplo: esta semana temos ofertas em higienizacao premium. Voce possui {saldo || 560} pontos acumulados para usar no catalogo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button variant="outline"><Gift className="mr-2 h-4 w-4" />Ver catalogo</Button>
            {phoneHref(empresa.whatsapp ?? empresa.telefone) && (
              <Button asChild>
                <a href={phoneHref(empresa.whatsapp ?? empresa.telefone)} target="_blank" rel="noreferrer">Agendar agora</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function SelectedService({ servico }: { servico: Servico }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <img src={serviceImage(servico)} alt={servico.nome} className="h-24 w-full object-cover" loading="lazy" />
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{servico.nome}</p>
            {servico.categoria && <p className="text-xs text-muted-foreground">{servico.categoria}</p>}
          </div>
          <p className="font-semibold">{brl(Number(servico.preco_padrao ?? 0))}</p>
        </div>
        {servico.descricao && <p className="text-sm text-muted-foreground">{servico.descricao}</p>}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {servico.tempo_estimado_min != null && <span>{servico.tempo_estimado_min} min</span>}
          {Number(servico.pontos_gerados ?? 0) > 0 && <span>{servico.pontos_gerados} pontos</span>}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm backdrop-blur">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="break-words">{label}</span>
    </div>
  );
}

function SmartLink({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
      <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-display text-xl font-bold">{value}</p>
    </div>
  );
}

function MiniFeature({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm">
      <Icon className="h-4 w-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}

function HistoryList({ title, rows, empty = "Nada encontrado ainda." }: { title: string; rows: string[]; empty?: string }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <div className="mt-2 space-y-2">
        {rows.length ? rows.map((row, index) => (
          <div key={`${title}-${index}`} className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">{row}</div>
        )) : <p className="text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}

function buildCategories(servicos: Servico[]) {
  const map = new Map<string, Servico[]>();
  map.set("procurados", servicos.slice(0, 6));
  servicos.forEach((servico) => {
    const key = normalizeCategory(servico.categoria ?? servico.nome);
    map.set(key, [...(map.get(key) ?? []), servico]);
  });
  return Array.from(map.entries())
    .filter(([, items]) => items.length > 0)
    .map(([id, items]) => ({
      id,
      label: CATEGORY_LABELS[id]?.label ?? "Servicos",
      icon: CATEGORY_LABELS[id]?.icon ?? "Sparkles",
      servicos: items,
    }));
}

function buildUpsells(servicos: Servico[], selected?: Servico) {
  if (!selected) return [];
  const selectedKey = normalizeCategory(`${selected.categoria ?? ""} ${selected.nome}`);
  const preferred = servicos.filter((s) => s.id !== selected.id && normalizeCategory(`${s.categoria ?? ""} ${s.nome}`) !== selectedKey);
  const premium = preferred.filter((s) => Number(s.preco_padrao ?? 0) >= Number(selected.preco_padrao ?? 0) * 0.35);
  return (premium.length ? premium : preferred).slice(0, 3);
}

function averageMinutes(servicos: Servico[]) {
  const values = servicos.map((s) => Number(s.tempo_estimado_min ?? 0)).filter((v) => v > 0);
  if (!values.length) return 45;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function iconGlyph(icon: string) {
  const map: Record<string, string> = {
    Star: "⭐",
    Fire: "🔥",
    Sparkles: "✨",
    Car: "🚗",
    Shield: "🛡",
    Soap: "🧼",
    Palette: "🎨",
    Plus: "＋",
  };
  return map[icon] ?? "✨";
}
