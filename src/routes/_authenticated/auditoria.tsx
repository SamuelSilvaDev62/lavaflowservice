import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RequireRole } from "@/components/require-role";
import { ADMINS } from "@/lib/rbac";
import {
  getAuditEvents, getAuditActors, getAuditSummary, type AuditEvent,
} from "@/lib/auditoria.functions";
import { dateTimeBr, brl, num } from "@/lib/format";
import { Bot, ShieldCheck, Filter, RotateCcw, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: Guarded,
});

function Guarded() {
  return <RequireRole roles={ADMINS}><Page /></RequireRole>;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function Page() {
  const init = defaultRange();
  const [fromDate, setFromDate] = useState(init.from);
  const [toDate, setToDate] = useState(init.to);
  const [userId, setUserId] = useState<string>("all");
  const [source, setSource] = useState<"all" | "equipe" | "ai">("all");
  const [offset, setOffset] = useState(0);

  const fromISO = useMemo(() => new Date(fromDate + "T00:00:00").toISOString(), [fromDate]);
  const toISO = useMemo(() => new Date(toDate + "T23:59:59").toISOString(), [toDate]);

  const events = useServerFn(getAuditEvents);
  const actors = useServerFn(getAuditActors);
  const summary = useServerFn(getAuditSummary);

  const actorsQ = useQuery({
    queryKey: ["audit-actors"],
    queryFn: () => actors(),
  });

  const summaryQ = useQuery({
    queryKey: ["audit-summary", fromISO, toISO],
    queryFn: () => summary({ data: { from: fromISO, to: toISO } }),
  });

  const eventsQ = useQuery({
    queryKey: ["audit-events", fromISO, toISO, userId, source, offset],
    queryFn: () => events({
      data: {
        from: fromISO,
        to: toISO,
        userId: userId === "all" ? undefined : userId,
        source,
        limit: 50,
        offset,
      },
    }),
  });

  function reset() {
    const d = defaultRange();
    setFromDate(d.from); setToDate(d.to);
    setUserId("all"); setSource("all"); setOffset(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        subtitle="Eventos de segurança, ações da equipe e uso do Consultor IA — restrito a Proprietário e Administrador."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Eventos da equipe</div>
          <div className="text-2xl font-semibold mt-1">{num(summaryQ.data?.equipeCount ?? 0)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-4 w-4" /> Chamadas de IA</div>
          <div className="text-2xl font-semibold mt-1">{num(summaryQ.data?.aiCalls ?? 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">{num(summaryQ.data?.aiTokens ?? 0)} tokens</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-4 w-4" /> Custo estimado IA</div>
          <div className="text-2xl font-semibold mt-1">{brl(summaryQ.data?.aiCost ?? 0)}</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setOffset(0); }} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setOffset(0); }} />
          </div>
          <div>
            <Label className="text-xs">Usuário</Label>
            <Select value={userId} onValueChange={(v) => { setUserId(v); setOffset(0); }}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {(actorsQ.data ?? []).map((a) => (
                  <SelectItem key={a.userId} value={a.userId}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={source} onValueChange={(v) => { setSource(v as any); setOffset(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="equipe">Equipe / Segurança</SelectItem>
                <SelectItem value="ai">Consultor IA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardContent className="p-0">
          {eventsQ.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando eventos…</div>
          ) : !eventsQ.data?.events.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Nenhum evento encontrado para o período/filtros selecionados.
            </div>
          ) : (
            <ul className="divide-y">
              {eventsQ.data.events.map((ev) => <EventRow key={ev.id} ev={ev} />)}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        {offset > 0 && (
          <Button variant="outline" onClick={() => setOffset(Math.max(0, offset - 50))}>Anterior</Button>
        )}
        {eventsQ.data?.hasMore && (
          <Button onClick={() => setOffset(offset + 50)}>Carregar mais</Button>
        )}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: AuditEvent }) {
  return (
    <li className="p-4 grid grid-cols-12 gap-3 items-start hover:bg-muted/30 transition-colors">
      <div className="col-span-12 sm:col-span-3 text-xs text-muted-foreground">
        {dateTimeBr(ev.timestamp)}
      </div>
      <div className="col-span-6 sm:col-span-2">
        {ev.source === "ai" ? (
          <Badge variant="secondary" className="gap-1"><Bot className="h-3 w-3" /> IA</Badge>
        ) : (
          <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Equipe</Badge>
        )}
      </div>
      <div className="col-span-6 sm:col-span-3 text-sm truncate">{ev.actor.label}</div>
      <div className="col-span-10 sm:col-span-3 text-sm font-medium truncate">{ev.action}</div>
      <div className="col-span-2 sm:col-span-1 text-right">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost"><ChevronRight className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="text-xs font-medium mb-2">Detalhes</div>
            <pre className="text-[11px] leading-snug whitespace-pre-wrap break-all max-h-72 overflow-auto">
{JSON.stringify(ev.metadata, null, 2)}
            </pre>
          </PopoverContent>
        </Popover>
      </div>
    </li>
  );
}
