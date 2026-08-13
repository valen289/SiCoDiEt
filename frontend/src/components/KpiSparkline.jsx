import { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// Mini grafico de tendencia embebido en una KPI card. Espera una serie ya
// completa (sin huecos) de valores numericos, mas vieja a mas nueva.
export default function KpiSparkline({ data, color }) {
  const gradientId = useId();
  if (!data || data.length < 2) return null;
  const chartData = data.map((value, i) => ({ i, value }));

  return (
    <div className="kpi-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
