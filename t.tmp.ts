import { streamText, convertToModelMessages } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
const gw = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!);
const ui=[{id:"1",role:"user",parts:[{type:"text",text:"Qual serviço devo divulgar agora e por que?"}]}];
const r = streamText({ model: gw("google/gemini-3.5-flash"), system:"Você é consultor de lava-rápido. Dados: receita 4200, ticket 42, topServicos: Lavagem completa.", messages: convertToModelMessages(ui as any) });
console.log((await r.text).slice(0,300));
