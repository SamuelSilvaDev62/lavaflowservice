import { createFileRoute } from "@tanstack/react-router";

/**
 * Chat do Consultor IA. Autentica pelo bearer do usuário, resolve o tenant
 * no servidor (nunca vem do cliente) e exige o plano Intelligence.
 */
export const Route = createFileRoute("/api/assistente-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Não autenticado", { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env["SUPABASE_URL"];
        const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend não configurado", { status: 503 });
        }
        if (!LOVABLE_API_KEY) {
          return new Response("Assistente de IA não configurado", { status: 503 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        const userId = (claims as any)?.claims?.sub as string | undefined;
        if (claimsError || !userId) return new Response("Token inválido", { status: 401 });

        const { resolveOwnerScope, assertFeature, FeatureBlockedError } = await import(
          "@/lib/entitlements.server"
        );
        const { ownerId, role } = await resolveOwnerScope(supabase, userId);
        if (!["owner", "admin", "gerente"].includes(role)) {
          return new Response("Sem permissão", { status: 403 });
        }
        try {
          await assertFeature(ownerId, "ai_assistant");
        } catch (err) {
          if (err instanceof FeatureBlockedError) {
            return new Response("Recurso disponível no plano Intelligence", { status: 402 });
          }
          throw err;
        }

        const { buildConsultorContexto, consultorSystemPrompt, checkAiRateLimit } = await import(
          "@/lib/assistente.server"
        );

        const limite = checkAiRateLimit(ownerId);
        if (!limite.ok) {
          return new Response("Muitas perguntas em pouco tempo. Tente novamente mais tarde.", {
            status: 429,
          });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }
        const messages = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
        if (messages.length === 0) return new Response("Sem mensagens", { status: 400 });

        const { streamText, convertToModelMessages } = await import("ai");
        const {
          createLovableAiGatewayProvider,
          getLovableAiGatewayRunId,
          getLovableAiGatewayResponseHeaders,
          withLovableAiGatewayRunIdHeader,
        } = await import("@/lib/ai-gateway.server");

        const contexto = await buildConsultorContexto(ownerId);
        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY, initialRunId);

        try {
          const result = streamText({
            model: gateway("google/gemini-3.5-flash"),
            system: consultorSystemPrompt(contexto),
            messages: await convertToModelMessages(messages as any),
            abortSignal: request.signal,
          });

          const response = result.toUIMessageStreamResponse({
            headers: getLovableAiGatewayResponseHeaders(undefined, {
              ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
            }),
          });
          return await withLovableAiGatewayRunIdHeader(response, gateway);
        } catch (err: any) {
          if (err?.name === "AbortError") return new Response(null, { status: 499 });
          console.error("[assistente-chat] falha", err);
          return new Response("Falha ao consultar o assistente", { status: 502 });
        }
      },
    },
  },
});
