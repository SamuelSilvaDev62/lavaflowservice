import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBusinessContext, updateBusinessContext } from "@/lib/business-context.functions";
import {
  BUSINESS_CONTEXT_FIELDS,
  BUSINESS_CONTEXT_GROUPS,
  KNOWLEDGE_SOURCE_LABEL,
  TONS_DE_VOZ,
  businessContextCompleteness,
  businessContextFatos,
  fieldsByGroup,
  groupCompleteness,
  knowledgeSources,
  mergeEmpresaIntoContext,
  type BusinessContext,
} from "@/lib/business-context";

export function ContextoNegocioTab() {
  const get = useServerFn(getBusinessContext);
  const save = useServerFn(updateBusinessContext);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["business-context"], queryFn: () => get() });

  const [ctx, setCtx] = useState<BusinessContext>({});
  const [tom, setTom] = useState<string>("");

  useEffect(() => {
    if (!data) return;
    setCtx(mergeEmpresaIntoContext(data.businessContext as BusinessContext, data.empresa as any));
    setTom(data.preferredTone ?? "");
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          ai_enabled: true,
          preferred_tone: tom || null,
          business_context: Object.fromEntries(
            BUSINESS_CONTEXT_FIELDS.map((f) => [f.key, (ctx[f.key] as string | null) ?? null]),
          ) as any,
        },
      }),
    onSuccess: () => {
      toast.success("Conhecimento do negócio salvo.");
      void qc.invalidateQueries({ queryKey: ["business-context"] });
      void qc.invalidateQueries({ queryKey: ["consultor-contexto"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const completude = businessContextCompleteness(ctx, tom);
  const fatos = businessContextFatos(ctx, (data?.empresa ?? null) as any, tom);
  const fontes = knowledgeSources(ctx, {
    temHistorico: data?.temHistoricoOperacional ?? false,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">Conhecimento do Negócio</h2>
              <p className="text-sm text-muted-foreground">
                Quanto mais contexto, mais específicas ficam as campanhas e recomendações.
              </p>
            </div>
            <span className="text-sm font-semibold">{completude}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completude}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Nome, endereço, horário, Instagram, Facebook e site vêm automaticamente da aba Empresa — não
            precisa digitar de novo. Os links são apenas referências cadastradas: o LavaFlow não faz leitura
            automática do Google ou das redes sociais.
          </p>
        </CardContent>
      </Card>

      {fatos.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold">O LavaFlow sabe que…</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {fatos.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1.5">
        <Label>Tom de voz</Label>
        <Select value={tom} onValueChange={setTom}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tom" />
          </SelectTrigger>
          <SelectContent>
            {TONS_DE_VOZ.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Usado em toda comunicação sugerida pelo LavaFlow.</p>
      </div>

      <Accordion type="multiple" defaultValue={["identidade"]} className="space-y-3">
        {BUSINESS_CONTEXT_GROUPS.map((g) => {
          const prog = groupCompleteness(ctx, g.id);
          return (
            <AccordionItem key={g.id} value={g.id} className="rounded-2xl border bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                  <span className="text-sm font-semibold">{g.titulo}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {prog.preenchidos}/{prog.total}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <p className="text-xs text-muted-foreground">{g.porque}</p>

                {g.id === "digital" && (
                  <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                    <p className="text-xs font-semibold">Fontes de conhecimento</p>
                    <ul className="space-y-1.5">
                      {fontes.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">{f.nome}</span>
                          <Badge variant={f.estado === "ativo" ? "default" : "outline"} className="shrink-0">
                            {KNOWLEDGE_SOURCE_LABEL[f.estado]}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground">
                      Nenhuma fonte externa é lida ou sincronizada automaticamente nesta versão.
                    </p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {fieldsByGroup(g.id).map((f) => (
                    <div key={f.key} className={`space-y-1.5 ${f.long ? "sm:col-span-2" : ""}`}>
                      <Label>{f.label}</Label>
                      {f.long ? (
                        <Textarea
                          rows={3}
                          value={(ctx[f.key] as string) ?? ""}
                          placeholder={f.placeholder}
                          onChange={(e) => setCtx({ ...ctx, [f.key]: e.target.value })}
                        />
                      ) : (
                        <Input
                          value={(ctx[f.key] as string) ?? ""}
                          placeholder={f.placeholder}
                          onChange={(e) => setCtx({ ...ctx, [f.key]: e.target.value })}
                        />
                      )}
                      {f.ajuda && <p className="text-[11px] text-muted-foreground">{f.ajuda}</p>}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Button className="w-full sm:w-auto" onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? "Salvando…" : "Salvar conhecimento"}
      </Button>
    </div>
  );
}
