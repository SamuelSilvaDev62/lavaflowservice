import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PageHeader } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Consultor LavaFlow IA"
        subtitle="Diagnostico, oportunidades e chat com base nos dados reais do negocio."
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
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {consultor.fallbackNotice}
        </div>
      )}

      <section className="rounded-md border border-border bg-card p-4">
        {loadingConsultor ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analisando dados do negocio...
          </div>
        ) : consultor ? (
          <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Resumo do dia
              </div>
              <h2 className="mt-2 text-2xl font-display font-semibold tracking-normal">{consultor.summary}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{consultor.topOpportunities.length} oportunidades priorizadas</span>
                <span>Impacto potencial: {fmtBrl(totalImpact)}</span>
                <span>Status: {consultor.diagnosis.status}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md bg-muted/50 p-4">
              <div>
                <p className="text-sm text-muted-foreground">Saude do negocio</p>
                <p className="text-3xl font-semibold">{Math.round(consultor.healthScore)}</p>
              </div>
              <Target className="h-10 w-10 text-primary" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nao foi possivel carregar o diagnostico agora.</p>
        )}
      </section>

      {consultor && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Oportunidades</h2>
              <Badge variant="secondary">{fmtBrl(totalImpact)} potencial estimado</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {consultor.topOpportunities.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    <span className="text-sm font-medium">{fmtBrl(item.estimatedImpact)}</span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><strong>Por que importa:</strong> {item.whyItMatters}</p>
                    <p><strong>Acao:</strong> {item.recommendedAction}</p>
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
            <section className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="font-display font-semibold">Plano da semana</h2>
              </div>
              <div className="mt-3 space-y-3">
                {consultor.weeklyActionPlan.map((item) => (
                  <div key={`${item.day}-${item.action}`} className="border-l-2 border-primary pl-3">
                    <p className="text-sm font-medium">{item.day}</p>
                    <p className="text-sm">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.expectedResult}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-border bg-card p-4">
              <h2 className="font-display font-semibold">Perguntas boas para agora</h2>
              <div className="mt-3 flex flex-col gap-2">
                {[...SUGESTOES, ...consultor.questionsToAskOwner].slice(0, 7).map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    disabled={!token || isBusy}
                    className="rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display font-semibold">Chat inteligente</h2>
        </div>
        <div ref={scrollRef} className="max-h-[520px] overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-content-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <p>Faca uma pergunta livre sobre faturamento, clientes, fidelidade, equipe, agenda ou campanhas.</p>
            </div>
          )}

          {messages.map((message) => {
            const text = message.parts.map((part: any) => (part.type === "text" ? part.text : "")).join("");
            const usedTools = message.parts.filter((part: any) => part.type?.startsWith("tool-")).map((part: any) => part.type.replace("tool-", ""));

            return (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 shrink-0 rounded-md grid place-content-center ${message.role === "user" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                  {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`flex-1 max-w-[85%] ${message.role === "user" ? "items-end" : ""}`}>
                  <div className={`rounded-md px-4 py-2.5 ${message.role === "user" ? "bg-primary text-primary-foreground ml-auto inline-block" : "bg-background border border-border"}`}>
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
                  {usedTools.length > 0 && <p className="text-xs text-muted-foreground mt-1 px-1">Ferramentas: {usedTools.join(", ")}</p>}
                </div>
              </div>
            );
          })}

          {isBusy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-md grid place-content-center bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-background border border-border rounded-md px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error.message}</div>}
        </div>

        <div className="border-t border-border p-3">
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
              placeholder={token ? "Pergunte algo sobre seu negocio..." : "Carregando..."}
              disabled={!token || isBusy}
              rows={1}
              className="resize-none min-h-[44px] max-h-32"
            />
            <Button type="submit" disabled={!input.trim() || isBusy || !token} size="icon" className="h-11 w-11 shrink-0">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
