import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from "recharts";
import { brl } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

type Item = { nome: string; valor: number };

function VerticalBarChart({ data, color = "var(--color-primary)" }: { data: Item[]; color?: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="nome" fontSize={10} stroke="var(--color-muted-foreground)" />
        <YAxis fontSize={10} stroke="var(--color-muted-foreground)" />
        <Tooltip formatter={(v: any) => brl(Number(v))} />
        <Bar dataKey="valor" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HorizontalRankingChart({ data }: { data: Item[] }) {
  const height = Math.max(140, data.length * 44);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nome"
            width={90}
            fontSize={11}
            stroke="var(--color-muted-foreground)"
            tick={{ fill: "var(--color-foreground)" }}
            tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
          />
          <Tooltip
            formatter={(v: any) => brl(Number(v))}
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 }}
          />
          <Bar dataKey="valor" fill="var(--color-primary)" radius={[0, 8, 8, 0]} barSize={22}>
            <LabelList
              dataKey="valor"
              position="right"
              fontSize={11}
              fill="var(--color-foreground)"
              formatter={(v: any) => brl(Number(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RelatoriosCharts({
  porServico, porFuncionario,
}: { porServico: Item[]; porFuncionario: Item[] }) {
  return (
    <>
      <Card><CardContent className="p-5">
        <h3 className="font-display font-semibold mb-4">Receita por serviço</h3>
        <div className="h-64"><VerticalBarChart data={porServico} /></div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <h3 className="font-display font-semibold mb-4">Receita por funcionário</h3>
        <div className="h-64"><VerticalBarChart data={porFuncionario} color="var(--color-chart-2)" /></div>
      </CardContent></Card>
    </>
  );
}
