import { convertToModelMessages } from "ai";
const ui=[{id:"1",role:"user",parts:[{type:"text",text:"Diga OK"}]}];
const r:any = convertToModelMessages(ui as any);
console.log(typeof r, r instanceof Promise, JSON.stringify(await r));
