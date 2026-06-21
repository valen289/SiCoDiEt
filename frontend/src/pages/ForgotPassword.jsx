import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Footer from '../components/Footer';
import '../styles/login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Recuperar Contraseña - SiCoDiEt';
    return () => { document.title = 'SiCoDiEt'; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess('Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
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
            <p className="login-subtitle">Recuperar contraseña</p>
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

          {!success && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <Mail size={14} /> Correo electrónico
                </label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace'}
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
