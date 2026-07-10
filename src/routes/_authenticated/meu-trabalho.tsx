import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getMeuTrabalho, iniciarOs, finalizarOs } from "@/lib/lavaflow.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Play, Check, Bell, RefreshCw, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meu-trabalho")({
  component: Page,
});

// Tokens locais do mockup
const C = {
  navy: "#0E2E33",
  navy2: "#123A40",
  teal: "#1E8A8C",
  tealLight: "#58B7B4",
  flowBlue: "#2F6FED",
  foam: "#F4FAF9",
  foam2: "#E8F2F1",
  ink: "#0E2A2E",
  inkSoft: "#5C7A7C",
  line: "#DCEBEA",
  gold: "#DE9C2C",
  goldSoft: "#FBEFD9",
};

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "SP";
}
function hhmm(iso?: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function minsSince(iso?: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function Page() {
  const navigate = useNavigate();
  const fn = useServerFn(getMeuTrabalho);
  const startFn = useServerFn(iniciarOs);
  const finishFn = useServerFn(finalizarOs);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["meu-trabalho"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  const startMut = useMutation({
    mutationFn: (id: string) => startFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meu-trabalho"] }); toast.success("Lavagem iniciada"); },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });
  const finishMut = useMutation({
    mutationFn: (id: string) => finishFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meu-trabalho"] }); toast.success("Veículo pronto ✓"); },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  // Turno: primeiro iniciado_em do dia, senão hora do primeiro mount
  const [mountTime] = useState(() => new Date());
  const turnoInicio = useMemo(() => {
    const fila = (data?.fila ?? []) as any[];
    const inicios = fila.map(o => o.iniciado_em).filter(Boolean).sort();
    return inicios[0] ? new Date(inicios[0]) : mountTime;
  }, [data, mountTime]);
  const turnoStr = `${String(turnoInicio.getHours()).padStart(2, "0")}:${String(turnoInicio.getMinutes()).padStart(2, "0")}`;

  // Timer vivo para "Tempo em atendimento"
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function signOut() {
    try { await supabase.auth.signOut(); } finally { navigate({ to: "/auth" }); }
  }

  const nome = data?.funcionario?.nome ?? "Colaborador";
  const cargo = data?.funcionario?.cargo || "Colaborador";
  const fila = (data?.fila ?? []) as any[];
  const active = fila.find(o => o.status === "em_lavagem") ?? fila.find(o => o.status === "aguardando");
  const outros = fila.filter(o => o.id !== active?.id);
  const c = data?.cards;
  const proxima = "Livre"; // sem dado de próximo agendamento atribuído no payload atual

  return (
    <div className="-m-4 min-h-[calc(100vh-0px)]" style={{ background: "#D8E4E3" }}>
      <div
        className="mx-auto max-w-[430px] overflow-hidden"
        style={{ background: C.foam, minHeight: "100vh" }}
      >
        {/* HEADER */}
        <header
          className="relative overflow-hidden px-5 pt-5 pb-6"
          style={{ background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`, color: C.foam }}
        >
          <div
            className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full"
            style={{ background: `radial-gradient(circle, rgba(88,183,180,0.28) 0%, rgba(88,183,180,0) 70%)` }}
          />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full font-display text-[15px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.flowBlue})` }}
              >
                {initials(nome)}
              </div>
              <div>
                <div className="font-display text-base font-semibold leading-tight">{nome}</div>
                <div className="text-xs" style={{ color: "rgba(244,250,249,0.62)" }}>
                  {cargo} · Turno da manhã
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ background: "rgba(244,250,249,0.1)", borderColor: "rgba(244,250,249,0.18)", color: C.foam }}
            >
              Sair <LogOut className="h-3 w-3" />
            </button>
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-2">
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: C.tealLight, boxShadow: "0 0 0 4px rgba(88,183,180,0.25)" }}
            />
            <span className="text-xs" style={{ color: "rgba(244,250,249,0.75)" }}>
              Turno ativo desde <b style={{ color: C.foam, fontWeight: 600 }}>{turnoStr}</b>
            </span>
          </div>
        </header>

        {/* CONTENT */}
        <div className="px-4 pb-24 pt-4">
          {!data?.funcionario && !isLoading && (
            <div className="mb-4 rounded-2xl border p-3 text-sm" style={{ borderColor: "#F0CE85", background: C.goldSoft, color: "#7A5310" }}>
              Sua conta ainda não foi vinculada a um funcionário. Peça ao proprietário para vincular seu e-mail em Equipe.
            </div>
          )}

          {/* Stat strip */}
          <div className="mb-4 flex overflow-hidden rounded-2xl border" style={{ background: "#fff", borderColor: C.line }}>
            <Stat n={String(fila.length)} l="Atribuídos" />
            <Stat n={String(fila.filter(o => o.status === "em_lavagem").length)} l="Em serviço" />
            <Stat n={String(c?.concluidasHoje ?? 0)} l="Concluídos" />
            <Stat n={proxima} l="Próximo" last />
          </div>

          <SectionLabel label="Em atendimento agora" pill={active ? "1 veículo" : "0 veículos"} />

          {active ? (
            <JobCard
              o={active}
              onStart={() => startMut.mutate(active.id)}
              onFinish={() => finishMut.mutate(active.id)}
              busy={startMut.isPending || finishMut.isPending}
            />
          ) : (
            <div className="rounded-2xl border p-6 text-center text-sm" style={{ borderColor: C.line, background: "#fff", color: C.inkSoft }}>
              Nenhum veículo aguardando agora 🧼
            </div>
          )}

          {outros.length > 0 && (
            <>
              <div className="mt-6">
                <SectionLabel label="Próximos veículos" pill={`${outros.length}`} />
              </div>
              <div className="space-y-2">
                {outros.map((o) => (
                  <MiniJob
                    key={o.id}
                    o={o}
                    onStart={() => startMut.mutate(o.id)}
                    onFinish={() => finishMut.mutate(o.id)}
                    busy={startMut.isPending || finishMut.isPending}
                  />
                ))}
              </div>
            </>
          )}

          {/* System action */}
          <div className="mt-6 border-t pt-4 text-center" style={{ borderColor: C.line, borderStyle: "dashed" }}>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 py-2 text-sm font-semibold"
              style={{ color: C.inkSoft }}
            >
              <RefreshCw className="h-4 w-4" /> Trocar colaborador
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function Stat({ n, l, last }: { n: string; l: string; last?: boolean }) {
    return (
      <div className="flex-1 py-3 text-center" style={{ borderRight: last ? "none" : `1px solid ${C.line}` }}>
        <div className="font-display text-[20px] font-bold leading-none" style={{ color: C.navy }}>{n}</div>
        <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.inkSoft }}>{l}</div>
      </div>
    );
  }
}

function SectionLabel({ label, pill }: { label: string; pill?: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-0.5">
      <div className="font-display text-[13px] font-semibold" style={{ color: C.navy }}>{label}</div>
      {pill && (
        <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: C.foam2, color: C.teal }}>
          {pill}
        </span>
      )}
    </div>
  );
}

