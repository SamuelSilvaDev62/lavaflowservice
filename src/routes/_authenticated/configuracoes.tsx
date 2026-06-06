import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEmpresa, updateEmpresa, listServicos, upsertServico } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { allTemplates, setTemplate, type WhatsAppTemplateKey } from "@/lib/whatsapp";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Empresa, serviços e mensagens." />
      <Tabs defaultValue="empresa">
        <TabsList className="mb-4">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="msg">Mensagens</TabsTrigger>
        </TabsList>
        <TabsContent value="empresa"><EmpresaTab /></TabsContent>
        <TabsContent value="servicos"><ServicosTab /></TabsContent>
        <TabsContent value="msg"><MsgTab /></TabsContent>
      </Tabs>
    </>
  );
}

function EmpresaTab() {
  const fn = useServerFn(getEmpresa);
  const up = useServerFn(updateEmpresa);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["empresa"], queryFn: () => fn() });
  const [f, setF] = useState<any>({ nome_fantasia: "" });
  useEffect(() => { if (data?.empresa) setF(data.empresa); }, [data?.empresa]);

  const mut = useMutation({
    mutationFn: () => up({ data: f }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa"] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Card><CardContent className="p-5 space-y-3">
      <div><Label>Nome fantasia</Label><Input value={f.nome_fantasia ?? ""} onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })} /></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Telefone</Label><Input value={f.telefone ?? ""} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
        <div><Label>WhatsApp</Label><Input value={f.whatsapp ?? ""} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
      </div>
      <div><Label>Email</Label><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div><Label>Endereço</Label><Input value={f.endereco ?? ""} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></div>
      <div><Label>Horário</Label><Input value={f.horario_funcionamento ?? ""} onChange={(e) => setF({ ...f, horario_funcionamento: e.target.value })} /></div>
      <div><Label>Instagram</Label><Input value={f.instagram ?? ""} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
    </CardContent></Card>
  );
}

function ServicosTab() {
  const fn = useServerFn(listServicos);
  const up = useServerFn(upsertServico);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["servicos"], queryFn: () => fn() });
  const [novo, setNovo] = useState({ nome: "", preco_padrao: 0 });
  const mut = useMutation({
    mutationFn: (v: any) => up({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["servicos"] }); setNovo({ nome: "", preco_padrao: 0 }); toast.success("Salvo"); },
  });
  return (
    <Card><CardContent className="p-5 space-y-3">
      <div className="space-y-2">
        {data?.servicos.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span className="font-medium">{s.nome}</span><span>{brl(s.preco_padrao)}</span>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate({ ...novo, ativo: true }); }} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div><Label>Novo serviço</Label><Input required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></div>
        <div><Label>Preço</Label><Input type="number" step="0.01" required value={novo.preco_padrao} onChange={(e) => setNovo({ ...novo, preco_padrao: Number(e.target.value) })} className="w-24" /></div>
        <Button type="submit">Adicionar</Button>
      </form>
    </CardContent></Card>
  );
}

function MsgTab() {
  const [tpls, setTpls] = useState(() => allTemplates());
  function save(key: WhatsAppTemplateKey, value: string) {
    setTemplate(key, value);
    setTpls(allTemplates());
    toast.success("Salvo");
  }
  return (
    <div className="space-y-3">
      {tpls.map((t) => (
        <Card key={t.key}><CardContent className="p-4 space-y-2">
          <Label className="text-xs uppercase tracking-wide">{t.key}</Label>
          <Textarea rows={3} defaultValue={t.value} onBlur={(e) => save(t.key, e.target.value)} />
          <p className="text-xs text-muted-foreground">Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{placa}}"}</code></p>
        </CardContent></Card>
      ))}
    </div>
  );
}
