import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PageHeader } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getMissaoDoDia, getSaudeNegocio } from "@/lib/lavaflow.functions";
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, Loader2, MessageCircle, RefreshCw, Send, Sparkles, Target, User } from "lucide-react";
import { toast } from "sonner";

const Markdown = lazy(() => import("@/components/markdown-message"));

export const Route = createFileRoute("/_authenticated/assistente")({
  component: Page,
});

const SUGESTOES = [
  "Como aumentar meu faturamento esta semana?",
  "Quais clientes devo chamar hoje?",
  "Quem pode assinar um plano mensal?",
  "Qual servico devo divulgar?",
  "O que devo fazer para bater minha meta?",
];

type ConsultorOpportunity = {
  id: string;
  priority: "alta" | "media" | "baixa";
  category: string;
  title: string;
  description: string;
  estimatedImpact: number;
  whyItMatters: string;
  recommendedAction: string;
  actionType: string;
  ctaLabel: string;
  whatsappMessage: string | null;
};

type ConsultorData = {
  summary: string;
  healthScore: number;
  fallbackNotice?: string;
  diagnosis: {
    status: string;
    strengths: string[];
    risks: string[];
  };
  topOpportunities: ConsultorOpportunity[];
  weeklyActionPlan: Array<{ day: string; action: string; expectedResult: string }>;
  suggestedCampaigns: Array<{ name: string; audience: string; message: string; estimatedImpact: number }>;
  questionsToAskOwner: string[];
};

function fmtBrl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function priorityVariant(priority: ConsultorOpportunity["priority"]) {
  if (priority === "alta") return "destructive";
  if (priority === "media") return "default";
  return "secondary";
}

