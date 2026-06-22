import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import api from '../services/api';
import { Mail, Phone, Lock, Save, UserCog, Building2, LockKeyhole } from 'lucide-react';
import '../styles/profile.css';

const ROL_LABELS = {
  dueno:      'Dueño',
  encargado:  'Técnico',
  trabajador: 'Trabajador',
};

const TELEFONO_REGEX = /^[0-9+\- ]{8,20}$/;

function passwordStrength(password) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Débil', level: 'weak' };
  if (score <= 2) return { label: 'Media', level: 'medium' };
  return { label: 'Fuerte', level: 'strong' };
}

function ProfileAvatar({ nombre, rol }) {
  const initials = (nombre || '?')
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`profile-avatar profile-avatar--${rol || 'trabajador'}`}>
      {initials}
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { success, error } = useAlert();
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

  useEffect(() => {
    document.title = 'Mi Perfil - SiCoDiEt';
    return () => {
      document.title = 'SiCoDiEt';
    };
  }, []);

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
          <ProfileAvatar nombre={user?.nombre} rol={user?.rol} />
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
              <input
                type="password"
                className={`form-control ${formErrors.currentPassword ? 'is-invalid' : ''}`}
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="Requerida solo para cambiar la contraseña"
              />
              {formErrors.currentPassword && <span className="form-error">{formErrors.currentPassword}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">
                <Lock size={16} /> Nueva Contraseña (opcional)
              </label>
              <input
                type="password"
                className="form-control"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
              {strength && (
                <div className="password-strength">
                  <div className={`password-strength__bar password-strength__bar--${strength.level}`} />
                  <span className={`password-strength__label password-strength__label--${strength.level}`}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
            {form.password && (
              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} /> Confirmar Contraseña
                </label>
                <input
                  type="password"
                  className={`form-control ${formErrors.confirmPassword ? 'is-invalid' : ''}`}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Repetir contraseña"
                />
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
