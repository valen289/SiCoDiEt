import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';
import '../styles/landing.css';

export default function PrivacyPolicy() {
  useSEO({
    title: 'Política de Privacidad — SiCoDiEt',
    description: 'Política de privacidad y tratamiento de datos personales de SiCoDiEt, conforme a la Ley 18.331 (Uruguay) y Ley 25.326 (Argentina).',
  });

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">SiCoDiEt</Link>
        <Link to="/login" className="btn btn-outline-secondary btn-sm">Ingresar</Link>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
          Política de Privacidad
        </h1>
        <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
          Última actualización: julio de 2026
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            SiCoDiEt es el responsable del tratamiento de los datos personales recabados a través de esta aplicación.
            Podés contactarnos en <a href="mailto:sicodietapp@gmail.com">sicodietapp@gmail.com</a>.
          </p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p>Al registrarte en SiCoDiEt recopilamos únicamente los datos necesarios para prestarte el servicio:</p>
          <ul>
            <li><strong>Cédula de identidad</strong> — identificador único de usuario.</li>
            <li><strong>Nombre completo</strong> — para identificarte dentro del sistema.</li>
            <li><strong>Correo electrónico</strong> — para notificaciones y recuperación de contraseña.</li>
            <li><strong>Teléfono</strong> — opcional, para contacto.</li>
            <li><strong>Nombre del establecimiento</strong> — para configurar tu espacio en la plataforma.</li>
          </ul>
          <p>No recopilamos ni almacenamos datos de tarjetas de crédito ni instrumentos de pago. Cuando se implemente
          el cobro de suscripciones, el procesamiento de pagos será delegado a proveedores certificados PCI DSS
          (como Stripe o MercadoPago). SiCoDiEt únicamente recibirá un identificador de suscripción, nunca datos sensibles de la tarjeta.</p>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          <p>Los datos se utilizan exclusivamente para:</p>
          <ul>
            <li>Autenticar tu acceso al sistema.</li>
            <li>Permitirte gestionar el stock, consumo y costos de tu establecimiento.</li>
            <li>Enviarte notificaciones de alerta de stock crítico.</li>
            <li>Recuperar tu contraseña ante olvido.</li>
            <li>Gestionar la facturación de la suscripción cuando aplique.</li>
          </ul>
          <p>No compartimos ni vendemos tus datos a terceros con fines comerciales.</p>
        </Section>

        <Section title="4. Base legal">
          <p>
            El tratamiento se realiza con tu consentimiento expreso al momento del registro, conforme a la
            <strong> Ley 18.331 de Protección de Datos Personales</strong> (Uruguay) y su decreto reglamentario,
            y la <strong>Ley 25.326</strong> (Argentina) según corresponda al país de residencia del usuario.
          </p>
        </Section>

        <Section title="5. Almacenamiento y seguridad">
          <p>
            Los datos se almacenan en servidores de Railway (infraestructura en la nube con cifrado en tránsito vía HTTPS).
            Las contraseñas se almacenan con hash bcrypt y nunca en texto plano. Aplicamos control de acceso por roles,
            limitación de intentos de login y auditoría de actividad dentro del sistema.
          </p>
        </Section>

        <Section title="6. Plazo de conservación">
          <p>
            Los datos se conservan mientras la cuenta esté activa. Si solicitás la eliminación de tu cuenta,
            los datos personales se borrarán en un plazo máximo de 30 días hábiles, salvo obligación legal
            de conservación.
          </p>
        </Section>

        <Section title="7. Tus derechos">
          <p>Tenés derecho a:</p>
          <ul>
            <li><strong>Acceder</strong> a los datos personales que tenemos sobre vos.</li>
            <li><strong>Rectificar</strong> datos incorrectos desde tu perfil o por email.</li>
            <li><strong>Eliminar</strong> tu cuenta y todos tus datos asociados.</li>
            <li><strong>Oponerte</strong> al tratamiento en los casos previstos por la ley.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, escribinos a{' '}
            <a href="mailto:sicodietapp@gmail.com">sicodietapp@gmail.com</a>.
          </p>
        </Section>

        <Section title="8. Cambios en esta política">
          <p>
            Podemos actualizar esta política. Te notificaremos por email ante cambios relevantes.
            La fecha de última actualización se indica al comienzo del documento.
          </p>
        </Section>
      </div>

      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-light)', lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}
