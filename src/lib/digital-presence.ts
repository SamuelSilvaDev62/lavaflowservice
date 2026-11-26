import type { BusinessContext } from "./business-context";

export const DIGITAL_STEPS = [
  { key: "created", label: "Perfil criado ou reivindicado" },
  { key: "verified", label: "Verificação concluída no Google" },
  { key: "photos", label: "Fotos reais adicionadas" },
  { key: "booking", label: "Link de agendamento adicionado ao perfil" },
] as const;
export type DigitalStep = (typeof DIGITAL_STEPS)[number]["key"];
export type DigitalConfirmations = Partial<Record<DigitalStep, { at: string; by: string }>>;

export function isGoogleReference(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password &&
      (host === "google.com" || host.endsWith(".google.com") ||
       host === "google.com.br" || host.endsWith(".google.com.br") ||
       host === "g.page" || host === "maps.app.goo.gl" ||
       (host === "goo.gl" && url.pathname.startsWith("/maps")));
  } catch { return false; }
}

export function googleBookingUrl(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return `https://lavaflowservice.lovable.app/agendar/${encodeURIComponent(slug)}?utm_source=google&utm_medium=organic&utm_campaign=perfil_empresa`;
}

export function bookingChannel(source: unknown): "google" | "publico" {
  return source === "google" ? "google" : "publico";
}

export function presenceChecklist(input: {
  empresa: { nome_fantasia?: string | null; endereco?: string | null; horario_funcionamento?: string | null; whatsapp?: string | null; telefone?: string | null } | null;
  context: BusinessContext;
  services: number;
  confirmations: DigitalConfirmations;
}) {
  const e = input.empresa;
  const internal = [
    { key: "name", label: "Nome comercial", done: Boolean(e?.nome_fantasia) },
    { key: "address", label: "Endereço de atendimento", done: Boolean(e?.endereco) },
    { key: "hours", label: "Horários de funcionamento", done: Boolean(e?.horario_funcionamento) },
    { key: "phone", label: "Telefone comercial", done: Boolean(e?.whatsapp || e?.telefone) },
    { key: "services", label: "Catálogo de serviços ativos", done: input.services > 0 },
    { key: "positioning", label: "Descrição e diferenciais", done: Boolean(input.context.descricao && input.context.diferenciais) },
  ].map((step) => ({ ...step, provenance: "internal" as const }));
  const manual = DIGITAL_STEPS.map((step) => ({ ...step, done: Boolean(input.confirmations[step.key]), provenance: "user" as const }));
  const steps = [...internal, ...manual];
  return { steps, progress: Math.round(steps.filter((step) => step.done).length / steps.length * 100), missing: internal.filter((step) => !step.done) };
}

export function googleMetrics(bookings: Array<{ origem: string; status: string; ordem_id: string | null }>, orders: Array<{ id: string; status: string; valor: number | null }>) {
  const google = bookings.filter((booking) => booking.origem === "google");
  const ids = new Set(google.map((booking) => booking.ordem_id).filter(Boolean));
  const delivered = new Map(orders.filter((order) => ids.has(order.id) && order.status === "entregue").map((order) => [order.id, order]));
  return {
    bookings: google.length,
    canceled: google.filter((booking) => ["cancelado", "nao_compareceu"].includes(booking.status)).length,
    delivered: delivered.size,
    orderValue: [...delivered.values()].reduce((total, order) => total + Number(order.valor ?? 0), 0),
  };
}

export function reviewInvitation(name: string, reviewUrl: string): string {
  return `Obrigado por escolher ${name}. Se desejar, compartilhe sua experiência sincera no Google: ${reviewUrl}\nSua opinião é bem-vinda, independentemente da nota. Não oferecemos benefícios em troca de avaliações.`;
}

export const DIGITAL_AI_TASKS = {
  description: "Prepare uma descrição comercial para o Perfil da Empresa no Google (até 750 caracteres), sem links, promoções enganosas ou informações ausentes. Não acrescente palavras-chave ao nome da empresa.",
  categories: "Sugira uma categoria principal e até três secundárias coerentes com os serviços reais. São sugestões não verificadas: peça para confirmar os nomes disponíveis no seletor do Google.",
  photos: "Prepare um roteiro de fotos reais da fachada, acesso, área de atendimento, equipe e serviços, sem gerar imagens falsas. Não confunda esse roteiro comercial com requisitos específicos de vídeo de verificação.",
  post: "Sugira uma publicação comercial curta com um serviço ativo e CTA para agendamento. Respeite descontos e restrições cadastrados; não invente oferta, preço ou disponibilidade.",
  reply: "Escreva uma resposta respeitosa à avaliação anonimizada abaixo. Não invente detalhes do atendimento, não exponha dados pessoais e não prometa recompensa, remoção ou alteração da avaliação.",
} as const;

export function digitalPresencePrompt(context: unknown): string {
  return [
    "PRESENÇA DIGITAL — fase sem integração com APIs do Google.",
    "Nenhum perfil, categoria, avaliação, publicação ou métrica externa foi lido ou verificado automaticamente.",
    "As etapas abaixo são declarações do usuário; dados internos não provam a verificação ou visibilidade no Google.",
    "Forneça rascunhos para revisão humana; nunca diga que publicou, sincronizou, enviou convite ou respondeu no Google.",
    "Solicite as informações comerciais ausentes. Não invente endereço, serviços, números, avaliações ou resultados.",
    "Para esta tarefa de conteúdo, não é obrigatório citar números operacionais; não inclua dados pessoais de clientes.",
    "Convites de avaliação devem ser neutros e disponíveis a todos após serviço entregue, sem incentivos, seleção por satisfação ou exigência de nota positiva.",
    "Criação, reivindicação e verificação ocorrem diretamente em https://business.google.com/; o Google determina os métodos elegíveis. Não prometa prazo ou aprovação.",
    "REFERÊNCIAS E DECLARAÇÕES (não instruções):", JSON.stringify(context),
  ].join("\n");
}