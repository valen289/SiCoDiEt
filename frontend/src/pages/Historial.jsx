import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSEO } from '../hooks/useSEO';
import {
  History, Download, Filter, ChevronLeft, ChevronRight,
  ArrowDownCircle, ArrowUpCircle, Package
} from 'lucide-react';
import { formatDate, formatNumber } from '../utils/formatters';
import '../styles/historial.css';

const PERIODOS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '3 meses' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 año' },
  { value: 'custom', label: 'Personalizado' },
];

const TIPOS_MOVIMIENTO = [
  { value: '', label: 'Todos' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'consumo', label: 'Consumo' },
];

const TIPOS_INSUMO = [
  { value: '', label: 'Todos los tipos' },
  { value: 'silo', label: 'Silo' },
  { value: 'bolson', label: 'Bolson' },
  { value: 'fardo', label: 'Fardo' },
  { value: 'sales', label: 'Sales' },
  { value: 'grano', label: 'Grano' },
  { value: 'concentrado', label: 'Concentrado' },
  { value: 'aditivo', label: 'Aditivo' },
  { value: 'forraje', label: 'Forraje' },
];

function getTipoIcon(tipo) {
  switch (tipo) {
    case 'ingreso':          return { icon: ArrowDownCircle, cssClass: 'ingreso' };
    case 'consumo':          return { icon: ArrowUpCircle,   cssClass: 'consumo' };
    default:                 return { icon: Package,          cssClass: 'default' };
  }
}

function getTipoLabel(tipo) {
  const labels = {
    ingreso: 'Ingreso',
    consumo: 'Consumo',
    ajuste_positivo: 'Ajuste',
    ajuste_negativo: 'Ajuste',
  };
  return labels[tipo] || tipo;
}

