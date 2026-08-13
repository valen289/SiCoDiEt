import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#006633', '#5E8CB8', '#D9A441', '#A7C49A', '#667085'];

export default function CategoriaDonutChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="stock_kg"
          nameKey="categoria"
          innerRadius="62%"
          outerRadius="100%"
          paddingAngle={2}
          strokeWidth={0}
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell key={entry.categoria} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
