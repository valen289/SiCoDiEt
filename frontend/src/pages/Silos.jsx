import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import {
  Plus, Edit2, History, AlertTriangle, Database,
  X, Trash2, FileText
} from 'lucide-react';
import { compartirReportePdf } from '../utils/reportes';
import '../styles/silos.css';

const categoriasBase = [
  { value: 'reserva_forrajera', label: 'Reserva Forrajera' },
  { value: 'concentrado',       label: 'Concentrados'       },
  { value: 'sales',             label: 'Sales Minerales'    },
];

const tiposContenedor = [
  { value: 'silo',   label: 'Silo'   },
  { value: 'fardo',  label: 'Fardo'  },
  { value: 'bolson', label: 'Bolsón' },
  { value: 'bolsa',  label: 'Bolsa'  },
];

export default function Silos() {
  const { success, error, confirm } = useAlert();
  const { tipo: tipoFromUrl } = useParams();
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const selectedTipo = tipoFromUrl || 'reserva_forrajera';

  const customCats = (() => {
    try { return JSON.parse(localStorage.getItem('sicodiet-custom-food-types') || '[]'); }
    catch { return []; }
  })();
  const todasLasCategorias = [...categoriasBase, ...customCats.map(c => ({ value: c.value, label: c.label }))];
  const categoriaActual = todasLasCategorias.find(c => c.value === selectedTipo) || categoriasBase[0];

  const seoTitle = `${categoriaActual.label} - Gestión de Stock | SiCoDiET`;
  const seoDescription = `Control de stock de ${categoriaActual.label.toLowerCase()} para establecimiento lechero. Monitorea niveles, registra consumos diarios y optimiza la alimentación bovina con SiCoDiET.`;

  useSEO({
    title: seoTitle,
    description: seoDescription,
    keywords: `${categoriaActual.label}, stock, alimentos, establecimiento, ganado, consumo, insumos, gestion`
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
    nombre: '', categoria: '', tipo_insumo: 'silo', unidad: 'kg',
    capacidad_maxima: '', stock_actual: '', stock_minimo: '', precio_por_kg: ''
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
      const params = selectedTipo ? { categoria: selectedTipo } : {};
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
    const { precio_por_kg: _precio, ...formData } = form;
    const payload = {
      ...formData,
      capacidad_maxima: parseInt(formData.capacidad_maxima, 10),
      stock_actual: formData.stock_actual === '' ? 0 : parseInt(formData.stock_actual, 10),
      stock_minimo: parseInt(formData.stock_minimo, 10),
    };

    try {
      if (editingInsumo) {
        await api.put(`/insumos/${editingInsumo.id}`, payload);
        if (form.precio_por_kg !== '') {
          const precio = parseFloat(form.precio_por_kg);
          if (!isNaN(precio) && precio >= 0) {
            await api.put(`/dietas/costos/${editingInsumo.id}`, { precio_por_kg: precio });
            setCostosInsumos(prev => ({ ...prev, [editingInsumo.id]: precio }));
          }
        }
        success('Insumo actualizado');
      } else {
        const res = await api.post('/insumos', payload);
        if (form.precio_por_kg !== '') {
          const precio = parseFloat(form.precio_por_kg);
          if (!isNaN(precio) && precio >= 0) {
            await api.put(`/dietas/costos/${res.data.insumoId}`, { precio_por_kg: precio });
            setCostosInsumos(prev => ({ ...prev, [res.data.insumoId]: precio }));
          }
        }
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
      type: 'error', confirmText: 'Sí, eliminar', cancelText: 'Cancelar',
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
      categoria: insumo.categoria || selectedTipo,
      tipo_insumo: insumo.tipo_insumo,
      unidad: insumo.unidad,
      capacidad_maxima: parseIntegerValue(insumo.capacidad_maxima),
      stock_actual: parseIntegerValue(insumo.stock_actual),
      stock_minimo: parseIntegerValue(insumo.stock_minimo),
      precio_por_kg: costosInsumos[insumo.id] !== undefined ? String(Math.round(parseFloat(costosInsumos[insumo.id]) * 100) / 100) : '',
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
      error('Ingrese un precio válido mayor o igual a 0');
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

  const getStockClass = (porcentaje) => {
    if (porcentaje <= 30) return 'stock-low';
    if (porcentaje <= 60) return 'stock-mid';
    return 'stock-high';
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

  const handleReportePdf = async () => {
    setGenerandoPdf(true);
    try {
      await compartirReportePdf('stock', {
        filename: `stock-${new Date().toISOString().slice(0, 10)}.pdf`,
        titulo: 'Reporte de Stock',
      });
    } catch (err) {
      console.error('Error generando reporte PDF:', err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="silos-page" role="main" aria-label="Gestión de alimentos y stock">
      <header className="page-header d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0 d-flex align-items-center gap-2">
          <Database size={22} aria-hidden="true" />
          <span>{categoriaActual.label} - Stock</span>
        </h1>
        <div className="silos__header-actions" role="group" aria-label="Acciones de stock">
          <button className="silos__btn silos__btn--secondary" onClick={handleReportePdf} disabled={generandoPdf}>
            <FileText size={16} aria-hidden="true" /> <span>{generandoPdf ? 'Generando...' : 'Reporte PDF'}</span>
          </button>
          <button className="silos__btn silos__btn--primary" onClick={() => {
            setEditingInsumo(null);
            setForm({ nombre: '', categoria: selectedTipo || 'reserva_forrajera', tipo_insumo: 'silo', unidad: 'kg', capacidad_maxima: '', stock_actual: '', stock_minimo: '' });
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
            const esEstimado = insumo.dias_restantes_origen === 'formulado';
            const nivelAlerta = getNivelAlerta(diasRaw);
            let dias;
            if (diasRaw === 999 || diasRaw === 0) {
              dias = 'Sin datos';
            } else if (diasRaw > 365) {
              dias = `${Math.floor(diasRaw / 30)} meses${esEstimado ? ' (estimado)' : ''}`;
            } else {
              dias = `${esEstimado ? '~' : ''}${diasRaw} dias${esEstimado ? ' (estimado)' : ''}`;
            }
            const isCritical = nivelAlerta.nivel === 'critico' || nivelAlerta.nivel === 'precaucion';
            const stockClass = getStockClass(porcentaje);

            return (
              <article key={insumo.id} className="insumo-card-wrapper" role="listitem" aria-label={`Insumo ${insumo.nombre}`}>
                <div className={`insumo-card nivel-${nivelAlerta.nivel}`}>

                  {/* Header: nombre */}
                  <div className="insumo-card-top">
                    <div className="insumo-card-info">
                      <h3 className="insumo-name">{insumo.nombre}</h3>
                      <span className="insumo-tipo-badge">{insumo.tipo_insumo}</span>
                    </div>
                  </div>

                  {/* Stock hero */}
                  <div className="insumo-stock-display">
                    <div className="stock-hero">
                      <span className="stock-current">
                        {formatNumber(insumo.stock_actual, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="stock-unit">{insumo.unidad}</span>
                    </div>
                    <span className="stock-disponible">Disponible</span>
                  </div>

                  {/* Barra de progreso con % */}
                  <div className="progress-bar-container">
                    <div className="progress-bar" role="progressbar" aria-valuenow={porcentaje} aria-valuemin="0" aria-valuemax="100" aria-label={`Stock al ${porcentaje}%`}>
                      <div className={`progress-fill ${stockClass}`} style={{ width: `${porcentaje}%` }} />
                    </div>
                    <span className="progress-pct">{porcentaje}%</span>
                  </div>

                  {/* Footer: días restantes + capacidad + precio */}
                  <div className="insumo-footer">
                    <div className="footer-stat">
                      <span className="footer-stat__label">Días restantes</span>
                      <strong className="footer-stat__value dias-value">{dias}</strong>
                    </div>
                    <div className="footer-stat">
                      <span className="footer-stat__label">Capacidad máx.</span>
                      <strong className="footer-stat__value">
                        {formatNumber(insumo.capacidad_maxima, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {insumo.unidad}
                      </strong>
                    </div>
                    <div className="footer-stat">
                      <span className="footer-stat__label">Precio/kg</span>
                      <strong className="footer-stat__value">
                        {costosInsumos[insumo.id] !== undefined
                          ? `US$${parseFloat(costosInsumos[insumo.id]).toFixed(2)}`
                          : <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>—</span>}
                      </strong>
                    </div>
                    {insumo.kg_materia_seca_disponible !== null && insumo.kg_materia_seca_disponible !== undefined && (
                      <div className="footer-stat">
                        <span className="footer-stat__label">MS disponible</span>
                        <strong className="footer-stat__value">
                          {formatNumber(insumo.kg_materia_seca_disponible, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Botones acción */}
                  <div className="card-btn-row">
                    <button className="card-btn card-btn--edit" onClick={() => handleEdit(insumo)} aria-label={`Editar ${insumo.nombre}`}>
                      <Edit2 size={13} /> Editar
                    </button>
                    <button className="card-btn card-btn--history" onClick={() => handleVerHistorial(insumo)} aria-label={`Movimientos ${insumo.nombre}`}>
                      <History size={13} /> Movimientos
                    </button>
                  </div>

                  {/* Alerta crítica */}
                  {isCritical && (
                    <div className="stock-warning" role="alert" aria-live="polite">
                      <AlertTriangle size={13} aria-hidden="true" />
                      {nivelAlerta.label} — {dias}
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
                  <input type="text" className="form-control" value={form.nombre} onChange={e => setForm(prev => ({...prev, nombre: e.target.value}))} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Categoría</label>
                  <select className="form-select" value={form.categoria} onChange={e => setForm(prev => ({...prev, categoria: e.target.value}))} required>
                    <option value="">Seleccionar categoría...</option>
                    {todasLasCategorias.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Contenedor físico</label>
                  <select className="form-select" value={form.tipo_insumo} onChange={e => setForm(prev => ({...prev, tipo_insumo: e.target.value}))} required>
                    <option value="">Seleccionar contenedor...</option>
                    {tiposContenedor.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Unidad</label>
                  <input type="text" className="form-control" value={form.unidad} onChange={e => setForm(prev => ({...prev, unidad: e.target.value}))} required />
                </div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Capacidad Máxima</label>
                    <input type="number" step="1" min="0" className="form-control" value={form.capacidad_maxima} onChange={e => setForm(prev => ({...prev, capacidad_maxima: e.target.value}))} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Stock Actual</label>
                    <input type="number" step="1" min="0" className="form-control" value={form.stock_actual} onChange={e => setForm(prev => ({...prev, stock_actual: e.target.value}))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Stock Mínimo</label>
                    <input type="number" step="1" min="0" className="form-control" value={form.stock_minimo} onChange={e => setForm(prev => ({...prev, stock_minimo: e.target.value}))} required />
                  </div>
                </div>

                {editingInsumo && (
                  <div className="mb-3">
                    <label className="form-label">Precio por kg (US$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="0.00"
                      value={form.precio_por_kg}
                      onChange={e => setForm(prev => ({ ...prev, precio_por_kg: e.target.value }))}
                      onBlur={e => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) setForm(prev => ({ ...prev, precio_por_kg: String(Math.round(val * 100) / 100) }));
                      }}
                    />
                    <div className="form-text">Este precio se usa en Costos y en Dietas.</div>
                  </div>
                )}

                {editingInsumo && (
                  <div className="carga-section">
                    <h4 className="h6 mb-3 text-success">Ajuste manual de stock (sin proveedor)</h4>
                    <div className="form-text mb-3">¿Es una compra a un proveedor? Usá el módulo Compras en su lugar: ahí queda registrado el precio pagado.</div>
                    <div className="mb-3">
                      <label className="form-label">Cantidad a agregar ({form.unidad})</label>
                      <input type="number" className="form-control" value={cargaForm.cantidad} onChange={e => setCargaForm({...cargaForm, cantidad: e.target.value})} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Comprobante de Entrega (Remito)</label>
                      <input type="text" className="form-control" value={cargaForm.comprobante} onChange={e => setCargaForm({...cargaForm, comprobante: e.target.value})} placeholder="Nro de remito" />
                    </div>
                    <button type="button" className="btn btn-success w-100" onClick={handleCargar}>
                      <Plus size={16} className="me-1" /> Registrar ajuste de stock
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
                    <div className="historial-resumen-card historial-resumen-card--ingreso text-center">
                      <div className="small text-muted">Ingresos</div>
                      <strong className="text-success">+{formatNumber(historialResumen.total_ingresos)} {editingInsumo.unidad}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="historial-resumen-card historial-resumen-card--consumo text-center">
                      <div className="small text-muted">Consumos</div>
                      <strong className="text-danger">-{formatNumber(historialResumen.total_consumos)} {editingInsumo.unidad}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="historial-resumen-card historial-resumen-card--ajuste text-center">
                      <div className="small text-muted">Ajustes +</div>
                      <strong>+{formatNumber(historialResumen.total_ajustes_pos)}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="historial-resumen-card historial-resumen-card--ajuste text-center">
                      <div className="small text-muted">Balance</div>
                      {(() => {
                        const balance = parseFloat(historialResumen.total_ingresos) + parseFloat(historialResumen.total_ajustes_pos) - parseFloat(historialResumen.total_consumos) - parseFloat(historialResumen.total_ajustes_neg);
                        return <strong className={balance >= 0 ? 'text-success' : 'text-danger'}>{formatNumber(balance)} {editingInsumo.unidad}</strong>;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              <div className="historial-list">
                {historial.map(h => {
                  const tipoLabels = { ingreso: 'Ingreso', consumo: 'Consumo', ajuste_positivo: 'Ajuste +', ajuste_negativo: 'Ajuste -' };
                  const tipoBadge = { ingreso: 'bg-success', consumo: 'bg-danger', ajuste_positivo: 'bg-primary', ajuste_negativo: 'bg-danger' };
                  return (
                    <div key={h.id} className="historial-item d-flex justify-content-between align-items-center py-2 border-bottom">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge ${tipoBadge[h.tipo] || 'bg-secondary'}`}>
                            {tipoLabels[h.tipo] || h.tipo}
                          </span>
                          <strong>{h.tipo === 'ingreso' || h.tipo === 'ajuste_positivo' ? '+' : '-'}{formatNumber(h.cantidad)} {h.unidad || editingInsumo.unidad}</strong>
                        </div>
                        <span className="d-block text-muted small">{h.fecha?.split('T')[0]} {h.hora?.substring(0, 5)}</span>
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
