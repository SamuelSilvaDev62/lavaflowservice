import { streamText, convertToModelMessages } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
const gw = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!);
for (const q of ["Como aumentar meu faturamento nas próximas 2 semanas?","Qual serviço devo divulgar agora e por quê?"]) {
  const r = streamText({ model: gw("google/gemini-3.5-flash"), system:"Consultor de lava-rápido. DADOS: receita30d 4200, ticket 42, clientesInativos60d 18, topServicos: [Lavagem completa R$2400, Polimento R$900]. Máx 120 palavras.", messages: await convertToModelMessages([{id:"1",role:"user",parts:[{type:"text",text:q}]}] as any), onError:(e:any)=>console.log("ERR",e.error?.message) });
  console.log("Q:",q,"\nA:",(await r.text).slice(0,250),"\n---");
}
