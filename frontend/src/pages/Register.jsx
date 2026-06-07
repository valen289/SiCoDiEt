import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, User, Mail, Phone, Lock } from 'lucide-react';
import '../styles/login.css';

export default function Register() {
  const [form, setForm] = useState({
    nombre: '', apellido: '', cedula: '', email: '', telefono: '', password: '', confirmPassword: '', rol: 'usuario'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }
    setLoading(true);
    try {
      await register({
        nombre: `${form.nombre} ${form.apellido}`,
        cedula: form.cedula,
        email: form.email,
        telefono: form.telefono,
        password: form.password,
        rol: form.rol
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card register-card">
          <div className="login-header">
            <h1 className="login-logo">SiCoDiEt</h1>
            <p className="login-subtitle">Crear nueva cuenta</p>
          </div>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input name="nombre" type="text" className="form-control" value={form.nombre} onChange={handleChange} placeholder="Ej: Juan" required />
              </div>
              <div className="form-group">
                <label className="form-label">Apellido</label>
                <input name="apellido" type="text" className="form-control" value={form.apellido} onChange={handleChange} placeholder="Ej: Perez" required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rol</label>
              <select name="rol" className="form-select" value={form.rol} onChange={handleChange}>
                <option value="usuario">Usuario</option>
                <option value="operario">Operario</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cédula de Identidad</label>
              <input name="cedula" type="text" className="form-control" value={form.cedula} onChange={(e) => setForm({...form, cedula: e.target.value.replace(/[^0-9]/g, '')})} placeholder="Ej: 12345678" inputMode="numeric" required />
            </div>

            <div className="form-group">
              <label className="form-label"><Mail size={14} /> Email</label>
              <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" required />
            </div>

            <div className="form-group">
              <label className="form-label"><Phone size={14} /> Telefono</label>
              <input name="telefono" type="text" className="form-control" value={form.telefono} onChange={handleChange} placeholder="094 231 234" />
            </div>

            <div className="form-group">
              <label className="form-label"><Lock size={14} /> Contraseña</label>
              <div className="input-group">
                <input type={showPassword ? 'text' : 'password'} name="password" className="form-control" value={form.password} onChange={handleChange} required />
                <button type="button" className="btn btn-outline-secondary input-group-text" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label"><Lock size={14} /> Confirmar Contraseña</label>
              <div className="input-group">
                <input type={showPassword ? 'text' : 'password'} name="confirmPassword" className="form-control" value={form.confirmPassword} onChange={handleChange} placeholder="Repita su contraseña" required />
                <button type="button" className="btn btn-outline-secondary input-group-text" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrarse'}
            </button>
          </form>

          <div className="login-links">
            <div className="register-link">
              <span>¿Ya tenés cuenta?</span>
              <Link to="/login">Iniciar sesión</Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="login-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h4>SiCoDiEt</h4>
            <p>Sistema de Control y Distribucion de Alimentos y Tambo</p>
          </div>
          <div className="footer-contact">
            <h4>Contacto</h4>
            <p><strong>Coria</strong></p>
            <p>+598 091 840 339</p>
            <p>valeencoria28@gmail.com</p>
          </div>
          <div className="footer-help">
            <h4>¿Necesitas ayuda?</h4>
            <a href="mailto:valeencoria28@gmail.com" className="btn-link-mail">Escribinos</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 SiCoDiEt. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
