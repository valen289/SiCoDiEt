const pool = require('../config/database');
const { encryptCedula, hashCedula } = require('../utils/cedulaCrypto');

// Corre en cada arranque del server, igual que las migraciones (initDb.js) -- es
// idempotente: solo toca las filas que todavia tienen `cedula_hash` NULL, que son
// las que quedaron con la cedula vieja en texto plano (antes de la migracion 028).
// Una fila creada despues de la migracion ya nace con cedula_hash seteado, asi que
// nunca vuelve a aparecer en este SELECT.
async function backfillCedulaEncryption() {
  if (!process.env.ENCRYPTION_KEY || !process.env.CEDULA_HASH_KEY) {
    console.warn('ENCRYPTION_KEY/CEDULA_HASH_KEY no configuradas -- se omite el cifrado de cedulas existentes');
    return;
  }

  const [rows] = await pool.query('SELECT id, cedula FROM usuarios WHERE cedula_hash IS NULL');
  for (const row of rows) {
    await pool.query(
      'UPDATE usuarios SET cedula = ?, cedula_hash = ? WHERE id = ?',
      [encryptCedula(row.cedula), hashCedula(row.cedula), row.id]
    );
  }

  if (rows.length > 0) {
    console.log(`Cedulas cifradas: ${rows.length} usuario(s)`);
  }
}

module.exports = backfillCedulaEncryption;
