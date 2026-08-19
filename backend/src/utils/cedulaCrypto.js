const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

// La cédula se busca por igualdad (login, unicidad al registrar) pero AES-GCM usa un
// IV al azar en cada cifrado, así que dos cédulas iguales nunca dan el mismo texto
// cifrado -- no sirve para un WHERE. Por eso se guarda además un HMAC determinístico
// (mismo texto plano -> mismo hash siempre) en `cedula_hash`, que es lo que se usa
// para buscar; `cedula` pasa a guardar el valor cifrado, solo para mostrarlo.
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY no configurada');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser una clave de 32 bytes en hex (64 caracteres)');
  }
  return buf;
}

function getHashKey() {
  const key = process.env.CEDULA_HASH_KEY;
  if (!key) {
    throw new Error('CEDULA_HASH_KEY no configurada');
  }
  return key;
}

function encryptCedula(plain) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptCedula(payload) {
  const key = getEncryptionKey();
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function hashCedula(plain) {
  return crypto.createHmac('sha256', getHashKey()).update(String(plain)).digest('hex');
}

module.exports = { encryptCedula, decryptCedula, hashCedula };
