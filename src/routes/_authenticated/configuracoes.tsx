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
import { getEmpresa, updateEmpresa, listServicos, upsertServico, getAgendaConfig, updateAgendaConfig, listTenantMembers, setMemberRole, listUpsellRegras, upsertUpsellRegra } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { allTemplates, setTemplate, type WhatsAppTemplateKey } from "@/lib/whatsapp";
import { FIDELIDADE_DEFAULTS, type TplKey as FidTplKey } from "@/lib/fidelidade-messages";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, type AppRole } from "@/lib/rbac";
import { useRole } from "@/hooks/use-role";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { RequireRole } from "@/components/require-role";
import { ImageUploadField } from "@/components/image-upload-field";
import { ADMINS } from "@/lib/rbac";
import { AssinaturaTab } from "@/components/configuracoes/assinatura-tab";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: () => <RequireRole roles={ADMINS}><Page /></RequireRole>,
});

function Page() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Empresa, serviços, equipe e mensagens." />
      <Tabs defaultValue="empresa">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="upsell">Upsell</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="membros">Membros e papéis</TabsTrigger>
          <TabsTrigger value="msg">Mensagens</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
        </TabsList>
        <TabsContent value="empresa"><EmpresaTab /></TabsContent>
        <TabsContent value="servicos"><ServicosTab /></TabsContent>
        <TabsContent value="upsell"><UpsellTab /></TabsContent>
        <TabsContent value="agenda"><AgendaTab /></TabsContent>
        <TabsContent value="membros"><MembrosTab /></TabsContent>
        <TabsContent value="msg"><MsgTab /></TabsContent>
        <TabsContent value="assinatura"><AssinaturaTab /></TabsContent>
      </Tabs>
    </>
  );
}

