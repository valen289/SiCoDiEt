import { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import api from '../services/api';

const ROL_COLORS = {
  dueno:      'bg-purple-100 text-purple-700',
  encargado:  'bg-blue-100 text-blue-700',
  trabajador: 'bg-green-100 text-green-700',
};

const ROL_LABELS = {
  dueno:      'Dueño',
  encargado:  'Encargado',
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

  if (diff < 60)   return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
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

  const colors = {
    dueno:      'bg-purple-500',
    encargado:  'bg-blue-500',
    trabajador: 'bg-green-500',
  };

  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${colors[rol] || 'bg-gray-400'}`}>
      {initials}
    </div>
  );
}

export default function Actividades() {
  const [actividades, setActividades] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-gray-500" />
        <h1 className="text-xl font-semibold text-gray-800">Actividad reciente</h1>
        {total > 0 && (
          <span className="ml-auto text-sm text-gray-400">{total} registros</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : actividades.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin actividad registrada aún</p>
        </div>
      ) : (
        <div className="space-y-1">
          {actividades.map((act) => (
            <div key={act.id} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
              <Avatar nombre={act.usuario_nombre} rol={act.usuario_rol} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 truncate">
                    {act.usuario_nombre || 'Sistema'}
                  </span>
                  {act.usuario_rol && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROL_COLORS[act.usuario_rol] || 'bg-gray-100 text-gray-600'}`}>
                      {ROL_LABELS[act.usuario_rol] || act.usuario_rol}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tiempoRelativo(act.fecha_hora)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-600">
                    {ACCION_LABELS[act.accion] || act.accion}
                  </span>
                  {act.descripcion && ` · ${act.descripcion}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={pagina === 1 || loading}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">
            {pagina} / {totalPaginas}
          </span>
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas || loading}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
