const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Sin TURNSTILE_SECRET_KEY (dev local, tests) se deja pasar sin verificar -- el
// widget del frontend tampoco se renderiza sin VITE_TURNSTILE_SITE_KEY, asi que
// ambos lados quedan deshabilitados juntos fuera de donde se cargaron las keys.
async function verifyTurnstile(token, remoteIp) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    return true;
  }
  if (!token) {
    return false;
  }

  const params = new URLSearchParams();
  params.append('secret', process.env.TURNSTILE_SECRET_KEY);
  params.append('response', token);
  if (remoteIp) {
    params.append('remoteip', remoteIp);
  }

  try {
    const response = await fetch(VERIFY_URL, { method: 'POST', body: params });
    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error('Error verificando Turnstile:', err.message);
    return false;
  }
}

module.exports = { verifyTurnstile };