function JobCard({ o, onStart, onFinish, busy }: { o: any; onStart: () => void; onFinish: () => void; busy: boolean }) {
  const emLavagem = o.status === "em_lavagem";
  const tempo = emLavagem ? minsSince(o.iniciado_em) : 0;
  return (
    <div
      className="rounded-3xl border p-4"
      style={{ background: "#fff", borderColor: C.line, boxShadow: "0 8px 24px rgba(14,46,51,0.06)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.inkSoft }}>
            Cliente · {o.clientes?.nome ?? "—"}
          </div>
          <div className="mt-0.5 font-display text-[18px] font-bold leading-tight" style={{ color: C.navy }}>
            {o.servicos?.nome ?? "Serviço"}
          </div>
        </div>
        <span
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold text-white"
          style={{ background: emLavagem ? C.flowBlue : C.teal }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {emLavagem ? "Em lavagem" : "Aguardando"}
        </span>
      </div>

      {/* Flow timer */}
      <div className="relative mt-4 overflow-hidden rounded-2xl px-4 py-3.5" style={{ background: C.navy }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            background: `repeating-linear-gradient(100deg, transparent 0px, transparent 22px, rgba(88,183,180,0.10) 22px, rgba(88,183,180,0.10) 24px)`,
            animation: "lf-flow 3.5s linear infinite",
          }}
        />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "rgba(244,250,249,0.6)" }}>
              {emLavagem ? "Tempo em atendimento" : "Aguardando início"}
            </span>
            <span className="mt-0.5 font-mono text-[22px] font-semibold" style={{ color: C.foam }}>
              {emLavagem ? (
                <>{String(tempo).padStart(2, "0")}<span className="ml-1 text-xs" style={{ color: C.tealLight }}>min</span></>
              ) : (
                <span className="text-base opacity-80">—</span>
              )}
            </span>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold"
            style={{ background: "rgba(39,158,99,0.18)", borderColor: "rgba(39,158,99,0.4)", color: "#7BE0AA" }}
          >
            ✓ Checklist ok
          </span>
        </div>
      </div>

      <div className="mt-3 text-[12.5px]" style={{ color: C.inkSoft }}>
        {emLavagem && o.iniciado_em ? `Iniciado às ${hhmm(o.iniciado_em)}` : "Aguardando"}
        {o.veiculos ? ` · Veículo: ${[o.veiculos.modelo, o.veiculos.placa].filter(Boolean).join(" ")}` : ""}
      </div>

      {/* Upsell estático */}
      <div className="mt-3 flex items-start gap-2.5 rounded-2xl border p-3" style={{ background: C.goldSoft, borderColor: "#F0CE85" }}>
        <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg" style={{ background: C.gold }}>
          <Lightbulb className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold" style={{ color: "#7A5310" }}>Ofereça um serviço extra</div>
          <div className="mt-0.5 text-[12px] leading-snug" style={{ color: "#8C6A22" }}>
            Enceramento, higienização interna ou impermeabilização podem aumentar o ticket desse cliente.
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="mt-4 flex flex-col gap-2">
        {emLavagem ? (
          <button
            onClick={onFinish}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-bold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${C.flowBlue}, #4C86F2)`, boxShadow: "0 8px 18px rgba(47,111,237,0.32)" }}
          >
            <Check className="h-4 w-4" /> Finalizar atendimento
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-bold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${C.flowBlue}, #4C86F2)`, boxShadow: "0 8px 18px rgba(47,111,237,0.32)" }}
          >
            <Play className="h-4 w-4" /> Iniciar atendimento
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => toast.success("Recepção notificada")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-[13.5px] font-semibold"
            style={{ borderColor: C.line, color: C.inkSoft, background: "transparent" }}
          >
            <Bell className="h-3.5 w-3.5" /> Avisar recepção
          </button>
        </div>
      </div>

      <style>{`@keyframes lf-flow { from { background-position: 0 0; } to { background-position: 200px 0; } }`}</style>
    </div>
  );
}

function MiniJob({ o, onStart, onFinish, busy }: { o: any; onStart: () => void; onFinish: () => void; busy: boolean }) {
  const emLavagem = o.status === "em_lavagem";
  return (
    <div className="rounded-2xl border p-3" style={{ background: "#fff", borderColor: C.line }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" style={{ color: C.navy }}>{o.clientes?.nome ?? "Cliente"}</div>
          <div className="mt-0.5 truncate text-xs" style={{ color: C.inkSoft }}>
            {o.servicos?.nome ?? "Serviço"}
            {o.veiculos?.placa ? ` · ${o.veiculos.placa}` : ""}
          </div>
        </div>
        <span
          className="whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold"
          style={{ background: emLavagem ? "rgba(47,111,237,0.12)" : C.foam2, color: emLavagem ? C.flowBlue : C.teal }}
        >
          {emLavagem ? "Em lavagem" : "Aguardando"}
        </span>
      </div>
      <div className="mt-2">
        {emLavagem ? (
          <button
            onClick={onFinish}
            disabled={busy}
            className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: C.flowBlue }}
          >
            <Check className="mr-1 inline h-3.5 w-3.5" /> Finalizar
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={busy}
            className="w-full rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: C.foam2, color: C.navy }}
          >
            <Play className="mr-1 inline h-3.5 w-3.5" /> Iniciar
          </button>
        )}
      </div>
    </div>
  );
}