function UpsellTab() {
  const list = useServerFn(listUpsellRegras);
  const save = useServerFn(upsertUpsellRegra);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["upsell-regras"], queryFn: () => list() });
  const empty = {
    id: undefined as string | undefined,
    item_chave: "",
    item_label: "",
    servico_sugerido: "",
    servico_id: null as string | null,
    termosTexto: "",
    motivo: "",
    ativo: true,
    prioridade: 1,
  };
  const [form, setForm] = useState(empty);
  const mut = useMutation({
    mutationFn: () => save({
      data: {
        id: form.id,
        item_chave: form.item_chave,
        item_label: form.item_label,
        servico_sugerido: form.servico_sugerido,
        servico_id: form.servico_id,
        termos: form.termosTexto.split(",").map((s) => s.trim()).filter(Boolean),
        motivo: form.motivo,
        ativo: form.ativo,
        prioridade: Number(form.prioridade) || 1,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upsell-regras"] });
      setForm(empty);
      toast.success("Regra de upsell salva");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar regra"),
  });

  function edit(row: any) {
    setForm({
      id: row.id,
      item_chave: row.item_chave,
      item_label: row.item_label,
      servico_sugerido: row.servico_sugerido,
      servico_id: row.servico_id ?? null,
      termosTexto: (row.termos ?? []).join(", "),
      motivo: row.motivo,
      ativo: row.ativo ?? true,
      prioridade: Number(row.prioridade ?? 1),
    });
  }

  function setItem(chave: string) {
    const item = data?.itensChecklist.find((i: any) => i.chave === chave);
    setForm({ ...form, item_chave: chave, item_label: item?.label ?? chave });
  }

  function setServico(id: string) {
    const svc = data?.servicos.find((s: any) => s.id === id);
    setForm({
      ...form,
      servico_id: id,
      servico_sugerido: svc?.nome ?? form.servico_sugerido,
      termosTexto: form.termosTexto || svc?.nome || "",
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Card><CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-display font-semibold">Motor de Upsell</h3>
          <p className="text-xs text-muted-foreground">Configure quais itens do checklist geram sugestoes comerciais automaticamente.</p>
        </div>
        {isLoading && <div className="h-48 rounded-md bg-muted animate-pulse" />}
        <div className="space-y-2">
          {(data?.regras ?? []).map((r: any) => (
            <div key={r.id ?? r.item_chave} className="rounded-md border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.item_label}</span>
                    <Badge variant={r.ativo === false ? "secondary" : "outline"}>{r.ativo === false ? "Inativa" : "Ativa"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.servico_sugerido}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.motivo}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => edit(r)}>Editar</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div>
            <h3 className="font-display font-semibold">{form.id ? "Editar regra" : "Nova regra"}</h3>
            <p className="text-xs text-muted-foreground">Use servicos reais cadastrados para estimar valor do upsell.</p>
          </div>
          <div>
            <Label>Item do checklist</Label>
            <Select value={form.item_chave} onValueChange={setItem}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{data?.itensChecklist.map((i: any) => <SelectItem key={i.chave} value={i.chave}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Servico sugerido</Label>
            <Select value={form.servico_id ?? ""} onValueChange={setServico}>
              <SelectTrigger><SelectValue placeholder="Vincular servico cadastrado" /></SelectTrigger>
              <SelectContent>{data?.servicos.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome} - {brl(s.preco_padrao)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Nome exibido</Label><Input value={form.servico_sugerido} onChange={(e) => setForm({ ...form, servico_sugerido: e.target.value })} /></div>
          <div><Label>Termos para encontrar servico</Label><Input placeholder="polimento, cristalizacao" value={form.termosTexto} onChange={(e) => setForm({ ...form, termosTexto: e.target.value })} /></div>
          <div><Label>Motivo comercial</Label><Textarea rows={4} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prioridade</Label><Input type="number" min={1} value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.ativo ? "true" : "false"} onValueChange={(v) => setForm({ ...form, ativo: v === "true" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativa</SelectItem>
                  <SelectItem value="false">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={mut.isPending || !form.item_chave || !form.servico_sugerido || !form.motivo}>Salvar regra</Button>
            <Button type="button" variant="outline" onClick={() => setForm(empty)}>Limpar</Button>
          </div>
        </form>
      </CardContent></Card>
    </div>
  );
}

function MembrosTab() {
  const fn = useServerFn(listTenantMembers);
  const setFn = useServerFn(setMemberRole);
  const qc = useQueryClient();
  const { role: myRole } = useRole();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-members"], queryFn: () => fn() });

  const mut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) =>
      setFn({ data: { user_id: v.user_id, role: v.role as any } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-members"] }); toast.success("Papel atualizado"); },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const opcoes: { value: AppRole; label: string }[] = [
    { value: "admin", label: "Administrador" },
    { value: "gerente", label: "Gerente" },
    { value: "atendente", label: "Atendente" },
    { value: "lavador", label: "Lavador" },
  ];

  return (
    <Card><CardContent className="p-5 space-y-3">
      <div>
        <h3 className="font-display font-semibold">Quem tem acesso</h3>
        <p className="text-xs text-muted-foreground">
          Promova ou rebaixe membros do seu lava-rápido. Apenas o proprietário pode designar administradores.
        </p>
      </div>
      {isLoading && <div className="h-32 rounded-md bg-muted animate-pulse" />}
      <ul className="divide-y">
        {(data?.membros ?? []).map((m: any) => {
          const isOwner = m.role === "owner";
          const isAdmin = m.role === "admin";
          const canEdit = !isOwner && (myRole === "owner" || (myRole === "admin" && !isAdmin));
          return (
            <li key={m.user_id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.funcionario_nome ?? m.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email ?? "—"}</p>
              </div>
              {isOwner ? (
                <Badge>{ROLE_LABELS[m.role as AppRole]}</Badge>
              ) : (
                <Select
                  value={m.role}
                  onValueChange={(v) => mut.mutate({ user_id: m.user_id, role: v as AppRole })}
                  disabled={!canEdit || mut.isPending}
                >
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opcoes.map((o) => (
                      <SelectItem
                        key={o.value} value={o.value}
                        disabled={o.value === "admin" && myRole !== "owner"}
                      >{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </li>
          );
        })}
        {!isLoading && (data?.membros ?? []).length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">Ainda não há membros vinculados.</li>
        )}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Para adicionar alguém, vá em <strong>Equipe → Novo</strong>, preencha o e-mail e escolha o perfil.
      </p>
    </CardContent></Card>
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
  const emptyServico = {
    id: undefined as string | undefined,
    nome: "",
    categoria: "",
    preco_padrao: 0,
    tempo_estimado_min: 30,
    pontos_gerados: 0,
    comissao_tipo: "" as "" | "fixo" | "percentual",
    comissao_valor: 0,
    descricao: "",
    foto_url: "",
    disponivel_online: true,
    ativo: true,
  };
  const [form, setForm] = useState(emptyServico);
  const mut = useMutation({
    mutationFn: (v: typeof emptyServico) => up({
      data: {
        ...v,
        categoria: v.categoria || null,
        descricao: v.descricao || null,
        foto_url: v.foto_url || null,
        comissao_tipo: v.comissao_tipo || null,
        preco_padrao: Number(v.preco_padrao),
        tempo_estimado_min: Number(v.tempo_estimado_min) || 30,
        pontos_gerados: Number(v.pontos_gerados) || 0,
        comissao_valor: Number(v.comissao_valor) || 0,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos"] });
      setForm(emptyServico);
      toast.success("Serviço salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar serviço"),
  });

  function editServico(s: any) {
    setForm({
      id: s.id,
      nome: s.nome ?? "",
      categoria: s.categoria ?? "",
      preco_padrao: Number(s.preco_padrao ?? 0),
      tempo_estimado_min: Number(s.tempo_estimado_min ?? 30),
      pontos_gerados: Number(s.pontos_gerados ?? 0),
      comissao_tipo: s.comissao_tipo ?? "",
      comissao_valor: Number(s.comissao_valor ?? 0),
      descricao: s.descricao ?? "",
      foto_url: s.foto_url ?? "",
      disponivel_online: s.disponivel_online ?? true,
      ativo: s.ativo ?? true,
    });
  }

  function duplicateServico(s: any) {
    editServico({ ...s, id: undefined, nome: `${s.nome} (cópia)` });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Card><CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-display font-semibold">Catálogo de serviços</h3>
          <p className="text-xs text-muted-foreground">Configure duração, pontuação, comissão e disponibilidade online.</p>
        </div>
        <div className="space-y-2">
          {data?.servicos.map((s: any) => (
            <div key={s.id} className="rounded-md border p-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{s.nome}</span>
                    {s.categoria && <Badge variant="outline">{s.categoria}</Badge>}
                    {!s.ativo && <Badge variant="secondary">Arquivado</Badge>}
                    {s.disponivel_online === false && <Badge variant="secondary">Offline</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {brl(s.preco_padrao)} · {s.tempo_estimado_min ?? 30} min · {s.pontos_gerados ?? 0} pts
                  </p>
                  {s.descricao && <p className="text-xs text-muted-foreground max-h-10 overflow-hidden">{s.descricao}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => editServico(s)}>Editar</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => duplicateServico(s)}>Duplicar</Button>
                </div>
              </div>
            </div>
          ))}
          {(data?.servicos ?? []).length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum serviço cadastrado ainda.
            </div>
          )}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold">{form.id ? "Editar serviço" : "Novo serviço"}</h3>
              <p className="text-xs text-muted-foreground">Dados usados na agenda, fidelidade e reserva pública.</p>
            </div>
            {form.id && <Button type="button" variant="ghost" size="sm" onClick={() => setForm(emptyServico)}>Limpar</Button>}
          </div>

          <div className="space-y-2">
            <Label>Nome do serviço</Label>
            <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input placeholder="Ex.: Lavagem, estética" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preço padrão</Label>
              <Input type="number" step="0.01" inputMode="decimal" placeholder="0,00" required value={form.preco_padrao === 0 ? "" : form.preco_padrao} onChange={(e) => setForm({ ...form, preco_padrao: e.target.value === "" ? 0 : Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tempo estimado (min)</Label>
              <Input type="number" min={1} required value={form.tempo_estimado_min} onChange={(e) => setForm({ ...form, tempo_estimado_min: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Pontos gerados</Label>
              <Input type="number" min={0} value={form.pontos_gerados} onChange={(e) => setForm({ ...form, pontos_gerados: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de comissão</Label>
              <Select value={form.comissao_tipo || "__none__"} onValueChange={(v) => setForm({ ...form, comissao_tipo: v === "__none__" ? "" : v as "fixo" | "percentual" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem comissão</SelectItem>
                  <SelectItem value="fixo">Valor fixo</SelectItem>
                  <SelectItem value="percentual">Percentual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor da comissão</Label>
              <Input type="number" min={0} step="0.01" disabled={!form.comissao_tipo} value={form.comissao_valor === 0 ? "" : form.comissao_valor} onChange={(e) => setForm({ ...form, comissao_valor: e.target.value === "" ? 0 : Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} placeholder="Detalhe o que está incluso no serviço" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <ImageUploadField
            bucket="service-images"
            label="Foto do serviço"
            aspect="video"
            hint="JPG/PNG/WebP até 8MB. A imagem é otimizada automaticamente."
            value={form.foto_url || null}
            onChange={(url: string | null) => setForm({ ...form, foto_url: url ?? "" })}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="checkbox" checked={form.disponivel_online} onChange={(e) => setForm({ ...form, disponivel_online: e.target.checked })} />
              Disponível online
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Serviço ativo
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={mut.isPending}>
            {form.id ? "Salvar alterações" : "Adicionar serviço"}
          </Button>
        </form>
      </CardContent></Card>
    </div>
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
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="font-display font-semibold text-base">Mensagens gerais</h3>
          <p className="text-xs text-muted-foreground">Variáveis disponíveis: <code>{"{{nome}}"}</code>, <code>{"{{placa}}"}</code></p>
        </div>
        {tpls.map((t) => (
          <Card key={t.key}><CardContent className="p-4 space-y-2">
            <Label className="text-xs uppercase tracking-wide">{t.key}</Label>
            <Textarea rows={3} defaultValue={t.value} onBlur={(e) => save(t.key, e.target.value)} />
          </CardContent></Card>
        ))}
      </div>

      <FidelidadeMsgSection />
    </div>
  );
}

const FID_LABELS: Record<FidTplKey, { titulo: string; descricao: string }> = {
  fidelidade_pronto_padrao: { titulo: "Veículo pronto — padrão", descricao: "Cliente ainda não tem recompensa disponível. Mostra próxima meta." },
  fidelidade_pronto_disponivel: { titulo: "Veículo pronto — recompensa disponível", descricao: "Cliente já pode resgatar um benefício." },
  fidelidade_pronto_vip: { titulo: "Veículo pronto — cliente VIP", descricao: "10+ visitas ou 1000+ pontos. Tom de agradecimento especial." },
  fidelidade_extrato: { titulo: "Extrato de fidelidade", descricao: "Mensagem enviada via botão no perfil do cliente." },
};

const FID_VARS = "{nome}, {servico}, {valor}, {pontos_ganhos}, {saldo_atual}, {proxima_recompensa}, {pontos_faltantes}, {recompensa_disponivel}, {historico}, {disponiveis}";

function FidelidadeMsgSection() {
  const [version, setVersion] = useState(0);
  const STORAGE_KEY = "lavaflow_wa_templates";

  function getCustom(key: FidTplKey): string {
    if (typeof window === "undefined") return FIDELIDADE_DEFAULTS[key];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map[key] ?? FIDELIDADE_DEFAULTS[key];
    } catch {
      return FIDELIDADE_DEFAULTS[key];
    }
  }

  function saveCustom(key: FidTplKey, value: string) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    setVersion((v) => v + 1);
    toast.success("Mensagem de fidelidade salva");
  }

  function reset(key: FidTplKey) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    delete map[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    setVersion((v) => v + 1);
    toast.success("Restaurado para o padrão");
  }

  const keys = Object.keys(FIDELIDADE_DEFAULTS) as FidTplKey[];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display font-semibold text-base flex items-center gap-2">🎁 Mensagens do programa de fidelidade</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Personalize as mensagens enviadas quando o veículo fica pronto e o extrato de pontos.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Variáveis: <code className="text-[10px] bg-muted px-1 rounded">{FID_VARS}</code>
        </p>
      </div>
      {keys.map((k) => {
        const meta = FID_LABELS[k];
        const value = getCustom(k);
        const isCustom = value !== FIDELIDADE_DEFAULTS[k];
        return (
          <Card key={`${k}-${version}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Label className="font-medium">{meta.titulo}</Label>
                  <p className="text-xs text-muted-foreground">{meta.descricao}</p>
                </div>
                {isCustom && (
                  <Button size="sm" variant="ghost" onClick={() => reset(k)} className="text-xs h-7">Restaurar padrão</Button>
                )}
              </div>
              <Textarea rows={8} defaultValue={value} onBlur={(e) => saveCustom(k, e.target.value)} className="font-mono text-xs" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AgendaTab() {
  const fn = useServerFn(getAgendaConfig);
  const up = useServerFn(updateAgendaConfig);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["agenda-config"], queryFn: () => fn() });
  const [f, setF] = useState<any>({ hora_inicio: "08:00", hora_fim: "18:00", dias_semana: [1,2,3,4,5,6], intervalo_min: 30, capacidade_simultanea: 1 });
  useEffect(() => {
    if (data?.config) setF({
      hora_inicio: String(data.config.hora_inicio).slice(0,5),
      hora_fim: String(data.config.hora_fim).slice(0,5),
      dias_semana: data.config.dias_semana,
      intervalo_min: data.config.intervalo_min,
      capacidade_simultanea: data.config.capacidade_simultanea,
    });
  }, [data?.config]);
  const mut = useMutation({
    mutationFn: () => up({ data: f }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda-config"] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const toggleDia = (d: number) => {
    const set = new Set<number>(f.dias_semana);
    if (set.has(d)) {
      set.delete(d);
    } else {
      set.add(d);
    }
    setF({ ...f, dias_semana: Array.from(set).sort() });
  };
  return (
    <Card><CardContent className="p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Abertura</Label><Input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></div>
        <div><Label>Fechamento</Label><Input type="time" value={f.hora_fim} onChange={(e) => setF({ ...f, hora_fim: e.target.value })} /></div>
      </div>
      <div>
        <Label className="mb-2 block">Dias de funcionamento</Label>
        <div className="flex flex-wrap gap-2">
          {dias.map((label, i) => (
            <button key={i} type="button" onClick={() => toggleDia(i)}
              className={`px-3 py-1.5 rounded-md text-sm border ${f.dias_semana.includes(i) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Intervalo entre horários</Label>
          <Select value={String(f.intervalo_min)} onValueChange={(v) => setF({ ...f, intervalo_min: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Atendimentos simultâneos</Label>
          <Select value={String(f.capacidade_simultanea)} onValueChange={(v) => setF({ ...f, capacidade_simultanea: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
    </CardContent></Card>
  );
}
