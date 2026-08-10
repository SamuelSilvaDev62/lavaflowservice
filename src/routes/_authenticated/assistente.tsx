import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CalendarDays,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/app-layout";
import { FeatureGate } from "@/components/feature-gate";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import MarkdownMessage from "@/components/markdown-message";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistente")({
  component: () => (
    <RequireRole roles={GESTAO}>
      <FeatureGate feature="ai_assistant">
        <Page />
      </FeatureGate>
    </RequireRole>
  ),
  head: () => ({
    meta: [
      { title: "Consultor IA — LavaFlow" },
      { name: "description", content: "Consultor de crescimento do LavaFlow baseado nos dados reais do seu negocio." },
    ],
  }),
});

const SUGESTOES = [
  "Como aumentar meu faturamento esta semana?",
  "Quais clientes devo priorizar hoje?",
  "Onde estou deixando dinheiro na mesa?",
  "Quais servicos merecem mais divulgacao?",
  "O que posso fazer ainda hoje para melhorar a recorrencia?",
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
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function priorityVariant(priority: ConsultorOpportunity["priority"]) {
  if (priority === "alta") return "destructive" as const;
  if (priority === "media") return "default" as const;
  return "secondary" as const;
}

function messageText(message: any) {
  return (message.parts ?? [])
    .filter((part: any) => part.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

function Page() {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [consultor, setConsultor] = useState<ConsultorData | null>(null);
  const [loadingConsultor, setLoadingConsultor] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
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
      if (!response.ok) throw new Error(payload.error ?? "Erro ao carregar o consultor");
      setConsultor(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar o consultor");
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
          return freshToken ? { Authorization: `Bearer ${freshToken}` } : {};
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    onError: (chatError) => toast.error(chatError.message || "Erro no Assistente IA"),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!isBusy) inputRef.current?.focus();
  }, [isBusy]);

  function handleSend(text: string) {
    const clean = text.trim();
    if (!clean || isBusy || !token) return;
    void sendMessage({ text: clean });
    setInput("");
  }

  const totalImpact = consultor?.topOpportunities.reduce((sum, item) => sum + Number(item.estimatedImpact || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultor LavaFlow IA"
        subtitle="Diagnostico, oportunidades e proximos passos com base nos dados reais da operacao."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadConsultor()} disabled={!token || loadingConsultor}>
              {loadingConsultor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar analise
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
                Nova conversa
              </Button>
            )}
          </div>
        }
      />

      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-5 sm:p-6">
          {loadingConsultor ? (
            <div className="flex min-h-32 items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Analisando o negocio...
            </div>
          ) : consultor ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  Leitura dos ultimos 30 dias
                </div>
                <h2 className="mt-3 max-w-3xl font-display text-2xl font-semibold leading-tight">
                  {consultor.summary}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{consultor.topOpportunities.length} oportunidades</Badge>
                  <Badge variant="outline">Potencial estimado {fmtBrl(totalImpact)}</Badge>
                  <Badge variant="outline" className="capitalize">{consultor.diagnosis.status}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Saude do negocio</p>
                  <p className="mt-1 font-display text-4xl font-bold tabular-nums">{Math.round(consultor.healthScore)}</p>
                  <p className="text-xs text-muted-foreground">de 100</p>
                </div>
                <Target className="h-10 w-10 text-primary" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda nao foi possivel gerar a leitura do negocio.</p>
          )}
        </CardContent>
      </Card>

      {consultor && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold">Oportunidades priorizadas</h2>
              <p className="text-sm text-muted-foreground">O potencial e uma estimativa, nao uma promessa de faturamento.</p>
            </div>
            <Badge variant="secondary">{fmtBrl(totalImpact)} potencial combinado</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {consultor.topOpportunities.map((item) => (
              <Card key={item.id} className="h-full">
                <CardContent className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={priorityVariant(item.priority)} className="capitalize">{item.priority}</Badge>
                    {item.estimatedImpact > 0 && <span className="text-sm font-semibold tabular-nums">{fmtBrl(item.estimatedImpact)}</span>}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <div className="mt-3 flex-1 space-y-2 text-sm">
                    <p><strong>Por que importa:</strong> {item.whyItMatters}</p>
                    <p><strong>Proximo passo:</strong> {item.recommendedAction}</p>
                  </div>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => handleSend(`Me ajude a executar esta oportunidade: ${item.recommendedAction}`)}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Planejar com a IA
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-display font-semibold">Converse com o Consultor</h2>
                  <p className="text-xs text-muted-foreground">Ele pode investigar os dados do seu LavaFlow durante a conversa.</p>
                </div>
              </div>
              {messages.length === 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGESTOES.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => handleSend(question)}
                      disabled={!token || isBusy}
                      className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[520px] min-h-[280px] space-y-4 overflow-y-auto p-4 sm:p-5">
              {messages.length === 0 && (
                <div className="grid min-h-48 place-items-center text-center text-muted-foreground">
                  <div>
                    <Bot className="mx-auto h-9 w-9 opacity-50" />
                    <p className="mt-3 text-sm">Escolha uma pergunta acima ou escreva o que voce quer melhorar no negocio.</p>
                  </div>
                </div>
              )}
              {messages.map((message) => {
                const text = messageText(message);
                if (!text) return null;
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="mt-1 grid h-8 w-8 shrink-0 place-content-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>
                      {isUser ? <p className="whitespace-pre-wrap">{text}</p> : <div className="prose prose-sm max-w-none dark:prose-invert"><MarkdownMessage>{text}</MarkdownMessage></div>}
                    </div>
                    {isUser && (
                      <div className="mt-1 grid h-8 w-8 shrink-0 place-content-center rounded-full bg-muted">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isBusy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error.message}</p>}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t p-4">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend(input);
                }}
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
                  placeholder="Ex.: O que eu faria hoje para trazer clientes de volta?"
                  rows={2}
                  disabled={!token || isBusy}
                  className="min-h-[52px] resize-none"
                />
                <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={!token || isBusy || !input.trim()}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">As recomendacoes sao apoio a decisao. Revise antes de executar campanhas ou ofertas.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {consultor && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="font-display font-semibold">Plano de acao</h2>
                </div>
                <div className="mt-4 space-y-4">
                  {consultor.weeklyActionPlan.map((item) => (
                    <div key={`${item.day}-${item.action}`} className="border-l-2 border-primary pl-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.day}</p>
                      <p className="mt-1 text-sm font-medium">{item.action}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.expectedResult}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {consultor && (consultor.diagnosis.risks.length > 0 || consultor.diagnosis.strengths.length > 0) && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="font-display font-semibold">Leitura rapida</h2>
                  <p className="text-xs text-muted-foreground">Sinais usados na priorizacao.</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pontos positivos</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {consultor.diagnosis.strengths.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atencao</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {consultor.diagnosis.risks.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
