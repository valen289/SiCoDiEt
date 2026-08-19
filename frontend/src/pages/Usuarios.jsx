import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useSEO } from '../hooks/useSEO';
import { Users, Plus, Edit2, UserCheck, UserX, Lock, Save, X, Mail, Phone, Hash, Copy, QrCode, Eye, EyeOff, Clock, Ban, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import PhoneInputField from '../components/PhoneInputField';
import PasswordRulesHint from '../components/PasswordRulesHint';
import { passwordStrength } from '../utils/passwordPolicy';
import '../styles/usuarios.css';

const ROL_CONFIG = {
  dueno:      { label: 'Administrador', class: 'badge-danger' },
  encargado:  { label: 'Técnico',       class: 'badge-primary' },
  trabajador: { label: 'Operario',      class: 'badge-success' },
};

export default function Usuarios() {
  const { success, error, confirm } = useAlert();
  useSEO({ title: 'Gestión de Usuarios', description: 'Administración de usuarios del establecimiento.' });
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
  const [verPassword, setVerPassword] = useState(false);
  const [filter, setFilter] = useState('todos');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRol, setInviteRol] = useState('trabajador');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [invitaciones, setInvitaciones] = useState([]);
  const [showInvitaciones, setShowInvitaciones] = useState(false);
  const [loadingInvitaciones, setLoadingInvitaciones] = useState(false);

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
    if (!editingUser && !passwordStrength(form.password)?.valid) {
      error('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial');
      return;
    }
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
    setVerPassword(false);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordStrength(passwordForm.password)?.valid) {
      error('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial');
      return;
    }
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

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await api.post('/usuarios/invitacion', { rol: inviteRol, email: inviteEmail || undefined });
      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const link = `${baseUrl}/register?token=${res.data.token}`;
      setInviteResult({ link, expira: res.data.expira, emailEnviado: res.data.emailEnviado, email: inviteEmail });
      if (res.data.emailEnviado) success(`Invitación enviada a ${inviteEmail}`);
      loadInvitaciones();
    } catch (err) {
      error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al crear invitación');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteResult.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCloseInvite = () => {
    setShowInviteModal(false);
    setInviteResult(null);
    setInviteRol('trabajador');
    setInviteEmail('');
    setCopied(false);
  };

  const loadInvitaciones = useCallback(async () => {
    try {
      setLoadingInvitaciones(true);
      const res = await api.get('/usuarios/invitaciones');
      setInvitaciones(res.data.invitaciones || []);
    } catch (err) {
      console.error('Error cargando invitaciones:', err);
    } finally {
      setLoadingInvitaciones(false);
    }
  }, []);

  useEffect(() => { loadInvitaciones(); }, [loadInvitaciones]);

  const handleRevocarInvitacion = async (invitacion) => {
    const confirmed = await confirm({
      title: 'Revocar invitación',
      message: `¿Revocar la invitación${invitacion.email ? ` a "${invitacion.email}"` : ''} (${ROL_CONFIG[invitacion.rol]?.label || invitacion.rol})?`,
      type: 'warning',
      confirmText: 'Sí, revocar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/usuarios/invitaciones/${invitacion.id}`);
      success('Invitación revocada');
      loadInvitaciones();
    } catch (err) {
      error(err.response?.data?.error || 'Error al revocar invitación');
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
          <p className="text-muted small mb-0">Administra los usuarios del establecimiento</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={() => setShowInvitaciones(v => !v)}
          >
            <Clock size={18} /> Invitaciones {invitaciones.length > 0 && `(${invitaciones.length})`}
          </button>
          <button
            className="btn btn-outline-success d-flex align-items-center gap-2"
            onClick={() => setShowInviteModal(true)}
          >
            <QrCode size={18} /> Invitar
          </button>
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

      {showInvitaciones && (
        <div className="card mb-4">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0 d-flex align-items-center gap-2"><Clock size={16} />Invitaciones pendientes</h6>
            <button className="btn btn-sm btn-light" onClick={() => setShowInvitaciones(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="card-body">
            {loadingInvitaciones ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-success" role="status" />
              </div>
            ) : invitaciones.length === 0 ? (
              <p className="text-muted text-center py-2 mb-0">No hay invitaciones pendientes</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Creada</th>
                      <th>Expira</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitaciones.map(inv => (
                      <tr key={inv.id}>
                        <td>{inv.email || <span className="text-muted">Sin email (solo link/QR)</span>}</td>
                        <td>{getRolBadge(inv.rol)}</td>
                        <td className="text-muted small">{new Date(inv.fecha_creacion).toLocaleDateString('es-AR')}</td>
                        <td className="text-muted small">{new Date(inv.fecha_expiracion).toLocaleDateString('es-AR')}</td>
                        <td>
                          {inv.expirada
                            ? <span className="badge badge-secondary">Vencida</span>
                            : <span className="badge badge-success">Pendiente</span>
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                            onClick={() => handleRevocarInvitacion(inv)}
                            title="Revocar"
                          >
                            <Ban size={13} /> Revocar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="usuarios-grid">
        {filteredUsuarios.map(usuario => (
          <div key={usuario.id} className={`usuario-card ${!usuario.activo ? 'inactive' : ''}`}>
            <div className="usuario-header">
              <div className="usuario-avatar">
                <span className="avatar-letter">{usuario.nombre.charAt(0).toUpperCase()}</span>
              </div>
              <div className="usuario-actions">
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

            <div className="usuario-body">
              <h3 className="usuario-name">{usuario.nombre}</h3>
              <div className="usuario-meta">
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
                    onChange={e => setForm(prev => ({ ...prev, cedula: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) }))}
                    inputMode="numeric"
                    maxLength={8}
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
                  <PhoneInputField
                    value={form.telefono}
                    onChange={(value) => setForm(prev => ({ ...prev, telefono: value || '' }))}
                  />
                </div>
                {!editingUser && (
                  <div className="mb-3">
                    <label className="form-label">Contraseña</label>
                    <div className="input-group">
                      <input
                        type={verPassword ? 'text' : 'password'}
                        className="form-control"
                        value={form.password}
                        onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setVerPassword(v => !v)}>
                        {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <PasswordRulesHint />
                    {form.password && (() => {
                      const strength = passwordStrength(form.password);
                      return strength && (
                        <div className="password-strength">
                          <div className={`password-strength__bar password-strength__bar--${strength.level}`} />
                          <span className={`password-strength__label password-strength__label--${strength.level}`}>
                            {strength.label}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Rol</label>
                  <select
                    className="form-select"
                    value={form.rol}
                    onChange={e => setForm(prev => ({ ...prev, rol: e.target.value }))}
                  >
                    <option value="trabajador">Operario</option>
                    <option value="encargado">Técnico</option>
                    <option value="dueno">Administrador</option>
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

      {/* Modal Invitación */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={handleCloseInvite}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="h5 mb-0 d-flex align-items-center gap-2"><QrCode size={18} /> Invitar operario</h2>
              <button type="button" className="btn-close" onClick={handleCloseInvite} />
            </div>
            <div className="modal-body">
              {!inviteResult ? (
                <>
                  <p className="text-muted small mb-3">
                    Generá un link de invitación. Si cargás el email, se lo mandamos directamente;
                    de todas formas siempre podés compartir el link o el QR a mano.
                  </p>
                  <div className="mb-3">
                    <label className="form-label">Email <span className="text-muted">(opcional)</span></label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="operario@ejemplo.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rol que tendrá</label>
                    <select
                      className="form-select"
                      value={inviteRol}
                      onChange={e => setInviteRol(e.target.value)}
                    >
                      <option value="trabajador">Operario</option>
                      <option value="encargado">Técnico</option>
                    </select>
                  </div>
                  <div className="d-flex gap-2 justify-content-end mt-4">
                    <button className="btn btn-secondary" onClick={handleCloseInvite}>Cancelar</button>
                    <button className="btn btn-success d-flex align-items-center gap-2" onClick={handleCreateInvite} disabled={inviteLoading}>
                      {inviteEmail ? <Send size={16} /> : <QrCode size={16} />}
                      {inviteLoading ? 'Generando...' : inviteEmail ? 'Enviar invitación' : 'Generar link'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted small mb-3">
                    Este link expira en <strong>7 días</strong>. Compartilo o mostrá el QR al operario.
                  </p>
                  {inviteResult.email && (
                    <div className={`alert ${inviteResult.emailEnviado ? 'alert-success' : 'alert-warning'} py-2 small`}>
                      {inviteResult.emailEnviado
                        ? `Se envió el link por email a ${inviteResult.email}.`
                        : `No se pudo enviar el email a ${inviteResult.email}. Compartí el link o el QR manualmente.`
                      }
                    </div>
                  )}
                  <div className="text-center mb-3">
                    <div
                      className="d-inline-block p-2"
                      style={{ borderRadius: 8, border: '1px solid var(--border)' }}
                    >
                      <QRCodeSVG value={inviteResult.link} size={200} />
                    </div>
                  </div>
                  <div className="input-group mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={inviteResult.link}
                      readOnly
                    />
                    <button className="btn btn-outline-secondary btn-sm" onClick={handleCopy}>
                      <Copy size={14} className="me-1" />
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="d-flex justify-content-end mt-4">
                    <button className="btn btn-success" onClick={handleCloseInvite}>Listo</button>
                  </div>
                </>
              )}
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
                  <div className="input-group">
                    <input
                      type={verPassword ? 'text' : 'password'}
                      className="form-control"
                      value={passwordForm.password}
                      onChange={e => setPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      autoFocus
                    />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setVerPassword(v => !v)}>
                      {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <PasswordRulesHint />
                  {passwordForm.password && (() => {
                    const strength = passwordStrength(passwordForm.password);
                    return strength && (
                      <div className="password-strength">
                        <div className={`password-strength__bar password-strength__bar--${strength.level}`} />
                        <span className={`password-strength__label password-strength__label--${strength.level}`}>
                          {strength.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="mb-3">
                  <label className="form-label">Confirmar Contraseña</label>
                  <div className="input-group">
                    <input
                      type={verPassword ? 'text' : 'password'}
                      className="form-control"
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setVerPassword(v => !v)}>
                      {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
