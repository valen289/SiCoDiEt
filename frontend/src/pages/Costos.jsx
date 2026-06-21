import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useSEO } from '../hooks/useSEO';
import {
  DollarSign, Download, Filter, BarChart2, Package, TrendingUp, FileText,
} from 'lucide-react';
import { compartirReportePdf } from '../utils/reportes';
import '../styles/costos.css';

const PERIODOS = [
  { value: '7',     label: '7 días'        },
  { value: '30',    label: '30 días'       },
  { value: 'mes',   label: 'Este mes'      },
  { value: 'custom', label: 'Personalizado' },
];

function formatMoney(num) {
  if (num === null || num === undefined) return 'US$ 0,00';
  return 'US$ ' + new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
}

function formatNumber(num) {
  if (!num) return '0,00';
  return parseFloat(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Costos() {
  useSEO({ title: 'Costos', description: 'Análisis de costos de alimentación por lote y período.' });

  const [resumen, setResumen]     = useState(null);
  const [lotes, setLotes]         = useState([]);
  const [lotesData, setLotesData] = useState([]);
  const [diasData, setDiasData]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tabActivo, setTabActivo] = useState('lotes');
  const [exporting, setExporting] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [periodo, setPeriodo]         = useState('30');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin]       = useState('');
  const [loteId, setLoteId]           = useState('');

  const getFechas = useCallback(() => {
    const now = new Date();
    if (periodo === 'mes') {
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        fi: inicio.toISOString().split('T')[0],
        ff: now.toISOString().split('T')[0],
      };
    }
    if (periodo === 'custom') return { fi: fechaInicio, ff: fechaFin };
    const inicio = new Date(now.getTime() - parseInt(periodo) * 86400000);
    return {
      fi: inicio.toISOString().split('T')[0],
      ff: now.toISOString().split('T')[0],
    };
  }, [periodo, fechaInicio, fechaFin]);

  const totalDiasPeriodo = useMemo(() => {
    const { fi, ff } = getFechas();
    if (!fi || !ff) return 0;
    const diff = (new Date(ff) - new Date(fi)) / 86400000;
    return Math.max(1, Math.round(diff) + 1);
  }, [getFechas]);

  const loadData = useCallback(async () => {
    const { fi, ff } = getFechas();
    if (!fi || !ff) return;

    setLoading(true);
    try {
      const params = { fecha_inicio: fi, fecha_fin: ff, lote_id: loteId || undefined };

      const [resumenRes, lotesRes, diasRes, lotesListRes] = await Promise.all([
        api.get('/costos/resumen', { params }),
        api.get('/costos/por-lote', { params }),
        api.get('/costos/diario', { params }),
        api.get('/lotes'),
      ]);

      setResumen(resumenRes.data.resumen);
      setLotesData(lotesRes.data.lotes || []);
      setDiasData(diasRes.data.dias || []);
      setLotes(lotesListRes.data.lotes || []);
    } catch (err) {
      console.error('Error cargando costos:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo, fechaInicio, fechaFin, loteId, getFechas]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePeriodoChange = (val) => {
    setPeriodo(val);
    if (val !== 'custom') { setFechaInicio(''); setFechaFin(''); }
  };

  const handleExport = () => {
    const { fi, ff } = getFechas();
    if (!fi || !ff) return;
    setExporting(true);
    try {
      let headers, rows;
      if (tabActivo === 'lotes') {
        headers = ['Lote', 'Animales', 'Consumo Total (kg)', 'Costo Total ($)', 'Días c/ Consumo', 'Costo/Animal/Día ($)'];
        rows = lotesData.map(r => [
          r.lote_nombre, r.cantidad_animales,
          formatNumber(r.total_kg), formatNumber(r.costo_total),
          r.dias_con_consumo, formatNumber(r.costo_animal_dia),
        ]);
      } else {
        headers = ['Fecha', 'Costo Total ($)', 'Consumo Total (kg)', 'Lotes Activos'];
        rows = diasData.map(r => [
          formatDate(r.fecha), formatNumber(r.costo_total),
          formatNumber(r.total_kg), r.lotes_activos,
        ]);
      }
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `costos_${fi}_${ff}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleReportePdf = async () => {
    setGenerandoPdf(true);
    try {
      const mes = new Date().toISOString().slice(0, 7);
      await compartirReportePdf('costos-mensual', {
        params: { mes },
        filename: `costos-mensual-${mes}.pdf`,
        titulo: 'Reporte de Costos Mensuales',
      });
    } catch (err) {
      console.error('Error generando reporte PDF:', err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const getPeriodoLabel = () => {
    if (periodo === 'custom' && fechaInicio && fechaFin) {
      return `${formatDate(fechaInicio)} — ${formatDate(fechaFin)}`;
    }
    return PERIODOS.find(p => p.value === periodo)?.label || '';
  };

  return (
    <div className="costos-page">
      <header className="costos__header">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <DollarSign size={24} /> Costos
          </h1>
          <p className="text-muted small mb-0">{getPeriodoLabel()}</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="costos__btn costos__btn--export"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            <Download size={16} />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
          <button
            className="costos__btn costos__btn--export"
            onClick={handleReportePdf}
            disabled={generandoPdf || loading}
          >
            <FileText size={16} />
            {generandoPdf ? 'Generando...' : 'Reporte PDF'}
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="costos__filters">
        <div className="costos__filters-section">
          <span className="costos__filters-label">Período</span>
          <div className="costos__periodo-btns">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                className={`costos__periodo-btn ${periodo === p.value ? 'costos__periodo-btn--active' : ''}`}
                onClick={() => handlePeriodoChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'custom' && (
            <div className="costos__custom-dates">
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
              />
              <span className="text-muted small">hasta</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="costos__filters-section">
          <span className="costos__filters-label"><Filter size={14} /> Filtros</span>
          <div className="costos__filters-row">
            <select
              className="form-select form-select-sm"
              value={loteId}
              onChange={e => setLoteId(e.target.value)}
            >
              <option value="">Todos los lotes</option>
              {lotes.map(l => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="costos__kpis">
        <div className="costos__kpi-card costos__kpi-card--total">
          <div className="costos__kpi-icon"><DollarSign size={18} /></div>
          <div className="costos__kpi-body">
            <div className="costos__kpi-label">Costo Total</div>
            <div className="costos__kpi-value">
              {resumen ? formatMoney(resumen.costo_total) : '—'}
            </div>
            {resumen && (
              <div className="costos__kpi-sub">
                {resumen.dias_con_consumo} de {totalDiasPeriodo} días con consumo
              </div>
            )}
          </div>
        </div>

        <div className="costos__kpi-card costos__kpi-card--promedio">
          <div className="costos__kpi-icon"><BarChart2 size={18} /></div>
          <div className="costos__kpi-body">
            <div className="costos__kpi-label">Promedio Diario</div>
            <div className="costos__kpi-value">
              {resumen ? formatMoney(resumen.promedio_diario) : '—'}
            </div>
            {resumen && (
              <div className="costos__kpi-sub" title={`Costo total ÷ ${resumen.dias_con_consumo} día${resumen.dias_con_consumo !== 1 ? 's' : ''} con consumo (no por día calendario)`}>
                por día con consumo, no calendario
              </div>
            )}
          </div>
        </div>

        <div className="costos__kpi-card costos__kpi-card--lote">
          <div className="costos__kpi-icon"><TrendingUp size={18} /></div>
          <div className="costos__kpi-body">
            <div className="costos__kpi-label">Lote Más Caro</div>
            <div className="costos__kpi-value costos__kpi-value--sm">
              {resumen?.lote_mas_caro?.lote_nombre || '—'}
            </div>
            {resumen?.lote_mas_caro && (
              <div className="costos__kpi-sub">{formatMoney(resumen.lote_mas_caro.costo_total)}</div>
            )}
          </div>
        </div>

        <div className="costos__kpi-card costos__kpi-card--insumo">
          <div className="costos__kpi-icon"><Package size={18} /></div>
          <div className="costos__kpi-body">
            <div className="costos__kpi-label">Insumo Más Caro</div>
            <div className="costos__kpi-value costos__kpi-value--sm">
              {resumen?.insumo_mas_caro?.insumo_nombre || '—'}
            </div>
            {resumen?.insumo_mas_caro && (
              <div className="costos__kpi-sub">{formatMoney(resumen.insumo_mas_caro.costo_total)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="costos__tabs">
        <button
          className={`costos__tab-btn ${tabActivo === 'lotes' ? 'costos__tab-btn--active' : ''}`}
          onClick={() => setTabActivo('lotes')}
        >
          Por Lote
        </button>
        <button
          className={`costos__tab-btn ${tabActivo === 'diario' ? 'costos__tab-btn--active' : ''}`}
          onClick={() => setTabActivo('diario')}
        >
          Evolución Diaria
        </button>
      </div>

      {/* Tabla */}
      <div className="costos__table-section">
        {loading ? (
          <div className="costos__loading">
            <div className="spinner-border text-success" role="status" />
            <p className="mt-2 text-muted">Cargando costos...</p>
          </div>
        ) : tabActivo === 'lotes' ? (
          lotesData.length === 0 ? (
            <div className="costos__empty">
              <DollarSign size={48} className="mb-3 opacity-25" />
              <p>No hay datos de costos para este período</p>
              <p className="text-muted small">
                Registrá consumos en la sección <strong>Consumos</strong>, y cargá precios en <strong>Silos → Editar insumo</strong>.
              </p>
            </div>
          ) : (
            <div className="costos__table-responsive">
              <table className="costos__table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Animales</th>
                    <th>Consumo Total</th>
                    <th>Costo Total</th>
                    <th>Días c/ Consumo (de {totalDiasPeriodo})</th>
                    <th>Costo / Animal / Día</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesData.map(r => (
                    <tr key={r.lote_id}>
                      <td><strong>{r.lote_nombre}</strong></td>
                      <td className="text-muted">{r.cantidad_animales}</td>
                      <td className="text-muted">{formatNumber(r.total_kg)} kg</td>
                      <td><strong>{formatMoney(r.costo_total)}</strong></td>
                      <td className="text-muted">{r.dias_con_consumo}</td>
                      <td>
                        <span className="costos__cost-badge">
                          {formatMoney(r.costo_animal_dia)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          diasData.length === 0 ? (
            <div className="costos__empty">
              <BarChart2 size={48} className="mb-3 opacity-25" />
              <p>No hay datos de costos para este período</p>
            </div>
          ) : (
            <div className="costos__table-responsive">
              <table className="costos__table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Costo Total</th>
                    <th>Consumo Total</th>
                    <th>Lotes Activos</th>
                  </tr>
                </thead>
                <tbody>
                  {diasData.map(r => (
                    <tr key={r.fecha}>
                      <td>
                        <div className="costos__date">{formatDate(r.fecha)}</div>
                      </td>
                      <td><strong>{formatMoney(r.costo_total)}</strong></td>
                      <td className="text-muted">{formatNumber(r.total_kg)} kg</td>
                      <td className="text-muted">{r.lotes_activos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
