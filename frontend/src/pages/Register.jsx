import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Mail, Phone, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import Footer from '../components/Footer';
import '../styles/login.css';

function validateCedula(cedula) {
  const cleaned = cedula.replace(/\D/g, '');
  if (cleaned.length < 6 || cleaned.length > 8) return false;
  const padded = cleaned.padStart(8, '0');
  const digits = padded.split('').map(Number);
  const coefficients = [2, 9, 8, 7, 6, 3, 4];
  const sum = coefficients.reduce((acc, coef, i) => acc + digits[i] * coef, 0);
  const remainder = sum % 10;
  const verifier = remainder === 0 ? 0 : 10 - remainder;
  return verifier === digits[7];
}

const ROL_LABELS = { trabajador: 'Trabajador', encargado: 'Técnico' };

export default function Register() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');

  const [invitacion, setInvitacion] = useState(inviteToken ? 'loading' : null);
  const [tokenError, setTokenError] = useState('');

  const [form, setForm] = useState({
    nombre: '', apellido: '', cedula: '', email: '', telefono: '', password: '', confirmPassword: '', nombre_tambo: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inviteToken) return;
    api.get(`/auth/invitacion/${inviteToken}`)
      .then(res => {
        setInvitacion(res.data.invitacion);
      })
      .catch(() => {
        setInvitacion(null);
        setTokenError('Esta invitación no es válida o ya expiró.');
      });
  }, [inviteToken]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateCedula(form.cedula)) {
      return setError('La cédula ingresada no es válida');
    }
    if (form.password !== form.confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }
    setLoading(true);
    try {
      const payload = {
        nombre: `${form.nombre} ${form.apellido}`,
        cedula: form.cedula,
        email: form.email,
        telefono: form.telefono,
        password: form.password,
      };
      if (inviteToken) {
        payload.invitation_token = inviteToken;
      } else {
        payload.nombre_tambo = form.nombre_tambo;
      }

      await register(payload);
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.errors?.[0]?.msg || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  if (inviteToken && invitacion === 'loading') {
    return (
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner-border text-success mb-3" role="status" />
            <p className="text-muted">Validando invitación...</p>
          </div>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <AlertCircle size={48} color="var(--danger)" className="mb-3" />
            <h2 className="h5 mb-2">Invitación inválida</h2>
            <p className="text-muted">{tokenError}</p>
            <Link to="/login" className="btn btn-outline-secondary mt-3">Ir al inicio de sesión</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card register-card">
          <div className="login-header">
            <h1 className="login-logo">SiCoDiEt</h1>
            <p className="login-subtitle">Crear nueva cuenta</p>
          </div>

          {invitacion && typeof invitacion === 'object' && (
            <div className="alert alert-success d-flex align-items-center gap-2 mb-3" role="alert">
              <CheckCircle size={18} />
              <span>
                Invitado al establecimiento <strong>{invitacion.tambo_nombre}</strong> como{' '}
                <strong>{ROL_LABELS[invitacion.rol] || invitacion.rol}</strong>
              </span>
            </div>
          )}

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

            {!inviteToken && (
              <div className="form-group">
                <label className="form-label">Nombre de tu establecimiento</label>
                <input
                  name="nombre_tambo"
                  type="text"
                  className="form-control"
                  value={form.nombre_tambo}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Cédula de Identidad</label>
              <input name="cedula" type="text" className="form-control" value={form.cedula} onChange={(e) => setForm({...form, cedula: e.target.value.replace(/[^0-9]/g, '').slice(0, 8)})} placeholder="Ej: 12345678" inputMode="numeric" required />
            </div>

            <div className="form-group">
              <label className="form-label"><Mail size={14} /> Email</label>
              <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" required />
            </div>

            <div className="form-group">
              <label className="form-label"><Phone size={14} /> Teléfono</label>
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

      <Footer />
    </div>
  );
}
