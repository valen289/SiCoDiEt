import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import api from '../services/api';
import { User, Mail, Phone, Lock, Save, UserCog } from 'lucide-react';
import '../styles/profile.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { success, error } = useAlert();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    email: user?.email || '',
    telefono: user?.telefono || '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Mi Perfil - SiCoDiEt';
    return () => {
      document.title = 'SiCoDiEt';
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password && form.password !== form.confirmPassword) {
      error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
      };
      if (form.password) {
        payload.password = form.password;
      }

      const res = await api.put('/auth/profile', payload);
      updateUser(res.data.user);
      success('Perfil actualizado exitosamente');
      setEditing(false);
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      error(err.response?.data?.error || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({
      nombre: user?.nombre || '',
      email: user?.email || '',
      telefono: user?.telefono || '',
      password: '',
      confirmPassword: '',
    });
  };

  const getRolBadge = (rol) => {
    const badges = {
      admin: { label: 'Administrador', class: 'bg-danger' },
      usuario: { label: 'Usuario', class: 'bg-primary' },
      operario: { label: 'Operario', class: 'bg-success' },
    };
    const badge = badges[rol] || badges.usuario;
    return <span className={`badge ${badge.class}`}>{badge.label}</span>;
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            <User size={48} />
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{user?.nombre}</h1>
            <div className="profile-meta">
              <span className="profile-cedula">Cédula: {user?.cedula}</span>
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
            <button className="btn btn-success btn-edit-profile" onClick={() => setEditing(true)}>
              <UserCog size={18} /> Editar Perfil
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label className="form-label">
                <User size={16} /> Nombre
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
                className="form-control"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <hr />
            <div className="form-group">
              <label className="form-label">
                <Lock size={16} /> Nueva Contraseña (opcional)
              </label>
              <input
                type="password"
                className="form-control"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Dejar vacío para no cambiar"
              />
            </div>
            {form.password && (
              <div className="form-group">
                <label className="form-label">
                  <Lock size={16} /> Confirmar Contraseña
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Repetir contraseña"
                />
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
