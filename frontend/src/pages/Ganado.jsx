import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Beef, Plus, History, Calendar, Users, TrendingUp, X, Save } from 'lucide-react';
import '../styles/ganado.css';

export default function Ganado() {
  const { user } = useAuth();
  const { success, error } = useAlert();
  useSEO({ title: 'Gestión de Ganado', description: 'Registro y control del rodeo con distribución de vacas lecheras, secas y terneros.' });
  const [ultimoRegistro, setUltimoRegistro] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [form, setForm] = useState({
    total_vacas: '', vacas_lechera: '', vacas_seco: '', terneros: ''
  });

  const canRegister = user?.rol === 'admin' || user?.rol === 'operario';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ultimoRes, historialRes] = await Promise.all([
        api.get('/ganado'),
        api.get('/ganado/historial')
      ]);
      setUltimoRegistro(ultimoRes.data || null);
      setHistorial(historialRes.data?.historial || historialRes.data || []);
    } catch (err) {
      console.error('Error cargando datos de ganado:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/ganado', {
        total_vacas: parseInt(form.total_vacas) || 0,
        vacas_lechera: parseInt(form.vacas_lechera) || 0,
        vacas_seco: parseInt(form.vacas_seco) || 0,
        terneros: parseInt(form.terneros) || 0,
      });
      success('Registro de ganado guardado');
      setShowForm(false);
      setForm({ total_vacas: '', vacas_lechera: '', vacas_seco: '', terneros: '' });
      loadData();
    } catch (err) {
      error(err.response?.data?.error || 'Error al guardar');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status" />
        <p className="mt-2 text-muted">Cargando datos de ganado...</p>
      </div>
    );
  }

  return (
    <div className="ganado-page">
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <Beef size={24} /> Gestión de Ganado
          </h1>
          <p className="text-muted small mb-0">Registro y control del rodeo</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => setShowHistorial(!showHistorial)}
          >
            <History size={18} /> Historial
          </button>
          {canRegister && (
            <button
              className="btn btn-success d-flex align-items-center gap-2"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus size={18} /> Nuevo Registro
            </button>
          )}
        </div>
      </div>

      {/* Formulario de registro */}
      {showForm && canRegister && (
        <div className="card mb-4">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0"><Calendar size={18} className="me-2" />Nuevo Registro de Ganado</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-3 col-6">
                  <label className="form-label fw-bold">Total de Vacas</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.total_vacas}
                    onChange={e => setForm({...form, total_vacas: e.target.value})}
                    required
                    min="0"
                  />
                </div>
                <div className="col-md-3 col-6">
                  <label className="form-label">Vacas Lecheras</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.vacas_lechera}
                    onChange={e => setForm({...form, vacas_lechera: e.target.value})}
                    min="0"
                  />
                </div>
                <div className="col-md-3 col-6">
                  <label className="form-label">Vacas Secas</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.vacas_seco}
                    onChange={e => setForm({...form, vacas_seco: e.target.value})}
                    min="0"
                  />
                </div>
                <div className="col-md-3 col-6">
                  <label className="form-label">Terneros</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.terneros}
                    onChange={e => setForm({...form, terneros: e.target.value})}
                    min="0"
                  />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-success">
                  <Save size={16} className="me-1" /> Guardar Registro
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  <X size={16} className="me-1" /> Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Último registro */}
      {ultimoRegistro && (
        <div className="card mb-4">
          <div className="card-header bg-white">
            <h5 className="mb-0">Último Registro</h5>
            <span className="text-muted small">
              {new Date(ultimoRegistro.fecha_registro).toLocaleDateString('es-AR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </span>
          </div>
          <div className="card-body">
            <div className="ganado-stats row g-3">
              <div className="col-md-3 col-6">
                <div className="stat-card stat-total">
                  <div className="stat-icon"><Users size={24} /></div>
                  <div className="stat-value">{ultimoRegistro.total_vacas}</div>
                  <div className="stat-label">Total Vacas</div>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="stat-card stat-lechera">
                  <div className="stat-icon"><TrendingUp size={24} /></div>
                  <div className="stat-value">{ultimoRegistro.vacas_lechera}</div>
                  <div className="stat-label">Vacas Lecheras</div>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="stat-card stat-seco">
                  <div className="stat-icon"><Beef size={24} /></div>
                  <div className="stat-value">{ultimoRegistro.vacas_seco}</div>
                  <div className="stat-label">Vacas Secas</div>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="stat-card stat-terneros">
                  <div className="stat-icon"><Beef size={24} /></div>
                  <div className="stat-value">{ultimoRegistro.terneros}</div>
                  <div className="stat-label">Terneros</div>
                </div>
              </div>
            </div>

            {/* Barra de distribución */}
            <div className="mt-4">
              <h6 className="text-muted small mb-2">Distribución del Rodeo</h6>
              <div className="progress" style={{ height: 24 }}>
                {ultimoRegistro.total_vacas > 0 && (
                  <>
                    <div
                      className="progress-bar bg-success"
                      style={{ width: `${(ultimoRegistro.vacas_lechera / ultimoRegistro.total_vacas) * 100}%` }}
                      title={`Lecheras: ${ultimoRegistro.vacas_lechera}`}
                    >
                      {ultimoRegistro.vacas_lechera > 0 && `${Math.round((ultimoRegistro.vacas_lechera / ultimoRegistro.total_vacas) * 100)}%`}
                    </div>
                    <div
                      className="progress-bar bg-warning"
                      style={{ width: `${(ultimoRegistro.vacas_seco / ultimoRegistro.total_vacas) * 100}%` }}
                      title={`Secas: ${ultimoRegistro.vacas_seco}`}
                    >
                      {ultimoRegistro.vacas_seco > 0 && `${Math.round((ultimoRegistro.vacas_seco / ultimoRegistro.total_vacas) * 100)}%`}
                    </div>
                    <div
                      className="progress-bar bg-info"
                      style={{ width: `${(ultimoRegistro.terneros / ultimoRegistro.total_vacas) * 100}%` }}
                      title={`Terneros: ${ultimoRegistro.terneros}`}
                    >
                      {ultimoRegistro.terneros > 0 && `${Math.round((ultimoRegistro.terneros / ultimoRegistro.total_vacas) * 100)}%`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!ultimoRegistro && (
        <div className="card mb-4">
          <div className="card-body text-center py-5 text-muted">
            <Beef size={48} className="mb-3 opacity-25" />
            <p className="mb-3">No hay registros de ganado</p>
            {canRegister && (
              <button className="btn btn-success" onClick={() => setShowForm(true)}>
                <Plus size={18} className="me-1" />Crear Primer Registro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Historial */}
      {showHistorial && (
        <div className="card mb-4">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0"><History size={16} className="me-2" />Historial de Registros</h6>
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
                      <th>Total</th>
                      <th>Lecheras</th>
                      <th>Secas</th>
                      <th>Terneros</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((reg, i) => (
                      <tr key={i}>
                        <td>{new Date(reg.fecha_registro).toLocaleDateString('es-AR')}</td>
                        <td className="fw-bold">{reg.total_vacas}</td>
                        <td>{reg.vacas_lechera}</td>
                        <td>{reg.vacas_seco}</td>
                        <td>{reg.terneros}</td>
                        <td>{reg.usuario_nombre || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted text-center py-3">No hay historial de registros</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
