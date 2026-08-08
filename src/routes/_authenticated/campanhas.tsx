import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { getCampanhas, criarCampanhaInteligente, marcarCampanhaAlvoEnviado } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, ChevronRight, MessageCircle, Megaphone, Play, Sparkles, SkipForward, Users } from "lucide-react";
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

function personalizar(template: string, nome?: string | null) {
  return template.replaceAll("{{nome}}", String(nome ?? "Cliente").split(" ")[0]);
}

function Metric({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`break-words font-display text-sm font-bold tabular-nums ${muted ? "text-muted-foreground" : ""}`}>{value}</p>
    </div>
  );
}

function Page() {
  const list = useServerFn(getCampanhas);
  const criar = useServerFn(criarCampanhaInteligente);
  const marcar = useServerFn(marcarCampanhaAlvoEnviado);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["campanhas"], queryFn: () => list() });

  const [execId, setExecId] = useState<string | null>(null);
  const [pulados, setPulados] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const criarMut = useMutation({
    mutationFn: (s: any) => criar({ data: { tipo: s.tipo, nome: s.titulo, mensagem: s.mensagem } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campanhas"] }); toast.success("Campanha criada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar campanha"),
  });

  const confirmarMut = useMutation({
    mutationFn: (id: string) => marcar({ data: { id } }),
    onSuccess: () => { setAberto(false); qc.invalidateQueries({ queryKey: ["campanhas"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao confirmar envio"),
  });

  const campanhas = data?.campanhas ?? [];
  const emAndamento = campanhas.filter((c: any) => c.status !== "concluida");
  const historico = campanhas.filter((c: any) => c.status === "concluida");
  const execucao = useMemo(() => campanhas.find((c: any) => c.id === execId), [campanhas, execId]);

  if (execucao) {
    const alvos = (execucao.alvos ?? []) as any[];
    const pendentes = alvos.filter((a: any) => a.status === "pendente" && !pulados.includes(a.id));
    const alvo = pendentes[0];
    const contatados = alvos.filter((a: any) => ["enviado", "convertido"].includes(a.status)).length;

    return (
      <>
        <PageHeader title={execucao.nome} subtitle={`${contatados} de ${alvos.length} contatados`} />
        <div className="mx-auto w-full max-w-xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setExecId(null); setAberto(false); setPulados([]); }}>
            <ArrowLeft className="mr-1 h-4 w-4" />Voltar
          </Button>

          {!alvo ? (
            <Card>
              <CardContent className="min-w-0 space-y-3 p-5">
                <h2 className="font-display text-lg font-semibold">Contatos concluídos</h2>
                <p className="text-sm text-muted-foreground">Todos os alvos desta campanha já foram tratados. Aguardando conversões.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Público" value={String(execucao.metricas.total)} />
                  <Metric label="Enviados" value={String(execucao.metricas.enviados)} />
                  <Metric label="Convertidos" value={String(execucao.metricas.convertidos)} />
                  <Metric
                    label="Receita"
                    value={execucao.receitaInfluenciada ? brl(execucao.receitaInfluenciada) : "Sem receita ainda"}
                    muted={!execucao.receitaInfluenciada}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="min-w-0 space-y-4 p-5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Próximo contato</p>
                  <h2 className="break-words font-display text-lg font-semibold">{alvo.nome ?? "Cliente"}</h2>
                  <p className="break-words text-sm text-muted-foreground">{alvo.telefone ?? "sem telefone"}</p>
                </div>

                <div className="min-w-0 whitespace-pre-wrap break-words rounded-2xl border bg-muted/40 p-3 text-sm leading-relaxed">
                  {personalizar(execucao.mensagem, alvo.nome)}
                </div>

                {!aberto ? (
                  <Button asChild className="w-full" variant="premium" disabled={!alvo.telefone}>
                    <a
                      href={alvo.telefone ? waLink(alvo.telefone, personalizar(execucao.mensagem, alvo.nome)) : "#"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setAberto(true)}
                    >
                      <MessageCircle className="mr-1 h-4 w-4" />Abrir WhatsApp
                    </a>
                  </Button>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="w-full" onClick={() => confirmarMut.mutate(alvo.id)} disabled={confirmarMut.isPending}>
                      <Check className="mr-1 h-4 w-4" />Confirmar envio
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => { setPulados((p) => [...p, alvo.id]); setAberto(false); }}>
                      <SkipForward className="mr-1 h-4 w-4" />Pular
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Abrir o WhatsApp não marca envio. Confirme apenas depois de enviar de fato.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Campanhas"
        subtitle="Sugestão, execução e resultado — em um fluxo simples."
      />

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />)}
        </div>
      )}

      {data && (
        <div className="min-w-0 space-y-6">
          <section className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Recomendado agora</h2>
            </div>
            {data.sugestoes.length === 0 ? (
              <Card><CardContent className="p-5 text-sm text-muted-foreground">Nenhuma campanha recomendada com os dados atuais.</CardContent></Card>
            ) : (
              <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                {data.sugestoes.map((s: any) => (
                  <Card key={s.tipo} className="w-full max-w-full overflow-hidden">
                    <CardContent className="min-w-0 space-y-3 p-4">
                      <div className="min-w-0">
                        <Badge variant="secondary" className="max-w-full whitespace-normal break-words">{tipoLabel[s.tipo] ?? s.tipo}</Badge>
                        <h3 className="mt-2 break-words font-display text-base font-semibold">{s.titulo}</h3>
                        <p className="mt-1 break-words text-sm text-muted-foreground">{s.descricao}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Metric label="Clientes elegíveis" value={String(s.alvos.length)} />
                        <Metric label="Potencial esperado" value={brl(s.potencialEsperado ?? 0)} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Estimativa com {Math.round((s.taxaEsperada ?? 0) * 100)}% de conversão esperada — não é receita garantida.
                      </p>
                      <Button className="w-full" variant="premium" onClick={() => criarMut.mutate(s)} disabled={criarMut.isPending}>
                        <Megaphone className="mr-1 h-4 w-4" />Criar campanha
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Em andamento</h2>
            </div>
            {emAndamento.length === 0 ? (
              <Card><CardContent className="p-5 text-sm text-muted-foreground">Nenhuma campanha em andamento.</CardContent></Card>
            ) : (
              <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                {emAndamento.map((c: any) => {
                  const m = c.metricas;
                  const semPendentes = m.pendentes === 0;
                  return (
                    <Card key={c.id} className="w-full max-w-full overflow-hidden">
                      <CardContent className="min-w-0 space-y-3 p-4">
                        <div className="min-w-0">
                          <Badge variant="secondary" className="max-w-full whitespace-normal break-words">{tipoLabel[c.tipo] ?? c.tipo}</Badge>
                          <h3 className="mt-2 break-words font-display text-base font-semibold">{c.nome}</h3>
                          <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{c.mensagem}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Metric label="Público" value={String(m.total)} />
                          <Metric label="Enviados" value={`${m.enviados}/${m.total}`} />
                          <Metric label="Convertidos" value={`${m.convertidos} · ${Math.round(m.conversao * 100)}%`} />
                          <Metric
                            label="Receita influenciada"
                            value={c.receitaInfluenciada ? brl(c.receitaInfluenciada) : "Sem receita atribuída ainda"}
                            muted={!c.receitaInfluenciada}
                          />
                        </div>
                        {semPendentes ? (
                          <p className="inline-flex min-w-0 items-center gap-1 break-words text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5 shrink-0" />Contatos concluídos · aguardando conversões
                          </p>
                        ) : (
                          <Button className="w-full" onClick={() => { setExecId(c.id); setAberto(false); setPulados([]); }}>
                            Continuar campanha<ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {historico.length > 0 && (
            <section className="min-w-0">
              <button
                type="button"
                className="mb-3 flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setMostrarHistorico((v) => !v)}
              >
                <h2 className="min-w-0 truncate font-display font-semibold text-muted-foreground">Histórico ({historico.length})</h2>
                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${mostrarHistorico ? "rotate-90" : ""}`} />
              </button>
              {mostrarHistorico && (
                <div className="min-w-0 divide-y rounded-2xl border bg-card">
                  {historico.map((c: any) => (
                    <div key={c.id} className="min-w-0 space-y-2 p-4">
                      <p className="break-words text-sm font-medium">{c.nome}</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Metric label="Contatos" value={String(c.metricas.total)} />
                        <Metric label="Enviados" value={String(c.metricas.enviados)} />
                        <Metric label="Convertidos" value={`${c.metricas.convertidos} · ${Math.round(c.metricas.conversao * 100)}%`} />
                        <Metric
                          label="Receita"
                          value={c.receitaInfluenciada ? brl(c.receitaInfluenciada) : "Sem receita atribuída"}
                          muted={!c.receitaInfluenciada}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
