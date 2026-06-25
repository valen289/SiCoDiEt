import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';
import { passwordStrength } from '../utils/passwordPolicy';
import '../styles/login.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    document.title = 'Nueva Contraseña - SiCoDiEt';
    if (!token) {
      setError('Token no proporcionado');
      setValidating(false);
    } else {
      setValidating(false);
    }
    return () => { document.title = 'SiCoDiEt'; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!passwordStrength(password)?.valid) {
      return setError('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial');
    }

    if (password !== confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      setSuccess('Contraseña actualizada exitosamente. Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="login-container">
        <div className="login-wrapper">
          <div className="text-center">
            <div className="spinner-border text-success mb-3" role="status"></div>
            <p className="text-muted">Validando enlace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-logo">SiCoDiEt</h1>
            <p className="login-subtitle">Crear nueva contraseña</p>
          </div>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {success && (
            <div className="alert alert-success" role="alert">
              <div className="d-flex align-items-center gap-2">
                <CheckCircle size={18} />
                <span>{success}</span>
              </div>
            </div>
          )}

          {!success && !error && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <Lock size={14} /> Nueva contraseña
                </label>
                <div className="input-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo"
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
                {password && (() => {
                  const strength = passwordStrength(password);
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

              <div className="form-group">
                <label className="form-label">
                  <Lock size={14} /> Confirmar contraseña
                </label>
                <div className="input-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
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
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}

          <div className="login-links">
            <Link to="/login" className="link-back">
              <ArrowLeft size={14} /> Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
