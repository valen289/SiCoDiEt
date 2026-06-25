// Debe coincidir con PASSWORD_REGEX del backend (backend/src/utils/passwordPolicy.js):
// minimo 8 caracteres, mayuscula, minuscula, numero y caracter especial.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function passwordStrength(password) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 3) return { label: 'Débil', level: 'weak', valid: false };
  if (score === 4) return { label: 'Media', level: 'medium', valid: false };
  return { label: 'Segura', level: 'strong', valid: true };
}
