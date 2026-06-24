import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSEO } from '../hooks/useSEO';
import { useAlert } from '../context/AlertContext';
import {
  Calculator, DollarSign, Plus, Edit2, Trash2,
  Save, X, BarChart3, AlertTriangle, ChevronUp, Info,
  Milk, Leaf, Beef
} from 'lucide-react';
import { safeNum, fmtUSD } from '../utils/formatters';
import '../styles/dietas.css';

export default function Dietas() {
  const navigate = useNavigate();
  useSEO({ title: 'Formulación de Dietas', description: 'Formulación y análisis económico de dietas para ganado con cálculo de costos, márgenes y simulación de escenarios.' });
  const { success, error: showError, confirm } = useAlert();
  const mountedRef = useRef(true);

  const [dietas, setDietas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [costos, setCostos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDieta, setExpandedDieta] = useState(null);
  const [apiError, setApiError] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    lote_id: '',
    ingredientes: [],
    produccion_leche_esperada: 20,
    precio_leche_por_litro: 0.45,
    ganancia_kg_esperada: 0.8,
    precio_kg_en_pie: 1.8,
  });

  const [simulationData, setSimulationData] = useState({ variacion_precio: 0, variacion_produccion: 0 });
  const [simulationResult, setSimulationResult] = useState(null);
  const [calculoPreview, setCalculoPreview] = useState(null);


  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchSafe = useCallback(async (url, fallback = []) => {
    try {
      const res = await api.get(url);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return fallback;
      throw err;
    }
  }, []);


  const loadData = useCallback(async () => {
    try {
      setApiError(null);
      const [dietasRaw, lotesRaw, insumosRaw, costosRaw] = await Promise.all([
        fetchSafe('/dietas', []),
        fetchSafe('/lotes', { lotes: [] }),
        fetchSafe('/insumos', { insumos: [] }),
        fetchSafe('/dietas/costos', []),
      ]);

      const lotesData = Array.isArray(lotesRaw) ? lotesRaw : (lotesRaw.lotes || []);
      const insumosData = Array.isArray(insumosRaw) ? insumosRaw : (insumosRaw.insumos || []);

      if (mountedRef.current) {
        setDietas(Array.isArray(dietasRaw) ? dietasRaw : []);
        setLotes(lotesData.filter(l => safeNum(l.activo) === 1));
        setInsumos(insumosData.filter(i => safeNum(i.activo) === 1));
        setCostos(Array.isArray(costosRaw) ? costosRaw : []);
      }
    } catch (error) {
      if (mountedRef.current) {
        setApiError(error.response?.data?.error || error.message);
      }
    }
  }, [fetchSafe]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLoading(true);
        setApiError(null);

        const [dietasRaw, lotesRaw, insumosRaw, costosRaw] = await Promise.all([
          fetchSafe('/dietas', []),
          fetchSafe('/lotes', { lotes: [] }),
          fetchSafe('/insumos', { insumos: [] }),
          fetchSafe('/dietas/costos', []),
        ]);

        const lotesData = Array.isArray(lotesRaw) ? lotesRaw : (lotesRaw.lotes || []);
        const insumosData = Array.isArray(insumosRaw) ? insumosRaw : (insumosRaw.insumos || []);

        if (cancelled) return;

        setDietas(Array.isArray(dietasRaw) ? dietasRaw : []);
        setLotes(lotesData.filter(l => safeNum(l.activo) === 1));
        setInsumos(insumosData.filter(i => safeNum(i.activo) === 1));
        setCostos(Array.isArray(costosRaw) ? costosRaw : []);
      } catch (error) {
        if (!cancelled) setApiError(error.response?.data?.error || error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [fetchSafe]);

  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel('sico-diet-precio-actualizado');
      channel.onmessage = (event) => {
        if (event.data?.type === 'precio-actualizado') loadData();
      };
    } catch { /* not supported */ }
    return () => { if (channel) channel.close(); };
  }, [loadData]);

  const handleAddIngrediente = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      ingredientes: [...prev.ingredientes, { insumo_id: '', cantidad_kg: '', porcentaje_am: 50 }],
    }));
  }, []);

  const handleRemoveIngrediente = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      ingredientes: prev.ingredientes.filter((_, i) => i !== index),
    }));
  }, []);

  const handleIngredienteChange = useCallback((index, field, value) => {
    setFormData(prev => {
      const newIngredientes = [...prev.ingredientes];
      newIngredientes[index] = { ...newIngredientes[index], [field]: value };
      return { ...prev, ingredientes: newIngredientes };
    });
  }, []);

  const getCostoPorKg = useCallback((insumoId) => {
    if (!insumoId) return 0;
    const costo = costos.find(c => c.insumo_id === parseInt(insumoId));
    return costo ? safeNum(costo.precio_por_kg) : 0;
  }, [costos]);

  const selectedLote = lotes.find(l => l.id === parseInt(formData.lote_id));
  const objetivo = selectedLote?.objetivo_productivo || 'leche';

  const calcularPreview = useCallback(async () => {
    const ingredientesValidas = formData.ingredientes.filter(i => i.insumo_id && safeNum(i.cantidad_kg) > 0);
    if (ingredientesValidas.length === 0 || !formData.lote_id) {
      setCalculoPreview(null);
      return;
    }

    const lote = lotes.find(l => l.id === parseInt(formData.lote_id));
    if (!lote) return;

    try {
      const { data } = await api.post('/dietas/calcular', {
        ingredientes: ingredientesValidas,
        lote_id: formData.lote_id,
        produccion_leche_esperada: safeNum(formData.produccion_leche_esperada),
        precio_leche_por_litro: safeNum(formData.precio_leche_por_litro),
        ganancia_kg_esperada: safeNum(formData.ganancia_kg_esperada),
        precio_kg_en_pie: safeNum(formData.precio_kg_en_pie),
      });
      if (data && data.resumen) setCalculoPreview(data);
    } catch (error) {
      console.error('Error al calcular:', error);
    }
  }, [formData.ingredientes, formData.lote_id, formData.produccion_leche_esperada, formData.precio_leche_por_litro, formData.ganancia_kg_esperada, formData.precio_kg_en_pie, lotes]);

  useEffect(() => {
    if (showForm && formData.ingredientes.length > 0 && formData.lote_id) {
      const timeout = setTimeout(calcularPreview, 600);
      return () => clearTimeout(timeout);
    }
  }, [calcularPreview, showForm, formData.ingredientes, formData.lote_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const ingredientesValidas = formData.ingredientes.filter(i => i.insumo_id && safeNum(i.cantidad_kg) > 0);
    if (ingredientesValidas.length === 0) {
      showError('Debe agregar al menos un ingrediente con cantidad mayor a 0');
      return;
    }

    const wasEditing = !!editingId;
    try {
      if (editingId) {
        await api.put(`/dietas/${editingId}`, { ...formData, ingredientes: ingredientesValidas });
      } else {
        await api.post('/dietas', { ...formData, ingredientes: ingredientesValidas });
      }
      resetForm();
      await loadData();
      success(wasEditing ? 'Dieta actualizada' : 'Dieta creada');
    } catch (error) {
      console.error('Error al guardar dieta:', error);
      showError(error.response?.data?.error || 'Error al guardar la dieta');
    }
  };

  const handleEdit = async (dieta) => {
    try {
      const { data } = await api.get(`/dietas/${dieta.id}`);
      if (!data) {
        showError('No se pudo cargar la dieta');
        return;
      }

      const ingredientes = Array.isArray(data.ingredientes)
        ? data.ingredientes.map(i => ({
            insumo_id: String(i.insumo_id || ''),
            cantidad_kg: safeNum(i.cantidad_kg, 0),
            porcentaje_am: safeNum(i.porcentaje_am, 50),
          }))
        : [];

      setFormData({
        nombre: data.nombre || '',
        lote_id: String(data.lote_id || ''),
        ingredientes,
        produccion_leche_esperada: safeNum(data.produccion_leche_esperada, 20),
        precio_leche_por_litro: safeNum(data.precio_leche_por_litro, 0.45),
        ganancia_kg_esperada: safeNum(data.ganancia_kg_esperada, 0.8),
        precio_kg_en_pie: safeNum(data.precio_kg_en_pie, 1.8),
      });
      setEditingId(data.id);
      setShowForm(true);
      setExpandedDieta(null);
    } catch (error) {
      console.error('Error al cargar dieta:', error);
      showError(error.response?.data?.error || 'Error al cargar la dieta');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Eliminar Dieta',
      message: '¿Está seguro que desea eliminar esta dieta?',
      type: 'error',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/dietas/${id}`);
      await loadData();
      success('Dieta eliminada');
    } catch (error) {
      console.error('Error al eliminar dieta:', error);
      showError(error.response?.data?.error || 'Error al eliminar la dieta');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '', lote_id: '', ingredientes: [],
      produccion_leche_esperada: 20, precio_leche_por_litro: 0.45,
      ganancia_kg_esperada: 0.8, precio_kg_en_pie: 1.8,
    });
    setEditingId(null);
    setShowForm(false);
    setCalculoPreview(null);
  };

  const runSimulation = () => {
    const ingredientesValidas = formData.ingredientes.filter(i => i.insumo_id && safeNum(i.cantidad_kg) > 0);
    if (ingredientesValidas.length === 0) {
      showError('Primero agregue ingredientes a la dieta para simular');
      return;
    }

    const lote = lotes.find(l => l.id === parseInt(formData.lote_id));
    if (!lote) {
      showError('Seleccione un lote para simular');
      return;
    }

    const costoTotalSimulado = ingredientesValidas.reduce((sum, i) => {
      const costo = costos.find(c => c.insumo_id === parseInt(i.insumo_id));
      const precioBase = costo ? safeNum(costo.precio_por_kg) : 0;
      const precioSimulado = precioBase * (1 + safeNum(simulationData.variacion_precio) / 100);
      return sum + (safeNum(i.cantidad_kg) * precioSimulado);
    }, 0);

    const loteObjetivo = lote.objetivo_productivo || 'leche';
    const cantidadAnimales = safeNum(lote.cantidad_animales);
    // cantidad_kg de cada ingrediente ya esta expresada por vaca/dia, asi que costoTotalSimulado
    // ya es el costo por vaca/dia. No dividir de nuevo por cantidadAnimales.
    const costoPorVaca = costoTotalSimulado;

    let ingresoPorVaca = 0;
    let costoPorLitro = 0, margenPorLitro = 0, produccionSimulada = 0;
    let costoPorKgGanado = 0, margenPorKgGanado = 0, gananciaSimulada = 0;

    if (loteObjetivo === 'leche') {
      produccionSimulada = safeNum(formData.produccion_leche_esperada) * (1 + safeNum(simulationData.variacion_produccion) / 100);
      ingresoPorVaca = produccionSimulada * safeNum(formData.precio_leche_por_litro);
      costoPorLitro = produccionSimulada > 0 ? costoPorVaca / produccionSimulada : 0;
      margenPorLitro = produccionSimulada > 0 ? (ingresoPorVaca - costoPorVaca) / produccionSimulada : 0;
    } else {
      gananciaSimulada = safeNum(formData.ganancia_kg_esperada) * (1 + safeNum(simulationData.variacion_produccion) / 100);
      ingresoPorVaca = gananciaSimulada * safeNum(formData.precio_kg_en_pie);
      costoPorKgGanado = gananciaSimulada > 0 ? costoPorVaca / gananciaSimulada : 0;
      margenPorKgGanado = gananciaSimulada > 0 ? (ingresoPorVaca - costoPorVaca) / gananciaSimulada : 0;
    }

    const margenAlimenticio = ingresoPorVaca - costoPorVaca;
    const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

    setSimulationResult({
      objetivo_productivo: loteObjetivo,
      costo_total: costoTotalSimulado * cantidadAnimales,
      costo_por_vaca: costoPorVaca,
      costo_por_litro: costoPorLitro,
      ingreso_por_vaca: ingresoPorVaca,
      margen_alimenticio: margenAlimenticio,
      margen_por_litro: margenPorLitro,
      costo_por_kg_ganado: costoPorKgGanado,
      margen_por_kg_ganado: margenPorKgGanado,
      porcentaje_gasto_alimentacion: porcentajeGasto,
      produccion_simulada: produccionSimulada,
      ganancia_simulada: gananciaSimulada,
      variacion_precio: safeNum(simulationData.variacion_precio),
      variacion_produccion: safeNum(simulationData.variacion_produccion),
    });
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-success" role="status" /></div>;
  }

  const resumen = calculoPreview?.resumen;

  return (
    <div className="dietas-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0"><Calculator size={28} className="me-2" />Formulación de Dietas</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={18} className="me-1" />Nueva Dieta
          </button>
        </div>
      </div>

      {apiError && (
        <div className="alert alert-danger mb-3">
          <strong>Error de API:</strong> {apiError}
        </div>
      )}

      {showForm && (
        <div className="card mb-4 dieta-form-card">
          <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{editingId ? 'Editar Dieta' : 'Nueva Dieta'}</h5>
            <button className="btn btn-sm btn-light" onClick={resetForm}><X size={16} /></button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="dietas__section-title mb-3">
                <h6 className="mb-0"><Info size={18} className="me-2" />Informacion General</h6>
              </div>
              <div className="row g-3 mb-4 dietas__info-row">
                <div className="col-md-4">
                  <label className="form-label">Nombre de la Dieta</label>
                  <input type="text" className="form-control" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required placeholder="Ej: Dieta Lactancia Alta" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Lote</label>
                  <select className="form-select" value={formData.lote_id} onChange={(e) => setFormData({ ...formData, lote_id: e.target.value })} required>
                    <option value="">Seleccionar lote...</option>
                    {lotes.map(l => (
                      <option key={l.id} value={String(l.id)}>
                        {l.nombre} ({safeNum(l.cantidad_animales)} animales · {l.objetivo_productivo === 'engorde' ? 'Engorde' : 'Leche'})
                      </option>
                    ))}
                  </select>
                  {lotes.length === 0 && (
                    <div className="alert alert-warning mt-2 py-2 px-3 d-flex align-items-center gap-2">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      <span className="small mb-0">No hay lotes registrados.</span>
                      <button type="button" className="btn btn-sm btn-outline-warning ms-auto" onClick={() => navigate('/lotes')}>Crear Lote</button>
                    </div>
                  )}
                </div>
                {objetivo === 'leche' ? (
                  <>
                    <div className="col-md-2">
                      <label className="form-label">Prod. Leche (L/vaca/dia)</label>
                      <input type="number" step="0.1" min="0" className="form-control" value={formData.produccion_leche_esperada} onChange={(e) => setFormData({ ...formData, produccion_leche_esperada: parseFloat(e.target.value) || 0 })} required />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Precio Leche (US$/L)</label>
                      <div className="input-group">
                        <span className="input-group-text">US$</span>
                        <input type="number" step="0.01" min="0" className="form-control" value={formData.precio_leche_por_litro} onChange={(e) => setFormData({ ...formData, precio_leche_por_litro: parseFloat(e.target.value) || 0 })} required />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-md-2">
                      <label className="form-label">Ganancia Esperada (kg/animal/dia)</label>
                      <input type="number" step="0.05" min="0" className="form-control" value={formData.ganancia_kg_esperada} onChange={(e) => setFormData({ ...formData, ganancia_kg_esperada: parseFloat(e.target.value) || 0 })} required />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Precio kg en pie (US$/kg)</label>
                      <div className="input-group">
                        <span className="input-group-text">US$</span>
                        <input type="number" step="0.01" min="0" className="form-control" value={formData.precio_kg_en_pie} onChange={(e) => setFormData({ ...formData, precio_kg_en_pie: parseFloat(e.target.value) || 0 })} required />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="dietas__section-title mb-3">
                <h6 className="mb-0"><Leaf size={18} className="me-2" />Ingredientes de la Dieta</h6>
              </div>

              {insumos.length === 0 && (
                <div className="alert alert-warning d-flex align-items-center gap-2">
                  <AlertTriangle size={18} className="flex-shrink-0" />
                  <span>No hay ingredientes registrados.</span>
                  <button type="button" className="btn btn-sm btn-outline-warning ms-auto" onClick={() => navigate('/silos')}>Gestionar Ingredientes</button>
                </div>
              )}

              {formData.ingredientes.length > 0 && (
                <>
                  <div className="table-responsive mb-3 dietas__desktop-table">
                    <table className="table table-sm table-bordered dietas__ingredientes-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Ingrediente</th>
                          <th style={{ width: '16%' }}>kg/vaca/dia</th>
                          <th style={{ width: '10%' }} className="text-center">AM %</th>
                          <th style={{ width: '10%' }} className="text-center">PM %</th>
                          <th style={{ width: '14%' }}>Precio/kg</th>
                          <th style={{ width: '14%' }}>Costo</th>
                          <th style={{ width: '8%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.ingredientes.map((ing, index) => {
                          const cantidad = safeNum(ing.cantidad_kg);
                          const costoParcial = cantidad * getCostoPorKg(ing.insumo_id);
                          const pctAm = Math.min(100, Math.max(0, safeNum(ing.porcentaje_am, 50)));
                          const pctPm = 100 - pctAm;
                          return (
                            <tr key={index}>
                              <td>
                                <select className="form-select form-select-sm" value={ing.insumo_id} onChange={(e) => handleIngredienteChange(index, 'insumo_id', e.target.value)}>
                                  <option value="">Seleccionar...</option>
                                  {insumos.map(i => <option key={i.id} value={String(i.id)}>{i.nombre}</option>)}
                                </select>
                              </td>
                              <td>
                                <input type="number" step="0.1" min="0" className="form-control form-control-sm" value={ing.cantidad_kg} onChange={(e) => handleIngredienteChange(index, 'cantidad_kg', e.target.value)} />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0" max="100" step="5"
                                  className="form-control form-control-sm text-center"
                                  value={pctAm}
                                  onChange={(e) => handleIngredienteChange(index, 'porcentaje_am', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                />
                              </td>
                              <td className="text-center align-middle">
                                <span className="badge bg-secondary">{pctPm}%</span>
                              </td>
                              <td className="text-center">{fmtUSD(getCostoPorKg(ing.insumo_id))}</td>
                              <td className="text-center fw-bold">{fmtUSD(costoParcial)}</td>
                              <td className="text-center">
                                <button type="button" className="dietas__action-btn dietas__action-btn--danger" onClick={() => handleRemoveIngrediente(index)}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="dietas__mobile-ingredientes mb-3">
                    {formData.ingredientes.map((ing, index) => {
                      const cantidad = safeNum(ing.cantidad_kg);
                      const costoParcial = cantidad * getCostoPorKg(ing.insumo_id);
                      const pctAm = Math.min(100, Math.max(0, safeNum(ing.porcentaje_am, 50)));
                      const pctPm = 100 - pctAm;
                      return (
                        <div key={index} className="dietas__ingrediente-card mb-2">
                          <div className="dietas__ingrediente-header d-flex justify-content-between align-items-center mb-2">
                            <span className="dietas__ingrediente-num badge bg-secondary">#{index + 1}</span>
                            <button
                              type="button"
                              className="dietas__action-btn dietas__action-btn--danger"
                              onClick={(e) => { e.stopPropagation(); handleRemoveIngrediente(index); }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mb-2">
                            <label className="form-label small mb-1">Ingrediente</label>
                            <select className="form-select form-select-sm" value={ing.insumo_id} onChange={(e) => handleIngredienteChange(index, 'insumo_id', e.target.value)}>
                              <option value="">Seleccionar...</option>
                              {insumos.map(i => <option key={i.id} value={String(i.id)}>{i.nombre}</option>)}
                            </select>
                          </div>
                          <div className="mb-2">
                            <label className="form-label small mb-1">Cantidad (kg/vaca/dia)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              inputMode="decimal"
                              className="form-control form-control-sm"
                              value={ing.cantidad_kg}
                              onChange={(e) => handleIngredienteChange(index, 'cantidad_kg', e.target.value)}
                              placeholder="0.0"
                            />
                          </div>
                          <div className="row g-2 mb-2">
                            <div className="col-6">
                              <label className="form-label small mb-1">AM %</label>
                              <input
                                type="number"
                                min="0" max="100" step="5"
                                inputMode="numeric"
                                className="form-control form-control-sm"
                                value={pctAm}
                                onChange={(e) => handleIngredienteChange(index, 'porcentaje_am', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                              />
                            </div>
                            <div className="col-6 d-flex flex-column justify-content-end">
                              <label className="form-label small mb-1">PM %</label>
                              <span className="form-control form-control-sm bg-light text-center fw-bold">{pctPm}%</span>
                            </div>
                          </div>
                          <div className="ingrediente-details row g-2 small">
                            <div className="col-6">
                              <span className="text-muted d-block">Precio/kg</span>
                              <strong>{fmtUSD(getCostoPorKg(ing.insumo_id))}</strong>
                            </div>
                            <div className="col-6">
                              <span className="text-muted d-block">Costo</span>
                              <strong>{fmtUSD(costoParcial)}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <button type="button" className="dietas__add-ingredient-btn" onClick={handleAddIngrediente}>
                <Plus size={14} className="me-1" />Agregar Ingrediente
              </button>

              {resumen && (
                <>
                  <div className="dietas__section-title mb-3">
                    <h6 className="mb-0"><DollarSign size={18} className="me-2" />Analisis Economico</h6>
                  </div>
                  <div className="dietas__econ-grid">
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">Costo Dieta</div>
                      <div className="dietas__econ-value">{fmtUSD(resumen.costo_por_vaca)}</div>
                      <div className="dietas__econ-sub">/vaca/dia</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">{objetivo === 'leche' ? 'Costo por Litro' : 'Costo por Kg Ganado'}</div>
                      <div className="dietas__econ-value">{fmtUSD(objetivo === 'leche' ? resumen.costo_por_litro : resumen.costo_por_kg_ganado)}</div>
                      <div className="dietas__econ-sub">{objetivo === 'leche' ? '/litro' : '/kg ganado'}</div>
                    </div>
                    <div className="dietas__econ-card dietas__econ-card--income">
                      <div className="dietas__econ-label">Ingreso por Vaca</div>
                      <div className="dietas__econ-value">{fmtUSD(resumen.ingreso_por_vaca)}</div>
                      <div className="dietas__econ-sub">{objetivo === 'leche' ? 'produccion de leche' : 'ganancia de peso'}</div>
                    </div>
                    <div className={`dietas__econ-card ${safeNum(resumen.margen_alimenticio) >= 0 ? 'dietas__econ-card--positive' : 'dietas__econ-card--negative'}`}>
                      <div className="dietas__econ-label">Margen Alimenticio</div>
                      <div className="dietas__econ-value">{fmtUSD(resumen.margen_alimenticio)}</div>
                      <div className="dietas__econ-sub">por vaca/dia</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">{objetivo === 'leche' ? 'Margen por Litro' : 'Margen por Kg Ganado'}</div>
                      <div className="dietas__econ-value">{fmtUSD(objetivo === 'leche' ? resumen.margen_por_litro : resumen.margen_por_kg_ganado)}</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">% Gasto Alimentacion</div>
                      <div className="dietas__econ-value">{safeNum(resumen.porcentaje_gasto_alimentacion).toFixed(1)}%</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">Costo Total Lote</div>
                      <div className="dietas__econ-value">{fmtUSD(resumen.costo_total)}</div>
                      <div className="dietas__econ-sub">por dia</div>
                    </div>
                  </div>
                </>
              )}

              <div className="dietas__form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}><X size={18} className="me-1" />Cancelar</button>
                <button type="submit" className="btn btn-success"><Save size={18} className="me-1" />{editingId ? 'Actualizar' : 'Guardar'} Dieta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSimulation && (
        <div className="card mb-4">
          <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0"><BarChart3 size={20} className="me-2" />Simulacion de Escenarios</h5>
            <button className="btn btn-sm btn-light" onClick={() => { setShowSimulation(false); setSimulationResult(null); }}><X size={16} /></button>
          </div>
          <div className="card-body">
            {(!formData.lote_id || formData.ingredientes.filter(i => i.insumo_id).length === 0) && (
              <div className="alert alert-warning">
                <AlertTriangle size={18} className="me-2" />
                Configure primero una dieta en el formulario de arriba para poder simular escenarios.
              </div>
            )}

            {(formData.lote_id && formData.ingredientes.filter(i => i.insumo_id).length > 0) && (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label">Variacion de Precios de Insumos</label>
                    <input type="range" className="form-range" min="-30" max="30" value={simulationData.variacion_precio}
                      onChange={(e) => { setSimulationData({ ...simulationData, variacion_precio: parseInt(e.target.value) }); setSimulationResult(null); }} />
                    <div className={`text-center fw-bold ${simulationData.variacion_precio > 0 ? 'text-danger' : simulationData.variacion_precio < 0 ? 'text-success' : ''}`}>
                      {simulationData.variacion_precio > 0 ? '+' : ''}{simulationData.variacion_precio}%
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{objetivo === 'leche' ? 'Variacion de Produccion de Leche' : 'Variacion de Ganancia de Peso'}</label>
                    <input type="range" className="form-range" min="-30" max="30" value={simulationData.variacion_produccion}
                      onChange={(e) => { setSimulationData({ ...simulationData, variacion_produccion: parseInt(e.target.value) }); setSimulationResult(null); }} />
                    <div className={`text-center fw-bold ${simulationData.variacion_produccion > 0 ? 'text-success' : simulationData.variacion_produccion < 0 ? 'text-danger' : ''}`}>
                      {simulationData.variacion_produccion > 0 ? '+' : ''}{simulationData.variacion_produccion}%
                    </div>
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <button type="button" className="btn btn-info text-white w-100" onClick={runSimulation}><BarChart3 size={18} className="me-1" />Comparar Escenarios</button>
                  </div>
                </div>

                {resumen && (
                  <div className="dietas__simulation-grid">
                    <div className="dietas__scenario-card dietas__scenario-card--current">
                      <h6 className="dietas__scenario-title">Escenario Actual</h6>
                      <div className="dietas__scenario-body">
                        <div className="dietas__scenario-row">
                          <span>{objetivo === 'leche' ? 'Produccion' : 'Ganancia'}</span>
                          <span className="fw-bold">
                            {objetivo === 'leche'
                              ? `${safeNum(formData.produccion_leche_esperada)} L/vaca`
                              : `${safeNum(formData.ganancia_kg_esperada)} kg/animal`}
                          </span>
                        </div>
                        <div className="dietas__scenario-row">
                          <span>Costo dieta</span>
                          <span className="fw-bold">{fmtUSD(resumen.costo_por_vaca)}/vaca</span>
                        </div>
                        <div className="dietas__scenario-row">
                          <span>{objetivo === 'leche' ? 'Costo por litro' : 'Costo por kg ganado'}</span>
                          <span className="fw-bold">{fmtUSD(objetivo === 'leche' ? resumen.costo_por_litro : resumen.costo_por_kg_ganado)}</span>
                        </div>
                        <div className="dietas__scenario-row dietas__scenario-row--highlight">
                          <span>Margen alimenticio</span>
                          <span className={`fw-bold ${safeNum(resumen.margen_alimenticio) >= 0 ? 'text-success' : 'text-danger'}`}>{fmtUSD(resumen.margen_alimenticio)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      {simulationResult ? (
                        <div className={`dietas__scenario-card dietas__scenario-card--simulated ${safeNum(simulationResult.margen_alimenticio) >= safeNum(resumen.margen_alimenticio) ? 'dietas__scenario-card--better' : 'dietas__scenario-card--worse'}`}>
                          <h6 className="dietas__scenario-title">
                            Escenario Simulado
                            <span className="badge bg-secondary ms-2">{safeNum(simulationResult.variacion_precio) > 0 ? '+' : ''}{safeNum(simulationResult.variacion_precio)}% precio | {safeNum(simulationResult.variacion_produccion) > 0 ? '+' : ''}{safeNum(simulationResult.variacion_produccion)}% prod</span>
                          </h6>
                          <div className="dietas__scenario-body">
                            <div className="dietas__scenario-row">
                              <span>{objetivo === 'leche' ? 'Produccion' : 'Ganancia'}</span>
                              <span className="fw-bold">
                                {objetivo === 'leche'
                                  ? `${safeNum(simulationResult.produccion_simulada).toFixed(1)} L/vaca`
                                  : `${safeNum(simulationResult.ganancia_simulada).toFixed(2)} kg/animal`}
                              </span>
                            </div>
                            <div className="dietas__scenario-row">
                              <span>Costo dieta</span>
                              <span className="fw-bold">{fmtUSD(simulationResult.costo_por_vaca)}/vaca</span>
                            </div>
                            <div className="dietas__scenario-row">
                              <span>{objetivo === 'leche' ? 'Costo por litro' : 'Costo por kg ganado'}</span>
                              <span className="fw-bold">{fmtUSD(objetivo === 'leche' ? simulationResult.costo_por_litro : simulationResult.costo_por_kg_ganado)}</span>
                            </div>
                            <div className="dietas__scenario-row dietas__scenario-row--highlight">
                              <span>Margen alimenticio</span>
                              <span className={`fw-bold ${safeNum(simulationResult.margen_alimenticio) >= 0 ? 'text-success' : 'text-danger'}`}>{fmtUSD(simulationResult.margen_alimenticio)}</span>
                            </div>
                            <hr />
                            <div className="dietas__scenario-row">
                              <span>Diferencia margen</span>
                              <span className={`fw-bold ${safeNum(simulationResult.margen_alimenticio) - safeNum(resumen.margen_alimenticio) >= 0 ? 'text-success' : 'text-danger'}`}>
                                {safeNum(simulationResult.margen_alimenticio) - safeNum(resumen.margen_alimenticio) >= 0 ? '+' : ''}{fmtUSD(safeNum(simulationResult.margen_alimenticio) - safeNum(resumen.margen_alimenticio))}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="dietas__scenario-card dietas__scenario-card--placeholder">
                          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                            <BarChart3 size={40} className="mb-2 opacity-50" />
                            <p className="mb-0 small">Ajuste los parametros y presione "Comparar Escenarios"</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header bg-white">
          <h5 className="mb-0">Dietas Registradas ({dietas.length})</h5>
        </div>
        <div className="card-body">
          {dietas.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Calculator size={48} className="mb-3 opacity-25" />
              <p className="mb-3">No hay dietas registradas. Cree una nueva dieta para comenzar.</p>
              <button className="btn btn-success" onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus size={18} className="me-1" />Crear Primera Dieta
              </button>
            </div>
          ) : (
            <div className="dietas__lista-grid">
              {dietas.map(dieta => {
                const isExpanded = expandedDieta === dieta.id;
                const dietaObjetivo = dieta.objetivo_productivo || 'leche';
                const costoPorVaca = safeNum(dieta.costo_por_vaca);
                const costoPorLitro = dietaObjetivo === 'leche' ? safeNum(dieta.costo_por_litro) : safeNum(dieta.costo_por_kg_ganado);
                const ingresoPorVaca = safeNum(dieta.ingreso_por_vaca);
                const margenAlimenticio = safeNum(dieta.margen_alimenticio);
                const porcentajeGasto = safeNum(dieta.porcentaje_gasto_alimentacion);
                const materiaSeca = safeNum(dieta.materia_seca_kg);
                const energia = safeNum(dieta.energia_mcal);
                const proteina = safeNum(dieta.proteina_porcentaje);
                const produccionLeche = safeNum(dieta.produccion_leche_esperada);
                const precioLeche = safeNum(dieta.precio_leche_por_litro);
                const gananciaKg = safeNum(dieta.ganancia_kg_esperada);
                const precioKg = safeNum(dieta.precio_kg_en_pie);

                const gastoClass = porcentajeGasto > 60
                  ? 'dietas__lista-gasto-fill--high'
                  : porcentajeGasto > 40
                    ? 'dietas__lista-gasto-fill--medium'
                    : 'dietas__lista-gasto-fill--low';

                return (
                  <div className="dietas__lista-card" key={dieta.id}>
                    <div className="dietas__lista-header" onClick={() => setExpandedDieta(isExpanded ? null : dieta.id)}>
                      <div>
                        <h3 className="dietas__lista-title">{dieta.nombre || 'Sin nombre'}</h3>
                        <span className="dietas__lista-lote">{dieta.lote_nombre || 'Sin lote'}</span>
                      </div>
                      <ChevronUp size={20} className={`dietas__lista-chevron ${isExpanded ? 'dietas__lista-chevron--open' : ''}`} />
                    </div>

                    <div className="dietas__lista-body">
                      <div className="dietas__lista-metrics">
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">Costo/Vaca</span>
                          <span className="dietas__lista-metric-value">{fmtUSD(costoPorVaca)}</span>
                        </div>
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">{dietaObjetivo === 'leche' ? 'Costo/Litro' : 'Costo/Kg Ganado'}</span>
                          <span className="dietas__lista-metric-value">{fmtUSD(costoPorLitro)}</span>
                        </div>
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">Ingreso/Vaca</span>
                          <span className="dietas__lista-metric-value dietas__lista-metric-value--positive">{fmtUSD(ingresoPorVaca)}</span>
                        </div>
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">Margen</span>
                          <span className={`dietas__lista-metric-value ${margenAlimenticio >= 0 ? 'dietas__lista-metric-value--positive' : 'dietas__lista-metric-value--negative'}`}>{fmtUSD(margenAlimenticio)}</span>
                        </div>
                      </div>

                      <div className="dietas__lista-gasto">
                        <div className="dietas__lista-gasto-header">
                          <span className="dietas__lista-gasto-label">% Gasto Alimentación</span>
                          <span className="dietas__lista-gasto-value">{porcentajeGasto.toFixed(1)}%</span>
                        </div>
                        <div className="dietas__lista-gasto-bar">
                          <div className={`dietas__lista-gasto-fill ${gastoClass}`} style={{ width: `${Math.min(porcentajeGasto, 100)}%` }} />
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="dietas__lista-expanded">
                        <div className="dietas__lista-section">
                          {dietaObjetivo === 'leche' ? (
                            <>
                              <h4 className="dietas__lista-section-title"><Milk size={14} /> Producción</h4>
                              <div className="dietas__lista-section-grid">
                                <span className="dietas__lista-section-item">Leche esperada: <strong>{produccionLeche} L</strong></span>
                                <span className="dietas__lista-section-item">Precio leche: <strong>{fmtUSD(precioLeche)}/L</strong></span>
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 className="dietas__lista-section-title"><Beef size={14} /> Engorde</h4>
                              <div className="dietas__lista-section-grid">
                                <span className="dietas__lista-section-item">Ganancia esperada: <strong>{gananciaKg} kg/animal</strong></span>
                                <span className="dietas__lista-section-item">Precio kg en pie: <strong>{fmtUSD(precioKg)}/kg</strong></span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="dietas__lista-section">
                          <h4 className="dietas__lista-section-title"><Leaf size={14} /> Nutricional</h4>
                          <div className="dietas__lista-section-grid dietas__lista-section-grid--3">
                            <span className="dietas__lista-section-item">MS: <strong>{materiaSeca.toFixed(1)} kg</strong></span>
                            <span className="dietas__lista-section-item">Energía: <strong>{energia.toFixed(1)} Mcal</strong></span>
                            <span className="dietas__lista-section-item">Proteína: <strong>{proteina.toFixed(1)} kg</strong></span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="dietas__lista-footer">
                      <button className="dietas__lista-btn dietas__lista-btn--edit" onClick={() => handleEdit(dieta)}>
                        <Edit2 size={14} /> Editar
                      </button>
                      <button className="dietas__lista-btn dietas__lista-btn--delete" onClick={() => handleDelete(dieta.id)}>
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
