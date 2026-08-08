import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { getCampanhas, criarCampanhaInteligente, marcarCampanhaAlvoEnviado, processarConversoesCampanhas } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignCard } from "@/components/ui/campaign-card";
import { MessageCircle, Megaphone, RefreshCw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/campanhas")({
  component: () => <RequireRole roles={GESTAO}><Page /></RequireRole>,
});

const tipoLabel: Record<string, string> = {
  inativos: "Clientes inativos",
  fidelidade: "Fidelidade",
  assinatura: "Assinaturas",
  baixa_ocupacao: "Baixa ocupação",
  aniversario: "Aniversário",
};

const statusTone: Record<string, "active" | "draft" | "done" | "paused"> = {
  ativa: "active",
  rascunho: "draft",
  concluida: "done",
  pausada: "paused",
};

function Page() {
  const list = useServerFn(getCampanhas);
  const criar = useServerFn(criarCampanhaInteligente);
  const marcar = useServerFn(marcarCampanhaAlvoEnviado);
  const processar = useServerFn(processarConversoesCampanhas);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["campanhas"], queryFn: () => list() });

  const criarMut = useMutation({
    mutationFn: (s: any) => criar({ data: { tipo: s.tipo, nome: s.titulo, mensagem: s.mensagem } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campanhas"] }); toast.success("Campanha criada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar campanha"),
  });

  const enviarMut = useMutation({
    mutationFn: (id: string) => marcar({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanhas"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar envio"),
  });
  const processarMut = useMutation({
    mutationFn: () => processar(),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["campanhas"] });
      qc.invalidateQueries({ queryKey: ["receita-influenciada"] });
      toast.success(`${res.convertidos} conversão(ões) encontradas`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar conversões"),
  });

  function msgFor(template: string, alvo: any) {
    return template.replaceAll("{{nome}}", String(alvo.nome ?? "Cliente").split(" ")[0]);
  }

  return (
    <>
      <PageHeader
        title="Campanhas"
        subtitle="Transforme oportunidades em conversas — cada campanha vira receita rastreável."
        actions={
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => processarMut.mutate()} disabled={processarMut.isPending}>
            <RefreshCw className="mr-1 h-4 w-4" />Atualizar conversões
          </Button>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl skeleton-shimmer" />)}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Sugeridas para você</h2>
            </div>
            {data.sugestoes.length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Ainda não há uma campanha recomendada com dados suficientes.</CardContent></Card>
            ) : (
              <div className="grid min-w-0 gap-4 lg:grid-cols-2 list-stagger">
                {data.sugestoes.map((s: any, i: number) => (
                  <div key={s.tipo} className="min-w-0" style={{ ["--i" as any]: i }}>
                    <CampaignCard
                      title={s.titulo}
                      objective={tipoLabel[s.tipo] ?? s.tipo}
                      audienceLabel={`${s.alvos.length} cliente(s)`}
                      status="Sugerida"
                      statusTone="draft"
                      channels={["whatsapp"]}
                      metric={{ label: "Potencial", value: brl(s.impactoEstimado) }}
                      actions={
                        <Button size="sm" onClick={() => criarMut.mutate(s)} disabled={criarMut.isPending} variant="premium">
                          <Megaphone className="mr-1 h-4 w-4" />Criar campanha
                        </Button>
                      }
                    >
                      <p className="break-words text-sm leading-relaxed text-muted-foreground">{s.descricao}</p>
                    </CampaignCard>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Suas campanhas</h2>
            </div>
            {(data.campanhas ?? []).length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma campanha criada ainda.</CardContent></Card>
            ) : (
              <div className="space-y-4 list-stagger">
                {data.campanhas.map((c: any, i: number) => {
                  const enviados = c.alvos.filter((a: any) => ["enviado", "convertido"].includes(a.status)).length;
                  const convertidos = c.alvos.filter((a: any) => a.status === "convertido").length;
                  const conversao = enviados ? convertidos / enviados : 0;
                  const date = c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : undefined;
                  return (
                    <div key={c.id} className="min-w-0" style={{ ["--i" as any]: i }}>
                      <CampaignCard
                        title={c.nome}
                        objective={tipoLabel[c.tipo] ?? c.tipo}
                        audienceLabel={`${c.alvos.length} alvo(s)`}
                        status={c.status}
                        statusTone={statusTone[c.status] ?? "draft"}
                        date={date}
                        channels={["whatsapp"]}
                        metric={{ label: "Receita influenciada", value: brl(c.receitaInfluenciada ?? 0) }}
                      >
                        <p className="break-words text-sm leading-relaxed text-muted-foreground">{c.mensagem}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex min-w-0 items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{convertidos} conv. · {Math.round(conversao * 100)}%</span></span>
                        </div>
                        <div className="min-w-0 divide-y rounded-2xl border bg-card">
                          {c.alvos.slice(0, 12).map((a: any) => (
                            <div key={a.id} className="flex min-w-0 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{a.nome ?? "Cliente"}</p>
                                <p className="truncate text-xs text-muted-foreground">{a.telefone ?? "sem telefone"} · {a.status}</p>
                              </div>
                              {a.telefone && (
                                <Button asChild size="sm" className="w-full shrink-0 sm:w-auto" variant={a.status === "enviado" ? "outline" : "default"} onClick={() => enviarMut.mutate(a.id)}>
                                  <a href={waLink(a.telefone, msgFor(c.mensagem, a))} target="_blank" rel="noreferrer">
                                    <MessageCircle className="mr-1 h-4 w-4" />Enviar
                                  </a>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CampaignCard>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
