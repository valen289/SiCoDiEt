import { Link } from 'react-router-dom';
import '../styles/footer.css';

export default function Footer() {
  const gmailComposeUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&to=sicodietapp@gmail.com&su=Consulta%20SiCoDiEt';

  return (
    <footer className="login-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <h4>SiCoDiEt</h4>
          <p>Sistema de Consumo Diario del Establecimiento</p>
        </div>
        <div className="footer-contact">
          <h4>Contacto</h4>
          <p><strong>SiCoDiEt</strong></p>
          <p>+598 091 840 339</p>
          <p>sicodietapp@gmail.com</p>
        </div>
        <div className="footer-help">
          <h4>¿Necesitas ayuda?</h4>
          <a
            href={gmailComposeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-link-mail"
          >
            Contactame
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 SiCoDiEt. Todos los derechos reservados.</p>
        <p style={{ marginTop: '0.375rem' }}>
          <Link to="/privacidad" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}
          >
            Política de Privacidad
          </Link>
        </p>
      </div>
    </footer>
  );
}
