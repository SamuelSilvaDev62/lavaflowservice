import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { autenticarEquipePin, getEquipeAcessoPublico } from "@/lib/lavaflow.functions";
import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/equipe/$slug")({
  component: Page,
  head: ({ params }) => ({
    meta: [
      { title: `Acesso da equipe - ${params.slug}` },
      { name: "description", content: "Acesso rapido da equipe LavaFlow por PIN." },
    ],
  }),
});

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  const key = "lavaflow_team_device_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function Page() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const listFn = useServerFn(getEquipeAcessoPublico);
  const authFn = useServerFn(autenticarEquipePin);
  const [selected, setSelected] = useState<any>(null);
  const [pin, setPin] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["equipe-acesso", slug],
    queryFn: () => listFn({ data: { slug } }),
    retry: false,
  });

  const auth = useMutation({
    mutationFn: () => authFn({
      data: {
        slug,
        funcionario_id: selected.id,
        pin,
        device_id: getDeviceId(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 280) : undefined,
      },
    }),
    onSuccess: (res) => {
      window.localStorage.setItem("lavaflow_team_token", res.token);
      window.localStorage.setItem("lavaflow_team_slug", slug);
      navigate({ to: "/modo-equipe" });
    },
    onError: (e: any) => {
      setPin("");
      toast.error(e?.message ?? "Nao foi possivel entrar");
    },
  });

  const colaboradores = data?.colaboradores ?? [];
  const pinSlots = useMemo(() => Array.from({ length: selected?.pin_digits ?? 4 }), [selected?.pin_digits]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{data?.empresa.nome ?? "LavaFlow"}</p>
            <h1 className="font-display text-2xl font-bold sm:text-4xl">Quem vai utilizar o LavaFlow?</h1>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-lg bg-card shadow-soft">
            <Link to="/auth">Entrar como Proprietario</Link>
          </Button>
        </header>

        {isLoading && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}</div>}
        {error && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Link de equipe invalido ou empresa nao encontrada.</CardContent></Card>}
        {!isLoading && !error && colaboradores.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum colaborador ativo com acesso por PIN.</CardContent></Card>
        )}

        <div className="grid flex-1 content-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colaboradores.map((c: any) => (
            <button
              key={c.id}
              onClick={() => { setSelected(c); setPin(""); }}
              className="group rounded-xl border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-xl">
                  <AvatarImage src={c.avatar_url ?? undefined} />
                  <AvatarFallback className="rounded-xl text-lg font-semibold">{initials(c.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{c.nome}</p>
                  <p className="truncate text-sm text-muted-foreground">{c.cargo ?? "Equipe"}</p>
                  <Badge variant="secondary" className="mt-2 text-[11px]">
                    {c.status}
                  </Badge>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              {!c.pin_configurado && <p className="mt-3 text-xs text-warning">Configure o PIN deste colaborador em Equipe.</p>}
            </button>
          ))}
        </div>
      </main>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5" /> Digite seu PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <Avatar className="h-12 w-12 rounded-lg">
                <AvatarImage src={selected?.avatar_url ?? undefined} />
                <AvatarFallback className="rounded-lg">{selected ? initials(selected.nome) : <UserRound />}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selected?.nome}</p>
                <p className="text-xs text-muted-foreground">{selected?.cargo ?? "Equipe"}</p>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              {pinSlots.map((_, i) => (
                <div key={i} className={`h-4 w-4 rounded-full border ${pin.length > i ? "border-primary bg-primary" : "border-muted-foreground/30"}`} />
              ))}
            </div>
            <Input
              autoFocus
              inputMode="numeric"
              type="password"
              value={pin}
              maxLength={selected?.pin_digits ?? 4}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, selected?.pin_digits ?? 4))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin.length === (selected?.pin_digits ?? 4)) auth.mutate();
              }}
              className="h-14 text-center text-2xl tracking-[0.5em]"
            />
            <Button
              className="h-12 w-full text-base"
              disabled={!selected?.pin_configurado || pin.length !== (selected?.pin_digits ?? 4) || auth.isPending}
              onClick={() => auth.mutate()}
            >
              Entrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
