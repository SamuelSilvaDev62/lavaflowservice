import { streamText, convertToModelMessages } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
const gw = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!);
const ui=[{id:"1",role:"user",parts:[{type:"text",text:"Diga OK"}]}];
const r = streamText({ model: gw("google/gemini-3.5-flash"), messages: convertToModelMessages(ui as any), onError: (e)=>console.log("ERR", JSON.stringify(e, null, 2).slice(0,1500)) });
for await (const p of r.fullStream) console.log(p.type, JSON.stringify(p).slice(0,200));
