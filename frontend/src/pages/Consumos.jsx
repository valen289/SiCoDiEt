import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Users, Package, Calendar, Milk, History, X, Sun, Moon, Plus, Trash2, AlertTriangle, TrendingDown, FileText } from 'lucide-react';
import { compartirReportePdf } from '../utils/reportes';
import { formatFecha } from '../utils/formatters';
import '../styles/silos.css';
import '../styles/consumos.css';

// En lactancia temprana (vaca recien parida, todavia subiendo a pico de produccion) conviene
// ser mas generoso con el comedero -- se prioriza que no le falte alimento mientras sube la
// curva, aunque eso signifique algo mas de sobra. En las demas etapas se mantiene el umbral
// mas ajustado de siempre.
function getAlertaSobra(pct, etapaLactancia) {
  if (pct === null || pct === undefined) return null;
  const esTemprana = etapaLactancia === 'temprana';
  const umbralNormal = esTemprana ? 10 : 5;
  const umbralModerada = esTemprana ? 15 : 10;

  if (pct === 0) return {
    color: 'danger',
    titulo: 'Comedero vacío',
    mensaje: 'Las vacas pueden haber quedado con hambre. Considerá aumentar la ración.',
  };
  if (pct <= umbralNormal) return {
    color: 'success',
    titulo: `Sobra normal (${pct}%)`,
    mensaje: esTemprana
      ? 'Ración bien calibrada para lactancia temprana (margen más generoso mientras sube a pico).'
      : 'Ración bien calibrada.',
  };
  if (pct <= umbralModerada) return {
    color: 'warning',
    titulo: `Sobra moderada (${pct}%)`,
    mensaje: 'Margen aceptable. Podés mantener o reducir levemente la ración.',
  };
  return {
    color: 'danger',
    titulo: `Sobra excesiva (${pct}%)`,
    mensaje: `Riesgo de pudrición. Se sugiere reducir la ración del próximo turno un ${pct.toFixed(0)}%.`,
  };
}

