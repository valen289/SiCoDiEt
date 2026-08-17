import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { formatFecha } from '../utils/formatters';

export default function GanadoEvolucionChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--divider)" />
        <XAxis
          dataKey="fecha_registro"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-light)' }}
          tickFormatter={(v) => formatFecha(v)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-light)' }}
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(v) => formatFecha(v)}
          contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="total_vacas" name="Total vacas" stroke="var(--text-light)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="vacas_lechera" name="Vacas lecheras" stroke="#006633" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
