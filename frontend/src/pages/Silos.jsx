import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import {
  Plus, Edit2, History, AlertTriangle, Database, Package, Wheat, Droplets,
  X, CheckCircle, Trash2
} from 'lucide-react';
import '../styles/silos.css';

const tiposOriginales = [
  { value: 'silo', label: 'Silo', icon: Database },
  { value: 'bolson', label: 'Bolson', icon: Package },
  { value: 'fardo', label: 'Fardo', icon: Wheat },
  { value: 'sales', label: 'Sales', icon: Droplets },
];

const tiposAdicionalesDefault = [
  { value: 'grano', label: 'Grano', icon: Wheat },
  { value: 'concentrado', label: 'Concentrado', icon: Package },
  { value: 'aditivo', label: 'Aditivo', icon: Droplets },
  { value: 'forraje', label: 'Forraje', icon: Wheat },
];

export default function Silos() {
  const { success, error, confirm } = useAlert();
  const { tipo: tipoFromUrl } = useParams();
  const tiposAdicionales = tiposAdicionalesDefault;
  const selectedTipo = tipoFromUrl || 'silo';

  const todosLosTipos = [...tiposOriginales, ...tiposAdicionales];
  const tipoActual = todosLosTipos.find(t => t.value === selectedTipo) || tiposOriginales[0];
  const seoTitle = tipoActual
    ? `${tipoActual.label}s - Gestión de Stock y Alimentos | SiCoDiET`
    : 'Alimentos y Stock - Gestión de Insumos | SiCoDiET';
  const seoDescription = tipoActual
    ? `Control de stock de ${tipoActual.label.toLowerCase()}s para tambo lechero. Monitorea niveles, registra consumos diarios y optimiza la alimentación bovina con SiCoDiET.`
    : 'Gestión integral de alimentos para tambo lechero. Control de stock, registro de consumos diarios y optimización de insumos con SiCoDiET.';

  useSEO({
    title: seoTitle,
    description: seoDescription,
    keywords: tipoActual
      ? `${tipoActual.label}, stock, alimentos, tambo, ganado, consumo, insumos, gestion`
      : 'alimentos, stock, silos, bolsón, fardo, sales, tambo, ganado, consumo diario, insumos, gestión'
  });

  useEffect(() => {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SiCoDiET - Gestión de Alimentos",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": seoDescription,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [seoDescription]);

  const [insumos, setInsumos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [form, setForm] = useState({
    nombre: '', tipo_insumo: '', unidad: 'kg',
    capacidad_maxima: '', stock_actual: '', stock_minimo: ''
  });
  const [cargaForm, setCargaForm] = useState({ cantidad: '', comprobante: '', observaciones: '' });
  const [historial, setHistorial] = useState([]);
  const [historialResumen, setHistorialResumen] = useState(null);
  const [historialPeriodo, setHistorialPeriodo] = useState('30');
  const [costosInsumos, setCostosInsumos] = useState({});
  const [editingPrecio, setEditingPrecio] = useState(null);
  const [precioInput, setPrecioInput] = useState('');

  const loadInsumos = useCallback(async () => {
    try {
      const params = selectedTipo ? { tipo: selectedTipo } : {};
      const insumosRes = await api.get('/insumos', { params });
      const insumosData = insumosRes.data.insumos || [];
      setInsumos(insumosData);
      try {
        const costosRes = await api.get('/dietas/costos');
        const costosMap = {};
        (costosRes.data || []).forEach(c => { costosMap[c.insumo_id] = c.precio_por_kg; });
        setCostosInsumos(costosMap);
      } catch { setCostosInsumos({}); }
    } catch { setInsumos([]); }
  }, [selectedTipo]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadInsumos(); }, [loadInsumos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      capacidad_maxima: parseInt(form.capacidad_maxima, 10),
      stock_actual: form.stock_actual === '' ? 0 : parseInt(form.stock_actual, 10),
      stock_minimo: parseInt(form.stock_minimo, 10),
    };

    try {
      if (editingInsumo) {
        await api.put(`/insumos/${editingInsumo.id}`, payload);
        success('Insumo actualizado');
      } else {
        await api.post('/insumos', payload);
        success('Insumo creado');
      }
      setShowModal(false);
      setEditingInsumo(null);
      loadInsumos();
    } catch (err) {
      error(err.response?.data?.error || 'Error');
    }
  };

  const handleCargar = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/insumos/${editingInsumo.id}/cargar`, {
        cantidad: parseFloat(cargaForm.cantidad),
        comprobante_entrega: cargaForm.comprobante,
        observaciones: cargaForm.observaciones
      });
      success('Carga registrada');
      setCargaForm({ cantidad: '', comprobante: '', observaciones: '' });
      loadInsumos();
    } catch (err) {
      error(err.response?.data?.error || 'Error al cargar');
    }
  };

  const handleDelete = async () => {
    if (!editingInsumo) return;
    const confirmed = await confirm({
      title: 'Eliminar Insumo', message: '¿Estás seguro que deseas eliminar este insumo?',
      type: 'warning', confirmText: 'Sí, eliminar', cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/insumos/${editingInsumo.id}`);
      success('Insumo eliminado');
      setShowModal(false);
      setEditingInsumo(null);
      loadInsumos();
    } catch (err) {
      error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const handleEdit = (insumo) => {
    setEditingInsumo(insumo);
    setForm({
      nombre: insumo.nombre,
      tipo_insumo: insumo.tipo_insumo,
      unidad: insumo.unidad,
      capacidad_maxima: parseIntegerValue(insumo.capacidad_maxima),
      stock_actual: parseIntegerValue(insumo.stock_actual),
      stock_minimo: parseIntegerValue(insumo.stock_minimo),
    });
    setShowModal(true);
  };

  const handleVerHistorial = async (insumo = null) => {
    const targetInsumo = insumo || editingInsumo || (insumos.length > 0 ? insumos[0] : null);
    if (!targetInsumo) return;
    setEditingInsumo(targetInsumo);
    try {
      const res = await api.get('/movimientos/historial-insumo', {
        params: { insumo_id: targetInsumo.id, periodo: historialPeriodo },
      });
      setHistorial(res.data.historial);
      setHistorialResumen(res.data.resumen);
      setShowHistorial(true);
    } catch (err) { console.error('Error:', err); }
  };

  const handleHistorialPeriodoChange = async (periodo) => {
    setHistorialPeriodo(periodo);
    if (editingInsumo && showHistorial) {
      try {
        const res = await api.get('/movimientos/historial-insumo', {
          params: { insumo_id: editingInsumo.id, periodo },
        });
        setHistorial(res.data.historial);
        setHistorialResumen(res.data.resumen);
      } catch (err) { console.error('Error:', err); }
    }
  };

  const handleEditarPrecio = (insumo) => {
    setEditingPrecio(insumo.id);
    const precioExistente = costosInsumos[insumo.id];
    setPrecioInput(precioExistente !== undefined ? String(precioExistente) : '0');
  };

  const handleGuardarPrecio = async (insumoId) => {
    const precio = parseFloat(precioInput);
    if (isNaN(precio) || precio < 0) {
      error('Ingrese un precio valido mayor o igual a 0');
      return;
    }
    try {
      await api.put(`/dietas/costos/${insumoId}`, { precio_por_kg: precio });
      setCostosInsumos(prev => ({ ...prev, [insumoId]: precio }));
      setEditingPrecio(null);
      setPrecioInput('');
      success('Precio actualizado');
      try {
        const channel = new BroadcastChannel('sico-diet-precio-actualizado');
        channel.postMessage({ type: 'precio-actualizado', insumoId, precio });
        channel.close();
      } catch { /* not supported */ }
    } catch (err) {
      error(err.response?.data?.error || 'Error al actualizar precio');
    }
  };

  const handleCancelarPrecio = () => {
    setEditingPrecio(null);
    setPrecioInput('');
  };

  const getPorcentaje = (insumo) => {
    return ((parseFloat(insumo.stock_actual) / parseFloat(insumo.capacidad_maxima)) * 100).toFixed(0);
  };

  const getNivelAlerta = (diasRestantes) => {
    if (diasRestantes === 0 || diasRestantes === 999) return { nivel: 'sin_datos', color: '#6c757d', label: 'SIN DATOS', bgClass: 'bg-secondary' };
    if (diasRestantes <= 5) return { nivel: 'critico', color: '#dc3545', label: 'CRITICO', bgClass: 'bg-danger' };
    if (diasRestantes <= 7) return { nivel: 'precaucion', color: '#ffc107', label: 'PRECAUCION', bgClass: 'bg-warning text-dark' };
    if (diasRestantes <= 20) return { nivel: 'normal', color: '#28a745', label: 'NORMAL', bgClass: 'bg-success' };
    return { nivel: 'holgado', color: '#17a2b8', label: 'HOLGADO', bgClass: 'bg-info' };
  };

  const getProgressColor = (porcentaje) => {
    if (porcentaje <= 30) return '#dc3545';
    if (porcentaje <= 60) return '#ffc107';
    return '#2e7d32';
  };

  const parseIntegerValue = (value) => {
    const parsed = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : '';
  };

  const formatNumber = (num, options = { minimumFractionDigits: 2, maximumFractionDigits: 2 }) => {
    const parsed = parseFloat(String(num).replace(',', '.'));
    if (Number.isNaN(parsed)) return '';
    return parsed.toLocaleString('es-AR', options);
  };

  return (
    <div className="silos-page" role="main" aria-label="Gestión de alimentos y stock">
      <header className="page-header d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0 d-flex align-items-center gap-2">
          <Database size={22} aria-hidden="true" />
          <span>{tipoActual?.label || 'Alimentos'} - Stock</span>
        </h1>
        <div className="silos__header-actions" role="group" aria-label="Acciones de stock">
          <button className="silos__btn silos__btn--secondary" onClick={handleVerHistorial} disabled={insumos.length === 0}>
            <History size={16} aria-hidden="true" /> <span>Historial</span>
          </button>
          <button className="silos__btn silos__btn--primary" onClick={() => {
            setEditingInsumo(null);
            setForm({ nombre: '', tipo_insumo: selectedTipo || 'silo', unidad: 'kg', capacidad_maxima: '', stock_actual: '', stock_minimo: '' });
            setShowModal(true);
          }}>
            <Plus size={16} aria-hidden="true" /> <span>Cargar Insumo</span>
          </button>
        </div>
      </header>

      <section aria-label="Listado de insumos">
        <h2 className="visually-hidden">Insumos disponibles</h2>
        <div className="insumos-grid" role="list">
          {insumos.length === 0 && (
            <div className="empty-state">
              <Database size={48} />
              <p>No hay insumos registrados para esta categoría</p>
              <button className="btn btn-success" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Cargar primer insumo
              </button>
            </div>
          )}
          {insumos.map(insumo => {
            const porcentaje = getPorcentaje(insumo);
            const diasRaw = parseInt(insumo.dias_restantes) || 0;
            const nivelAlerta = getNivelAlerta(diasRaw);
            let dias;
            if (diasRaw === 999 || diasRaw === 0) {
              dias = 'Sin datos';
            } else if (diasRaw > 365) {
              dias = `${Math.floor(diasRaw / 30)} meses`;
            } else {
              dias = `${diasRaw} dias`;
            }
            const isCritical = nivelAlerta.nivel === 'critico' || nivelAlerta.nivel === 'precaucion';
            const precio = costosInsumos[insumo.id];
            const isEditing = editingPrecio === insumo.id;

            return (
              <article key={insumo.id} className="insumo-card-wrapper" role="listitem" aria-label={`Insumo ${insumo.nombre}`}>
                <div className={`insumo-card ${isCritical ? 'low-stock' : ''}`} style={{ borderLeftColor: nivelAlerta.color }}>
                  <div className="insumo-card-top">
                    <div className="insumo-card-info">
                      <h3 className="insumo-name">{insumo.nombre}</h3>
                      <p className="insumo-meta">Unidad: {insumo.unidad}</p>
                      <p className="insumo-meta">Capacidad: {formatNumber(insumo.capacidad_maxima, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {insumo.unidad}</p>
                    </div>
                    <button className="btn btn-sm btn-light insumo-edit-btn" onClick={() => handleEdit(insumo)} type="button" aria-label={`Editar ${insumo.nombre}`}>
                      <Edit2 size={14} /> Editar
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => handleVerHistorial(insumo)} aria-label={`Historial ${insumo.nombre}`}>
                      <History size={14} />
                    </button>
                  </div>

                  <hr className="insumo-divider" />

                  <div className="insumo-stock-display">
                    <span className="stock-current" style={{ color: nivelAlerta.color }}>
                      {formatNumber(insumo.stock_actual, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="stock-max">/{formatNumber(insumo.capacidad_maxima, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {insumo.unidad}</span>
                  </div>

                  <div className="insumo-precio-section">
                    <div className="precio-info">
                      <span className="precio-label">Precio/kg (USD)</span>
                      {isEditing ? (
                        <div className="input-group input-group-sm precio-input-group">
                          <span className="input-group-text">US$</span>
                          <input type="number" step="0.0001" className="form-control" value={precioInput} onChange={(e) => setPrecioInput(e.target.value)} autoFocus />
                        </div>
                      ) : (
                        <strong className="precio-value">US${precio ? parseFloat(precio).toFixed(2) : 'N/A'}</strong>
                      )}
                    </div>
                    <div className="precio-actions">
                      {isEditing ? (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => handleGuardarPrecio(insumo.id)} aria-label="Guardar precio">
                            <CheckCircle size={14} />
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={handleCancelarPrecio} aria-label="Cancelar">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-sm btn-outline-primary" onClick={() => handleEditarPrecio(insumo)} aria-label="Editar precio">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="insumo-details-row">
                    <div className="detail-col">
                      <span className="detail-label">Porcentaje</span>
                      <strong className="detail-value">{porcentaje}%</strong>
                    </div>
                    <div className="detail-col text-end">
                      <span className="detail-label">Dias restantes</span>
                      <strong className="detail-value" style={{ color: nivelAlerta.color }}>{dias}</strong>
                    </div>
                  </div>

                  <div className="progress-bar" role="progressbar" aria-valuenow={porcentaje} aria-valuemin="0" aria-valuemax="100">
                    <div className="progress-fill" style={{ width: `${porcentaje}%`, backgroundColor: getProgressColor(porcentaje) }}></div>
                  </div>

                  {isCritical && (
                    <div className="stock-warning" style={{ color: nivelAlerta.color }} role="alert" aria-live="polite">
                      <AlertTriangle size={14} aria-hidden="true" /> {nivelAlerta.label} - {dias}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="h5 mb-0">{editingInsumo ? 'Editar Insumo' : 'Nuevo Insumo'}</h3>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Nombre del Insumo</label>
                  <input type="text" className="form-control" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={form.tipo_insumo} onChange={e => setForm({...form, tipo_insumo: e.target.value})} required>
                    <option value="">Seleccionar tipo...</option>
                    {todosLosTipos.filter(t => t.value !== 'todos').map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Unidad</label>
                  <input type="text" className="form-control" value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})} required />
                </div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Capacidad Maxima</label>
                    <input type="number" step="1" min="0" className="form-control" value={form.capacidad_maxima} onChange={e => setForm({...form, capacidad_maxima: e.target.value})} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Stock Actual</label>
                    <input type="number" step="1" min="0" className="form-control" value={form.stock_actual} onChange={e => setForm({...form, stock_actual: e.target.value})} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Stock Minimo</label>
                    <input type="number" step="1" min="0" className="form-control" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: e.target.value})} required />
                  </div>
                </div>

                {editingInsumo && (
                  <div className="carga-section">
                    <h4 className="h6 mb-3 text-success">Nuevo Ingreso</h4>
                    <div className="mb-3">
                      <label className="form-label">Cantidad a agregar ({form.unidad})</label>
                      <input type="number" className="form-control" value={cargaForm.cantidad} onChange={e => setCargaForm({...cargaForm, cantidad: e.target.value})} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Comprobante de Entrega (Remito)</label>
                      <input type="text" className="form-control" value={cargaForm.comprobante} onChange={e => setCargaForm({...cargaForm, comprobante: e.target.value})} placeholder="Nro de remito" />
                    </div>
                    <button type="button" className="btn btn-success w-100" onClick={handleCargar}>
                      <Plus size={16} className="me-1" /> Registrar Ingreso
                    </button>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    <X size={16} className="me-1" /> Cancelar
                  </button>
                  {editingInsumo && (
                    <button type="button" className="btn btn-danger" onClick={handleDelete}>
                      <Trash2 size={16} className="me-1" /> Eliminar
                    </button>
                  )}
                  <button type="submit" className="btn btn-success">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Historial Modal */}
      {showHistorial && editingInsumo && (
        <div className="modal-overlay" onClick={() => setShowHistorial(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="h5 mb-0">Historial - {editingInsumo.nombre}</h3>
              <button type="button" className="btn-close" onClick={() => setShowHistorial(false)}></button>
            </div>
            <div className="modal-body">
              {/* Periodo selector */}
              <div className="d-flex gap-2 mb-3 flex-wrap">
                {[
                  { value: '7', label: '7 días' },
                  { value: '30', label: '30 días' },
                  { value: '90', label: '3 meses' },
                  { value: '180', label: '6 meses' },
                  { value: '365', label: '1 año' },
                ].map(p => (
                  <button
                    key={p.value}
                    className={`btn btn-sm ${historialPeriodo === p.value ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => handleHistorialPeriodoChange(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Resumen */}
              {historialResumen && (
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded text-center" style={{ background: 'var(--primary-light)' }}>
                      <div className="small text-muted">Ingresos</div>
                      <strong className="text-success">+{formatNumber(historialResumen.total_ingresos)} {editingInsumo.unidad}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded text-center" style={{ background: 'rgba(193,85,59,0.1)' }}>
                      <div className="small text-muted">Consumos</div>
                      <strong className="text-danger">-{formatNumber(historialResumen.total_consumos)} {editingInsumo.unidad}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded text-center" style={{ background: 'var(--bg)' }}>
                      <div className="small text-muted">Ajustes +</div>
                      <strong>+{formatNumber(historialResumen.total_ajustes_pos)}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded text-center" style={{ background: 'var(--bg)' }}>
                      <div className="small text-muted">Balance</div>
                      <strong className={(parseFloat(historialResumen.total_ingresos) + parseFloat(historialResumen.total_ajustes_pos) - parseFloat(historialResumen.total_consumos) - parseFloat(historialResumen.total_ajustes_neg)) >= 0 ? 'text-success' : 'text-danger'}>
                        {formatNumber(parseFloat(historialResumen.total_ingresos) + parseFloat(historialResumen.total_ajustes_pos) - parseFloat(historialResumen.total_consumos) - parseFloat(historialResumen.total_ajustes_neg))} {editingInsumo.unidad}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="historial-list">
                {historial.map(h => {
                  const tipoLabels = { ingreso: 'Ingreso', consumo: 'Consumo', ajuste_positivo: 'Ajuste +', ajuste_negativo: 'Ajuste -' };
                  const tipoColors = { ingreso: 'var(--primary)', consumo: 'var(--danger)', ajuste_positivo: '#28a745', ajuste_negativo: 'var(--danger)' };
                  return (
                    <div key={h.id} className="historial-item d-flex justify-content-between align-items-center py-2 border-bottom">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge" style={{ backgroundColor: tipoColors[h.tipo], color: '#fff' }}>
                            {tipoLabels[h.tipo] || h.tipo}
                          </span>
                          <strong>{h.tipo === 'ingreso' || h.tipo === 'ajuste_positivo' ? '+' : '-'}{formatNumber(h.cantidad)} {h.unidad || editingInsumo.unidad}</strong>
                        </div>
                        <span className="d-block text-muted small">{h.fecha} {h.hora?.substring(0, 5)}</span>
                        {h.observaciones && <span className="d-block text-muted small fst-italic">{h.observaciones}</span>}
                      </div>
                      <div className="text-end">
                        <span className="d-block">{h.usuario_nombre || '-'}</span>
                        {h.comprobante_entrega && <span className="text-muted small">Remito: {h.comprobante_entrega}</span>}
                        <span className="d-block small text-muted">Stock: {formatNumber(h.stock_anterior)} → {formatNumber(h.stock_posterior)}</span>
                      </div>
                    </div>
                  );
                })}
                {historial.length === 0 && <p className="text-muted text-center py-3">Sin registros en este período</p>}
              </div>
              <div className="text-end mt-3">
                <button className="btn btn-success" onClick={() => setShowHistorial(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
