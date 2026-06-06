// Dados de demonstração — arrays estáticos usados pelo seed.
// Mantido client-safe (sem imports server-only) para poder ser usado em qualquer contexto.

export const NOMES_BR = [
  "Carlos Silva", "Ana Souza", "Bruno Costa", "Daniela Lima", "Eduardo Pereira",
  "Fernanda Alves", "Gabriel Ramos", "Helena Rocha", "Igor Martins", "Juliana Castro",
  "Lucas Mendes", "Mariana Dias", "Nicolas Barros", "Olivia Cardoso", "Pedro Henrique",
  "Renata Moreira", "Rafael Oliveira", "Sofia Carvalho", "Thiago Nunes", "Vanessa Pinto",
  "William Araujo", "Yasmin Teixeira", "André Vieira", "Beatriz Gomes", "Caio Ribeiro",
];

export const MODELOS = [
  "Honda Civic", "Toyota Corolla", "VW Gol", "Hyundai HB20", "Fiat Argo",
  "Jeep Renegade", "Chevrolet Onix", "Nissan Kicks", "Renault Kwid", "Ford Ka",
  "Toyota Hilux", "VW T-Cross", "Jeep Compass", "Honda HR-V", "Chevrolet Tracker",
];

export const CORES = ["Preto", "Branco", "Prata", "Cinza", "Vermelho", "Azul"];

export const ORIGENS = ["Indicação", "Instagram", "Google", "Passou em frente", "Cliente antigo"];

export const SERVICOS_DEMO = [
  { nome: "Lavagem Simples", preco_padrao: 35 },
  { nome: "Lavagem Completa", preco_padrao: 60 },
  { nome: "Lavagem Premium", preco_padrao: 90 },
  { nome: "Detalhada / Estética", preco_padrao: 180 },
  { nome: "Higienização Interna", preco_padrao: 150 },
  { nome: "Polimento", preco_padrao: 320 },
];

export const FUNCIONARIOS_DEMO = [
  { nome: "Marcos Pereira", cargo: "Lavador chefe" },
  { nome: "João Vitor", cargo: "Lavador" },
  { nome: "Rodrigo Alves", cargo: "Lavador" },
  { nome: "Lucia Fernandes", cargo: "Atendente" },
];

export const PLANOS_DEMO = [
  { nome: "Básico", quantidade_lavagens: 4, valor_mensal: 120, beneficios: ["4 lavagens simples no mês", "Atendimento prioritário"] },
  { nome: "Plus", quantidade_lavagens: 8, valor_mensal: 220, beneficios: ["8 lavagens completas", "10% off em serviços extras", "Cliente VIP"] },
  { nome: "Ilimitado", quantidade_lavagens: 30, valor_mensal: 380, beneficios: ["Lavagens ilimitadas", "Higienização semestral grátis", "Polimento anual cortesia"] },
];

export const RECOMPENSAS_DEMO = [
  { nome: "Lavagem simples grátis", custo_pontos: 200 },
  { nome: "Lavagem completa grátis", custo_pontos: 350 },
  { nome: "20% off na próxima visita", custo_pontos: 100 },
  { nome: "Higienização cortesia", custo_pontos: 600 },
];

export const TIPOS_INTERACAO = ["whatsapp", "ligacao", "presencial"] as const;

// Placas Mercosul fake
export function fakePlaca(i: number) {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const a = letras[i % 26];
  const b = letras[(i * 3) % 26];
  const c = letras[(i * 7) % 26];
  const d = (i % 10);
  const e = letras[(i * 5) % 26];
  const f = ((i * 2) % 10);
  const g = ((i * 3) % 10);
  return `${a}${b}${c}${d}${e}${f}${g}`;
}

export function fakeTelefone(i: number) {
  const ddd = 11 + (i % 80);
  const n = String(900000000 + i * 13579).slice(0, 9);
  return `(${ddd}) 9${n.slice(0, 4)}-${n.slice(4, 8)}`;
}
