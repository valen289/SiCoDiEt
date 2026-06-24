import { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronLeft, ChevronRight, Activity, Check, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import '../styles/actividades.css';

const ROL_LABELS = {
  dueno:      'Dueño',
  encargado:  'Técnico',
  trabajador: 'Trabajador',
};

const ACCION_LABELS = {
  ganado_actualizado:  'Rodeo actualizado',
  consumo_registrado:  'Consumo registrado',
  insumo_creado:       'Insumo creado',
  insumo_actualizado:  'Insumo actualizado',
  carga_registrada:    'Carga registrada',
  insumo_desactivado:  'Insumo desactivado',
  lote_creado:         'Lote creado',
  lote_actualizado:    'Lote actualizado',
  lote_desactivado:    'Lote desactivado',
  usuario_creado:      'Usuario creado',
  usuario_desactivado: 'Usuario dado de baja',
};

function tiempoRelativo(fechaStr) {
  const fecha = new Date(fechaStr);
  const diff = Math.floor((Date.now() - fecha.getTime()) / 1000);
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  if (dias === 1)  return 'ayer';
  if (dias < 7)   return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Avatar({ nombre, rol }) {
  const initials = (nombre || '?')
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
  const mod = rol || 'sistema';
  return (
    <div className={`actividades__avatar actividades__avatar--${mod}`}>
      {initials}
    </div>
  );
}

export default function Actividades() {
  const { error: notifyError, confirm } = useAlert();
  const [actividades, setActividades] = useState([]);
  const [pagina, setPagina]           = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const cargar = useCallback(async (pag) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/actividades', { params: { page: pag, limit: 20 } });
      setActividades(res.data.actividades || []);
      setTotalPaginas(res.data.total_paginas || 1);
      setTotal(res.data.total || 0);
    } catch {
      setError('No se pudieron cargar las actividades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(pagina); }, [pagina, cargar]);

  const marcarLeida = async (id) => {
    try {
      await api.patch(`/actividades/${id}/leida`);
      setActividades(prev => prev.filter(act => act.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      notifyError(err.response?.data?.error || 'Error al marcar como leída');
    }
  };

  const borrar = async (act) => {
    const confirmed = await confirm({
      title: 'Eliminar actividad',
      message: '¿Estás seguro que deseas eliminar este registro de actividad?',
      type: 'error', confirmText: 'Sí, eliminar', cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/actividades/${act.id}`);
      setActividades(prev => prev.filter(a => a.id !== act.id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      notifyError(err.response?.data?.error || 'Error al eliminar la actividad');
    }
  };

  return (
    <div className="actividades">
      <div className="actividades__header">
        <Activity size={18} className="actividades__header-icon" />
        <h1 className="actividades__title">Actividad reciente</h1>
        {total > 0 && (
          <span className="actividades__count">{total} registros</span>
        )}
      </div>

      {error && (
        <div className="actividades__error">{error}</div>
      )}

      {loading ? (
        <div className="actividades__skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="actividades__skeleton-item">
              <div className="actividades__skeleton-avatar" />
              <div className="actividades__skeleton-lines">
                <div className="actividades__skeleton-line actividades__skeleton-line--long" />
                <div className="actividades__skeleton-line actividades__skeleton-line--short" />
              </div>
            </div>
          ))}
        </div>
      ) : actividades.length === 0 ? (
        <div className="actividades__empty">
          <Activity size={40} />
          <p>Sin actividad registrada aún</p>
        </div>
      ) : (
        <div className="actividades__list">
          {actividades.map((act) => (
            <div key={act.id} className="actividades__item">
              <Avatar nombre={act.usuario_nombre} rol={act.usuario_rol} />
              <div className="actividades__content">
                <div className="actividades__meta">
                  <span className="actividades__name">
                    {act.usuario_nombre || 'Sistema'}
                  </span>
                  {act.usuario_rol && (
                    <span className={`actividades__badge actividades__badge--${act.usuario_rol}`}>
                      {ROL_LABELS[act.usuario_rol] || act.usuario_rol}
                    </span>
                  )}
                  <span className="actividades__time">
                    <Clock size={11} />
                    {tiempoRelativo(act.fecha_hora)}
                  </span>
                </div>
                <p className="actividades__desc">
                  <span className="actividades__action">
                    {ACCION_LABELS[act.accion] || act.accion}
                  </span>
                  {act.descripcion && ` · ${act.descripcion}`}
                </p>
              </div>
              <div className="actividades__actions">
                <button
                  className="actividades__action-btn actividades__action-btn--leida"
                  title="Marcar como leída"
                  onClick={() => marcarLeida(act.id)}
                >
                  <Check size={15} />
                </button>
                <button
                  className="actividades__action-btn actividades__action-btn--borrar"
                  title="Eliminar"
                  onClick={() => borrar(act)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="actividades__pagination">
          <button
            className="actividades__page-btn"
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={pagina === 1 || loading}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="actividades__page-info">{pagina} / {totalPaginas}</span>
          <button
            className="actividades__page-btn"
            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas || loading}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
