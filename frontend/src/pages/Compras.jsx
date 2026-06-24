import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSEO } from '../hooks/useSEO';
import { useAlert } from '../context/AlertContext';
import {
  ShoppingCart, Plus, Download, Filter, Edit2, Trash2,
  DollarSign, BarChart2, Users, X, ChevronDown, FileText,
} from 'lucide-react';
import { compartirReportePdf } from '../utils/reportes';
import { formatMoney, formatNumber, formatDate } from '../utils/formatters';
import '../styles/compras.css';

const PERIODOS = [
  { value: '7',     label: '7 días'        },
  { value: '30',    label: '30 días'       },
  { value: 'mes',   label: 'Este mes'      },
  { value: 'custom', label: 'Personalizado' },
];

const FORM_VACIO = {
  fecha: new Date().toISOString().split('T')[0],
  proveedor_id: '',
  insumo_id: '',
  cantidad: '',
  precio_unitario: '',
  numero_factura: '',
  observaciones: '',
};

const PROV_FORM_VACIO = { nombre: '', contacto: '', telefono_codigo: '+54', telefono_numero: '' };

const CODIGOS_PAIS = [
  { codigo: '+54',  label: '🇦🇷 +54'  },
  { codigo: '+598', label: '🇺🇾 +598' },
  { codigo: '+55',  label: '🇧🇷 +55'  },
  { codigo: '+595', label: '🇵🇾 +595' },
  { codigo: '+56',  label: '🇨🇱 +56'  },
  { codigo: '+591', label: '🇧🇴 +591' },
];

function parsePhone(telefono) {
  if (!telefono) return { codigo: '+54', numero: '' };
  const match = telefono.match(/^(\+\d+)\s*(.*)$/);
  return match ? { codigo: match[1], numero: match[2] } : { codigo: '+54', numero: telefono };
}

