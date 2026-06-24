// Railway bloquea el puerto SMTP saliente (25/465/587): cualquier intento de SMTP
// directo (Gmail u otro) termina en ENETUNREACH/ETIMEDOUT sin importar el ajuste de
// IPv4/IPv6. La salida es mandar el email por la API HTTP de Brevo (puerto 443,
// siempre abierto), en vez de hablar SMTP directamente.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_RAW = process.env.EMAIL_FROM || `"SiCoDiEt" <${process.env.EMAIL_USER || ''}>`;

function parseSender(raw) {
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || 'SiCoDiEt', email: match[2].trim() };
  return { name: 'SiCoDiEt', email: raw.trim() };
}

const isEmailConfigured = () => Boolean(process.env.BREVO_API_KEY);

async function enviarEmail({ to, subject, html }) {
  const destinatarios = Array.isArray(to) ? to : [to];

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseSender(FROM_RAW),
      to: destinatarios.map((email) => ({ email })),
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }

  return res.json();
}

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2e7d32; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SiCoDiEt</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Sistema de Control y Distribucion de Alimentos y Establecimiento</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #212529; margin: 0 0 16px; font-size: 20px;">Restablecer contraseña</h2>
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en SiCoDiEt.
        </p>
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #2e7d32; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
            Restablecer contraseña
          </a>
        </div>
        <p style="color: #6c757d; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
          O copia y pega este enlace en tu navegador:
        </p>
        <p style="color: #2e7d32; font-size: 12px; word-break: break-all; margin: 0 0 24px; background: #f8f9fa; padding: 8px 12px; border-radius: 4px;">
          ${resetUrl}
        </p>
        <div style="border-top: 1px solid #e0e0e0; padding-top: 24px; margin-top: 24px;">
          <p style="color: #6c757d; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
            <strong>¿No solicitaste este cambio?</strong>
          </p>
          <p style="color: #6c757d; font-size: 13px; line-height: 1.6; margin: 0;">
            Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu contraseña no sera cambiada.
          </p>
        </div>
      </div>
      <div style="background: #f8f9fa; padding: 16px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #6c757d; font-size: 12px; margin: 0;">© 2026 SiCoDiEt. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return enviarEmail({ to: email, subject: 'Restablecer contraseña - SiCoDiEt', html });
};

const sendStockCriticoEmail = async (destinatarios, { nombreInsumo, diasRestantes, stockActual, unidad }) => {
  const appUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').split(',')[0].trim();
  const subject = `Stock crítico: ${nombreInsumo} - SiCoDiEt`;

  if (!isEmailConfigured()) {
    console.log('[email] BREVO_API_KEY no configurada, no se envía email real. Contenido:');
    console.log(`[email] Para: ${destinatarios} | Asunto: ${subject}`);
    console.log(`[email] ${nombreInsumo}: ${diasRestantes} dias restantes, stock ${stockActual} ${unidad}`);
    return null;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #c0392b; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SiCoDiEt</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Alerta de stock crítico</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #212529; margin: 0 0 16px; font-size: 20px;">${nombreInsumo}</h2>
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Este insumo quedó en estado <strong>CRITICO</strong>: aproximadamente
          <strong>${diasRestantes} días restantes</strong> de stock
          (${Number(stockActual).toFixed(2)} ${unidad} disponibles).
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}/alertas" style="display: inline-block; background: #c0392b; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
            Ver alertas en SiCoDiEt
          </a>
        </div>
      </div>
      <div style="background: #f8f9fa; padding: 16px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #6c757d; font-size: 12px; margin: 0;">© 2026 SiCoDiEt. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return enviarEmail({ to: destinatarios, subject, html });
};

module.exports = { sendPasswordResetEmail, sendStockCriticoEmail, isEmailConfigured };
