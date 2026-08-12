import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
const gw = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!);
const r = streamText({ model: gw("google/gemini-3.5-flash"), prompt:"Diga OK", onError: (e:any)=>{const x=e.error; console.log("NAME",x?.name,"MSG",x?.message,"STATUS",x?.statusCode,"BODY",String(x?.responseBody).slice(0,500), "CAUSE", String(x?.cause).slice(0,300));} });
for await (const p of r.fullStream) console.log(p.type);
