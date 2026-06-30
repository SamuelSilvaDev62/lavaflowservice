// MVP Mode — esconde módulos fora do escopo MVP v0.1 (14 dias).
// Escopo: Clientes, Agendamento, OS (Kanban), WhatsApp finalização + 2 insights leves.
// Ativar com VITE_MVP_MODE=true no .env (ou localStorage `lavaflow.mvp`=`1` para alternar em runtime).

const ENV_FLAG = (import.meta.env.VITE_MVP_MODE ?? "").toString().toLowerCase() === "true";

function readLocal(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem("lavaflow.mvp");
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function isMvpMode(): boolean {
  const local = readLocal();
  return local ?? ENV_FLAG;
}

export function setMvpMode(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("lavaflow.mvp", on ? "1" : "0");
  window.location.reload();
}

// Rotas que permanecem visíveis no modo MVP. Tudo o mais fica oculto na navegação.
export const MVP_ALLOWED_ROUTES = new Set<string>([
  "/dashboard",
  "/agendamentos",
  "/fila",
  "/ordens",
  "/clientes",
  "/configuracoes",
  "/meu-trabalho",
]);