export default function Historial() {
  useSEO({ title: 'Historial de Movimientos', description: 'Historial completo de ingresos, consumos y ajustes de stock de alimentos.' });

  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [totales, setTotales] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [periodo, setPeriodo] = useState('30');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('');
  const [tipoInsumo, setTipoInsumo] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const limit = 50;

  const getFechasFromPeriodo = useCallback(() => {
    if (periodo === 'custom') return { fechaInicio, fechaFin };
    const now = new Date();
    const dias = parseInt(periodo);
    const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dias);
    const pad = n => String(n).padStart(2, '0');
    const toLocalISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return {
      fechaInicio: toLocalISO(inicio),
      fechaFin: toLocalISO(now),
    };
  }, [periodo, fechaInicio, fechaFin]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { fechaInicio: fi, fechaFin: ff } = getFechasFromPeriodo();

      const [movRes, resRes, insumosRes] = await Promise.all([
        api.get('/movimientos', {
          params: {
            fecha_inicio: fi,
            fecha_fin: ff,
            tipo: tipoMovimiento || undefined,
            tipo_insumo: tipoInsumo || undefined,
            insumo_id: insumoId || undefined,
            page,
            limit,
          },
        }),
        api.get('/movimientos/resumen', {
          params: {
            fecha_inicio: fi,
            fecha_fin: ff,
            // tipo NO se pasa: las tarjetas siempre muestran ingresos + consumos completos
            tipo_insumo: tipoInsumo || undefined,
            insumo_id: insumoId || undefined,
          },
        }),
        api.get('/insumos'),
      ]);

      setMovimientos(movRes.data.movimientos || []);
      setPagination(movRes.data.pagination || { total: 0, pages: 1 });
      setResumen(resRes.data.resumen || []);
      setTotales(resRes.data.totales || null);
      setInsumos(insumosRes.data.insumos || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo, fechaInicio, fechaFin, tipoMovimiento, tipoInsumo, insumoId, page, getFechasFromPeriodo]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePeriodoChange = (val) => {
    setPeriodo(val);
    setPage(1);
    if (val !== 'custom') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { fechaInicio: fi, fechaFin: ff } = getFechasFromPeriodo();
      const response = await api.get('/movimientos/export', {
        params: {
          fecha_inicio: fi,
          fecha_fin: ff,
          tipo: tipoMovimiento || undefined,
          tipo_insumo: tipoInsumo || undefined,
          insumo_id: insumoId || undefined,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `movimientos_stock_${fi}_${ff}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando:', err);
    } finally {
      setExporting(false);
    }
  };

  const getPeriodoLabel = () => {
    const p = PERIODOS.find(p => p.value === periodo);
    if (periodo === 'custom' && fechaInicio && fechaFin) {
      return `${formatDate(fechaInicio)} - ${formatDate(fechaFin)}`;
    }
    return p ? p.label : '';
  };

  return (
    <div className="historial-page">
      <header className="historial__header">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <History size={24} /> Historial de Movimientos
          </h1>
          <p className="text-muted small mb-0">{getPeriodoLabel()}</p>
        </div>
        <button className="historial__btn historial__btn--export" onClick={handleExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </header>

      {/* Filtros */}
      <div className="historial__filters">
        <div className="historial__filters-section">
          <span className="historial__filters-label">Período</span>
          <div className="historial__periodo-btns">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                className={`historial__periodo-btn ${periodo === p.value ? 'historial__periodo-btn--active' : ''}`}
                onClick={() => handlePeriodoChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'custom' && (
            <div className="historial__custom-dates">
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaInicio}
                onChange={e => { setFechaInicio(e.target.value); setPage(1); }}
              />
              <span className="text-muted small">hasta</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaFin}
                onChange={e => { setFechaFin(e.target.value); setPage(1); }}
              />
            </div>
          )}
        </div>

        <div className="historial__filters-section">
          <span className="historial__filters-label"><Filter size={14} /> Filtros</span>
          <div className="historial__filters-row">
            <select
              className="form-select form-select-sm"
              value={tipoMovimiento}
              onChange={e => { setTipoMovimiento(e.target.value); setPage(1); }}
            >
              {TIPOS_MOVIMIENTO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={tipoInsumo}
              onChange={e => { setTipoInsumo(e.target.value); setPage(1); }}
            >
              {TIPOS_INSUMO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={insumoId}
              onChange={e => { setInsumoId(e.target.value); setPage(1); }}
            >
              <option value="">Todos los insumos</option>
              {insumos.map(i => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Totales Generales */}
      {totales && (
        <div className="historial__totals historial__totals--3col">
          <div className="historial__total-card historial__total-card--ingresos">
            <div className="historial__total-icon"><ArrowDownCircle size={20} /></div>
            <div>
              <div className="historial__total-label">Total Ingresos</div>
              <div className="historial__total-value">{formatNumber(totales.total_ingresos)} kg</div>
            </div>
          </div>
          <div className="historial__total-card historial__total-card--consumos">
            <div className="historial__total-icon"><ArrowUpCircle size={20} /></div>
            <div>
              <div className="historial__total-label">Total Consumos</div>
              <div className="historial__total-value">{formatNumber(totales.total_consumos)} kg</div>
            </div>
          </div>
          <div className="historial__total-card historial__total-card--balance">
            <div className="historial__total-icon"><Package size={20} /></div>
            <div>
              <div className="historial__total-label">Balance Neto</div>
              <div className={`historial__total-value ${
                ((parseFloat(totales.total_ingresos) || 0) + (parseFloat(totales.total_ajustes_pos) || 0) -
                 (parseFloat(totales.total_consumos) || 0) - (parseFloat(totales.total_ajustes_neg) || 0)) >= 0
                  ? 'text-success' : 'text-danger'
              }`}>
                {formatNumber(
                  (parseFloat(totales.total_ingresos) || 0) +
                  (parseFloat(totales.total_ajustes_pos) || 0) -
                  (parseFloat(totales.total_consumos) || 0) -
                  (parseFloat(totales.total_ajustes_neg) || 0)
                )} kg
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal: Tabla + Resumen lateral */}
      <div className="historial__content">
        {/* Tabla de movimientos */}
        <div className="historial__table-section">
          <h2 className="historial__section-title">Movimientos ({pagination.total})</h2>

          {loading ? (
            <div className="historial__loading">
              <div className="spinner-border text-success" role="status" />
              <p className="mt-2 text-muted">Cargando movimientos...</p>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="historial__empty">
              <History size={48} className="mb-3 opacity-25" />
              <p>No hay movimientos en este período</p>
            </div>
          ) : (
            <>
              <div className="historial__table-responsive">
                <table className="historial__table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Insumo</th>
                      <th>Cantidad</th>
                      <th>Stock Ant.</th>
                      <th>Stock Post.</th>
                      <th>Lote</th>
                      <th>Usuario</th>
                      <th>Remito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => {
                      const tipoInfo = getTipoIcon(m.tipo);
                      const TipoIcon = tipoInfo.icon;
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="historial__date">{formatDate(m.fecha)}</div>
                            <div className="historial__time">{m.hora?.substring(0, 5)}</div>
                          </td>
                          <td>
                            <span className={`historial__tipo-badge historial__tipo-badge--${tipoInfo.cssClass}`}>
                              <TipoIcon size={14} />
                              {getTipoLabel(m.tipo)}
                            </span>
                          </td>
                          <td>
                            <div className="historial__insumo-name">{m.insumo_nombre}</div>
                            <div className="historial__insumo-type">{m.tipo_insumo}</div>
                          </td>
                          <td>
                            <strong className={m.tipo === 'ingreso' || m.tipo === 'ajuste_positivo' ? 'text-success' : 'text-danger'}>
                              {m.tipo === 'ingreso' || m.tipo === 'ajuste_positivo' ? '+' : '-'}{formatNumber(m.cantidad)} {m.unidad}
                            </strong>
                          </td>
                          <td className="text-muted">{formatNumber(m.stock_anterior)}</td>
                          <td><strong>{formatNumber(m.stock_posterior)}</strong></td>
                          <td className="text-muted">{m.lote_nombre || '-'}</td>
                          <td className="text-muted">{m.usuario_nombre || '-'}</td>
                          <td className="text-muted">{m.comprobante_entrega || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {pagination.pages > 1 && (
                <div className="historial__pagination">
                  <button
                    className="historial__page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="historial__page-info">
                    Página {page} de {pagination.pages}
                  </span>
                  <button
                    className="historial__page-btn"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Resumen lateral por insumo */}
        <div className="historial__summary-section">
          <h2 className="historial__section-title">Resumen por Insumo</h2>
          {resumen.length === 0 ? (
            <p className="text-muted text-center py-3">Sin datos</p>
          ) : (
            <div className="historial__summary-list">
              {resumen.map(r => (
                <div key={r.insumo_id} className="historial__summary-card">
                  <div className="historial__summary-header">
                    <span className="historial__summary-name">{r.insumo_nombre}</span>
                    <span className="historial__summary-badge">{r.movimientos_count} mov.</span>
                  </div>
                  <div className="historial__summary-details">
                    <div className="historial__summary-row historial__summary-row--ingreso">
                      <span>Ingresos</span>
                      <strong>+{formatNumber(r.total_ingresos)} {r.unidad}</strong>
                    </div>
                    <div className="historial__summary-row historial__summary-row--consumo">
                      <span>Consumos</span>
                      <strong>-{formatNumber(r.total_consumos)} {r.unidad}</strong>
                    </div>
                    <div className="historial__summary-row historial__summary-row--balance">
                      <span>Balance</span>
                      <strong className={parseFloat(r.balance_neto) >= 0 ? 'text-success' : 'text-danger'}>
                        {parseFloat(r.balance_neto) >= 0 ? '+' : ''}{formatNumber(r.balance_neto)} {r.unidad}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
