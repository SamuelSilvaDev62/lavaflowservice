import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
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
import { googleMapsDirectionsUrl } from "@/lib/business-location";
import { applyCepLookup, EMPTY_BUSINESS_ADDRESS, formatBusinessAddress, formatCep, parseBusinessAddress, validAddress, type BusinessAddress, type CepLookup } from "@/lib/business-address";
import { Building2, Pencil, MapPin, Phone, MessageCircle, Mail, Clock3, Instagram, ExternalLink, Copy, CheckCircle2, AlertCircle, Link2, ArrowLeft, Globe, ShieldCheck } from "lucide-react";

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


type BusinessProfileForm = {
  nome_fantasia: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  horario_funcionamento: string;
  instagram: string;
};

const PROFILE_FIELDS: (keyof BusinessProfileForm)[] = [
  "nome_fantasia", "telefone", "whatsapp", "email", "endereco", "horario_funcionamento", "instagram",
];

function profileFromEmpresa(empresa: any): BusinessProfileForm {
  return {
    nome_fantasia: empresa?.nome_fantasia ?? "",
    telefone: empresa?.telefone ?? "",
    whatsapp: empresa?.whatsapp ?? "",
    email: empresa?.email ?? "",
    endereco: empresa?.endereco ?? "",
    horario_funcionamento: empresa?.horario_funcionamento ?? "",
    instagram: empresa?.instagram ?? "",
  };
}

