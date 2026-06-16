import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { brl } from "@/lib/format";

export default function DashboardRevenueChart({ data }: { data: Array<{ dia: string; valor: number }> }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="dia" fontSize={10} stroke="var(--color-muted-foreground)" />
        <YAxis fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${v}`} />
        <Tooltip formatter={(v: any) => brl(Number(v))} />
        <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
