import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import api from '../services/api';
import { Mail, Phone, Lock, Save, UserCog, Building2, LockKeyhole, Camera, Eye, EyeOff, Upload, Trash2, Bell, BellOff } from 'lucide-react';
import PasswordRulesHint from '../components/PasswordRulesHint';
import { passwordStrength } from '../utils/passwordPolicy';
import { resizeImageToDataUrl } from '../utils/resizeImage';
import { isPushSupported, getSuscripcionActual, activarNotificaciones, desactivarNotificaciones } from '../utils/push';
import '../styles/profile.css';

const ROL_LABELS = {
  dueno:      'Administrador',
  encargado:  'Técnico',
  trabajador: 'Operario',
};

const TELEFONO_REGEX = /^[0-9+\- ]{8,20}$/;

function ProfileAvatar({ nombre, rol, foto }) {
  const initials = (nombre || '?')
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();

  if (foto) {
    return <img src={foto} alt="Foto de perfil" className="profile-avatar profile-avatar--photo" />;
  }

  return (
    <div className={`profile-avatar profile-avatar--${rol || 'trabajador'}`}>
      {initials}
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { success, error, confirm } = useAlert();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    telefono: user?.telefono || '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const uploadInputRef = useRef(null);
  const captureInputRef = useRef(null);
  const [pushSubscrito, setPushSubscrito] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    document.title = 'Mi Perfil - Sicodiet';
    return () => {
      document.title = 'Sicodiet';
    };
  }, []);

  useEffect(() => {
    if (!isPushSupported()) return;
    getSuscripcionActual().then((sub) => setPushSubscrito(Boolean(sub))).catch(() => {});
  }, []);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushSubscrito) {
        await desactivarNotificaciones();
        setPushSubscrito(false);
        success('Notificaciones desactivadas');
      } else {
        await activarNotificaciones();
        setPushSubscrito(true);
        success('Notificaciones activadas');
      }
    } catch (err) {
      error(err.message || 'Error al cambiar el estado de las notificaciones');
    } finally {
      setPushLoading(false);
    }
  };

  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoMenuOpen(false);
    setPhotoLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const res = await api.put('/auth/profile', { foto: dataUrl });
      updateUser(res.data.user);
      success('Foto de perfil actualizada');
    } catch (err) {
      error(err.response?.data?.error || 'Error al subir la foto');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoMenuOpen(false);
    const confirmed = await confirm({
      title: 'Quitar foto de perfil',
      message: '¿Estás seguro que deseas quitar tu foto de perfil?',
      type: 'warning',
      confirmText: 'Sí, quitar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    setPhotoLoading(true);
    try {
      const res = await api.put('/auth/profile', { foto: null });
      updateUser(res.data.user);
      success('Foto de perfil eliminada');
    } catch (err) {
      error(err.response?.data?.error || 'Error al quitar la foto');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = {};
    if (form.telefono && !TELEFONO_REGEX.test(form.telefono)) {
      nextErrors.telefono = 'Teléfono inválido (solo números, espacios, + y -, mínimo 8 dígitos)';
    }
    if (form.password) {
      if (!form.currentPassword) {
        nextErrors.currentPassword = 'Ingresá tu contraseña actual';
      }
      if (!passwordStrength(form.password)?.valid) {
        nextErrors.password = 'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial';
      }
      if (form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
      };
      if (form.password) {
        payload.password = form.password;
        payload.currentPassword = form.currentPassword;
      }

      const res = await api.put('/auth/profile', payload);
      updateUser(res.data.user);
      success('Perfil actualizado exitosamente');
      setEditing(false);
      setForm(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }));
    } catch (err) {
      error(err.response?.data?.error || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFormErrors({});
    setForm({
      nombre: user?.nombre || '',
      email: user?.email || '',
      telefono: user?.telefono || '',
      currentPassword: '',
      password: '',
      confirmPassword: '',
    });
  };

  const getRolBadge = (rol) => {
    const label = ROL_LABELS[rol] || rol;
    return <span className={`profile-badge profile-badge--${rol}`}>{label}</span>;
  };

  const strength = passwordStrength(form.password);

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <button
              type="button"
              className="profile-avatar-button"
              onClick={() => setPhotoMenuOpen(true)}
              disabled={photoLoading}
              aria-label="Cambiar foto de perfil"
            >
              <ProfileAvatar nombre={user?.nombre} rol={user?.rol} foto={user?.foto} />
              <span className="profile-avatar-camera-badge">
                <Camera size={14} />
              </span>
            </button>

            {photoMenuOpen && (
              <>
                <div className="profile-photo-menu-overlay" onClick={() => setPhotoMenuOpen(false)} />
                <div className="profile-photo-menu">
                  <button
                    type="button"
                    className="profile-photo-menu__item"
                    disabled={!user?.foto}
                    onClick={() => { setPhotoMenuOpen(false); setViewingPhoto(true); }}
                  >
                    <Eye size={16} /> Ver foto
                  </button>
                  <button
                    type="button"
                    className="profile-photo-menu__item"
                    onClick={() => captureInputRef.current?.click()}
                  >
                    <Camera size={16} /> Tomar foto
                  </button>
                  <button
                    type="button"
                    className="profile-photo-menu__item"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <Upload size={16} /> Subir foto
                  </button>
                  <button
                    type="button"
                    className="profile-photo-menu__item profile-photo-menu__item--danger"
                    disabled={!user?.foto}
                    onClick={handleRemovePhoto}
                  >
                    <Trash2 size={16} /> Quitar foto
                  </button>
                </div>
              </>
            )}

            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={handlePhotoFile}
            />
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoFile}
            />
          </div>

          {viewingPhoto && user?.foto && (
            <div className="modal-overlay" onClick={() => setViewingPhoto(false)}>
              <div className="modal-content profile-photo-preview" onClick={(e) => e.stopPropagation()}>
                <img src={user.foto} alt="Foto de perfil" />
              </div>
            </div>
          )}

          <div className="profile-info">
            <h1 className="profile-name">{user?.nombre}</h1>
            <div className="profile-meta">
              <span className="profile-cedula">
                <LockKeyhole size={12} /> Cédula: {user?.cedula}
              </span>
              {getRolBadge(user?.rol)}
            </div>
          </div>
        </div>

        {!editing ? (
          <div className="profile-details">
            <div className="detail-item">
              <Mail size={18} />
              <div>
                <span className="detail-label">Email</span>
                <span className="detail-value">{user?.email || 'No configurado'}</span>
              </div>
            </div>
            <div className="detail-item">
              <Phone size={18} />
              <div>
                <span className="detail-label">Teléfono</span>
                <span className="detail-value">{user?.telefono || 'No configurado'}</span>
              </div>
            </div>
            <div className="detail-item">
              <Building2 size={18} />
              <div>
                <span className="detail-label">Establecimiento</span>
                <span className="detail-value">{user?.tambo_nombre || 'No asignado'}</span>
              </div>
            </div>
            {isPushSupported() && (
              <div className="detail-item">
                {pushSubscrito ? <Bell size={18} /> : <BellOff size={18} />}
                <div>
                  <span className="detail-label">Notificaciones push</span>
                  <span className="detail-value">{pushSubscrito ? 'Activadas' : 'Desactivadas'}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                >
                  {pushLoading ? '...' : pushSubscrito ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            )}
            <button className="btn btn-success btn-edit-profile" onClick={() => setEditing(true)}>
              <UserCog size={18} /> Editar Perfil
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label className="form-label">
                <UserCog size={16} /> Nombre
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
                <Mail size={16} /> Email
              </label>
              <input
                type="email"
                className="form-control"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Phone size={16} /> Teléfono
              </label>
              <input
                type="text"
                className={`form-control ${formErrors.telefono ? 'is-invalid' : ''}`}
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="094 231 234"
              />
              {formErrors.telefono && <span className="form-error">{formErrors.telefono}</span>}
            </div>
            <hr />
            <div className="form-group">
              <label className="form-label">
                <Lock size={16} /> Contraseña actual
              </label>
              <div className="input-group">
                <input
                  type={verPassword ? 'text' : 'password'}
                  className={`form-control ${formErrors.currentPassword ? 'is-invalid' : ''}`}
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  placeholder="Requerida solo para cambiar la contraseña"
                />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setVerPassword(v => !v)}>
                  {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formErrors.currentPassword && <span className="form-error">{formErrors.currentPassword}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">
                <Lock size={16} /> Nueva Contraseña (opcional)
              </label>
              <div className="input-group">
                <input
                  type={verPassword ? 'text' : 'password'}
                  className={`form-control ${formErrors.password ? 'is-invalid' : ''}`}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setVerPassword(v => !v)}>
                  {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordRulesHint />
              {strength && (
                <div className="password-strength">
                  <div className={`password-strength__bar password-strength__bar--${strength.level}`} />
                  <span className={`password-strength__label password-strength__label--${strength.level}`}>
                    {strength.label}
                  </span>
                </div>
              )}
              {formErrors.password && <span className="form-error">{formErrors.password}</span>}
            </div>
            {form.password && (
              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} /> Confirmar Contraseña
                </label>
                <div className="input-group">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    className={`form-control ${formErrors.confirmPassword ? 'is-invalid' : ''}`}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Repetir contraseña"
                  />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setVerPassword(v => !v)}>
                    {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formErrors.confirmPassword && <span className="form-error">{formErrors.confirmPassword}</span>}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-success" disabled={loading}>
                <Save size={16} /> {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
