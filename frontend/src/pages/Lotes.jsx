import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import '../styles/lotes.css';

export default function Lotes() {
  const { success, error, confirm } = useAlert();
  useSEO({ title: 'Lotes de Ganado', description: 'Administración de lotes de ganado con consumo estimado e insumos requeridos.' });
  const [lotes, setLotes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLote, setEditingLote] = useState(null);
  const [form, setForm] = useState({
    nombre: '', tipo_animal: '', objetivo_productivo: 'leche', etapa_lactancia: '', cantidad_animales: '', observaciones: ''
  });

  useEffect(() => { loadLotes(); loadInsumos(); }, []);

  const loadLotes = async () => {
    try {
      const res = await api.get('/lotes');
      setLotes(res.data.lotes);
    } catch (err) { console.error('Error:', err); }
  };

  const loadInsumos = async () => {
    try {
      const res = await api.get('/insumos');
      setInsumos(res.data.insumos);
    } catch (err) { console.error('Error:', err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLote) {
        await api.put(`/lotes/${editingLote.id}`, form);
        success('Lote actualizado');
      } else {
        await api.post('/lotes', form);
        success('Lote creado');
      }
      setShowModal(false);
      setEditingLote(null);
      loadLotes();
    } catch (err) {
      error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (lote) => {
    setEditingLote(lote);
    setForm({
      nombre: lote.nombre, tipo_animal: lote.tipo_animal,
      objetivo_productivo: lote.objetivo_productivo || 'leche',
      etapa_lactancia: lote.etapa_lactancia || '',
      cantidad_animales: lote.cantidad_animales,
      observaciones: lote.observaciones || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (lote) => {
    const confirmed = await confirm({
      title: 'Eliminar Lote',
      message: `¿Estás seguro que deseas eliminar el lote "${lote.nombre}"?`,
      type: 'error', confirmText: 'Sí, eliminar', cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/lotes/${lote.id}`);
      success('Lote eliminado');
      loadLotes();
    } catch (err) {
      error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  return (
    <div className="lotes-page">
      <header className="page-header d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0 d-flex align-items-center gap-2">
          <Package size={22} /> Lotes de Ganado
        </h1>
        <div className="lotes__header-actions">
          <button className="lotes__btn lotes__btn--primary" onClick={() => {
            setEditingLote(null);
            setForm({ nombre: '', tipo_animal: '', objetivo_productivo: 'leche', etapa_lactancia: '', cantidad_animales: '', observaciones: '' });
            setShowModal(true);
          }}>
            <Plus size={16} /> Nuevo Lote
          </button>
        </div>
      </header>

      <section aria-label="Listado de lotes">
        <div className="lotes__grid" role="list">
          {lotes.length === 0 && (
            <div className="lotes__empty-state">
              <Package size={48} />
              <p>No hay lotes registrados</p>
              <button className="lotes__btn lotes__btn--primary" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Crear primer lote
              </button>
            </div>
          )}
          {lotes.map(lote => (
            <article key={lote.id} className="lotes__card-wrapper" role="listitem">
              <div className="lotes__card">
                <div className="lotes__card-top">
                  <div>
                    <h3 className="lotes__card-name">{lote.nombre}</h3>
                    <p className="lotes__card-meta">
                      {lote.tipo_animal}{' '}
                      <span className={`badge ${lote.objetivo_productivo === 'engorde' ? 'bg-warning text-dark' : 'bg-info'}`}>
                        {lote.objetivo_productivo === 'engorde' ? 'Engorde' : 'Leche'}
                      </span>
                    </p>
                  </div>
                  <div className="lotes__card-actions">
                    <button className="lotes__card-action-btn" onClick={() => handleEdit(lote)} aria-label="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="lotes__card-action-btn lotes__card-action-btn--danger" onClick={() => handleDelete(lote)} aria-label="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <hr className="lotes__divider" />

                <div className="lotes__details-row">
                  <div className="lotes__detail-col">
                    <span className="lotes__detail-label">Animales</span>
                    <strong className="lotes__detail-value">{lote.cantidad_animales}</strong>
                  </div>
                </div>

                {lote.insumos_requeridos?.length > 0 && (
                  <div className="lotes__insumos-section">
                    <h4 className="lotes__insumos-title">Insumos requeridos</h4>
                    {lote.insumos_requeridos.map(li => (
                      <div key={li.id} className="lotes__insumo-item">
                        <span>{li.nombre}</span>
                        <strong>{li.cantidad_requerida} {li.unidad}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="h5 mb-0">{editingLote ? 'Editar Lote' : 'Nuevo Lote'}</h3>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Nombre</label>
                  <input className="form-control" value={form.nombre} onChange={e => setForm(prev => ({...prev, nombre: e.target.value}))} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Tipo de Animal</label>
                  <input className="form-control" value={form.tipo_animal} onChange={e => setForm(prev => ({...prev, tipo_animal: e.target.value}))} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Objetivo productivo</label>
                  <select className="form-select" value={form.objetivo_productivo} onChange={e => setForm(prev => ({...prev, objetivo_productivo: e.target.value}))}>
                    <option value="leche">Leche</option>
                    <option value="engorde">Engorde</option>
                  </select>
                </div>
                {form.objetivo_productivo === 'leche' && (
                  <div className="mb-3">
                    <label className="form-label">Etapa de lactancia</label>
                    <select className="form-select" value={form.etapa_lactancia} onChange={e => setForm(prev => ({...prev, etapa_lactancia: e.target.value}))}>
                      <option value="">Sin especificar</option>
                      <option value="temprana">Temprana (recién paridas, subiendo a pico)</option>
                      <option value="media">Media</option>
                      <option value="tardia">Tardía</option>
                      <option value="seca">Vacas secas</option>
                    </select>
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Cantidad de Animales</label>
                  <input type="number" className="form-control" value={form.cantidad_animales} onChange={e => setForm(prev => ({...prev, cantidad_animales: e.target.value}))} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Observaciones</label>
                  <textarea className="form-control" value={form.observaciones} onChange={e => setForm(prev => ({...prev, observaciones: e.target.value}))} rows="3" />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
