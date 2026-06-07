import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Key, Eye, EyeOff } from 'lucide-react';
import '../styles/login.css';

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
    metaDesc.content = 'Inicia sesión en SiCoDiEt, el sistema de control y distribución de alimentos para tambos.';
    return () => { document.title = 'SiCoDiEt'; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(cedula, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesion');
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
            <a href="mailto:valeencoria28@gmail.com" className="btn-link-mail">
              Escribinos
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 SiCoDiEt. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
