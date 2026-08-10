import { FeatureGate } from "@/components/feature-gate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { getClienteInativos } from "@/lib/lavaflow.functions";
import { waLink, renderTemplate, getTemplate, setTemplate, type WhatsAppTemplateKey } from "@/lib/whatsapp";
import { MessageCircle, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/clientes/inativos")({
  component: () => (
    <FeatureGate feature="clientes_inativos">
      <Page />
    </FeatureGate>
  ),
});

const tabs = [
  { dias: 30, key: "reativacao_30" as WhatsAppTemplateKey, label: "30 dias" },
  { dias: 45, key: "reativacao_45" as WhatsAppTemplateKey, label: "45 dias" },
  { dias: 60, key: "reativacao_60" as WhatsAppTemplateKey, label: "60 dias" },
  { dias: 90, key: "reativacao_90" as WhatsAppTemplateKey, label: "90+ dias" },
];

function Page() {
  const [tab, setTab] = useState(tabs[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [template, setTpl] = useState(getTemplate(tab.key));

  const fn = useServerFn(getClienteInativos);
  const { data, isLoading } = useQuery({ queryKey: ["inativos", tab.dias], queryFn: () => fn({ data: { dias: tab.dias } }) });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  const selecionadosComTel = (data?.inativos ?? []).filter((c) => selected.has(c.id) && c.telefone);
  const proximo = selecionadosComTel[0];

  function sendProximo() {
    if (!proximo) return;
    const url = waLink(proximo.telefone!, renderTemplate(template, { nome: proximo.nome.split(" ")[0] }));
    window.open(url, "_blank", "noopener,noreferrer");
    // remove do conjunto para avançar
    const next = new Set(selected);
    next.delete(proximo.id);
    setSelected(next);
  }

  return (
    <>
      <PageHeader title="Clientes inativos" subtitle="Recupere clientes que pararam de aparecer."
        actions={
          <Dialog>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" />Editar mensagem</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Mensagem para {tab.label}</DialogTitle></DialogHeader>
              <Textarea rows={6} value={template} onChange={(e) => setTpl(e.target.value)} />
              <p className="text-xs text-muted-foreground">Use <code>{"{{nome}}"}</code> para o primeiro nome.</p>
              <Button onClick={() => { setTemplate(tab.key, template); }}>Salvar</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={String(tab.dias)} onValueChange={(v) => { const t = tabs.find(x => String(x.dias) === v)!; setTab(t); setTpl(getTemplate(t.key)); setSelected(new Set()); }}>
        <TabsList className="grid grid-cols-4 w-full mb-4">
          {tabs.map((t) => <TabsTrigger key={t.dias} value={String(t.dias)}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{data?.inativos.length ?? 0} clientes · {selecionadosComTel.length} na fila</p>
        <Button size="sm" disabled={!proximo} onClick={sendProximo}>
          <MessageCircle className="h-4 w-4 mr-1" />
          {proximo ? `Enviar para ${proximo.nome.split(" ")[0]}` : "Selecione clientes"}
        </Button>
      </div>
      {selecionadosComTel.length > 1 && (
        <p className="text-xs text-muted-foreground -mt-1 mb-3">
          💡 O WhatsApp bloqueia envio em massa automático. Clique uma vez para cada cliente — leva poucos segundos.
        </p>
      )}

      {isLoading && <div className="h-64 rounded-xl bg-muted animate-pulse" />}

      <Card><CardContent className="p-0"><div className="divide-y">
        {data?.inativos.map((c) => (
          <label key={c.id} className="p-4 flex items-center gap-3 hover:bg-accent/40 cursor-pointer">
            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} disabled={!c.telefone} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{c.nome}</p>
              <p className="text-xs text-muted-foreground">{c.telefone ?? "sem telefone"} · {c.dias_inativo}d sem voltar</p>
            </div>
            {c.telefone && (
              <Button asChild size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
                <a href={waLink(c.telefone, renderTemplate(template, { nome: c.nome.split(" ")[0] }))} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4" /></a>
              </Button>
            )}
          </label>
        ))}
        {data && data.inativos.length === 0 && <p className="p-10 text-center text-muted-foreground text-sm">Nenhum cliente inativo nesse intervalo. 🎉</p>}
      </div></CardContent></Card>
    </>
  );
}
