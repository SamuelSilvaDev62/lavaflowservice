import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBusinessContext, updateBusinessContext } from "@/lib/business-context.functions";
import {
  BUSINESS_CONTEXT_FIELDS,
  TONS_DE_VOZ,
  businessContextCompleteness,
  businessContextFatos,
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
      toast.success("Contexto do negócio salvo.");
      void qc.invalidateQueries({ queryKey: ["business-context"] });
      void qc.invalidateQueries({ queryKey: ["consultor-contexto"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const completude = businessContextCompleteness(ctx, tom);
  const fatos = businessContextFatos(ctx, (data?.empresa ?? null) as any, tom);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">Contexto do Negócio</h2>
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
            precisa digitar de novo. Os links abaixo são apenas referências cadastradas: o LavaFlow não faz
            leitura automática do Google ou das redes sociais.
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

      <Card>
        <CardContent className="space-y-4 p-4">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {BUSINESS_CONTEXT_FIELDS.map((f) => (
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
              </div>
            ))}
          </div>

          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar contexto"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
