import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { getCampanhas, criarCampanhaInteligente, marcarCampanhaAlvoEnviado } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Megaphone, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/campanhas")({
  component: () => <RequireRole roles={GESTAO}><Page /></RequireRole>,
});

const tipoLabel: Record<string, string> = {
  inativos: "Clientes inativos",
  fidelidade: "Fidelidade",
  assinatura: "Assinaturas",
  baixa_ocupacao: "Baixa ocupacao",
  aniversario: "Aniversario",
};

function Page() {
  const list = useServerFn(getCampanhas);
  const criar = useServerFn(criarCampanhaInteligente);
  const marcar = useServerFn(marcarCampanhaAlvoEnviado);
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
    onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar envio"),
  });

  function msgFor(template: string, alvo: any) {
    return template.replaceAll("{{nome}}", String(alvo.nome ?? "Cliente").split(" ")[0]);
  }

  return (
    <>
      <PageHeader
        title="Campanhas Inteligentes"
        subtitle="Transforme oportunidades do Consultor IA em acoes de WhatsApp rastreaveis."
      />

      {isLoading && <div className="h-96 rounded-xl bg-muted animate-pulse" />}

      {data && (
        <div className="space-y-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Sugestoes automaticas</h2>
            </div>
            {data.sugestoes.length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Ainda nao ha uma campanha recomendada com dados suficientes.</CardContent></Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.sugestoes.map((s: any) => (
                  <Card key={s.tipo} className="border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="secondary">{tipoLabel[s.tipo] ?? s.tipo}</Badge>
                          <h3 className="mt-2 font-display font-semibold">{s.titulo}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{s.descricao}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Potencial</p>
                          <p className="font-display font-bold text-success">{brl(s.impactoEstimado)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{s.alvos.length} alvo(s)</span>
                        <Button size="sm" onClick={() => criarMut.mutate(s)} disabled={criarMut.isPending}>
                          <Megaphone className="mr-1 h-4 w-4" />Criar campanha
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Campanhas criadas</h2>
            </div>
            {(data.campanhas ?? []).length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma campanha criada ainda.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {data.campanhas.map((c: any) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-semibold">{c.nome}</h3>
                            <Badge variant="outline">{tipoLabel[c.tipo] ?? c.tipo}</Badge>
                            <Badge variant="secondary">{c.status}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{c.mensagem}</p>
                        </div>
                        <p className="text-sm font-medium">{c.alvos.length} alvo(s)</p>
                      </div>
                      <div className="mt-3 divide-y rounded-md border">
                        {c.alvos.slice(0, 12).map((a: any) => (
                          <div key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium">{a.nome ?? "Cliente"}</p>
                              <p className="text-xs text-muted-foreground">{a.telefone ?? "sem telefone"} · {a.status}</p>
                            </div>
                            {a.telefone && (
                              <Button asChild size="sm" variant={a.status === "enviado" ? "outline" : "default"} onClick={() => enviarMut.mutate(a.id)}>
                                <a href={waLink(a.telefone, msgFor(c.mensagem, a))} target="_blank" rel="noreferrer">
                                  <MessageCircle className="mr-1 h-4 w-4" />Enviar
                                </a>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
