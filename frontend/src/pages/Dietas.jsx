import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSEO } from '../hooks/useSEO';
import {
  Calculator, DollarSign, TrendingUp, Plus, Edit2, Trash2,
  Save, X, BarChart3, AlertTriangle, ChevronUp, Info,
  Milk, Leaf, Scale, Settings
} from 'lucide-react';
import '../styles/dietas.css';

const DEFAULT_PARAM = { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function Dietas() {
  const navigate = useNavigate();
  useSEO({ title: 'Formulación de Dietas', description: 'Calculadora de dietas bovinas con análisis nutricional y costos para optimizar la producción lechera.' });
  const mountedRef = useRef(true);
  useSEO({ title: 'Formulación de Dietas', description: 'Formulación y análisis económico de dietas para ganado con cálculo de costos, márgenes y simulación de escenarios.' });

  const [dietas, setDietas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [costos, setCostos] = useState([]);
  const [parametros, setParametros] = useState({});
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
  });

  const [simulationData, setSimulationData] = useState({ variacion_precio: 0, variacion_produccion: 0 });
  const [simulationResult, setSimulationResult] = useState(null);
  const [calculoPreview, setCalculoPreview] = useState(null);

  const [showParamModal, setShowParamModal] = useState(false);
  const [editingParamInsumo, setEditingParamInsumo] = useState(null);
  const [paramForm, setParamForm] = useState({ materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 });

  const handleOpenParamEditor = async (insumoId) => {
    const insumo = insumos.find(i => i.id === parseInt(insumoId));
    if (!insumo) return;
    const existing = parametros[parseInt(insumoId)] || DEFAULT_PARAM;
    setEditingParamInsumo(insumo);
    setParamForm({
      materia_seca_porcentaje: safeNum(existing.materia_seca_porcentaje),
      energia_mcal_por_kg: safeNum(existing.energia_mcal_por_kg),
      proteina_porcentaje: safeNum(existing.proteina_porcentaje),
      fibra_porcentaje: safeNum(existing.fibra_porcentaje),
    });
    setShowParamModal(true);
  };

  const handleSaveParametros = async () => {
    if (!editingParamInsumo) return;
    try {
      await api.put(`/dietas/parametros/${editingParamInsumo.id}`, paramForm);
      const { data } = await api.get(`/dietas/parametros/${editingParamInsumo.id}`);
      setParametros(prev => ({ ...prev, [editingParamInsumo.id]: data }));
      setShowParamModal(false);
      setEditingParamInsumo(null);
    } catch (err) {
      console.error('Error guardando parametros:', err);
    }
  };

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

  const loadParametros = useCallback(async (insumosList) => {
    const paramsMap = {};
    await Promise.all(
      insumosList.map(async (insumo) => {
        try {
          const { data } = await api.get(`/dietas/parametros/${insumo.id}`);
          paramsMap[insumo.id] = data || DEFAULT_PARAM;
        } catch {
          paramsMap[insumo.id] = DEFAULT_PARAM;
        }
      })
    );
    return paramsMap;
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

      const lotesActivos = lotesData.filter(l => safeNum(l.activo) === 1);
      const insumosActivos = insumosData.filter(i => safeNum(i.activo) === 1);

      if (mountedRef.current) {
        setDietas(Array.isArray(dietasRaw) ? dietasRaw : []);
        setLotes(lotesActivos);
        setInsumos(insumosActivos);
        setCostos(Array.isArray(costosRaw) ? costosRaw : []);
      }

      const paramsMap = await loadParametros(insumosActivos);
      if (mountedRef.current) setParametros(paramsMap);
    } catch (error) {
      if (mountedRef.current) {
        setApiError(error.response?.data?.error || error.message);
      }
    }
  }, [fetchSafe, loadParametros]);

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

        const lotesActivos = lotesData.filter(l => safeNum(l.activo) === 1);
        const insumosActivos = insumosData.filter(i => safeNum(i.activo) === 1);

        if (cancelled) return;

        setDietas(Array.isArray(dietasRaw) ? dietasRaw : []);
        setLotes(lotesActivos);
        setInsumos(insumosActivos);
        setCostos(Array.isArray(costosRaw) ? costosRaw : []);

        const paramsMap = await loadParametros(insumosActivos);
        if (!cancelled) setParametros(paramsMap);
      } catch (error) {
        if (!cancelled) setApiError(error.response?.data?.error || error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [fetchSafe, loadParametros]);

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
      ingredientes: [...prev.ingredientes, { insumo_id: '', cantidad_kg: 0 }],
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

  const getIngredienteInfo = useCallback((insumoId) => {
    if (!insumoId) return null;
    const insumo = insumos.find(i => i.id === parseInt(insumoId));
    const param = parametros[parseInt(insumoId)] || DEFAULT_PARAM;
    return { ...insumo, ...param };
  }, [insumos, parametros]);

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
        produccion_leche_esperada: safeNum(formData.produccion_leche_esperada),
        precio_leche_por_litro: safeNum(formData.precio_leche_por_litro),
        cantidad_animales: safeNum(lote.cantidad_animales),
      });
      if (data && data.resumen) setCalculoPreview(data);
    } catch (error) {
      console.error('Error al calcular:', error);
    }
  }, [formData.ingredientes, formData.lote_id, formData.produccion_leche_esperada, formData.precio_leche_por_litro, lotes]);

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
      alert('Debe agregar al menos un ingrediente con cantidad mayor a 0');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/dietas/${editingId}`, { ...formData, ingredientes: ingredientesValidas });
      } else {
        await api.post('/dietas', { ...formData, ingredientes: ingredientesValidas });
      }
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error al guardar dieta:', error);
      alert('Error al guardar la dieta: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = async (dieta) => {
    try {
      const { data } = await api.get(`/dietas/${dieta.id}`);
      if (!data) {
        alert('No se pudo cargar la dieta');
        return;
      }

      const ingredientes = Array.isArray(data.ingredientes)
        ? data.ingredientes.map(i => ({
            insumo_id: String(i.insumo_id || ''),
            cantidad_kg: safeNum(i.cantidad_kg, 0),
          }))
        : [];

      setFormData({
        nombre: data.nombre || '',
        lote_id: String(data.lote_id || ''),
        ingredientes,
        produccion_leche_esperada: safeNum(data.produccion_leche_esperada, 20),
        precio_leche_por_litro: safeNum(data.precio_leche_por_litro, 0.45),
      });
      setEditingId(data.id);
      setShowForm(true);
      setExpandedDieta(null);
    } catch (error) {
      console.error('Error al cargar dieta:', error);
      alert('Error al cargar la dieta: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Esta seguro de eliminar esta dieta?')) return;
    try {
      await api.delete(`/dietas/${id}`);
      await loadData();
    } catch (error) {
      console.error('Error al eliminar dieta:', error);
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', lote_id: '', ingredientes: [], produccion_leche_esperada: 20, precio_leche_por_litro: 0.45 });
    setEditingId(null);
    setShowForm(false);
    setCalculoPreview(null);
  };

  const runSimulation = () => {
    const ingredientesValidas = formData.ingredientes.filter(i => i.insumo_id && safeNum(i.cantidad_kg) > 0);
    if (ingredientesValidas.length === 0) {
      alert('Primero agregue ingredientes a la dieta para simular');
      return;
    }

    const lote = lotes.find(l => l.id === parseInt(formData.lote_id));
    if (!lote) {
      alert('Seleccione un lote para simular');
      return;
    }

    const costoTotalSimulado = ingredientesValidas.reduce((sum, i) => {
      const costo = costos.find(c => c.insumo_id === parseInt(i.insumo_id));
      const precioBase = costo ? safeNum(costo.precio_por_kg) : 0;
      const precioSimulado = precioBase * (1 + safeNum(simulationData.variacion_precio) / 100);
      return sum + (safeNum(i.cantidad_kg) * precioSimulado);
    }, 0);

    const produccionSimulada = safeNum(formData.produccion_leche_esperada) * (1 + safeNum(simulationData.variacion_produccion) / 100);
    const cantidadAnimales = safeNum(lote.cantidad_animales);
    const costoPorVaca = cantidadAnimales > 0 ? costoTotalSimulado / cantidadAnimales : 0;
    const costoPorLitro = produccionSimulada > 0 ? costoPorVaca / produccionSimulada : 0;
    const ingresoPorVaca = produccionSimulada * safeNum(formData.precio_leche_por_litro);
    const margenAlimenticio = ingresoPorVaca - costoPorVaca;
    const margenPorLitro = produccionSimulada > 0 ? margenAlimenticio / produccionSimulada : 0;
    const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

    setSimulationResult({
      costo_total: costoTotalSimulado,
      costo_por_vaca: costoPorVaca,
      costo_por_litro: costoPorLitro,
      ingreso_por_vaca: ingresoPorVaca,
      margen_alimenticio: margenAlimenticio,
      margen_por_litro: margenPorLitro,
      porcentaje_gasto_alimentacion: porcentajeGasto,
      produccion_simulada: produccionSimulada,
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
        <h2 className="mb-0"><Calculator size={28} className="me-2" />Formulacion de Dietas</h2>
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
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label className="form-label">Nombre de la Dieta</label>
                  <input type="text" className="form-control" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required placeholder="Ej: Dieta Lactancia Alta" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Lote</label>
                  <select className="form-select" value={formData.lote_id} onChange={(e) => setFormData({ ...formData, lote_id: e.target.value })} required>
                    <option value="">Seleccionar lote...</option>
                    {lotes.map(l => <option key={l.id} value={String(l.id)}>{l.nombre} ({safeNum(l.cantidad_animales)} vacas)</option>)}
                  </select>
                  {lotes.length === 0 && (
                    <div className="alert alert-warning mt-2 py-2 px-3 d-flex align-items-center gap-2">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      <span className="small mb-0">No hay lotes registrados.</span>
                      <button type="button" className="btn btn-sm btn-outline-warning ms-auto" onClick={() => navigate('/lotes')}>Crear Lote</button>
                    </div>
                  )}
                </div>
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
                          <th style={{ width: '30%' }}>Ingrediente</th>
                          <th style={{ width: '15%' }}>Cantidad (kg/vaca/dia)</th>
                          <th style={{ width: '12%' }}>Precio/kg (USD)</th>
                          <th style={{ width: '12%' }}>Costo (USD)</th>
                          <th style={{ width: '10%' }}>MS (kg)</th>
                          <th style={{ width: '10%' }}>Prot (kg)</th>
                          <th style={{ width: '11%' }}>Fibra (kg)</th>
                          <th style={{ width: '5%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.ingredientes.map((ing, index) => {
                          const info = getIngredienteInfo(ing.insumo_id);
                          const cantidad = safeNum(ing.cantidad_kg);
                          const costoParcial = cantidad * getCostoPorKg(ing.insumo_id);
                          const ms = info ? cantidad * (safeNum(info.materia_seca_porcentaje) / 100) : 0;
                          const prot = info ? cantidad * (safeNum(info.proteina_porcentaje) / 100) : 0;
                          const fibra = info ? cantidad * (safeNum(info.fibra_porcentaje) / 100) : 0;
                          return (
                            <tr key={index}>
                              <td>
                                <select className="form-select form-select-sm" value={ing.insumo_id} onChange={(e) => handleIngredienteChange(index, 'insumo_id', e.target.value)}>
                                  <option value="">Seleccionar...</option>
                                  {insumos.map(i => <option key={i.id} value={String(i.id)}>{i.nombre}</option>)}
                                </select>
                              </td>
                              <td>
                                <input type="number" step="0.1" min="0" className="form-control form-control-sm" value={ing.cantidad_kg} onChange={(e) => handleIngredienteChange(index, 'cantidad_kg', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="text-center">US${getCostoPorKg(ing.insumo_id).toFixed(2)}</td>
                              <td className="text-center fw-bold">US${costoParcial.toFixed(2)}</td>
                              <td className="text-center">{ms.toFixed(2)}</td>
                              <td className="text-center">{prot.toFixed(2)}</td>
                              <td className="text-center">{fibra.toFixed(2)}</td>
                              <td className="text-center">
                                <div className="dietas__action-group">
                                  <button type="button" className="dietas__action-btn dietas__action-btn--settings" onClick={() => handleOpenParamEditor(ing.insumo_id)} title="Editar parametros nutricionales">
                                    <Settings size={14} />
                                  </button>
                                  <button type="button" className="dietas__action-btn dietas__action-btn--danger" onClick={() => handleRemoveIngrediente(index)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="dietas__mobile-ingredientes mb-3">
                    {formData.ingredientes.map((ing, index) => {
                      const info = getIngredienteInfo(ing.insumo_id);
                      const cantidad = safeNum(ing.cantidad_kg);
                      const costoParcial = cantidad * getCostoPorKg(ing.insumo_id);
                      const ms = info ? cantidad * (safeNum(info.materia_seca_porcentaje) / 100) : 0;
                      const prot = info ? cantidad * (safeNum(info.proteina_porcentaje) / 100) : 0;
                      const fibra = info ? cantidad * (safeNum(info.fibra_porcentaje) / 100) : 0;
                      return (
                        <div key={index} className="dietas__ingrediente-card mb-2">
                          <div className="dietas__ingrediente-header d-flex justify-content-between align-items-center mb-2">
                            <span className="dietas__ingrediente-num badge bg-secondary">#{index + 1}</span>
                            <div className="dietas__action-group">
                              <button
                                type="button"
                                className="dietas__action-btn dietas__action-btn--settings"
                                onClick={(e) => { e.stopPropagation(); handleOpenParamEditor(ing.insumo_id); }}
                                title="Editar parametros"
                              >
                                <Settings size={16} />
                              </button>
                              <button
                                type="button"
                                className="dietas__action-btn dietas__action-btn--danger"
                                onClick={(e) => { e.stopPropagation(); handleRemoveIngrediente(index); }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
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
                              onChange={(e) => handleIngredienteChange(index, 'cantidad_kg', parseFloat(e.target.value) || 0)}
                              placeholder="0.0"
                            />
                          </div>
                          <div className="ingrediente-details row g-2 small">
                            <div className="col-4">
                              <span className="text-muted d-block">Precio/kg</span>
                              <strong>US${getCostoPorKg(ing.insumo_id).toFixed(2)}</strong>
                            </div>
                            <div className="col-4">
                              <span className="text-muted d-block">Costo</span>
                              <strong>US${costoParcial.toFixed(2)}</strong>
                            </div>
                            <div className="col-4">
                              <span className="text-muted d-block">MS</span>
                              <strong>{ms.toFixed(2)} kg</strong>
                            </div>
                            <div className="col-4">
                              <span className="text-muted d-block">Proteina</span>
                              <strong>{prot.toFixed(2)} kg</strong>
                            </div>
                            <div className="col-4">
                              <span className="text-muted d-block">Fibra</span>
                              <strong>{fibra.toFixed(2)} kg</strong>
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
                    <h6 className="mb-0"><Leaf size={18} className="me-2" />Resumen Nutricional</h6>
                  </div>
                  <div className="dietas__nutri-grid">
                    <div className="dietas__nutri-card">
                      <div className="dietas__nutri-icon"><Leaf size={20} /></div>
                      <div className="dietas__nutri-label">Materia Seca</div>
                      <div className="dietas__nutri-value">{safeNum(resumen.materia_seca_total).toFixed(1)} kg</div>
                    </div>
                    <div className="dietas__nutri-card">
                      <div className="dietas__nutri-icon"><TrendingUp size={20} /></div>
                      <div className="dietas__nutri-label">Energia Total</div>
                      <div className="dietas__nutri-value">{safeNum(resumen.energia_total).toFixed(1)} Mcal</div>
                    </div>
                    <div className="dietas__nutri-card">
                      <div className="dietas__nutri-icon"><Scale size={20} /></div>
                      <div className="dietas__nutri-label">Proteina</div>
                      <div className="dietas__nutri-value">{safeNum(resumen.proteina_total).toFixed(1)} kg</div>
                    </div>
                    <div className="dietas__nutri-card">
                      <div className="dietas__nutri-icon"><Leaf size={20} /></div>
                      <div className="dietas__nutri-label">Fibra</div>
                      <div className="dietas__nutri-value">{safeNum(resumen.fibra_total).toFixed(1)} kg</div>
                    </div>
                  </div>

                  <div className="dietas__section-title mb-3">
                    <h6 className="mb-0"><DollarSign size={18} className="me-2" />Analisis Economico</h6>
                  </div>
                  <div className="dietas__econ-grid">
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">Costo Dieta</div>
                      <div className="dietas__econ-value">US${safeNum(resumen.costo_por_vaca).toFixed(4)}</div>
                      <div className="dietas__econ-sub">/vaca/dia</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">Costo por Litro</div>
                      <div className="dietas__econ-value">US${safeNum(resumen.costo_por_litro).toFixed(4)}</div>
                      <div className="dietas__econ-sub">/litro</div>
                    </div>
                    <div className="dietas__econ-card dietas__econ-card--income">
                      <div className="dietas__econ-label">Ingreso por Vaca</div>
                      <div className="dietas__econ-value">US${safeNum(resumen.ingreso_por_vaca).toFixed(2)}</div>
                      <div className="dietas__econ-sub">produccion de leche</div>
                    </div>
                    <div className={`dietas__econ-card ${safeNum(resumen.margen_alimenticio) >= 0 ? 'dietas__econ-card--positive' : 'dietas__econ-card--negative'}`}>
                      <div className="dietas__econ-label">Margen Alimenticio</div>
                      <div className="dietas__econ-value">US${safeNum(resumen.margen_alimenticio).toFixed(2)}</div>
                      <div className="dietas__econ-sub">por vaca/dia</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">Margen por Litro</div>
                      <div className="dietas__econ-value">US${safeNum(resumen.margen_por_litro).toFixed(2)}</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">% Gasto Alimentacion</div>
                      <div className="dietas__econ-value">{safeNum(resumen.porcentaje_gasto_alimentacion).toFixed(1)}%</div>
                    </div>
                    <div className="dietas__econ-card">
                      <div className="dietas__econ-label">Costo Total Lote</div>
                      <div className="dietas__econ-value">US${safeNum(resumen.costo_total).toFixed(2)}</div>
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
                    <label className="form-label">Variacion de Produccion de Leche</label>
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
                          <span>Produccion</span>
                          <span className="fw-bold">{safeNum(formData.produccion_leche_esperada)} L/vaca</span>
                        </div>
                        <div className="dietas__scenario-row">
                          <span>Costo dieta</span>
                          <span className="fw-bold">US${safeNum(resumen.costo_por_vaca).toFixed(4)}/vaca</span>
                        </div>
                        <div className="dietas__scenario-row">
                          <span>Costo por litro</span>
                          <span className="fw-bold">US${safeNum(resumen.costo_por_litro).toFixed(4)}</span>
                        </div>
                        <div className="dietas__scenario-row dietas__scenario-row--highlight">
                          <span>Margen alimenticio</span>
                          <span className={`fw-bold ${safeNum(resumen.margen_alimenticio) >= 0 ? 'text-success' : 'text-danger'}`}>US${safeNum(resumen.margen_alimenticio).toFixed(2)}</span>
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
                              <span>Produccion</span>
                              <span className="fw-bold">{safeNum(simulationResult.produccion_simulada).toFixed(1)} L/vaca</span>
                            </div>
                            <div className="dietas__scenario-row">
                              <span>Costo dieta</span>
                              <span className="fw-bold">US${safeNum(simulationResult.costo_por_vaca).toFixed(4)}/vaca</span>
                            </div>
                            <div className="dietas__scenario-row">
                              <span>Costo por litro</span>
                              <span className="fw-bold">US${safeNum(simulationResult.costo_por_litro).toFixed(4)}</span>
                            </div>
                            <div className="dietas__scenario-row dietas__scenario-row--highlight">
                              <span>Margen alimenticio</span>
                              <span className={`fw-bold ${safeNum(simulationResult.margen_alimenticio) >= 0 ? 'text-success' : 'text-danger'}`}>US${safeNum(simulationResult.margen_alimenticio).toFixed(2)}</span>
                            </div>
                            <hr />
                            <div className="dietas__scenario-row">
                              <span>Diferencia margen</span>
                              <span className={`fw-bold ${safeNum(simulationResult.margen_alimenticio) - safeNum(resumen.margen_alimenticio) >= 0 ? 'text-success' : 'text-danger'}`}>
                                {safeNum(simulationResult.margen_alimenticio) - safeNum(resumen.margen_alimenticio) >= 0 ? '+' : ''}US${(safeNum(simulationResult.margen_alimenticio) - safeNum(resumen.margen_alimenticio)).toFixed(2)}
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
                const costoPorVaca = safeNum(dieta.costo_por_vaca);
                const costoPorLitro = safeNum(dieta.costo_por_litro);
                const ingresoPorVaca = safeNum(dieta.ingreso_por_vaca);
                const margenAlimenticio = safeNum(dieta.margen_alimenticio);
                const porcentajeGasto = safeNum(dieta.porcentaje_gasto_alimentacion);
                const materiaSeca = safeNum(dieta.materia_seca_kg);
                const energia = safeNum(dieta.energia_mcal);
                const proteina = safeNum(dieta.proteina_porcentaje);
                const produccionLeche = safeNum(dieta.produccion_leche_esperada);
                const precioLeche = safeNum(dieta.precio_leche_por_litro);

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
                          <span className="dietas__lista-metric-value">US${costoPorVaca.toFixed(4)}</span>
                        </div>
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">Costo/Litro</span>
                          <span className="dietas__lista-metric-value">US${costoPorLitro.toFixed(4)}</span>
                        </div>
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">Ingreso/Vaca</span>
                          <span className="dietas__lista-metric-value dietas__lista-metric-value--positive">US${ingresoPorVaca.toFixed(2)}</span>
                        </div>
                        <div className="dietas__lista-metric">
                          <span className="dietas__lista-metric-label">Margen</span>
                          <span className={`dietas__lista-metric-value ${margenAlimenticio >= 0 ? 'dietas__lista-metric-value--positive' : 'dietas__lista-metric-value--negative'}`}>US${margenAlimenticio.toFixed(2)}</span>
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
                          <h4 className="dietas__lista-section-title"><Milk size={14} /> Producción</h4>
                          <div className="dietas__lista-section-grid">
                            <span className="dietas__lista-section-item">Leche esperada: <strong>{produccionLeche} L</strong></span>
                            <span className="dietas__lista-section-item">Precio leche: <strong>US${precioLeche.toFixed(2)}/L</strong></span>
                          </div>
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

      {showParamModal && editingParamInsumo && (
        <div className="modal-overlay" onClick={() => setShowParamModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="h5 mb-0"><Settings size={18} className="me-2" />Parametros Nutricionales</h2>
              <button type="button" className="btn-close" onClick={() => setShowParamModal(false)}></button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                <strong>{editingParamInsumo.nombre}</strong> — Valores de referencia para calculo nutricional
              </p>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label small fw-bold">Materia Seca (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="form-control form-control-sm"
                    value={paramForm.materia_seca_porcentaje}
                    onChange={e => setParamForm({...paramForm, materia_seca_porcentaje: parseFloat(e.target.value) || 0})}
                  />
                  <small className="text-muted">Ej: Maiz = 88%, Alfalfa = 50%</small>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold">Energia (Mcal/kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control form-control-sm"
                    value={paramForm.energia_mcal_por_kg}
                    onChange={e => setParamForm({...paramForm, energia_mcal_por_kg: parseFloat(e.target.value) || 0})}
                  />
                  <small className="text-muted">Ej: Maiz = 2.35</small>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold">Proteina (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="form-control form-control-sm"
                    value={paramForm.proteina_porcentaje}
                    onChange={e => setParamForm({...paramForm, proteina_porcentaje: parseFloat(e.target.value) || 0})}
                  />
                  <small className="text-muted">Ej: Exp. Soja = 44%</small>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold">Fibra (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="form-control form-control-sm"
                    value={paramForm.fibra_porcentaje}
                    onChange={e => setParamForm({...paramForm, fibra_porcentaje: parseFloat(e.target.value) || 0})}
                  />
                  <small className="text-muted">Ej: Alfalfa = 28%</small>
                </div>
              </div>
            </div>
            <div className="modal-actions d-flex gap-2 justify-content-end mt-3">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowParamModal(false)}>
                <X size={14} className="me-1" />Cancelar
              </button>
              <button type="button" className="btn btn-success btn-sm" onClick={handleSaveParametros}>
                <Save size={14} className="me-1" />Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
