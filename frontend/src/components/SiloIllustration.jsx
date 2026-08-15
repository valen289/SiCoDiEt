import '../styles/silo-illustration.css';
import siloImg from '../assets/silo.png';

// Silo renderizado a partir de un modelo 3D real (glb generado con trimesh,
// ver frontend/__scratch_render/ en el historial del proyecto) y exportado a
// PNG con fondo transparente. El relleno de grano se "pinta" encima de la
// franja cilíndrica del cuerpo (mismo criterio que cualquier grafico de
// tanque/termometro: no es fisicamente realista ver el nivel a traves de
// metal solido, pero es la convencion estandar de estos indicadores) usando
// mix-blend-mode: multiply para que las costillas/aros de la foto se seleccion
// vean a traves del color en vez de taparse.
//
// Coordenadas medidas a mano sobre silo.png (900x1200px): la franja del
// cuerpo cilindrico ocupa x:[158,723] (17.6%-80.3% del ancho) e
// y:[390,1035] (32.5%-86.3% del alto).
const BODY_LEFT_PCT = 17.6;
const BODY_RIGHT_PCT = 80.3;
const BODY_TOP_PCT = 32.5;
const BODY_BOTTOM_PCT = 86.3;
const BODY_WIDTH_PCT = BODY_RIGHT_PCT - BODY_LEFT_PCT;
const BODY_HEIGHT_PCT = BODY_BOTTOM_PCT - BODY_TOP_PCT;

const SCALE_TICKS = [100, 75, 50, 25, 0];

export default function SiloIllustration({ porcentaje, stockClass, showScale = true }) {
  const pct = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  const fillHeightPct = (BODY_HEIGHT_PCT * pct) / 100;
  const fillTopPct = BODY_BOTTOM_PCT - fillHeightPct;

  return (
    <div className={`silo-illustration ${showScale ? 'silo-illustration--with-scale' : ''}`} role="img" aria-label={`Nivel de stock: ${pct}%`}>
      <div className="silo-illustration__image-wrap">
        <img className="silo-illustration__shell" src={siloImg} alt="" />
        <div
          className={`silo-illustration__fill ${stockClass}`}
          style={{ top: `${fillTopPct}%`, height: `${fillHeightPct}%`, left: `${BODY_LEFT_PCT}%`, width: `${BODY_WIDTH_PCT}%` }}
        />
      </div>

      {showScale && (
        <div className="silo-illustration__scale">
          <span className="silo-illustration__scale-line" style={{ top: `${BODY_TOP_PCT}%`, bottom: `${100 - BODY_BOTTOM_PCT}%` }} />
          {SCALE_TICKS.map(tick => {
            const y = BODY_BOTTOM_PCT - (BODY_HEIGHT_PCT * tick) / 100;
            return (
              <span key={tick} className="silo-illustration__scale-tick" style={{ top: `${y}%` }}>
                <span className="silo-illustration__scale-tick-mark" />
                <span className="silo-illustration__scale-tick-label">{tick}%</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
