import '../styles/footer.css';

export default function Footer() {
  const gmailComposeUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&to=valeencoria28@gmail.com&su=Consulta%20SiCoDiEt';

  return (
    <footer className="login-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <h4>SiCoDiEt</h4>
          <p>Sistema de Consumo Diario del Establecimiento</p>
        </div>
        <div className="footer-contact">
          <h4>Contacto</h4>
          <p><strong>Coria</strong></p>
          <p>+598 091 840 339</p>
          <p>valeencoria28@gmail.com</p>
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
      </div>
    </footer>
  );
}
