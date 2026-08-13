import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingDown, DollarSign, Bell, Tag, ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { fmt, formatMoney, todayLabel } from '../utils/formatters';
import { getNivelAlerta, getStockClass } from '../utils/nivelAlerta';
import SiloIllustration from '../components/SiloIllustration';
import KpiSparkline from '../components/KpiSparkline';
import CategoriaDonutChart from '../components/CategoriaDonutChart';
import ConsumoSemanalChart from '../components/ConsumoSemanalChart';
import '../styles/dashboard.css';

const CATEGORIA_LABELS = {
  reserva_forrajera: 'Forrajes',
  concentrado: 'Concentrados',
  sales: 'Sales Minerales',
  sin_categoria: 'Sin categoría',
};

function labelCategoria(categoria) {
  return CATEGORIA_LABELS[categoria] || (categoria.charAt(0).toUpperCase() + categoria.slice(1));
}

function fechaISO(date) {
  return date.toISOString().split('T')[0];
}

// Completa la serie diaria dispersa que devuelve /costos/diario (solo trae dias con
// filas en consumo_diario_lote) con ceros en los dias sin consumo registrado, para
// tener siempre 7 puntos continuos en el sparkline/barras.
function construirSerieDias(diasApi, fechaInicio, fechaFin) {
  const porFecha = {};
  (diasApi || []).forEach(d => { porFecha[String(d.fecha).split('T')[0]] = d; });

  const dias = [];
  const cursor = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);
  while (cursor <= fin) {
    const key = fechaISO(cursor);
    const fila = porFecha[key];
    dias.push({
      fecha: key,
      total_kg: fila ? parseFloat(fila.total_kg) || 0 : 0,
      costo_total: fila ? parseFloat(fila.costo_total) || 0 : 0,
      tieneDatos: !!fila,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

function promedioSerie(serie, campo) {
  const conDatos = serie.filter(d => d.tieneDatos);
  if (conDatos.length === 0) return 0;
  return conDatos.reduce((s, d) => s + d[campo], 0) / conDatos.length;
}

function deltaPorcentual(actual, anterior) {
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stockTotal, setStockTotal] = useState(0);
  const [insumoCount, setInsumoCount] = useState(0);
  const [alertaCount, setAlertaCount] = useState(0);
  const [alertas, setAlertas] = useState([]);
  const [loteCount, setLoteCount] = useState(0);
  const [insumosAlerta, setInsumosAlerta] = useState([]);
  const [insumosTodos, setInsumosTodos] = useState([]);
  const [stockPorCategoria, setStockPorCategoria] = useState([]);
  const [serieSemana, setSerieSemana] = useState([]);
  const [consumoPromedio, setConsumoPromedio] = useState(0);
  const [consumoDelta, setConsumoDelta] = useState(null);
  const [costoPromedio, setCostoPromedio] = useState(0);
  const [costoDelta, setCostoDelta] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    const hoy = new Date();
    const fin = fechaISO(hoy);
    const inicio = fechaISO(new Date(hoy.getTime() - 6 * 86400000));
    const finAnterior = fechaISO(new Date(hoy.getTime() - 7 * 86400000));
    const inicioAnterior = fechaISO(new Date(hoy.getTime() - 13 * 86400000));

    const [insumosRes, alertasRes, lotesRes, estadoRes, semanaRes, semanaAnteriorRes, categoriaRes] = await Promise.allSettled([
      api.get('/insumos'),
      api.get('/alertas?leidas=false'),
      api.get('/lotes'),
      api.get('/insumos/estado-alertas'),
      api.get('/costos/diario', { params: { fecha_inicio: inicio, fecha_fin: fin } }),
      api.get('/costos/diario', { params: { fecha_inicio: inicioAnterior, fecha_fin: finAnterior } }),
      api.get('/insumos/stock-por-categoria'),
    ]);

    let hayError = false;

    if (insumosRes.status === 'fulfilled') {
      const insumos = insumosRes.value.data.insumos || [];
      setStockTotal(insumos.reduce((s, i) => s + parseFloat(i.stock_actual || 0), 0));
      setInsumoCount(insumos.length);
    } else {
      console.error('Error cargando insumos:', insumosRes.reason);
      hayError = true;
    }

    if (alertasRes.status === 'fulfilled') {
      setAlertaCount(alertasRes.value.data.alertas?.length || 0);
      setAlertas((alertasRes.value.data.alertas || []).slice(0, 5));
    } else {
      console.error('Error cargando alertas:', alertasRes.reason);
      hayError = true;
    }

    if (lotesRes.status === 'fulfilled') {
      setLoteCount(lotesRes.value.data.lotes?.length || 0);
    } else {
      console.error('Error cargando lotes:', lotesRes.reason);
      hayError = true;
    }

    if (estadoRes.status === 'fulfilled') {
      const todos = estadoRes.value.data.insumos || [];
      setInsumosTodos(todos);
      setInsumosAlerta(todos.filter(i => i.nivel_alerta === 'critico' || i.nivel_alerta === 'precaucion'));
    } else {
      console.error('Error cargando estado de alertas:', estadoRes.reason);
      hayError = true;
    }

    if (semanaRes.status === 'fulfilled' && semanaAnteriorRes.status === 'fulfilled') {
      const serie = construirSerieDias(semanaRes.value.data.dias, inicio, fin);
      const serieAnterior = construirSerieDias(semanaAnteriorRes.value.data.dias, inicioAnterior, finAnterior);
      setSerieSemana(serie);

      const promKg = promedioSerie(serie, 'total_kg');
      const promKgAnterior = promedioSerie(serieAnterior, 'total_kg');
      setConsumoPromedio(promKg);
      setConsumoDelta(deltaPorcentual(promKg, promKgAnterior));

      const promCosto = promedioSerie(serie, 'costo_total');
      const promCostoAnterior = promedioSerie(serieAnterior, 'costo_total');
      setCostoPromedio(promCosto);
      setCostoDelta(deltaPorcentual(promCosto, promCostoAnterior));
    } else {
      console.error('Error cargando serie semanal:', semanaRes.reason || semanaAnteriorRes.reason);
      hayError = true;
    }

    if (categoriaRes.status === 'fulfilled') {
      setStockPorCategoria(categoriaRes.value.data.categorias || []);
    } else {
      console.error('Error cargando stock por categoria:', categoriaRes.reason);
      hayError = true;
    }

    setError(hayError ? 'Algunos datos no se pudieron cargar. Probá recargar la página.' : null);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, []);

  const getNivelLabel = (tipo) => {
    if (tipo === 'stock_critico') return { label: 'CRÍTICO', dotCls: 'alerta-dot--critico', badgeCls: 'alerta-badge--critico' };
    return { label: 'PRECAUCIÓN', dotCls: 'alerta-dot--precaucion', badgeCls: 'alerta-badge--precaucion' };
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner-border text-success" role="status" aria-label="Cargando…" />
      </div>
    );
  }

  // El insumo destacado del widget "Silo principal" es el mas urgente con datos reales
  // (menor dias_restantes, excluyendo sin_datos); la grilla "Estado de silos" muestra
  // los siguientes por urgencia (ya vienen ordenados asi desde /insumos/estado-alertas).
  const insumosConDatos = insumosTodos.filter(i => getNivelAlerta(parseInt(i.dias_restantes) || 0).nivel !== 'sin_datos');
  const insumoPrincipal = insumosConDatos[0] || insumosTodos[0] || null;
  const insumosGrilla = insumosTodos.slice(0, 4);

  const totalCategorias = stockPorCategoria.reduce((s, c) => s + c.stock_kg, 0);
  const serieBarChart = serieSemana.map(d => ({
    ...d,
    label: new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
  }));

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Resumen del día</h1>
      <p className="dashboard-subtitle" style={{ textTransform: 'capitalize' }}>{todayLabel()}</p>

      {error && (
        <div className="dashboard-error">{error}</div>
      )}

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-card--stock" onClick={() => navigate('/silos/reserva_forrajera')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-label">Stock Total</span>
            <div className="kpi-icon kpi-icon--stock">
              <Package size={20} strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <span className="kpi-value kpi-value--stock">{fmt(stockTotal)}</span>
            <span className="kpi-unit">kg</span>
          </div>
          <div className="kpi-sub">{insumoCount} insumo{insumoCount !== 1 ? 's' : ''} registrado{insumoCount !== 1 ? 's' : ''}</div>
        </div>

        <div className="kpi-card kpi-card--consumo" onClick={() => navigate('/consumos')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-label">Consumo Diario Promedio</span>
            <div className="kpi-icon kpi-icon--consumo">
              <TrendingDown size={20} strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <span className="kpi-value kpi-value--consumo">{fmt(consumoPromedio)}</span>
            <span className="kpi-unit">kg</span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub">Últimos 7 días</span>
            {consumoDelta !== null && (
              <span className={`kpi-trend ${consumoDelta >= 0 ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
                {consumoDelta >= 0 ? '↑' : '↓'} {Math.abs(consumoDelta).toFixed(1)}%
              </span>
            )}
          </div>
          {serieSemana.length > 1 && (
            <KpiSparkline data={serieSemana.map(d => d.total_kg)} color="#5E8CB8" />
          )}
        </div>

        <div className="kpi-card kpi-card--costo" onClick={() => navigate('/costos')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-label">Costo Diario Promedio</span>
            <div className="kpi-icon kpi-icon--costo">
              <DollarSign size={20} strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <span className="kpi-value kpi-value--costo">{formatMoney(costoPromedio)}</span>
          </div>
          <div className="kpi-sub-row">
            <span className="kpi-sub">Últimos 7 días</span>
            {costoDelta !== null && (
              <span className={`kpi-trend ${costoDelta >= 0 ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
                {costoDelta >= 0 ? '↑' : '↓'} {Math.abs(costoDelta).toFixed(1)}%
              </span>
            )}
          </div>
          {serieSemana.length > 1 && (
            <KpiSparkline data={serieSemana.map(d => d.costo_total)} color="#B8834A" />
          )}
        </div>

        <div className="kpi-card kpi-card--alertas" onClick={() => navigate('/alertas')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-label">Alertas</span>
            <div className="kpi-icon kpi-icon--alertas">
              <Bell size={20} strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <span className="kpi-value kpi-value--alertas">{alertaCount}</span>
          </div>
          <div className="kpi-sub">{alertaCount === 0 ? 'sin alertas activas' : `alerta${alertaCount !== 1 ? 's' : ''} sin leer`}</div>
        </div>

        <div className="kpi-card kpi-card--lotes" onClick={() => navigate('/lotes')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-label">Lotes</span>
            <div className="kpi-icon kpi-icon--lotes">
              <Tag size={20} strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <span className="kpi-value kpi-value--lotes">{loteCount}</span>
          </div>
          <div className="kpi-sub">lote{loteCount !== 1 ? 's' : ''} activo{loteCount !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {insumoCount > 0 && (
        <>
          {/* ── Stock por categoría / Silo principal / Consumo semanal ── */}
          <div className="dashboard-charts-grid">
            <div className="dashboard-card dashboard-card--donut">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">Stock por categoría</h2>
                <button className="section-link" onClick={() => navigate('/silos')}>Ver detalle</button>
              </div>
              {stockPorCategoria.length > 0 ? (
                <div className="donut-layout">
                  <div className="donut-chart-wrap">
                    <CategoriaDonutChart data={stockPorCategoria} />
                    <div className="donut-center">
                      <span className="donut-center-value">{fmt(totalCategorias)}</span>
                      <span className="donut-center-unit">kg</span>
                    </div>
                  </div>
                  <ul className="donut-legend">
                    {stockPorCategoria.map((c, i) => (
                      <li key={c.categoria} className="donut-legend-item">
                        <span className="donut-legend-dot" style={{ background: ['#006633', '#5E8CB8', '#D9A441', '#A7C49A', '#667085'][i % 5] }} />
                        <span className="donut-legend-label">{labelCategoria(c.categoria)}</span>
                        <span className="donut-legend-pct">{c.porcentaje.toFixed(0)}%</span>
                        <span className="donut-legend-kg">{fmt(c.stock_kg)} kg</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="dashboard-card-empty">Todavía no hay stock cargado.</p>
              )}
            </div>

            <div className="dashboard-card dashboard-card--hero">
              {insumoPrincipal ? (() => {
                const porcentaje = ((parseFloat(insumoPrincipal.stock_actual) / parseFloat(insumoPrincipal.capacidad_maxima)) * 100).toFixed(0);
                const stockClass = getStockClass(porcentaje);
                const nivel = getNivelAlerta(parseInt(insumoPrincipal.dias_restantes) || 0);
                return (
                  <>
                    <div className="dashboard-section-header">
                      <h2 className="dashboard-section-title">Silo principal - {insumoPrincipal.nombre}</h2>
                      <span className={`silo-hero-badge silo-hero-badge--${nivel.nivel}`}>{nivel.label}</span>
                    </div>
                    <div className="silo-hero-body">
                      <div className="silo-hero-info">
                        <span className="silo-hero-pct">{porcentaje}%</span>
                        <span className="silo-hero-pct-label">Nivel actual</span>
                        <div className="silo-hero-stat">
                          <span className="silo-hero-stat-label">Contenido</span>
                          <strong>{fmt(insumoPrincipal.stock_actual)} {insumoPrincipal.unidad}</strong>
                        </div>
                        <div className="silo-hero-stat">
                          <span className="silo-hero-stat-label">Capacidad total</span>
                          <strong>{fmt(insumoPrincipal.capacidad_maxima)} {insumoPrincipal.unidad}</strong>
                        </div>
                        <button className="section-link" onClick={() => navigate('/silos')}>Ver detalle →</button>
                      </div>
                      <div className="silo-hero-visual">
                        <SiloIllustration porcentaje={porcentaje} stockClass={stockClass} />
                      </div>
                    </div>
                  </>
                );
              })() : (
                <p className="dashboard-card-empty">Cargá tu primer insumo para ver el silo principal.</p>
              )}
            </div>

            <div className="dashboard-card dashboard-card--weekly">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">Consumo últimos 7 días</h2>
              </div>
              {serieBarChart.length > 1 ? (
                <ConsumoSemanalChart data={serieBarChart} />
              ) : (
                <p className="dashboard-card-empty">Todavía no hay consumo registrado en la semana.</p>
              )}
            </div>
          </div>

          {/* ── Estado de silos ── */}
          {insumosGrilla.length > 0 && (
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">Estado de silos</h2>
                <button className="section-link" onClick={() => navigate('/silos')}>Ver todos</button>
              </div>
              <div className="silo-grid">
                {insumosGrilla.map(insumo => {
                  const porcentaje = ((parseFloat(insumo.stock_actual) / parseFloat(insumo.capacidad_maxima)) * 100).toFixed(0);
                  const stockClass = getStockClass(porcentaje);
                  const nivel = getNivelAlerta(parseInt(insumo.dias_restantes) || 0);
                  return (
                    <div key={insumo.id} className="silo-mini-card" onClick={() => navigate('/silos')}>
                      <div className="silo-mini-header">
                        <span className="silo-mini-nombre">{insumo.nombre}</span>
                        <span className={`silo-hero-badge silo-hero-badge--${nivel.nivel}`}>{nivel.label}</span>
                      </div>
                      <div className="silo-mini-visual">
                        <SiloIllustration porcentaje={porcentaje} stockClass={stockClass} showScale={false} />
                      </div>
                      <div className="silo-mini-footer">
                        <span className="silo-mini-pct">{porcentaje}%</span>
                        <span className="silo-mini-stock">{fmt(insumo.stock_actual)} {insumo.unidad}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Alertas recientes ── */}
      {alertas.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Alertas activas</h2>
            <button className="section-link" onClick={() => navigate('/alertas')}>Ver todas</button>
          </div>
          <div className="alerta-list">
            {alertas.map(alerta => {
              const nivel = getNivelLabel(alerta.tipo);
              return (
                <div key={alerta.id} className={`alerta-item alerta-${alerta.tipo}`}>
                  <span className={`alerta-dot ${nivel.dotCls}`} />
                  <div className="alerta-content">
                    <div className="alerta-nombre">{alerta.insumo_nombre}</div>
                    <div className="alerta-mensaje">{alerta.mensaje}</div>
                  </div>
                  <span className={`alerta-badge ${nivel.badgeCls}`}>{nivel.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alertas.length === 0 && insumosAlerta.length === 0 && (
        insumoCount === 0 && loteCount === 0 ? (
          <div className="dashboard-onboarding">
            <p className="dashboard-onboarding-title">Empezá en 3 pasos</p>
            <p className="dashboard-onboarding-sub">Tu establecimiento todavía no tiene datos cargados. Seguí estos pasos para comenzar.</p>
            <div className="onboarding-steps">
              <button className="onboarding-step" onClick={() => navigate('/silos')}>
                <span className="onboarding-step-num">1</span>
                <div className="onboarding-step-body">
                  <strong>Cargá tus insumos</strong>
                  <span>Silos, fardos, bolsones y concentrados</span>
                </div>
                <ArrowRight size={16} />
              </button>
              <button className="onboarding-step" onClick={() => navigate('/lotes')}>
                <span className="onboarding-step-num">2</span>
                <div className="onboarding-step-body">
                  <strong>Creá tus lotes</strong>
                  <span>Nombre, cantidad de animales y etapa</span>
                </div>
                <ArrowRight size={16} />
              </button>
              <button className="onboarding-step" onClick={() => navigate('/consumos')}>
                <span className="onboarding-step-num">3</span>
                <div className="onboarding-step-body">
                  <strong>Registrá el primer consumo</strong>
                  <span>Qué se dio, en qué turno y cuánto</span>
                </div>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="dashboard-empty">
            <CheckCircle2 size={18} className="me-1" style={{ verticalAlign: '-3px' }} />
            Todo en orden — no hay alertas activas ni insumos en estado crítico.
          </div>
        )
      )}
    </div>
  );
}
