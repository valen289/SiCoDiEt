import { useId } from 'react';

// Ilustración más detallada de un silo (techo cónico, cuerpo con costuras,
// escalera lateral y patas) para el modal de detalle de insumo. SiloGauge.jsx
// sigue siendo el ícono chico usado en las tarjetas — este componente es la
// versión grande "real" que pidió el usuario, inspirada en el mockup del
// dashboard (silo con escala de % al costado).
const BODY_LEFT = 40;
const BODY_RIGHT = 160;
const BODY_TOP = 82;
const BODY_BOTTOM = 250;
const BODY_HEIGHT = BODY_BOTTOM - BODY_TOP;

const BODY_PATH = `M${BODY_LEFT} ${BODY_TOP} Q100 70 ${BODY_RIGHT} ${BODY_TOP} L${BODY_RIGHT} ${BODY_BOTTOM} Q100 262 ${BODY_LEFT} ${BODY_BOTTOM} Z`;

const SCALE_TICKS = [100, 75, 50, 25, 0];

export default function SiloIllustration({ porcentaje, stockClass, showScale = true }) {
  const clipId = useId();
  const pct = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  const fillHeight = (BODY_HEIGHT * pct) / 100;
  const fillY = BODY_BOTTOM - fillHeight;

  return (
    <svg
      className="silo-illustration"
      viewBox={`0 0 ${showScale ? 240 : 200} 300`}
      role="img"
      aria-label={`Nivel de stock: ${pct}%`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
        <linearGradient id={`${clipId}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9aa1a8" />
          <stop offset="12%" stopColor="#bcc2c7" />
          <stop offset="32%" stopColor="#f4f5f6" />
          <stop offset="50%" stopColor="#dde1e4" />
          <stop offset="70%" stopColor="#eef0f1" />
          <stop offset="88%" stopColor="#c1c6cb" />
          <stop offset="100%" stopColor="#8f959c" />
        </linearGradient>
        <linearGradient id={`${clipId}-roof`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#868d94" />
          <stop offset="35%" stopColor="#d7dadd" />
          <stop offset="55%" stopColor="#eef0f1" />
          <stop offset="100%" stopColor="#767d84" />
        </linearGradient>
        <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={`silo-illustration__fill-stop-light ${stockClass}`} />
          <stop offset="100%" className={`silo-illustration__fill-stop-dark ${stockClass}`} />
        </linearGradient>
      </defs>

      {/* Sombra en el piso */}
      <ellipse className="silo-illustration__shadow" cx="100" cy="286" rx="70" ry="9" />

      {/* Patas */}
      <g className="silo-illustration__legs">
        <path d="M58 246 L44 282 L54 282 L66 248 Z" />
        <path d="M142 246 L156 282 L146 282 L134 248 Z" />
        <path d="M100 250 L94 284 L106 284 L100 250 Z" />
        <line className="silo-illustration__legs-brace" x1="46" y1="270" x2="98" y2="266" />
        <line className="silo-illustration__legs-brace" x1="154" y1="270" x2="102" y2="266" />
      </g>

      {/* Techo cónico */}
      <path
        className="silo-illustration__roof"
        d={`M${BODY_LEFT - 3} ${BODY_TOP + 2} Q100 14 ${BODY_RIGHT + 3} ${BODY_TOP + 2} Q100 60 ${BODY_LEFT - 3} ${BODY_TOP + 2} Z`}
        fill={`url(#${clipId}-roof)`}
      />
      <path
        className="silo-illustration__roof-highlight"
        d="M70 62 Q100 24 100 20 Q100 24 96 60 Q83 63 70 62 Z"
      />
      <line className="silo-illustration__finial" x1="100" y1="14" x2="100" y2="30" />
      <circle className="silo-illustration__finial-cap" cx="100" cy="13" r="3" />

      {/* Cuerpo metálico */}
      <path d={BODY_PATH} fill={`url(#${clipId}-metal)`} />

      {/* Relleno de grano */}
      <rect
        x={BODY_LEFT}
        y={fillY}
        width={BODY_RIGHT - BODY_LEFT}
        height={fillHeight}
        fill={`url(#${clipId}-fill)`}
        clipPath={`url(#${clipId})`}
      />
      {fillHeight > 2 && (
        <ellipse
          className={`silo-illustration__fill-top ${stockClass}`}
          cx="100"
          cy={fillY}
          rx={(BODY_RIGHT - BODY_LEFT) / 2 - 2}
          ry="7"
          clipPath={`url(#${clipId})`}
        />
      )}

      {/* Costuras horizontales del cuerpo */}
      <g className="silo-illustration__seams">
        <line x1={BODY_LEFT + 3} y1="126" x2={BODY_RIGHT - 3} y2="126" />
        <line x1={BODY_LEFT + 3} y1="168" x2={BODY_RIGHT - 3} y2="168" />
        <line x1={BODY_LEFT + 3} y1="210" x2={BODY_RIGHT - 3} y2="210" />
      </g>
      {/* Costuras verticales sutiles (paneles) */}
      <g className="silo-illustration__panels" clipPath={`url(#${clipId})`}>
        <line x1="70" y1={BODY_TOP} x2="70" y2={BODY_BOTTOM} />
        <line x1="100" y1={BODY_TOP} x2="100" y2={BODY_BOTTOM} />
        <line x1="130" y1={BODY_TOP} x2="130" y2={BODY_BOTTOM} />
      </g>

      {/* Contorno del cuerpo */}
      <path d={BODY_PATH} className="silo-illustration__outline--stroke" />

      {/* Escalera lateral */}
      <g className="silo-illustration__ladder">
        <line x1="164" y1="94" x2="164" y2="245" />
        <line x1="174" y1="94" x2="174" y2="245" />
        {Array.from({ length: 10 }).map((_, i) => {
          const y = 100 + i * 15;
          return <line key={y} x1="164" y1={y} x2="174" y2={y} />;
        })}
        {/* Plataforma de acceso */}
        <rect x="160" y="106" width="20" height="5" rx="1" className="silo-illustration__platform" />
      </g>

      {/* Escala de porcentaje */}
      {showScale && (
        <g className="silo-illustration__scale">
          <line x1="200" y1={BODY_TOP} x2="200" y2={BODY_BOTTOM} />
          {SCALE_TICKS.map(tick => {
            const y = BODY_BOTTOM - (BODY_HEIGHT * tick) / 100;
            return (
              <g key={tick}>
                <line x1="196" y1={y} x2="204" y2={y} />
                <text x="209" y={y} dy="0.32em">{tick}%</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