export default function Consumos() {
  const { success, error } = useAlert();
  useSEO({ title: 'Consumos Diarios', description: 'Registro y seguimiento de consumos diarios de alimentos por lote de ganado.' });

  const [lotes, setLotes] = useState([]);
  const [todosInsumos, setTodosInsumos] = useState([]);
  const [selectedLote, setSelectedLote] = useState('');
  const [loteInfo, setLoteInfo] = useState(null);
  const [ingredientesBase, setIngredientesBase] = useState([]); // de la dieta activa
  const [cantidadVacas, setCantidadVacas] = useState(0);
  const [fechaConsumo, setFechaConsumo] = useState(new Date().toISOString().split('T')[0]);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [turno, setTurno] = useState('AM');

  // Estado editable — el trabajador puede modificarlo antes de confirmar
  const [consumoEditable, setConsumoEditable] = useState([]);
  const [observacion, setObservacion] = useState('');

  const [porcentajeSobra, setPorcentajeSobra] = useState('');
  const [lecturaAnterior, setLecturaAnterior] = useState({ lectura: null, fecha: null, turno: null });

  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Carga lotes e insumos al montar
  useEffect(() => {
    api.get('/lotes')
      .then(res => {
        const data = res.data.lotes || res.data || [];
        setLotes(Array.isArray(data) ? data.filter(l => l.activo === true || l.activo === 1) : []);
      })
      .catch(() => setLotes([]));

    api.get('/insumos')
      .then(res => setTodosInsumos(res.data.insumos || []))
      .catch(() => setTodosInsumos([]));
  }, []);

  // Construye las filas editables a partir de los ingredientes de la dieta
  const buildConsumoEditable = useCallback((ingredientesData, vacas, turnoActual) => {
    return ingredientesData.map(ing => {
      const pctAm = parseFloat(ing.porcentaje_am ?? 50);
      const factor = turnoActual === 'AM' ? pctAm / 100 : (100 - pctAm) / 100;
      const kgEsteTurno = parseFloat(ing.kg_por_vaca) * factor;
      return {
        insumo_id: ing.insumo_id,
        insumo_id_original: ing.insumo_id, // para detectar sustituciones
        insumo_nombre: ing.insumo_nombre,
        unidad: ing.unidad,
        porcentaje_am: pctAm,
        kg_este_turno_por_vaca: kgEsteTurno,
        cantidad_total: parseFloat((kgEsteTurno * (parseInt(vacas) || 0)).toFixed(2)),
        es_extra: false, // fila agregada manualmente
      };
    });
  }, []);

  const loadDietaActiva = useCallback(async (loteId) => {
    if (!loteId) {
      setLoteInfo(null);
      setIngredientesBase([]);
      setConsumoEditable([]);
      return;
    }
    try {
      const [loteRes, dietaRes] = await Promise.all([
        api.get(`/lotes/${loteId}`),
        api.get(`/lotes/${loteId}/dieta-activa`),
      ]);
      const loteData = loteRes.data.lote || loteRes.data;
      setLoteInfo(loteData);
      setCantidadVacas(loteData.cantidad_animales || 0);

      const ings = dietaRes.data.ingredientes || [];
      setIngredientesBase(ings);
      setConsumoEditable(buildConsumoEditable(ings, loteData.cantidad_animales || 0, turno));
    } catch (err) {
      console.error('Error cargando dieta:', err);
      setLoteInfo(null);
      setIngredientesBase([]);
      setConsumoEditable([]);
    }
  }, [turno, buildConsumoEditable]);

  useEffect(() => {
    if (selectedLote) loadDietaActiva(selectedLote);
  }, [selectedLote, loadDietaActiva]);

  // Trae la lectura de sobra del turno anterior cuando cambia lote, fecha o turno
  useEffect(() => {
    if (!selectedLote || !fechaConsumo) {
      setLecturaAnterior({ lectura: null, fecha: null, turno: null });
      return;
    }
    api.get('/insumos/lectura-anterior', { params: { lote_id: selectedLote, fecha: fechaConsumo, turno } })
      .then(res => setLecturaAnterior(res.data))
      .catch(() => setLecturaAnterior({ lectura: null, fecha: null, turno: null }));
  }, [selectedLote, fechaConsumo, turno]);

  // Recalcula las filas de la dieta cuando cambia turno o vacas
  // Las filas "extra" que el trabajador agregó no se recalculan
  useEffect(() => {
    if (ingredientesBase.length === 0) return;
    setConsumoEditable(prev => {
      const filasBase = buildConsumoEditable(ingredientesBase, cantidadVacas, turno);
      const filasExtra = prev.filter(f => f.es_extra);
      return [...filasBase, ...filasExtra];
    });
  }, [turno, cantidadVacas, ingredientesBase, buildConsumoEditable]);

  // ── Handlers de edición de filas ─────────────────────────────────────────

  const handleEditCantidad = (index, valor) => {
    setConsumoEditable(prev => {
      const next = [...prev];
      next[index] = { ...next[index], cantidad_total: parseFloat(valor) || 0 };
      return next;
    });
  };

  const handleCambiarIngrediente = (index, nuevoInsumoId) => {
    const insumo = todosInsumos.find(i => i.id === parseInt(nuevoInsumoId));
    if (!insumo) return;
    setConsumoEditable(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        insumo_id: insumo.id,
        insumo_nombre: insumo.nombre,
        unidad: insumo.unidad,
        // insumo_id_original se mantiene: así el backend sabe qué revertir
      };
      return next;
    });
  };

  const handleAgregarIngrediente = () => {
    // Verificar que haya insumos disponibles que no estén ya en la lista
    const idsEnUso = new Set(consumoEditable.map(f => f.insumo_id));
    const disponibles = todosInsumos.filter(i => !idsEnUso.has(i.id));
    if (disponibles.length === 0) {
      error('No hay más insumos disponibles para agregar');
      return;
    }
    const primero = disponibles[0];
    setConsumoEditable(prev => [
      ...prev,
      {
        insumo_id: primero.id,
        insumo_id_original: null, // no estaba en la dieta
        insumo_nombre: primero.nombre,
        unidad: primero.unidad,
        porcentaje_am: 50,
        kg_este_turno_por_vaca: 0,
        cantidad_total: 0,
        es_extra: true,
      },
    ]);
  };

  const handleEliminarFila = (index) => {
    setConsumoEditable(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoReducir = (pct) => {
    const factor = 1 - pct / 100;
    setConsumoEditable(prev => prev.map(f => ({
      ...f,
      cantidad_total: parseFloat((f.cantidad_total * factor).toFixed(2)),
    })));
  };

  // ── Registro ─────────────────────────────────────────────────────────────

  const hayAlgoQueRegistrar = consumoEditable.some(f => f.cantidad_total > 0);

  const handleRegistrarConsumo = () => {
    if (!selectedLote) { error('Debe seleccionar un lote'); return; }
    if (cantidadVacas <= 0) { error('La cantidad de vacas debe ser mayor a 0'); return; }
    if (consumoEditable.length === 0) { error('No hay dieta activa para este lote'); return; }
    if (!hayAlgoQueRegistrar) { error('Al menos un ingrediente debe tener cantidad mayor a 0'); return; }
    setShowConfirm(true);
  };

  const buildPayload = () => {
    // Construye mapa de insumo_id → cantidad final
    // Si el ingrediente cambió, agrega una entrada en 0 para el original (para que el backend lo revierta)
    const mapa = new Map();

    for (const fila of consumoEditable) {
      // Si el ingrediente de esta fila fue sustituido, zerar el original
      if (fila.insumo_id_original && fila.insumo_id !== fila.insumo_id_original) {
        if (!mapa.has(fila.insumo_id_original)) {
          mapa.set(fila.insumo_id_original, 0);
        }
      }
      // Sumar la cantidad del ingrediente actual
      mapa.set(fila.insumo_id, (mapa.get(fila.insumo_id) || 0) + fila.cantidad_total);
    }

    return Array.from(mapa.entries()).map(([insumo_id, cantidad_kg]) => ({
      insumo_id,
      cantidad_kg,
    }));
  };

  const handleConfirmarConsumo = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const res = await api.post('/insumos/consumo-diario', {
        fecha: fechaConsumo,
        turno,
        lote_id: parseInt(selectedLote),
        cantidad_animales: parseInt(cantidadVacas),
        ingredientes: buildPayload(),
        observacion: observacion || null,
        porcentaje_sobra: porcentajeSobra !== '' ? parseFloat(porcentajeSobra) : null,
      });
      success(res.data.message);
      setObservacion('');
      setPorcentajeSobra('');
      loadDietaActiva(selectedLote);
    } catch (err) {
      error(err.response?.data?.error || 'Error al registrar consumo');
    } finally {
      setLoading(false);
    }
  };

  // ── Historial ─────────────────────────────────────────────────────────────

  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const params = {};
      if (selectedLote) params.lote_id = selectedLote;
      const res = await api.get('/insumos/historial-consumo', { params });
      setHistorial(res.data || []);
      setShowHistorial(true);
    } catch (err) {
      console.error('Error cargando historial:', err);
      error('Error al cargar historial');
    } finally {
      setLoadingHistorial(false);
    }
  }, [selectedLote, error]);

  // ── Render ────────────────────────────────────────────────────────────────

  const consumoTotal = consumoEditable.reduce((sum, f) => sum + (f.cantidad_total || 0), 0);
  const idsEnUso = new Set(consumoEditable.map(f => f.insumo_id));
  const insumosDisponiblesParaAgregar = todosInsumos.filter(i => !idsEnUso.has(i.id));

  const handleReportePdf = async () => {
    setGenerandoPdf(true);
    try {
      const mes = new Date().toISOString().slice(0, 7);
      await compartirReportePdf('consumo-mensual', {
        params: { mes },
        filename: `consumo-mensual-${mes}.pdf`,
        titulo: 'Reporte de Consumo Mensual',
      });
    } catch (err) {
      console.error('Error generando reporte PDF:', err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="silos-page">
      <div className="page-header d-flex justify-content-between align-items-center">
        <h1>Consumos</h1>
        <button className="silos__btn silos__btn--secondary" onClick={handleReportePdf} disabled={generandoPdf}>
          <FileText size={16} /> {generandoPdf ? 'Generando...' : 'Reporte PDF'}
        </button>
      </div>

      <div className="consumo-diario-panel mb-4">
        <div className="consumo-header mb-3">
          <h5 className="mb-2 d-flex align-items-center gap-2">
            <Calendar size={20} /> Consumo Diario
          </h5>
          <div className="consumo-controls d-flex flex-wrap gap-2">
            <input
              type="date"
              className="form-control form-control-sm"
              value={fechaConsumo}
              onChange={(e) => setFechaConsumo(e.target.value)}
            />
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${turno === 'AM' ? 'btn-warning' : 'btn-outline-warning'} d-flex align-items-center gap-1`}
                onClick={() => setTurno('AM')}
              >
                <Sun size={14} /> AM
              </button>
              <button
                type="button"
                className={`btn ${turno === 'PM' ? 'btn-primary' : 'btn-outline-primary'} d-flex align-items-center gap-1`}
                onClick={() => setTurno('PM')}
              >
                <Moon size={14} /> PM
              </button>
            </div>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={loadHistorial}
              disabled={loadingHistorial}
            >
              <History size={16} />
              <span>{loadingHistorial ? 'Cargando...' : 'Historial'}</span>
            </button>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header bg-success text-white">
            <h6 className="mb-0"><Users size={16} className="me-2" />Seleccionar Lote</h6>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Lote</label>
              <select
                className="form-select"
                value={selectedLote}
                onChange={(e) => { setSelectedLote(e.target.value); setObservacion(''); }}
              >
                <option value="">Seleccionar lote...</option>
                {lotes.map(lote => (
                  <option key={lote.id} value={lote.id}>{lote.nombre}</option>
                ))}
              </select>
            </div>

            {loteInfo && (
              <>
                <div className="alert alert-light border mb-3">
                  <h6 className="mb-2"><Package size={16} className="me-2" />Información del lote</h6>
                  <div className="row">
                    <div className="col-md-4">
                      <strong>Tipo:</strong> {loteInfo.tipo_animal}
                    </div>
                    <div className="col-md-4">
                      <strong>Animales (lote):</strong> {loteInfo.cantidad_animales}
                    </div>
                    <div className="col-md-4">
                      <strong>Total {turno}:</strong>{' '}
                      <span className="fw-bold">{consumoTotal.toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Cantidad de Vacas</label>
                  <input
                    type="number"
                    className="form-control"
                    value={cantidadVacas}
                    onChange={(e) => setCantidadVacas(e.target.value)}
                    min="0"
                  />
                  <small className="text-muted">Default del lote: {loteInfo.cantidad_animales} vacas</small>
                </div>

                {/* ── Lectura del turno anterior ──────────────────────── */}
                {(() => {
                  const alerta = getAlertaSobra(lecturaAnterior.lectura, loteInfo?.etapa_lactancia);
                  if (!alerta) return null;
                  const turnoRef = turno === 'PM' ? 'AM de hoy' : 'PM de ayer';
                  return (
                    <div className={`alert alert-${alerta.color} lectura-comedero-banner mb-3`}>
                      <div className="lectura-comedero-pct">
                        {lecturaAnterior.lectura === 0 ? '0%' : `${lecturaAnterior.lectura}%`}
                      </div>
                      <div className="flex-grow-1">
                        <strong>Sobra {turnoRef}:</strong> {alerta.titulo}
                        <br />
                        <small>{alerta.mensaje}</small>
                        {lecturaAnterior.lectura > 10 && (
                          <div className="mt-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0"
                              onClick={() => handleAutoReducir(lecturaAnterior.lectura)}
                            >
                              <TrendingDown size={13} className="me-1" />
                              Reducir ración {lecturaAnterior.lectura.toFixed(0)}%
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {consumoEditable.length > 0 && (
                  <>
                    <div className="table-responsive mb-2">
                      <table className="table table-bordered table-sm mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Insumo</th>
                            <th className="text-center" style={{ width: '70px' }}>AM %</th>
                            <th className="text-center" style={{ width: '70px' }}>PM %</th>
                            <th style={{ width: '140px' }}>
                              Cantidad{' '}
                              {turno === 'AM'
                                ? <span className="badge bg-warning text-dark">AM</span>
                                : <span className="badge bg-primary">PM</span>
                              }
                            </th>
                            <th className="text-center" style={{ width: '50px' }}>Und</th>
                            <th style={{ width: '36px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumoEditable.map((fila, index) => {
                            const fueModificado = fila.insumo_id !== fila.insumo_id_original && fila.insumo_id_original !== null;
                            return (
                              <tr key={index} className={fila.cantidad_total <= 0 ? 'table-secondary' : fueModificado ? 'table-warning' : ''}>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={fila.insumo_id}
                                    onChange={(e) => handleCambiarIngrediente(index, e.target.value)}
                                  >
                                    {/* Opción actual siempre visible */}
                                    <option value={fila.insumo_id}>{fila.insumo_nombre}</option>
                                    {todosInsumos
                                      .filter(i => i.id !== fila.insumo_id && !idsEnUso.has(i.id))
                                      .map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)
                                    }
                                  </select>
                                  {fueModificado && (
                                    <small className="text-warning d-block mt-1">
                                      ⚠ Sustituido (original: {ingredientesBase.find(b => b.insumo_id === fila.insumo_id_original)?.insumo_nombre || fila.insumo_id_original})
                                    </small>
                                  )}
                                </td>
                                <td className="text-center align-middle text-muted small">
                                  {fila.es_extra ? '—' : `${fila.porcentaje_am.toFixed(0)}%`}
                                </td>
                                <td className="text-center align-middle text-muted small">
                                  {fila.es_extra ? '—' : `${(100 - fila.porcentaje_am).toFixed(0)}%`}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={fila.cantidad_total}
                                    min="0"
                                    step="0.1"
                                    onChange={(e) => handleEditCantidad(index, e.target.value)}
                                  />
                                </td>
                                <td className="text-center align-middle small">{fila.unidad}</td>
                                <td className="text-center align-middle">
                                  {fila.es_extra && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger p-1"
                                      onClick={() => handleEliminarFila(index)}
                                      title="Eliminar fila"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {insumosDisponiblesParaAgregar.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success mb-3"
                        onClick={handleAgregarIngrediente}
                      >
                        <Plus size={14} className="me-1" />Agregar insumo extra / sustituto
                      </button>
                    )}

                    <div className="mb-3">
                      <label className="form-label small fw-bold">Observación (opcional)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ej: Sin fardos, se sustituyó maíz por cáscara de soja..."
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        maxLength={250}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">
                        Lectura del comedero — sobra del turno {turno === 'PM' ? 'AM' : 'PM anterior'} (%)
                      </label>
                      <div className="d-flex align-items-center gap-2">
                        <div className="input-group input-group-sm" style={{ maxWidth: 160 }}>
                          <input
                            type="number"
                            className="form-control"
                            value={porcentajeSobra}
                            onChange={(e) => setPorcentajeSobra(e.target.value)}
                            min="0"
                            max="100"
                            step="1"
                            placeholder="ej: 5"
                          />
                          <span className="input-group-text">%</span>
                        </div>
                        {porcentajeSobra !== '' && (() => {
                          const a = getAlertaSobra(parseFloat(porcentajeSobra), loteInfo?.etapa_lactancia);
                          return a
                            ? <span className={`badge bg-${a.color === 'danger' ? 'danger' : a.color === 'warning' ? 'warning text-dark' : 'success'} small`}>{a.titulo}</span>
                            : null;
                        })()}
                      </div>
                      <small className="text-muted">
                        ¿Cuánto quedó en el comedero del turno {turno === 'PM' ? 'AM' : 'PM anterior'}? (opcional)
                      </small>
                    </div>
                  </>
                )}

                <div className="d-flex gap-2">
                  <button
                    className={`btn btn-sm ${turno === 'AM' ? 'btn-warning' : 'btn-primary'}`}
                    onClick={handleRegistrarConsumo}
                    disabled={loading || consumoEditable.length === 0}
                  >
                    <Milk size={16} className="me-1" />
                    {loading ? 'Registrando...' : `Registrar Consumo ${turno}`}
                  </button>
                </div>
              </>
            )}

            {!loteInfo && selectedLote && (
              <div className="alert alert-info">
                Este lote no tiene una dieta activa configurada.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de Confirmación ─────────────────────────────────────────── */}
      {showConfirm && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className={`modal-header ${turno === 'AM' ? 'bg-warning' : 'bg-primary text-white'}`}>
                <h5 className="modal-title">
                  {turno === 'AM' ? <Sun size={18} className="me-2" /> : <Moon size={18} className="me-2" />}
                  Confirmar Consumo {turno}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirm(false)} />
              </div>
              <div className="modal-body">
                <p className="mb-2 small">
                  <strong>Lote:</strong> {loteInfo?.nombre} &nbsp;|&nbsp;
                  <strong>Fecha:</strong> {fechaConsumo} &nbsp;|&nbsp;
                  <strong>Vacas:</strong> {cantidadVacas}
                </p>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-2">
                    <thead className="table-light">
                      <tr>
                        <th>Insumo</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-center">Und</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumoEditable.map((fila, i) => {
                        const fueModificado = fila.insumo_id !== fila.insumo_id_original && fila.insumo_id_original !== null;
                        return (
                          <tr key={i} className={fila.cantidad_total <= 0 ? 'text-muted' : fueModificado ? 'table-warning' : ''}>
                            <td>
                              {fila.insumo_nombre}
                              {fueModificado && <span className="badge bg-warning text-dark ms-1 small">sustituido</span>}
                              {fila.es_extra && <span className="badge bg-info ms-1 small">extra</span>}
                            </td>
                            <td className="text-end fw-bold">
                              {fila.cantidad_total <= 0
                                ? <span className="text-muted">0 (sin dar)</span>
                                : fila.cantidad_total.toFixed(2)
                              }
                            </td>
                            <td className="text-center">{fila.unidad}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="table-light fw-bold">
                        <td>Total</td>
                        <td className="text-end">{consumoTotal.toFixed(2)}</td>
                        <td className="text-center">kg</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {observacion && (
                  <p className="mb-1 small"><strong>Observación:</strong> {observacion}</p>
                )}
                {porcentajeSobra !== '' && (() => {
                  const a = getAlertaSobra(parseFloat(porcentajeSobra), loteInfo?.etapa_lactancia);
                  return a
                    ? <p className="mb-0 small"><strong>Sobra turno anterior:</strong> {porcentajeSobra}% — <span className={`text-${a.color}`}>{a.titulo}</span></p>
                    : null;
                })()}
                {consumoEditable.some(f => f.cantidad_total <= 0) && (
                  <div className="alert alert-warning py-2 mb-0 mt-2 small">
                    <AlertTriangle size={14} className="me-1" />
                    Los ingredientes con cantidad 0 <strong>no</strong> se descontarán del stock.
                    Si hubo un registro previo de ese insumo para este turno, se revertirá.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                  Cancelar
                </button>
                <button
                  className={`btn ${turno === 'AM' ? 'btn-warning' : 'btn-primary'}`}
                  onClick={handleConfirmarConsumo}
                >
                  <Milk size={16} className="me-1" />
                  Confirmar y Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Historial ─────────────────────────────────────────────────────── */}
      {showHistorial && (
        <div className="card mb-4">
          <div className="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0"><History size={16} className="me-2" />Historial de Consumos</h6>
            <button className="btn btn-sm btn-light" onClick={() => setShowHistorial(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="card-body">
            {historial.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Turno</th>
                      <th>Lote</th>
                      <th>Insumo</th>
                      <th>Cantidad</th>
                      <th>Animales</th>
                      <th>Kg/Animal</th>
                      <th>Sobra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((item, index) => {
                      const sobra = item.porcentaje_sobra !== null && item.porcentaje_sobra !== undefined
                        ? parseFloat(item.porcentaje_sobra)
                        : null;
                      const etapaLote = lotes.find(l => l.id === item.lote_id)?.etapa_lactancia;
                      const alerta = getAlertaSobra(sobra, etapaLote);
                      return (
                        <tr key={index}>
                          <td>{formatFecha(item.fecha)}</td>
                          <td>
                            {item.turno === 'AM'
                              ? <span className="badge bg-warning text-dark">AM</span>
                              : <span className="badge bg-primary">PM</span>
                            }
                          </td>
                          <td>{item.lote_nombre}</td>
                          <td>{item.insumo_nombre}</td>
                          <td className="fw-bold">{parseFloat(item.cantidad_kg).toFixed(2)}</td>
                          <td>{item.cantidad_animales}</td>
                          <td>{parseFloat(item.kg_por_animal).toFixed(2)}</td>
                          <td>
                            {sobra !== null
                              ? <span className={`badge bg-${alerta?.color === 'danger' ? 'danger' : alerta?.color === 'warning' ? 'warning text-dark' : 'success'}`}>{sobra}%</span>
                              : <span className="text-muted">—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted text-center py-3">No hay registros de consumo</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