function Page() {
  const fetchMissao = useServerFn(getMissaoDoDia);
  const fetchSaude = useServerFn(getSaudeNegocio);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [consultor, setConsultor] = useState<ConsultorData | null>(null);
  const [loadingConsultor, setLoadingConsultor] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadConsultor() {
    const { data } = await supabase.auth.getSession();
    const freshToken = data.session?.access_token;
    if (!freshToken) return;

    setLoadingConsultor(true);
    try {
      const response = await fetch("/api/assistente-chat?period=30d", {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Erro ao carregar consultor");
      setConsultor(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar consultor");
    } finally {
      setLoadingConsultor(false);
    }
  }

  useEffect(() => {
    if (token) void loadConsultor();
  }, [token]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistente-chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const freshToken = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (freshToken) headers.Authorization = `Bearer ${freshToken}`;
          return headers;
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Erro no assistente"),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!isBusy) inputRef.current?.focus();
  }, [isBusy]);

  function handleSend(text: string) {
    if (!text.trim() || isBusy || !token) return;
    sendMessage({ text: text.trim() });
    setInput("");
  }

  const totalImpact = consultor?.topOpportunities.reduce((sum, item) => sum + item.estimatedImpact, 0) ?? 0;
  const { data: missao } = useQuery({ queryKey: ["missao-do-dia"], queryFn: () => fetchMissao(), enabled: !!token });
  const { data: saude } = useQuery({ queryKey: ["saude-negocio"], queryFn: () => fetchSaude(), enabled: !!token });

  return (
    <div className="relative space-y-6">
      {/* Ambient background — central de inteligência */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[120px] opacity-60" />
        <div className="absolute top-1/3 -right-24 h-[360px] w-[360px] rounded-full bg-fuchsia-400/15 blur-[120px] opacity-50" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-cyan-400/15 blur-[120px] opacity-40" />
      </div>

      <PageHeader
        title="Central de Inteligência"
        subtitle="Diagnóstico em tempo real, oportunidades priorizadas e um consultor IA conectado aos seus dados."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadConsultor} disabled={!token || loadingConsultor}>
              {loadingConsultor ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Atualizar
            </Button>
            {messages.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
                Nova conversa
              </Button>
            ) : null}
          </div>
        }
      />

      {consultor?.fallbackNotice && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/70 backdrop-blur-sm px-4 py-2.5 text-sm text-amber-900 shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          {consultor.fallbackNotice}
        </div>
      )}

      {/* Hero status — pulso da operação */}
      <section className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-background/80 via-background/60 to-primary/5 backdrop-blur-xl p-6 shadow-[0_20px_60px_-30px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
        <div aria-hidden className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        {loadingConsultor ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analisando dados do negócio...
          </div>
        ) : consultor ? (
          <div className="relative grid gap-6 lg:grid-cols-[1.5fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Resumo inteligente
              </div>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-semibold leading-tight tracking-tight">{consultor.summary}</h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-muted/60 px-3 py-1 text-muted-foreground">{consultor.topOpportunities.length} oportunidades</span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 ring-1 ring-emerald-500/20">Potencial {fmtBrl(totalImpact)}</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-primary capitalize">{consultor.diagnosis.status}</span>
              </div>
            </div>
            <div className="relative flex items-center gap-4 rounded-2xl border border-primary/20 bg-background/70 backdrop-blur-md p-5 shadow-[0_10px_30px_-15px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
              <div className="relative">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Saúde</p>
                <p className="font-display text-4xl font-bold leading-none mt-1">{Math.round(consultor.healthScore)}<span className="text-lg text-muted-foreground">/100</span></p>
              </div>
              <div className="relative h-14 w-14 rounded-full bg-primary/15 grid place-content-center ring-1 ring-primary/30">
                <Target className="h-7 w-7 text-primary" />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Não foi possível carregar o diagnóstico agora.</p>
        )}
      </section>

      {missao && (
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Target className="h-4 w-4" />
            Missão do Dia
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight">{missao.titulo}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{missao.subtitulo}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Potencial: {fmtBrl(Number(missao.potencialHoje ?? 0))}</span>
                <span>Tempo estimado: {missao.tempoTotalMin ?? 0} min</span>
                <span>Ticket médio: {fmtBrl(Number(missao.ticketMedio ?? 0))}</span>
              </div>
            </div>
            <div className="grid gap-2">
              {(missao.acoes ?? []).slice(0, 3).map((acao: any) => (
                <button
                  key={acao.id}
                  onClick={() => handleSend(acao.whatsapp ?? acao.detalhe ?? acao.titulo)}
                  disabled={!token || isBusy}
                  className="group rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_50%,transparent)] hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{acao.titulo}</p>
                    <Badge variant={acao.prioridade === "alta" ? "destructive" : acao.prioridade === "media" ? "default" : "secondary"}>{acao.prioridade}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{acao.detalhe}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chat central — mensagens flutuantes */}
      <section className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-b from-background/70 to-background/40 backdrop-blur-xl shadow-[0_30px_80px_-40px_color-mix(in_oklab,var(--primary)_50%,transparent)]">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/60 grid place-content-center shadow-[0_4px_12px_-2px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
              <Bot className="h-4 w-4 text-primary-foreground" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-semibold leading-tight">Consultor IA</h2>
              <p className="text-xs text-muted-foreground">Online · conectado aos seus dados</p>
            </div>
          </div>
          {isBusy && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:240ms]" />
              <span className="ml-1">pensando</span>
            </div>
          )}
        </div>

        <div ref={scrollRef} className="max-h-[520px] overflow-y-auto px-4 md:px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-start gap-3 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground grid place-content-center shrink-0 shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-background/80 backdrop-blur-sm border border-border/50 px-4 py-3 shadow-sm">
                Faça uma pergunta livre sobre faturamento, clientes, fidelidade, equipe, agenda ou campanhas. Estou pronto.
              </div>
            </div>
          )}

          {messages.map((message) => {
            const text = message.parts.map((part: any) => (part.type === "text" ? part.text : "")).join("");
            const usedTools = message.parts.filter((part: any) => part.type?.startsWith("tool-")).map((part: any) => part.type.replace("tool-", ""));
            const isUser = message.role === "user";

            return (
              <div key={message.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isUser ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 shrink-0 rounded-2xl grid place-content-center shadow-sm ${isUser ? "bg-muted/80 backdrop-blur text-foreground" : "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--primary)_60%,transparent)]"}`}>
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`flex-1 max-w-[85%] ${isUser ? "flex flex-col items-end" : ""}`}>
                  <div className={`px-4 py-2.5 shadow-sm transition-shadow ${isUser ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground" : "rounded-2xl rounded-tl-sm bg-background/80 backdrop-blur-md border border-border/50 hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_40%,transparent)]"}`}>
                    {text ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:my-2">
                        <Suspense fallback={<span className="whitespace-pre-wrap">{text}</span>}>
                          <Markdown>{text}</Markdown>
                        </Suspense>
                      </div>
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                  {usedTools.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 px-1 inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary/70" />
                      {usedTools.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {isBusy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 animate-in fade-in duration-200">
              <div className="h-8 w-8 shrink-0 rounded-2xl grid place-content-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-background/80 backdrop-blur-md border border-border/50 px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:120ms]" />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl p-3">{error.message}</div>}
        </div>

        <div className="border-t border-border/40 p-3 bg-background/40 backdrop-blur-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2 items-end"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder={token ? "Pergunte algo sobre seu negócio..." : "Carregando..."}
              disabled={!token || isBusy}
              rows={1}
              className="resize-none min-h-[44px] max-h-32 bg-background/70 backdrop-blur-sm"
            />
            <Button type="submit" disabled={!input.trim() || isBusy || !token} size="icon" className="h-11 w-11 shrink-0 shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          {messages.length === 0 && consultor && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGESTOES.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={!token || isBusy}
                  className="rounded-full border border-border/60 bg-background/60 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:bg-primary/5 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {consultor && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_80%,transparent)]" />
                Oportunidades
              </h2>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20">{fmtBrl(totalImpact)} potencial</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {consultor.topOpportunities.map((item) => (
                <Card key={item.id} className="group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_color-mix(in_oklab,var(--primary)_50%,transparent)]">
                  <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    <span className="text-sm font-semibold text-emerald-600">{fmtBrl(item.estimatedImpact)}</span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><strong className="text-foreground/80">Por que importa:</strong> {item.whyItMatters}</p>
                    <p><strong className="text-foreground/80">Ação:</strong> {item.recommendedAction}</p>
                  </div>
                  {item.whatsappMessage && (
                    <Textarea className="mt-3 min-h-20 text-sm" defaultValue={item.whatsappMessage} />
                  )}
                  <Button className="mt-3 w-full" variant={item.actionType === "whatsapp" ? "default" : "outline"} onClick={() => handleSend(item.recommendedAction)}>
                    {item.actionType === "whatsapp" ? <MessageCircle className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {item.ctaLabel}
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            {saude && (
              <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-4 shadow-sm">
                <div aria-hidden className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Saúde do negócio</p>
                    <p className="font-display text-3xl font-bold">{saude.score}<span className="text-base text-muted-foreground">/100</span></p>
                  </div>
                  <Badge variant={saude.score >= 65 ? "default" : saude.score >= 45 ? "secondary" : "destructive"} className="capitalize">{saude.status}</Badge>
                </div>
                <p className="relative mt-3 text-sm text-muted-foreground">{saude.resumo}</p>
                <div className="relative mt-3 space-y-2">
                  {(saude.riscos ?? []).map((fator: any) => (
                    <div key={fator.id} className="rounded-xl border border-border/50 bg-background/40 p-2.5">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{fator.label}</span>
                        <span className="tabular-nums text-muted-foreground">{fator.valor}/100</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{fator.detalhe}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="font-display font-semibold">Plano da semana</h2>
              </div>
              <div className="mt-3 space-y-3">
                {consultor.weeklyActionPlan.map((item) => (
                  <div key={`${item.day}-${item.action}`} className="relative border-l-2 border-primary/60 pl-3">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_70%,transparent)]" />
                    <p className="text-sm font-medium">{item.day}</p>
                    <p className="text-sm">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.expectedResult}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-4 shadow-sm">
              <h2 className="font-display font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Perguntas para agora
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {[...SUGESTOES, ...consultor.questionsToAskOwner].slice(0, 7).map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    disabled={!token || isBusy}
                    className="group rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-left text-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-[0_8px_20px_-12px_color-mix(in_oklab,var(--primary)_50%,transparent)] hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
