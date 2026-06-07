import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Check, Users, Package, TrendingDown, Calendar, Milk, History, X } from 'lucide-react';
import '../styles/silos.css';
import '../styles/consumos.css';

export default function Consumos() {
  const { user } = useAuth();
  const { success, error } = useAlert();
  useSEO({ title: 'Consumos Diarios', description: 'Registro y seguimiento de consumos diarios de alimentos por lote de ganado.' });
  const [lotes, setLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState('');
  const [loteInfo, setLoteInfo] = useState(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [cantidadVacas, setCantidadVacas] = useState(0);
  const [consumoCalculado, setConsumoCalculado] = useState([]);
  const [fechaConsumo, setFechaConsumo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const loadLotes = useCallback(async () => {
    try {
      const res = await api.get('/lotes');
      const lotesData = res.data.lotes || res.data || [];
      setLotes(Array.isArray(lotesData) ? lotesData.filter(l => l.activo === true || l.activo === 1) : []);
    } catch (err) {
      console.error('Error cargando lotes:', err);
      setLotes([]);
    }
  }, []);

  useEffect(() => {
    loadLotes();
  }, [loadLotes]);

  const loadDietaActiva = useCallback(async (loteId) => {
    if (!loteId) {
      setLoteInfo(null);
      setIngredientes([]);
      setConsumoCalculado([]);
      return;
    }

    try {
      const [loteRes, dietaRes] = await Promise.all([
        api.get(`/lotes/${loteId}`),
        api.get(`/lotes/${loteId}/dieta-activa`)
      ]);

      const loteData = loteRes.data.lote || loteRes.data;
      setLoteInfo(loteData);
      setCantidadVacas(loteData.cantidad_animales || 0);

      const ingredientesData = dietaRes.data.ingredientes || [];
      setIngredientes(ingredientesData);

      calcularConsumo(ingredientesData, loteData.cantidad_animales || 0);
    } catch (err) {
      console.error('Error cargando dieta:', err);
      setLoteInfo(null);
      setIngredientes([]);
      setConsumoCalculado([]);
    }
  }, []);

  const calcularConsumo = (ingredientesData, vacas) => {
    const calculado = ingredientesData.map(ing => ({
      insumo_id: ing.insumo_id,
      insumo_nombre: ing.insumo_nombre,
      unidad: ing.unidad,
      kg_por_vaca: parseFloat(ing.kg_por_vaca),
      cantidad_vacas: parseInt(vacas) || 0,
      cantidad_total: parseFloat(ing.kg_por_vaca) * (parseInt(vacas) || 0)
    }));
    setConsumoCalculado(calculado);
  };

  useEffect(() => {
    if (selectedLote) {
      loadDietaActiva(selectedLote);
    }
  }, [selectedLote, loadDietaActiva]);

  useEffect(() => {
    if (ingredientes.length > 0) {
      calcularConsumo(ingredientes, cantidadVacas);
    }
  }, [cantidadVacas]);

  const handleRegistrarConsumo = async () => {
    if (!selectedLote) {
      error('Debe seleccionar un lote');
      return;
    }

    if (cantidadVacas <= 0) {
      error('La cantidad de vacas debe ser mayor a 0');
      return;
    }

    if (consumoCalculado.length === 0) {
      error('No hay dieta activa para este lote');
      return;
    }

    setLoading(true);

    try {
      const registros = [{
        lote_id: parseInt(selectedLote),
        cantidad_animales: parseInt(cantidadVacas)
      }];

      const res = await api.post('/insumos/consumo-diario', {
        fecha: fechaConsumo,
        registros,
      });

      success(res.data.message);
      loadDietaActiva(selectedLote);
    } catch (err) {
      error(err.response?.data?.error || 'Error al registrar consumo');
    } finally {
      setLoading(false);
    }
  };

  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const params = {};
      if (selectedLote) {
        params.lote_id = selectedLote;
      }
      
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

  const consumoTotal = consumoCalculado.reduce((sum, item) => sum + item.cantidad_total, 0);

  return (
    <div className="silos-page">
      <div className="page-header">
        <h1>Consumos</h1>
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
            <button
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
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
                onChange={(e) => setSelectedLote(e.target.value)}
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
                  <h6 className="mb-2"><Package size={16} className="me-2" />Informacion del lote</h6>
                  <div className="row">
                    <div className="col-md-4">
                      <strong>Tipo:</strong> {loteInfo.tipo_animal}
                    </div>
                    <div className="col-md-4">
                      <strong>Animales:</strong> {loteInfo.cantidad_animales}
                    </div>
                    <div className="col-md-4">
                      <strong>Consumo diario:</strong> {consumoTotal.toFixed(2)} kg
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Cantidad de Vacas (variable)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={cantidadVacas}
                    onChange={(e) => setCantidadVacas(e.target.value)}
                    min="0"
                    placeholder="Ingrese cantidad de vacas"
                  />
                  <small className="text-muted">Default: {loteInfo.cantidad_animales} vacas</small>
                </div>

                {consumoCalculado.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-bordered mb-0">
                      <thead>
                        <tr>
                          <th>Silo</th>
                          <th>Unidad</th>
                          <th>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumoCalculado.map((item, index) => (
                          <tr key={index}>
                            <td>{item.insumo_nombre}</td>
                            <td>{item.unidad}</td>
                            <td className="fw-bold">{item.cantidad_total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="d-flex gap-2 mt-3">
                  <button 
                    className="btn btn-success btn-sm" 
                    onClick={handleRegistrarConsumo}
                    disabled={loading || consumoCalculado.length === 0}
                  >
                    <Milk size={16} className="me-1" />
                    {loading ? 'Registrando...' : 'Registrar Consumo'}
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

      {showHistorial && (
        <div className="card mb-4">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0"><History size={16} className="me-2" />Historial de Consumos</h6>
            <button 
              className="btn btn-sm btn-light" 
              onClick={() => setShowHistorial(false)}
            >
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
                      <th>Lote</th>
                      <th>Insumo</th>
                      <th>Cantidad (kg)</th>
                      <th>Animales</th>
                      <th>Kg/Animal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((item, index) => (
                      <tr key={index}>
                        <td>{item.fecha}</td>
                        <td>{item.lote_nombre}</td>
                        <td>{item.insumo_nombre}</td>
                        <td className="fw-bold">{parseFloat(item.cantidad_kg).toFixed(2)}</td>
                        <td>{item.cantidad_animales}</td>
                        <td>{parseFloat(item.kg_por_animal).toFixed(2)}</td>
                      </tr>
                    ))}
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
