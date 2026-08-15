import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { fmt } from '../utils/formatters';

export default function ConsumoSemanalChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--divider)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-light)' }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-light)' }}
          width={44}
          domain={[0, 'dataMax']}
          tickCount={5}
          allowDecimals={false}
          tickFormatter={(v) => fmt(v)}
        />
        <Tooltip
          formatter={(value) => [`${fmt(value, 1)} kg`, 'Consumo']}
          contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
          cursor={{ fill: 'var(--bg)' }}
        />
        <Bar dataKey="total_kg" radius={[4, 4, 0, 0]} fill="#5E8CB8" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
