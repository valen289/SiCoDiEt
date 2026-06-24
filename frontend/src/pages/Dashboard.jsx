import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingDown, Bell, Tag } from 'lucide-react';
import api from '../services/api';
import { fmt, todayStr, todayLabel } from '../utils/formatters';
import '../styles/dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stockTotal, setStockTotal] = useState(0);
  const [insumoCount, setInsumoCount] = useState(0);
  const [consumoHoy, setConsumoHoy] = useState(0);
  const [alertaCount, setAlertaCount] = useState(0);
  const [alertas, setAlertas] = useState([]);
  const [loteCount, setLoteCount] = useState(0);
  const [insumosAlerta, setInsumosAlerta] = useState([]);
  const [error, setError] = useState(null);

  const loadData = async () => {
    const today = todayStr();
    const [insumosRes, alertasRes, lotesRes, estadoRes] = await Promise.allSettled([
      api.get('/insumos'),
      api.get('/alertas?leidas=false'),
      api.get('/lotes'),
      api.get('/insumos/estado-alertas'),
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
      const alertados = (estadoRes.value.data.insumos || []).filter(
        i => i.nivel_alerta === 'critico' || i.nivel_alerta === 'precaucion'
      );
      setInsumosAlerta(alertados);
    } else {
      console.error('Error cargando estado de alertas:', estadoRes.reason);
      hayError = true;
    }

    try {
      const resumenRes = await api.get(`/insumos/resumen-diario?fecha=${today}`);
      setConsumoHoy(resumenRes.data.consumo_total_dia || 0);
    } catch { /* sin datos de consumo aún */ }

    setError(hayError ? 'Algunos datos no se pudieron cargar. Probá recargar la página.' : null);
    setLoading(false);
  };

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
            <span className="kpi-label">Consumo Hoy</span>
            <div className="kpi-icon kpi-icon--consumo">
              <TrendingDown size={20} strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <span className="kpi-value kpi-value--consumo">{fmt(consumoHoy)}</span>
            <span className="kpi-unit">kg</span>
          </div>
          <div className="kpi-sub">consumo registrado hoy</div>
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

      {/* ── Alertas recientes ── */}
      {alertas.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Alertas recientes</h2>
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

      {/* ── Estado insumos ── */}
      {insumosAlerta.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Estado de stock</h2>
            <button className="section-link" onClick={() => navigate('/silos/reserva_forrajera')}>Ver alimentos</button>
          </div>
          <div className="insumos-table-wrap">
            <table className="insumos-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Stock actual</th>
                  <th>Días restantes</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {insumosAlerta.map(insumo => {
                  const isCritico = insumo.nivel_alerta === 'critico';
                  return (
                    <tr key={insumo.id}>
                      <td><strong>{insumo.nombre}</strong></td>
                      <td>{fmt(insumo.stock_actual)} {insumo.unidad}</td>
                      <td>
                        <div className="stock-days-cell">
                          <span className="stock-days-num">{insumo.dias_restantes}</span>
                          <span className="stock-days-meta">días</span>
                          <div
                            className={`stock-days-bar ${isCritico ? 'stock-days-bar--critico' : 'stock-days-bar--precaucion'}`}
                            style={{ '--bar-pct': `${Math.min(Math.max((insumo.dias_restantes / 30) * 100, 0), 100)}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <span className={`insumo-badge ${isCritico ? 'insumo-badge--critico' : 'insumo-badge--precaucion'}`}>
                          {insumo.label_alerta}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {alertas.length === 0 && insumosAlerta.length === 0 && (
        <div className="dashboard-empty">
          Todo en orden — no hay alertas activas ni insumos en estado crítico.
        </div>
      )}
    </div>
  );
}
