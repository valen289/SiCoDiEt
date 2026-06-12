import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Users, Plus, Edit2, UserCheck, UserX, Lock, Save, X, Mail, Phone, Hash } from 'lucide-react';
import '../styles/usuarios.css';

const ROL_CONFIG = {
  dueno:      { label: 'Dueño',      class: 'badge-danger' },
  encargado:  { label: 'Encargado',  class: 'badge-primary' },
  trabajador: { label: 'Trabajador', class: 'badge-success' },
};

export default function Usuarios() {
  const { success, error, confirm } = useAlert();
  useSEO({ title: 'Gestión de Usuarios', description: 'Administración de usuarios del tambo.' });
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    cedula: '', nombre: '', email: '', telefono: '', password: '', rol: 'trabajador'
  });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [filter, setFilter] = useState('todos');

  const loadUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await api.get('/usuarios');
      setUsuarios(res.data.usuarios || []);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setApiError(err.response?.data?.error || 'Error al cargar usuarios');
      error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { nombre: form.nombre, email: form.email, telefono: form.telefono, rol: form.rol };
        await api.put(`/usuarios/${editingUser.id}`, payload);
        success('Usuario actualizado');
      } else {
        await api.post('/usuarios', form);
        success('Usuario creado');
      }
      setShowModal(false);
      setEditingUser(null);
      setForm({ cedula: '', nombre: '', email: '', telefono: '', password: '', rol: 'trabajador' });
      loadUsuarios();
    } catch (err) {
      error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error');
    }
  };

  const handleEdit = (usuario) => {
    setEditingUser(usuario);
    setForm({
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      email: usuario.email || '',
      telefono: usuario.telefono || '',
      password: '',
      rol: usuario.rol
    });
    setShowModal(true);
  };

  const handleToggleActivo = async (usuario) => {
    const action = usuario.activo ? 'desactivar' : 'activar';
    const confirmed = await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} usuario`,
      message: `¿Estás seguro que deseas ${action} a "${usuario.nombre}"?`,
      type: 'warning',
      confirmText: `Sí, ${action}`,
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.put(`/usuarios/${usuario.id}`, { activo: !usuario.activo });
      success(`Usuario ${usuario.activo ? 'desactivado' : 'activado'}`);
      loadUsuarios();
    } catch (err) {
      error(err.response?.data?.error || `Error al ${action} usuario`);
    }
  };

  const handleChangePassword = (usuario) => {
    setEditingUser(usuario);
    setPasswordForm({ password: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirmPassword) {
      error('Las contraseñas no coinciden');
      return;
    }
    try {
      await api.put(`/usuarios/${editingUser.id}/password`, { password: passwordForm.password });
      success('Contraseña actualizada');
      setShowPasswordModal(false);
      setEditingUser(null);
    } catch (err) {
      error(err.response?.data?.error || 'Error al cambiar contraseña');
    }
  };

  const getRolBadge = (rol) => {
    const cfg = ROL_CONFIG[rol] || ROL_CONFIG.trabajador;
    return <span className={`badge ${cfg.class}`}>{cfg.label}</span>;
  };

  const filteredUsuarios = usuarios.filter(u => {
    if (filter === 'activos')   return u.activo;
    if (filter === 'inactivos') return !u.activo;
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status" />
        <p className="mt-2 text-muted">Cargando usuarios...</p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="text-center py-5">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Error</h4>
          <p>{apiError}</p>
          <hr />
          <button className="btn btn-outline-danger" onClick={loadUsuarios}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="usuarios-page">
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <Users size={24} /> Gestión de Usuarios
          </h1>
          <p className="text-muted small mb-0">Administra los usuarios del tambo</p>
        </div>
        <button
          className="btn btn-success d-flex align-items-center gap-2"
          onClick={() => {
            setEditingUser(null);
            setForm({ cedula: '', nombre: '', email: '', telefono: '', password: '', rol: 'trabajador' });
            setShowModal(true);
          }}
        >
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      <div className="usuarios-filters mb-3 d-flex gap-2">
        {['todos', 'activos', 'inactivos'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-success' : 'btn-outline-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-muted small ms-auto align-self-center">
          {filteredUsuarios.length} usuario{filteredUsuarios.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="usuarios-grid row g-3">
        {filteredUsuarios.map(usuario => (
          <div key={usuario.id} className="col-12 col-sm-6 col-xl-4">
            <div className={`usuario-card ${!usuario.activo ? 'inactive' : ''}`}>
              <div className="usuario-header d-flex justify-content-between align-items-start">
                <div className="usuario-avatar">
                  <span className="avatar-letter">{usuario.nombre.charAt(0).toUpperCase()}</span>
                </div>
                <div className="d-flex gap-1">
                  <button className="btn btn-sm btn-light" onClick={() => handleEdit(usuario)} title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-sm btn-light" onClick={() => handleChangePassword(usuario)} title="Cambiar contraseña">
                    <Lock size={14} />
                  </button>
                  <button
                    className={`btn btn-sm ${usuario.activo ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => handleToggleActivo(usuario)}
                    title={usuario.activo ? 'Dar de baja' : 'Reactivar'}
                  >
                    {usuario.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                </div>
              </div>

              <div className="usuario-body mt-3">
                <h3 className="usuario-name">{usuario.nombre}</h3>
                <div className="usuario-meta d-flex flex-wrap gap-2 mb-2">
                  {getRolBadge(usuario.rol)}
                  <span className={`badge ${usuario.activo ? 'badge-success' : 'badge-secondary'}`}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="usuario-details">
                  <div className="detail-row"><Hash size={14} /><span>{usuario.cedula}</span></div>
                  {usuario.email && (
                    <div className="detail-row"><Mail size={14} /><span>{usuario.email}</span></div>
                  )}
                  {usuario.telefono && (
                    <div className="detail-row"><Phone size={14} /><span>{usuario.telefono}</span></div>
                  )}
                  {usuario.ultimo_acceso && (
                    <div className="detail-row text-muted small">
                      <span>Último acceso: {new Date(usuario.ultimo_acceso).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsuarios.length === 0 && (
        <div className="text-center py-5 text-muted">
          <Users size={48} className="mb-3 opacity-25" />
          <p>No hay usuarios {filter !== 'todos' ? filter : ''} registrados</p>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="h4 mb-0">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Cédula / DNI</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.cedula}
                    onChange={e => setForm(prev => ({ ...prev, cedula: e.target.value }))}
                    required
                    disabled={!!editingUser}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.nombre}
                    onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email <span className="text-muted">(opcional)</span></label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Teléfono <span className="text-muted">(opcional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.telefono}
                    onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value }))}
                  />
                </div>
                {!editingUser && (
                  <div className="mb-3">
                    <label className="form-label">Contraseña</label>
                    <input
                      type="password"
                      className="form-control"
                      value={form.password}
                      onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                    />
                    <small className="text-muted">Mínimo 6 caracteres</small>
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Rol</label>
                  <select
                    className="form-select"
                    value={form.rol}
                    onChange={e => setForm(prev => ({ ...prev, rol: e.target.value }))}
                  >
                    <option value="trabajador">Trabajador</option>
                    <option value="encargado">Encargado</option>
                    <option value="dueno">Dueño</option>
                  </select>
                </div>
                <div className="modal-actions d-flex gap-2 justify-content-end mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    <X size={16} className="me-1" /> Cancelar
                  </button>
                  <button type="submit" className="btn btn-success">
                    <Save size={16} className="me-1" /> Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="h5 mb-0"><Lock size={18} className="me-2" />Cambiar Contraseña</h2>
              <button type="button" className="btn-close" onClick={() => setShowPasswordModal(false)} />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">Usuario: <strong>{editingUser?.nombre}</strong></p>
              <form onSubmit={handlePasswordSubmit}>
                <div className="mb-3">
                  <label className="form-label">Nueva Contraseña</label>
                  <input
                    type="password"
                    className="form-control"
                    value={passwordForm.password}
                    onChange={e => setPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Confirmar Contraseña</label>
                  <input
                    type="password"
                    className="form-control"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
                <div className="modal-actions d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success">
                    <Save size={16} className="me-1" /> Cambiar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
