import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Key, Eye, EyeOff } from 'lucide-react';
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

export default function Login() {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Iniciar Sesión - SiCoDiEt';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'Inicia sesión en SiCoDiEt, el sistema de control y distribución de alimentos para establecimientos.';
    return () => { document.title = 'SiCoDiEt'; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateCedula(cedula)) {
      return setError('La cédula ingresada no es válida');
    }
    setLoading(true);
    try {
      await login(cedula, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-logo">SiCoDiEt</h1>
            <p className="login-subtitle">Inicia sesión para acceder al sistema</p>
          </div>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                <User size={14} /> Cédula de Identidad
              </label>
              <input
                type="text"
                className="form-control"
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ej: 12345678"
                inputMode="numeric"
                required
              />
              <small className="form-text text-muted">Sin puntos ni guiones, con dígito verificador</small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Lock size={14} /> Contraseña
              </label>
              <div className="input-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary input-group-text"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="login-links">
            <Link to="/forgot-password" className="link-forgot">
              <Key size={14} /> ¿Olvidaste tu contraseña?
            </Link>
            <div className="register-link">
              <span>¿No tenés cuenta?</span>
              <Link to="/register">Registrarse</Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
