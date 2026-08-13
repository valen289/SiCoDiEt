import { useId } from 'react';

// Silueta simple de silo: cuerpo cilíndrico con tapa curva arriba y abajo.
const SILO_PATH = 'M4 8 Q16 2 28 8 L28 34 Q16 38 4 34 Z';
const MIN_Y = 2;
const MAX_Y = 38;

export default function SiloGauge({ porcentaje, stockClass }) {
  const clipId = useId();
  const pct = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  const fillHeight = ((MAX_Y - MIN_Y) * pct) / 100;
  const fillY = MAX_Y - fillHeight;

  return (
    <svg className="silo-gauge" viewBox="0 0 32 40" role="img" aria-label={`Nivel de stock: ${pct}%`}>
      <defs>
        <clipPath id={clipId}>
          <path d={SILO_PATH} />
        </clipPath>
      </defs>
      <rect
        className={`silo-gauge-fill ${stockClass}`}
        x="0"
        y={fillY}
        width="32"
        height={fillHeight}
        clipPath={`url(#${clipId})`}
      />
      <path className="silo-gauge-outline" d={SILO_PATH} />
    </svg>
  );
}