function ProfileItem({ icon: Icon, label, value, href }: {
  icon: any;
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  const content = value?.trim() || "Não informado";
  return (
    <div className="flex min-w-0 items-start gap-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {href && value ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 break-words text-sm font-medium text-primary hover:underline">
            {content} <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        ) : (
          <p className={value ? "mt-0.5 break-words text-sm font-medium" : "mt-0.5 text-sm text-muted-foreground"}>
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

function EmpresaTab() {
  const fn = useServerFn(getEmpresa);
  const up = useServerFn(updateEmpresa);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["empresa"], queryFn: () => fn() });
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<BusinessProfileForm>(profileFromEmpresa(null));
  const [address, setAddress] = useState<BusinessAddress>({ ...EMPTY_BUSINESS_ADDRESS });
  const [addressTouched, setAddressTouched] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepNotice, setCepNotice] = useState("");
  const cepRequestRef = useRef(0);

  const saved = profileFromEmpresa(data?.empresa);
  const dirty = PROFILE_FIELDS.some((key) => f[key] !== saved[key]) || addressTouched;
  useEffect(() => {
    if (!editing && data?.empresa) {
      setF(profileFromEmpresa(data.empresa));
      setAddress(parseBusinessAddress(data.empresa.endereco) ?? { ...EMPTY_BUSINESS_ADDRESS });
      setAddressTouched(false);
      setCepNotice("");
    }
  }, [data?.empresa, editing]);

  const mut = useMutation({
    mutationFn: () => up({ data: {
      nome_fantasia: f.nome_fantasia.trim(),
      telefone: f.telefone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      endereco: addressTouched ? formatBusinessAddress(address) : f.endereco.trim() || null,
      horario_funcionamento: f.horario_funcionamento.trim() || null,
      instagram: f.instagram.trim() || null,
    } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["empresa"] });
      setEditing(false);
      toast.success("Informações do estabelecimento atualizadas.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar suas alterações."),
  });

  const empresa = data?.empresa;
  const slug = empresa?.slug;
  const publicPath = slug ? "/agendar/" + encodeURIComponent(slug) : null;
  const mapUrl = googleMapsDirectionsUrl(empresa?.endereco);
  const instagramHandle = String(empresa?.instagram ?? "").replace(/^@/, "").trim();
  const instagramUrl = /^[A-Za-z0-9._]{1,30}$/.test(instagramHandle)
    ? "https://instagram.com/" + instagramHandle : null;
  const whatsappDigits = String(empresa?.whatsapp ?? "").replace(/\D/g, "");
  const whatsappUrl = whatsappDigits.length >= 10 && whatsappDigits.length <= 15
    ? "https://wa.me/" + whatsappDigits : null;
  const completeCount = PROFILE_FIELDS.filter((key) => saved[key]?.trim()).length;
  const missing = PROFILE_FIELDS.filter((key) => !saved[key]?.trim());
  const displayName = empresa?.nome_fantasia || "Meu estabelecimento";

  async function copyPublicLink() {
    if (!publicPath || typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href);
      toast.success("Link de agendamento copiado.");
    } catch {
      toast.error("Não foi possível copiar. Abra a página e copie o endereço.");
    }
  }
  function cancelEditing() {
    setF(profileFromEmpresa(empresa));
    setAddress(parseBusinessAddress(empresa?.endereco) ?? { ...EMPTY_BUSINESS_ADDRESS });
    setAddressTouched(false);
    setCepNotice("");
    setEditing(false);
  }

  function changeAddress(key: keyof BusinessAddress, value: string) {
    setAddress((current) => ({ ...current, [key]: key === "cep" ? formatCep(value) : key === "uf" ? value.toUpperCase().slice(0, 2) : value }));
    setAddressTouched(true);
    if (key === "cep") { cepRequestRef.current += 1; setCepLoading(false); }
    setCepNotice("");
  }
  async function lookupCep() {
    const cep = address.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepNotice("Informe um CEP com 8 dígitos.");
      return;
    }
    const lookupId = ++cepRequestRef.current;
    setCepLoading(true);
    setCepNotice("");
    try {
      const response = await fetch("https://viacep.com.br/ws/" + cep + "/json/", { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("CEP temporariamente indisponível.");
      const result = await response.json() as CepLookup;
      if (lookupId !== cepRequestRef.current) return;
      if (result.erro) {
        setCepNotice("CEP não encontrado. Preencha o endereço manualmente.");
      } else {
        setAddress((old) => applyCepLookup(old, result));
        setAddressTouched(true);
        setCepNotice(result.logradouro && result.bairro
          ? "CEP encontrado. Confira o número e o complemento."
          : "CEP localizado parcialmente. Preencha os campos que faltam.");
      }
    } catch {
      if (lookupId === cepRequestRef.current) setCepNotice("Não foi possível consultar o CEP. Você pode preencher tudo manualmente.");
    } finally {
      if (lookupId === cepRequestRef.current) setCepLoading(false);
    }
  }

  if (isLoading) return <Card><CardContent className="space-y-4 p-5"><div className="h-20 animate-pulse rounded-2xl bg-muted" /><div className="h-44 animate-pulse rounded-2xl bg-muted" /></CardContent></Card>;
  if (isError) return <Card><CardContent className="space-y-3 p-5"><p>Não foi possível carregar o perfil do estabelecimento.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></CardContent></Card>;

  if (editing) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Button type="button" size="icon" variant="outline" aria-label="Cancelar edição" onClick={cancelEditing} disabled={mut.isPending}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">Editar estabelecimento</h2>
              <p className="text-sm text-muted-foreground">Altere os dados e confira antes de salvar.</p>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (dirty) mut.mutate(); }} className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Informações principais</h3>
              <div className="space-y-1.5"><Label htmlFor="empresa-nome">Nome do estabelecimento</Label><Input id="empresa-nome" required maxLength={120} value={f.nome_fantasia} onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })} /></div>
            </section>
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Contato</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="empresa-telefone">Telefone</Label><Input id="empresa-telefone" type="tel" maxLength={20} value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="empresa-whatsapp">WhatsApp</Label><Input id="empresa-whatsapp" type="tel" maxLength={20} value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="empresa-email">E-mail</Label><Input id="empresa-email" type="email" maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            </section>
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Localização e atendimento</h3>
              <div className="space-y-3">
                {f.endereco && !parseBusinessAddress(f.endereco) && !addressTouched && (
                  <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Endereço cadastrado anteriormente</p>
                    <p className="mt-1 break-words text-muted-foreground">{f.endereco}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ao salvar outros dados, este endereço será preservado. Para melhorar a localização, preencha os campos abaixo.</p>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="empresa-cep">CEP</Label>
                    <Input id="empresa-cep" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" value={address.cep} onChange={(e) => changeAddress("cep", e.target.value)} />
                  </div>
                  <Button type="button" variant="outline" disabled={cepLoading || address.cep.replace(/\D/g, "").length !== 8} onClick={lookupCep}>{cepLoading ? "Buscando..." : "Buscar CEP"}</Button>
                </div>
                {cepNotice && <p role="status" className="text-xs text-muted-foreground">{cepNotice}</p>}
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <div className="space-y-1.5"><Label htmlFor="empresa-rua">Rua / Avenida / Estrada</Label><Input id="empresa-rua" maxLength={100} placeholder="Rua das Flores" value={address.rua} onChange={(e) => changeAddress("rua", e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="empresa-numero">Número</Label><Input id="empresa-numero" maxLength={15} placeholder="123 ou S/N" value={address.numero} onChange={(e) => changeAddress("numero", e.target.value)} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="empresa-bairro">Bairro / Localidade</Label><Input id="empresa-bairro" maxLength={80} placeholder="Centro" value={address.bairro} onChange={(e) => changeAddress("bairro", e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="empresa-complemento">Complemento (opcional)</Label><Input id="empresa-complemento" maxLength={80} placeholder="Próximo à praça" value={address.complemento} onChange={(e) => changeAddress("complemento", e.target.value)} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <div className="space-y-1.5"><Label htmlFor="empresa-cidade">Cidade</Label><Input id="empresa-cidade" maxLength={80} value={address.cidade} onChange={(e) => changeAddress("cidade", e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="empresa-uf">UF</Label><Input id="empresa-uf" maxLength={2} placeholder="MG" value={address.uf} onChange={(e) => changeAddress("uf", e.target.value)} /></div>
                </div>
                {addressTouched && (
                  <p className="rounded-xl bg-muted/50 p-3 text-xs">
                    <strong>Prévia do endereço:</strong> {formatBusinessAddress(address)}
                    {!validAddress(address) && <span className="mt-1 block text-destructive">Preencha rua, número, bairro, cidade e UF para salvar.</span>}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Os dados atualizados serão usados nas próximas consultas da página de agendamento e nas novas mensagens de WhatsApp. Confira o ponto no Google Maps.</p>
              </div>
              <div className="space-y-1.5"><Label htmlFor="empresa-horario">Horário de funcionamento</Label><Input id="empresa-horario" maxLength={120} placeholder="Seg a Sex, 08h às 18h" value={f.horario_funcionamento} onChange={(e) => setF({ ...f, horario_funcionamento: e.target.value })} /></div>
            </section>
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Presença digital</h3>
              <div className="space-y-1.5"><Label htmlFor="empresa-instagram">Instagram</Label><Input id="empresa-instagram" maxLength={80} placeholder="@seunegocio" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></div>
            </section>
            <div className="sticky bottom-16 z-20 -mx-4 flex gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:justify-end sm:border-0 sm:px-0 lg:bottom-0">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={cancelEditing} disabled={mut.isPending}>Cancelar</Button>
              <Button type="submit" className="flex-1 sm:flex-none" disabled={mut.isPending || !dirty || !f.nome_fantasia.trim() || (addressTouched && (!validAddress(address) || formatBusinessAddress(address).length > 200))}>{mut.isPending ? "Salvando..." : "Salvar alterações"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-background" />
        <CardContent className="-mt-7 space-y-4 px-4 pb-5 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <div className="grid h-16 w-16 shrink-0 place-content-center overflow-hidden rounded-2xl border-4 border-card bg-primary text-primary-foreground shadow-md">
              {empresa?.logo_url ? <img src={empresa.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7" aria-hidden />}
            </div>
            <Badge variant="secondary" className="mb-1 gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Perfil do negócio</Badge>
          </div>
          <div>
            <h2 className="break-words font-display text-2xl font-bold tracking-tight">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie sua presença e informações comerciais em um só lugar.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button type="button" className="col-span-2 gap-2 sm:col-span-1" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar informações</Button>
            <Button asChild variant="outline" disabled={!publicPath} className="gap-2">
              {publicPath ? <a href={publicPath} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Ver agendamento</a> : <span><ExternalLink className="h-4 w-4" /> Sem link</span>}
            </Button>
            <Button variant="outline" disabled={!publicPath} onClick={copyPublicLink} className="gap-2"><Copy className="h-4 w-4" /> Copiar link</Button>
          </div>
        </CardContent>
      </Card>

      {missing.length > 0 && (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold">Complete seu perfil — {completeCount} de {PROFILE_FIELDS.length} informações</p>
              <p className="text-xs text-muted-foreground">Informações ausentes: {missing.map((key) => ({
                nome_fantasia: "nome", telefone: "telefone", whatsapp: "WhatsApp", email: "e-mail", endereco: "endereço", horario_funcionamento: "horário", instagram: "Instagram",
              })[key]).join(", ")}.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Completar</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-4 sm:p-5">
          <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold"><Phone className="h-4 w-4 text-primary" /> Contato</h3>
          <div className="divide-y">
            <ProfileItem icon={Phone} label="Telefone" value={empresa?.telefone} />
            <ProfileItem icon={MessageCircle} label="WhatsApp" value={empresa?.whatsapp} href={whatsappUrl} />
            <ProfileItem icon={Mail} label="E-mail" value={empresa?.email} href={empresa?.email ? "mailto:" + encodeURIComponent(empresa.email) : null} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 sm:p-5">
          <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold"><MapPin className="h-4 w-4 text-primary" /> Localização e horário</h3>
          <div className="divide-y">
            <ProfileItem icon={MapPin} label="Endereço" value={empresa?.endereco} href={mapUrl} />
            <ProfileItem icon={Clock3} label="Funcionamento" value={empresa?.horario_funcionamento} />
          </div>
          {mapUrl && <Button asChild variant="outline" size="sm" className="mt-3 gap-2"><a href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" /> Abrir no Google Maps</a></Button>}
        </CardContent></Card>
        <Card><CardContent className="p-4 sm:p-5">
          <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold"><Globe className="h-4 w-4 text-primary" /> Presença digital</h3>
          <div className="divide-y">
            <ProfileItem icon={Instagram} label="Instagram" value={empresa?.instagram} href={instagramUrl} />
            <ProfileItem icon={Link2} label="Agendamento público" value={publicPath ? "Página de reservas disponível" : null} href={publicPath} />
          </div>
          {publicPath ? <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Link configurado para compartilhamento</p> : <p className="mt-2 text-xs text-muted-foreground">Configure um link público para receber reservas online.</p>}
        </CardContent></Card>
      </div>
    </div>
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
