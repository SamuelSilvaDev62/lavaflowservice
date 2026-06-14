import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, Sparkles, User, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistente")({
  component: Page,
});

const SUGESTOES = [
  "Quais clientes devo chamar hoje?",
  "Qual meu melhor dia da semana?",
  "Crie uma mensagem de reativação para inativos",
  "Quais serviços mais geram receita?",
  "Como aumento meu ticket médio?",
];

function Page() {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader
        title="Assistente de crescimento"
        subtitle="Converse com a IA sobre seu negócio em tempo real."
        actions={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
              <RefreshCw className="h-4 w-4 mr-1" /> Nova conversa
            </Button>
          ) : null
        }
      />

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-4 px-4 pb-4 space-y-4">
        {messages.length === 0 && (
          <Card className="p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-content-center shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-semibold text-base">Olá! Como posso ajudar a crescer seu lava-rápido hoje?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Posso analisar seus clientes, identificar oportunidades, sugerir promoções e redigir mensagens de WhatsApp prontas para enviar.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={!token}
                  className="text-xs px-3 py-1.5 rounded-full bg-background border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p: any) => (p.type === "text" ? p.text : ""))
            .join("");
          const usedTools = m.parts.filter((p: any) => p.type?.startsWith("tool-")).map((p: any) => p.type.replace("tool-", ""));

          return (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`h-8 w-8 shrink-0 rounded-lg grid place-content-center ${
                  m.role === "user" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`flex-1 max-w-[85%] ${m.role === "user" ? "items-end" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto inline-block"
                      : "bg-card border border-border"
                  }`}
                >
                  {text ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                    </div>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
                {usedTools.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 px-1">
                    🔧 {usedTools.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {isBusy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg grid place-content-center bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            {error.message}
          </div>
        )}
      </div>

      {/* Input fixo */}
      <div className="border-t border-border pt-3 -mx-4 px-4 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2 items-end"
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder={token ? "Pergunte algo sobre seu negócio..." : "Carregando..."}
            disabled={!token || isBusy}
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
          />
          <Button type="submit" disabled={!input.trim() || isBusy || !token} size="icon" className="h-11 w-11 shrink-0">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
