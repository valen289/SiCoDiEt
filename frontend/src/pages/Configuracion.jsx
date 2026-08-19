import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import api from '../services/api';
import { Building2, Save, Upload, Clock, Trash2, Lock } from 'lucide-react';
import { resizeImageToDataUrl } from '../utils/resizeImage';
import '../styles/profile.css';

const ZONAS_HORARIAS = [
  { value: 'America/Montevideo', label: 'Montevideo (UY)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (AR)' },
  { value: 'America/Santiago', label: 'Santiago (CL)' },
  { value: 'America/Asuncion', label: 'Asunción (PY)' },
];

export default function Configuracion() {
  const { user, updateUser, logout } = useAuth();
  const { success, error, confirm } = useAlert();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: user?.tambo_nombre || '',
    zona_horaria: user?.tambo_zona_horaria || 'America/Montevideo',
  });
  const [logoPreview, setLogoPreview] = useState(user?.tambo_logo || null);
  const [saving, setSaving] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = 'Configuración - Sicodiet';
    return () => {
      document.title = 'Sicodiet';
    };
  }, []);

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLogoLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const res = await api.put('/tambo', { logo: dataUrl });
      updateUser({
        tambo_nombre: res.data.tambo.nombre,
        tambo_zona_horaria: res.data.tambo.zona_horaria,
        tambo_logo: res.data.tambo.logo,
      });
      setLogoPreview(res.data.tambo.logo);
      success('Logo actualizado');
    } catch (err) {
      error(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Error al subir el logo');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/tambo', {
        nombre: form.nombre,
        zona_horaria: form.zona_horaria,
      });
      updateUser({
        tambo_nombre: res.data.tambo.nombre,
        tambo_zona_horaria: res.data.tambo.zona_horaria,
        tambo_logo: res.data.tambo.logo,
      });
      success('Configuración actualizada exitosamente');
    } catch (err) {
      error(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Error al actualizar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarClick = async () => {
    const confirmado = await confirm({
      type: 'warning',
      title: 'Eliminar establecimiento',
      message: 'Esta acción es permanente: se van a borrar todos los usuarios y todos los datos del establecimiento (insumos, lotes, consumos, dietas, compras, etc.). No se puede deshacer. ¿Querés continuar?',
      confirmText: 'Sí, continuar',
      cancelText: 'Cancelar',
    });
    if (confirmado) {
      setDeleteError('');
      setDeletePassword('');
      setDeleteModalOpen(true);
    }
  };

  const handleConfirmarEliminar = async (e) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/tambo', { data: { password: deletePassword } });
      success('Establecimiento eliminado');
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Error al eliminar el establecimiento');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <button
              type="button"
              className="profile-avatar-button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoLoading}
              aria-label="Cambiar logo del establecimiento"
            >
              {logoPreview
                ? <img src={logoPreview} alt="Logo del establecimiento" className="profile-avatar profile-avatar--photo" />
                : <div className="profile-avatar profile-avatar--dueno"><Building2 size={32} /></div>}
              <span className="profile-avatar-camera-badge">
                <Upload size={14} />
              </span>
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleLogoFile}
            />
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{user?.tambo_nombre}</h1>
            <div className="profile-meta">
              <span className="profile-cedula">Configuración del establecimiento</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label className="form-label">
              <Building2 size={16} /> Nombre del establecimiento
            </label>
            <input
              type="text"
              className="form-control"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <Clock size={16} /> Zona horaria
            </label>
            <select
              className="form-control"
              value={form.zona_horaria}
              onChange={(e) => setForm({ ...form, zona_horaria: e.target.value })}
            >
              {ZONAS_HORARIAS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
            <small className="form-text text-muted">
              Se usa para que la fecha y hora de los consumos y compras coincidan con la hora real del establecimiento.
            </small>
          </div>
          <small className="form-text text-muted d-block mb-3">
            El logo se recorta a cuadrado automáticamente.
          </small>
          <div className="form-actions">
            <button type="submit" className="btn btn-success" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>

      <div className="profile-container mt-3">
        <div className="p-4 border border-danger rounded bg-white">
          <h3 className="h6 text-danger d-flex align-items-center gap-2 mb-2">
            <Trash2 size={18} /> Zona de peligro
          </h3>
          <p className="text-muted small mb-3">
            Eliminar el establecimiento borra permanentemente todos sus usuarios y todos sus datos
            (insumos, lotes, consumos, dietas, compras, etc.). No se puede deshacer.
          </p>
          <button type="button" className="btn btn-outline-danger" onClick={handleEliminarClick}>
            <Trash2 size={16} /> Eliminar establecimiento
          </button>
        </div>
      </div>

      {deleteModalOpen && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal-content p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="h5 text-danger d-flex align-items-center gap-2 mb-3">
              <Lock size={18} /> Confirmar eliminación
            </h3>
            <p className="text-muted small mb-3">
              Ingresá tu contraseña para eliminar <strong>{user?.tambo_nombre}</strong> de forma permanente.
            </p>
            <form onSubmit={handleConfirmarEliminar}>
              <div className="form-group mb-3">
                <input
                  type="password"
                  className={`form-control ${deleteError ? 'is-invalid' : ''}`}
                  placeholder="Tu contraseña"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoFocus
                  required
                />
                {deleteError && <span className="form-error">{deleteError}</span>}
              </div>
              <div className="form-actions d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={deleting}
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={deleting || !deletePassword}>
                  {deleting ? 'Eliminando...' : 'Confirmar eliminación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
