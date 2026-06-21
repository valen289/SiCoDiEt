const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"SiCoDiEt" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Restablecer contraseña - SiCoDiEt',
    html: `
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
    `,
  };

  return transporter.sendMail(mailOptions);
};

const sendStockCriticoEmail = async (destinatarios, { nombreInsumo, diasRestantes, stockActual, unidad }) => {
  const appUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').split(',')[0].trim();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"SiCoDiEt" <${process.env.EMAIL_USER}>`,
    to: destinatarios,
    subject: `Stock crítico: ${nombreInsumo} - SiCoDiEt`,
    html: `
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
    `,
  };

  if (!isEmailConfigured()) {
    console.log('[email] EMAIL_USER/EMAIL_PASS no configurados, no se envía email real. Contenido:');
    console.log(`[email] Para: ${destinatarios} | Asunto: ${mailOptions.subject}`);
    console.log(`[email] ${nombreInsumo}: ${diasRestantes} dias restantes, stock ${stockActual} ${unidad}`);
    return null;
  }

  return transporter.sendMail(mailOptions);
};

module.exports = { sendPasswordResetEmail, sendStockCriticoEmail, isEmailConfigured };
