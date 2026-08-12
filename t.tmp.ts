import { convertToModelMessages } from "ai";
const ui=[{id:"1",role:"user",parts:[{type:"text",text:"Diga OK"}]}];
console.log(JSON.stringify(convertToModelMessages(ui as any)));