export default function Compras() {
  useSEO({ title: 'Compras', description: 'Registro de compras de insumos con impacto en stock.' });
  const { success, error: showError, confirm } = useAlert();

  // Datos
  const [compras, setCompras]         = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos]         = useState([]);
  const [resumen, setResumen]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Filtros
  const [periodo, setPeriodo]               = useState('30');
  const [fechaInicio, setFechaInicio]       = useState('');
  const [fechaFin, setFechaFin]             = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroInsumo, setFiltroInsumo]     = useState('');

  // Modal compra
  const [showModal, setShowModal]           = useState(false);
  const [editingCompra, setEditingCompra]   = useState(null);
  const [form, setForm]                     = useState(FORM_VACIO);
  const [saving, setSaving]                 = useState(false);

  // Modal proveedores
  const [showProvModal, setShowProvModal]   = useState(false);
  const [editingProv, setEditingProv]       = useState(null);
  const [provForm, setProvForm]             = useState(PROV_FORM_VACIO);
  const [savingProv, setSavingProv]         = useState(false);

  const getFechas = useCallback(() => {
    const now = new Date();
    if (periodo === 'mes') {
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fi: inicio.toISOString().split('T')[0], ff: now.toISOString().split('T')[0] };
    }
    if (periodo === 'custom') return { fi: fechaInicio, ff: fechaFin };
    const inicio = new Date(now.getTime() - parseInt(periodo) * 86400000);
    return { fi: inicio.toISOString().split('T')[0], ff: now.toISOString().split('T')[0] };
  }, [periodo, fechaInicio, fechaFin]);

  const loadData = useCallback(async () => {
    const { fi, ff } = getFechas();
    if (!fi || !ff) return;
    setLoading(true);
    try {
      const params = {
        fecha_inicio: fi, fecha_fin: ff,
        proveedor_id: filtroProveedor || undefined,
        insumo_id: filtroInsumo || undefined,
      };
      const [comprasRes, provsRes, insumosRes] = await Promise.all([
        api.get('/compras', { params }),
        api.get('/compras/proveedores'),
        api.get('/insumos'),
      ]);
      setCompras(comprasRes.data.compras || []);
      setResumen(comprasRes.data.resumen || null);
      setProveedores(provsRes.data.proveedores || []);
      setInsumos(insumosRes.data.insumos || []);
    } catch (err) {
      console.error('Error cargando compras:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo, fechaInicio, fechaFin, filtroProveedor, filtroInsumo, getFechas]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePeriodoChange = (val) => {
    setPeriodo(val);
    if (val !== 'custom') { setFechaInicio(''); setFechaFin(''); }
  };

  /* ── Modal Compra ── */

  const openNueva = () => {
    setEditingCompra(null);
    setForm(FORM_VACIO);
    setShowModal(true);
  };

  const openEditar = (compra) => {
    setEditingCompra(compra);
    setForm({
      proveedor_id: compra.proveedor_id || '',
      precio_unitario: compra.precio_unitario,
      numero_factura: compra.numero_factura || '',
      observaciones: compra.observaciones || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCompra) {
        await api.put(`/compras/${editingCompra.id}`, form);
        success('Compra actualizada');
      } else {
        await api.post('/compras', form);
        success('Compra registrada y stock actualizado');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      showError(err.response?.data?.error || 'Error al guardar la compra');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (compra) => {
    const confirmed = await confirm({
      title: 'Eliminar Compra',
      message: `¿Eliminar la compra de "${compra.insumo_nombre}"? El ingreso de stock NO será revertido.`,
      type: 'error',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/compras/${compra.id}`);
      success('Compra eliminada');
      loadData();
    } catch (err) {
      showError(err.response?.data?.error || 'Error al eliminar');
    }
  };

  /* ── Modal Proveedores ── */

  const openProvModal = () => {
    setEditingProv(null);
    setProvForm(PROV_FORM_VACIO);
    setShowProvModal(true);
  };

  const handleProvSubmit = async (e) => {
    e.preventDefault();
    setSavingProv(true);
    try {
      const telefono = provForm.telefono_numero
        ? `${provForm.telefono_codigo} ${provForm.telefono_numero}`
        : '';
      const payload = { nombre: provForm.nombre, contacto: provForm.contacto, telefono };
      if (editingProv) {
        await api.put(`/compras/proveedores/${editingProv.id}`, payload);
        success('Proveedor actualizado');
      } else {
        await api.post('/compras/proveedores', payload);
        success('Proveedor creado');
      }
      setEditingProv(null);
      setProvForm(PROV_FORM_VACIO);
      const res = await api.get('/compras/proveedores');
      setProveedores(res.data.proveedores || []);
    } catch (err) {
      showError(err.response?.data?.error || 'Error al guardar proveedor');
    } finally {
      setSavingProv(false);
    }
  };

  /* ── Export ── */

  const handleExport = () => {
    const { fi, ff } = getFechas();
    const headers = ['Fecha', 'Proveedor', 'Insumo', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total', 'Factura'];
    const rows = compras.map(c => [
      formatDate(c.fecha),
      c.proveedor_nombre || '',
      c.insumo_nombre,
      formatNumber(c.cantidad),
      c.insumo_unidad,
      formatNumber(c.precio_unitario),
      formatNumber(c.monto_total),
      c.numero_factura || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compras_${fi}_${ff}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReportePdf = async () => {
    setGenerandoPdf(true);
    try {
      const mes = new Date().toISOString().slice(0, 7);
      await compartirReportePdf('compras', {
        params: { mes },
        filename: `compras-${mes}.pdf`,
        titulo: 'Reporte de Compras',
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

  const insumoSeleccionado = insumos.find(i => String(i.id) === String(form.insumo_id));
  const montoPreview = (parseFloat(form.cantidad) || 0) * (parseFloat(form.precio_unitario) || 0);

  return (
    <div className="compras-page">
      <header className="compras__header">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <ShoppingCart size={24} /> Compras
          </h1>
          <p className="text-muted small mb-0">{getPeriodoLabel()}</p>
        </div>
        <div className="compras__header-actions">
          <button className="compras__btn compras__btn--secondary" onClick={openProvModal}>
            <Users size={15} /> Proveedores
          </button>
          <button className="compras__btn compras__btn--export" onClick={handleExport} disabled={loading}>
            <Download size={15} /> Exportar CSV
          </button>
          <button className="compras__btn compras__btn--export" onClick={handleReportePdf} disabled={generandoPdf || loading}>
            <FileText size={15} /> {generandoPdf ? 'Generando...' : 'Reporte PDF'}
          </button>
          <button className="compras__btn compras__btn--primary" onClick={openNueva}>
            <Plus size={15} /> Nueva Compra
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="compras__filters">
        <div className="compras__filters-section">
          <span className="compras__filters-label">Período</span>
          <div className="compras__periodo-btns">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                className={`compras__periodo-btn ${periodo === p.value ? 'compras__periodo-btn--active' : ''}`}
                onClick={() => handlePeriodoChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'custom' && (
            <div className="compras__custom-dates">
              <input type="date" className="form-control form-control-sm" value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)} />
              <span className="text-muted small">hasta</span>
              <input type="date" className="form-control form-control-sm" value={fechaFin}
                onChange={e => setFechaFin(e.target.value)} />
            </div>
          )}
        </div>
        <div className="compras__filters-section">
          <span className="compras__filters-label"><Filter size={14} /> Filtros</span>
          <div className="compras__filters-row">
            <select className="form-select form-select-sm" value={filtroProveedor}
              onChange={e => setFiltroProveedor(e.target.value)}>
              <option value="">Todos los proveedores</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select className="form-select form-select-sm" value={filtroInsumo}
              onChange={e => setFiltroInsumo(e.target.value)}>
              <option value="">Todos los insumos</option>
              {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="compras__kpis">
        <div className="compras__kpi-card compras__kpi-card--gasto">
          <div className="compras__kpi-icon"><DollarSign size={18} /></div>
          <div className="compras__kpi-body">
            <div className="compras__kpi-label">Gasto Total</div>
            <div className="compras__kpi-value">{resumen ? formatMoney(resumen.gasto_total) : '—'}</div>
            {resumen && <div className="compras__kpi-sub">{resumen.total_compras} compras en el período</div>}
          </div>
        </div>
        <div className="compras__kpi-card compras__kpi-card--promedio">
          <div className="compras__kpi-icon"><BarChart2 size={18} /></div>
          <div className="compras__kpi-body">
            <div className="compras__kpi-label">Promedio por Compra</div>
            <div className="compras__kpi-value">
              {resumen && resumen.total_compras > 0
                ? formatMoney(resumen.gasto_total / resumen.total_compras)
                : '—'}
            </div>
            <div className="compras__kpi-sub">por orden de compra</div>
          </div>
        </div>
        <div className="compras__kpi-card compras__kpi-card--proveedor">
          <div className="compras__kpi-icon"><Users size={18} /></div>
          <div className="compras__kpi-body">
            <div className="compras__kpi-label">Proveedor Principal</div>
            <div className="compras__kpi-value compras__kpi-value--sm">
              {resumen?.proveedor_top?.proveedor_top_nombre || '—'}
            </div>
            {resumen?.proveedor_top && (
              <div className="compras__kpi-sub">{formatMoney(resumen.proveedor_top.proveedor_top_monto)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="compras__table-section">
        <div className="compras__table-header">
          <span className="compras__table-title">Compras ({compras.length})</span>
        </div>
        {loading ? (
          <div className="compras__loading">
            <div className="spinner-border text-success" role="status" />
            <p className="mt-2 text-muted">Cargando compras...</p>
          </div>
        ) : compras.length === 0 ? (
          <div className="compras__empty">
            <ShoppingCart size={48} className="mb-3 opacity-25" />
            <p>No hay compras en este período</p>
            <button className="compras__btn compras__btn--primary mt-2" onClick={openNueva}>
              <Plus size={15} /> Registrar primera compra
            </button>
          </div>
        ) : (
          <div className="compras__table-responsive">
            <table className="compras__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Insumo</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Total</th>
                  <th>Factura / Remito</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {compras.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="compras__date">{formatDate(c.fecha)}</div>
                      {c.usuario_nombre && <div className="compras__sub">{c.usuario_nombre}</div>}
                    </td>
                    <td>
                      {c.proveedor_nombre
                        ? <span className="compras__proveedor-badge">{c.proveedor_nombre}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div className="compras__insumo-name">{c.insumo_nombre}</div>
                    </td>
                    <td className="text-muted">
                      {formatNumber(c.cantidad)} <span className="compras__unit">{c.insumo_unidad}</span>
                    </td>
                    <td className="text-muted">{formatMoney(c.precio_unitario)}/{c.insumo_unidad}</td>
                    <td>
                      <span className="compras__cost-badge">{formatMoney(c.monto_total)}</span>
                    </td>
                    <td className="text-muted">{c.numero_factura || '—'}</td>
                    <td>
                      <div className="compras__row-actions">
                        <button className="compras__action-btn" onClick={() => openEditar(c)} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button className="compras__action-btn compras__action-btn--danger" onClick={() => handleEliminar(c)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Compra */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content compras__modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="h5 mb-0">{editingCompra ? 'Editar Compra' : 'Nueva Compra'}</h3>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                {!editingCompra && (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-sm-6">
                        <label className="form-label">Fecha <span className="text-danger">*</span></label>
                        <input type="date" className="form-control" required
                          value={form.fecha}
                          onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">Proveedor</label>
                        <div className="d-flex gap-2">
                          <select className="form-select" value={form.proveedor_id}
                            onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                            <option value="">Sin proveedor</option>
                            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </div>
                        <div className="mt-1">
                          <button type="button" className="compras__link-btn"
                            onClick={() => { setShowModal(false); openProvModal(); }}>
                            + Agregar proveedor
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Insumo <span className="text-danger">*</span></label>
                      <select className="form-select" required value={form.insumo_id}
                        onChange={e => setForm(f => ({ ...f, insumo_id: e.target.value }))}>
                        <option value="">Seleccionar insumo...</option>
                        {insumos.map(i => (
                          <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                        ))}
                      </select>
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-sm-6">
                        <label className="form-label">
                          Cantidad <span className="text-danger">*</span>
                          {insumoSeleccionado && <span className="text-muted ms-1">({insumoSeleccionado.unidad})</span>}
                        </label>
                        <input type="number" className="form-control" required min="0" step="any"
                          value={form.cantidad}
                          onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                          onBlur={e => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) setForm(f => ({ ...f, cantidad: String(Math.round(val * 100) / 100) }));
                          }} />
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">
                          Precio Unitario <span className="text-danger">*</span>
                          {insumoSeleccionado && <span className="text-muted ms-1">(por {insumoSeleccionado.unidad})</span>}
                        </label>
                        <input type="number" className="form-control" required min="0" step="0.01"
                          value={form.precio_unitario}
                          onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))} />
                      </div>
                    </div>
                    {montoPreview > 0 && (
                      <div className="compras__monto-preview">
                        <span>Monto total:</span>
                        <strong>{formatMoney(montoPreview)}</strong>
                      </div>
                    )}
                  </>
                )}

                {editingCompra && (
                  <>
                    <div className="compras__edit-info mb-3">
                      <div><span>Insumo:</span> <strong>{editingCompra.insumo_nombre}</strong></div>
                      <div><span>Cantidad:</span> <strong>{formatNumber(editingCompra.cantidad)} {editingCompra.insumo_unidad}</strong></div>
                      <div><span>Fecha:</span> <strong>{formatDate(editingCompra.fecha)}</strong></div>
                      <p className="compras__edit-warning">La cantidad y fecha no se pueden modificar (ya impactaron el stock)</p>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Proveedor</label>
                      <select className="form-select" value={form.proveedor_id}
                        onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                        <option value="">Sin proveedor</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Precio Unitario</label>
                      <input type="number" className="form-control" min="0" step="0.01"
                        value={form.precio_unitario}
                        onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))} />
                    </div>
                  </>
                )}

                <div className="mb-3">
                  <label className="form-label">N° Factura / Remito</label>
                  <input type="text" className="form-control" maxLength={50}
                    value={form.numero_factura}
                    onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))}
                    placeholder="Ej: F-0001234" />
                </div>
                <div className="mb-3">
                  <label className="form-label">Observaciones</label>
                  <textarea className="form-control" rows={2} value={form.observaciones}
                    onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? 'Guardando...' : editingCompra ? 'Actualizar' : 'Registrar Compra'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Proveedores */}
      {showProvModal && (
        <div className="modal-overlay" onClick={() => { setShowProvModal(false); setEditingProv(null); setProvForm(PROV_FORM_VACIO); }}>
          <div className="modal-content compras__modal compras__modal--proveedores" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="h5 mb-0">Gestión de Proveedores</h3>
              <button type="button" className="btn-close" onClick={() => { setShowProvModal(false); setEditingProv(null); setProvForm(PROV_FORM_VACIO); }} />
            </div>
            <div className="modal-body">

              {/* Lista existente */}
              {proveedores.length > 0 ? (
                <>
                  <p className="compras__prov-section-title">Proveedores registrados</p>
                  <div className="compras__prov-list">
                    {proveedores.map(p => (
                      <div key={p.id} className={`compras__prov-item ${editingProv?.id === p.id ? 'compras__prov-item--editing' : ''}`}>
                        <div className="compras__prov-info">
                          <div className="compras__prov-nombre">{p.nombre}</div>
                          {(p.contacto || p.telefono) && (
                            <div className="compras__prov-sub">
                              {p.contacto}{p.contacto && p.telefono ? ' · ' : ''}{p.telefono}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="compras__action-btn"
                          title="Editar"
                          onClick={() => {
                            const ph = parsePhone(p.telefono);
                            setEditingProv(p);
                            setProvForm({ nombre: p.nombre, contacto: p.contacto || '', telefono_codigo: ph.codigo, telefono_numero: ph.numero });
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="compras__prov-divider" />
                </>
              ) : (
                <p className="compras__prov-empty">Todavía no hay proveedores. Agregá el primero.</p>
              )}

              {/* Formulario agregar / editar */}
              <div className="compras__prov-form-header">
                <span className="compras__prov-form-label">
                  {editingProv ? `Editando: ${editingProv.nombre}` : 'Nuevo proveedor'}
                </span>
                {editingProv && (
                  <button type="button" className="compras__link-btn"
                    onClick={() => { setEditingProv(null); setProvForm(PROV_FORM_VACIO); }}>
                    Cancelar edición
                  </button>
                )}
              </div>

              <form onSubmit={handleProvSubmit}>
                <div className="mb-2">
                  <label className="form-label form-label-sm">Nombre <span className="text-danger">*</span></label>
                  <input type="text" className="form-control form-control-sm" required
                    placeholder="Ej: Agropecuaria del Sur"
                    value={provForm.nombre}
                    onChange={e => setProvForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label form-label-sm">Contacto</label>
                  <input type="text" className="form-control form-control-sm"
                    placeholder="Nombre de la persona de contacto"
                    value={provForm.contacto}
                    onChange={e => setProvForm(f => ({ ...f, contacto: e.target.value }))} />
                </div>
                <div className="mb-3">
                  <label className="form-label form-label-sm">Teléfono</label>
                  <div className="compras__phone-input">
                    <select
                      className="compras__phone-code"
                      value={provForm.telefono_codigo}
                      onChange={e => setProvForm(f => ({ ...f, telefono_codigo: e.target.value }))}
                    >
                      {CODIGOS_PAIS.map(c => (
                        <option key={c.codigo} value={c.codigo}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      className="form-control form-control-sm"
                      placeholder="Número"
                      inputMode="numeric"
                      value={provForm.telefono_numero}
                      onChange={e => setProvForm(f => ({ ...f, telefono_numero: e.target.value.replace(/\D/g, '') }))}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-success btn-sm w-100" disabled={savingProv}>
                  {savingProv ? 'Guardando...' : editingProv ? 'Guardar cambios' : '+ Agregar proveedor'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
