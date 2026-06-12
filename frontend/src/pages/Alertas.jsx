import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Bell, BellOff, Check, CheckCheck, Trash2, AlertTriangle, Info, X } from 'lucide-react';
import '../styles/alertas.css';

export default function Alertas() {
  const { user } = useAuth();
  const { success, error, confirm } = useAlert();
  useSEO({ title: 'Centro de Alertas', description: 'Alertas de stock bajo, stock crítico y vencimientos de insumos del tambo.' });
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todas');

  const isAdmin = user?.rol === 'dueno' || user?.rol === 'encargado';

  const loadAlertas = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter === 'no-leidas' ? { leidas: 'false' } : {};
      const res = await api.get('/alertas', { params });
      setAlertas(res.data.alertas || res.data || []);
    } catch (err) {
      console.error('Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAlertas();
  }, [loadAlertas]);

  const handleMarcarLeida = async (alerta) => {
    try {
      await api.put(`/alertas/${alerta.id}/leer`);
      success('Alerta marcada como leída');
      loadAlertas();
    } catch (err) {
      error('Error al marcar alerta');
    }
  };

  const handleMarcarTodas = async () => {
    try {
      await api.put('/alertas/leer-todas');
      success('Todas las alertas marcadas como leídas');
      loadAlertas();
    } catch (err) {
      error('Error al marcar alertas');
    }
  };

  const handleEliminar = async (alerta) => {
    const confirmed = await confirm({
      title: 'Eliminar Alerta',
      message: '¿Estás seguro que deseas eliminar esta alerta?',
      type: 'warning',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/alertas/${alerta.id}`);
      success('Alerta eliminada');
      loadAlertas();
    } catch (err) {
      error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'stock_bajo': return { icon: AlertTriangle, color: 'warning', label: 'Stock Bajo' };
      case 'stock_critico': return { icon: AlertTriangle, color: 'danger', label: 'Stock Crítico' };
      case 'vencimiento': return { icon: Info, color: 'info', label: 'Vencimiento' };
      default: return { icon: Bell, color: 'secondary', label: tipo };
    }
  };

  const noLeidasCount = alertas.filter(a => !a.leida).length;

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status" />
        <p className="mt-2 text-muted">Cargando alertas...</p>
      </div>
    );
  }

  return (
    <div className="alertas-page">
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <Bell size={24} /> Centro de Alertas
          </h1>
          <p className="text-muted small mb-0">
            {noLeidasCount > 0 ? `${noLeidasCount} alerta${noLeidasCount > 1 ? 's' : ''} sin leer` : 'Todas las alertas leídas'}
          </p>
        </div>
        <div className="alertas__header-actions">
          {noLeidasCount > 0 && (
            <button className="alertas__btn" onClick={handleMarcarTodas}>
              <CheckCheck size={16} className="me-1" />Marcar todas
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="alertas__filters">
        {[
          { value: 'todas', label: 'Todas' },
          { value: 'no-leidas', label: 'No leídas' },
        ].map(f => (
          <button
            key={f.value}
            className={`alertas__filter-btn ${filter === f.value ? 'alertas__filter-btn--active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <span className="alertas__count">
          {alertas.length} alerta{alertas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista de alertas */}
      <div className="alertas__list">
        {alertas.length > 0 ? (
          alertas.map(alerta => {
            const tipoInfo = getTipoIcon(alerta.tipo);
            const TipoIcon = tipoInfo.icon;
            return (
              <div key={alerta.id} className={`alertas__card ${alerta.leida ? 'alertas__card--read' : ''}`}>
                <div className="alertas__indicator" style={{ backgroundColor: `var(--${tipoInfo.color})` }} />
                <div className="alertas__body">
                  <div className="alertas__header">
                    <div className="alertas__header-title">
                      <TipoIcon size={18} className={`text-${tipoInfo.color}`} />
                      <span className={`badge bg-${tipoInfo.color}`}>{tipoInfo.label}</span>
                      {!alerta.leida && (
                        <span className="badge bg-primary">Nueva</span>
                      )}
                    </div>
                    <span className="text-muted small">
                      {new Date(alerta.fecha_creacion).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="alertas__mensaje mt-2 mb-0">{alerta.mensaje}</p>
                  {alerta.insumo_nombre && (
                    <span className="alertas__insumo">
                      Insumo: {alerta.insumo_nombre}
                    </span>
                  )}
                </div>
                <div className="alertas__actions">
                  {!alerta.leida && (
                    <button
                      className="alertas__action-btn alertas__action-btn--success"
                      onClick={() => handleMarcarLeida(alerta)}
                      title="Marcar como leída"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="alertas__action-btn alertas__action-btn--danger"
                      onClick={() => handleEliminar(alerta)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="alertas__empty-state">
            <BellOff size={48} className="mb-3 opacity-25" />
            <p className="mb-0">
              {filter === 'no-leidas' ? 'No hay alertas sin leer' : 'No hay alertas'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
