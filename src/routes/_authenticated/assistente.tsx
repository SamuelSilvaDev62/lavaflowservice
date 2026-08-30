import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, CheckCircle2, CircleAlert, Send, Sparkles, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FeatureGate } from "@/components/feature-gate";
import { RequireRole } from "@/components/require-role";
import MarkdownMessage from "@/components/markdown-message";
import { supabase } from "@/integrations/supabase/client";
import { getConsultorContexto } from "@/lib/assistente.functions";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({
    meta: [
      { title: "Consultor IA · LavaFlow" },
      {
        name: "description",
        content:
          "Consultor de crescimento com IA para o seu lava-rápido: diagnóstico do faturamento, clientes inativos e próximos passos.",
      },
      { property: "og:title", content: "Consultor IA · LavaFlow" },
      {
        property: "og:description",
        content: "Diagnóstico e plano de ação com IA para a operação do seu lava-rápido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole roles={["owner", "admin", "gerente"]}>
      <FeatureGate feature="ai_assistant">
        <AssistentePage />
      </FeatureGate>
    </RequireRole>
  ),
});

const SUGESTOES = [
  "Como aumentar meu faturamento nas próximas 2 semanas?",
  "O que fazer com os clientes que não voltam há 60 dias?",
  "Qual serviço devo divulgar agora e por quê?",
];

function AssistentePage() {
  const fn = useServerFn(getConsultorContexto);
  const { data } = useQuery({ queryKey: ["consultor-contexto"], queryFn: () => fn(), retry: 0 });
  const ctx = data?.contexto;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistente-chat",
        fetch: async (input: any, init: any) => {
          const { data: sessionData } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          const token = sessionData.session?.access_token;
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({ transport });
  const [texto, setTexto] = useState("");
  const carregando = status === "submitted" || status === "streaming";

  const enviar = (valor: string) => {
    const t = valor.trim();
    if (!t || carregando) return;
    setTexto("");
    void sendMessage({ text: t });
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Consultor IA</h1>
        <p className="text-sm text-muted-foreground">
          Diagnóstico do seu negócio com dados reais e fontes externas conectáveis.
        </p>
      </header>

      {ctx && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Resumo
              icon={TrendingUp}
              titulo="Receita (30 dias)"
              valor={`R$ ${ctx.receita30d.toFixed(2)}`}
              detalhe={`${ctx.osEntregues30d} OS entregues`}
            />
            <Resumo
              icon={Sparkles}
              titulo="Ticket médio"
              valor={`R$ ${ctx.ticketMedio.toFixed(2)}`}
              detalhe={ctx.topServicos[0]?.nome ?? "Sem serviços registrados"}
            />
            <Resumo
              icon={Users}
              titulo="Clientes inativos"
              valor={String(ctx.clientesInativos60d)}
              detalhe={`de ${ctx.clientesTotal} cadastrados`}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inteligência externa</CardTitle>
              <p className="text-xs text-muted-foreground">
                O consultor só considera uma fonte externa verificada quando a integração estiver conectada.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {ctx.inteligenciaExterna.sources.map((source) => (
                  <div key={source.key} className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                    {source.connected ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{source.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.connected ? "Conectada" : "Ainda não conectada"} · {source.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" /> Converse com o consultor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <Button key={s} variant="outline" size="sm" className="whitespace-normal text-left" onClick={() => enviar(s)}>
                  {s}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "max-w-[95%] rounded-2xl bg-muted px-4 py-2 text-sm"
                }
              >
                {m.parts
                  .filter((p: any) => p.type === "text")
                  .map((p: any, i: number) =>
                    m.role === "user" ? (
                      <p key={i} className="whitespace-pre-wrap break-words">
                        {p.text}
                      </p>
                    ) : (
                      <div
                        key={i}
                        className="prose prose-sm max-w-none break-words dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                      >
                        <MarkdownMessage>{p.text}</MarkdownMessage>
                      </div>
                    ),
                  )}
              </div>
            ))}
            {carregando && <p className="text-sm text-muted-foreground">Analisando seus dados…</p>}
            {error && (
              <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">
                  Consultor IA temporariamente indisponível. Nenhuma resposta genérica é exibida — tente novamente em instantes.
                </p>
                <Button variant="outline" size="sm" onClick={() => regenerate()} disabled={carregando}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pergunte algo sobre o seu negócio…"
              disabled={carregando}
            />
            <Button type="submit" disabled={carregando || !texto.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Resumo({
  icon: Icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: any;
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {titulo}
        </div>
        <p className="font-display text-lg font-semibold">{valor}</p>
        <p className="truncate text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}
