const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations(markAllApplied = false) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, '../../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (markAllApplied) {
    for (const file of files) {
      await pool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
    }
    return;
  }

  const [applied] = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        // Skip idempotent errors so migrations can be re-run safely
        const skip = [
          'ER_DUP_FIELDNAME',           // column already exists
          'ER_DUP_KEYNAME',             // index/key already exists
          'ER_CANT_DROP_FIELD_OR_KEY',  // DROP INDEX on non-existent index
          'ER_DUP_ENTRY',               // unique constraint on INSERT IGNORE rows
          'ER_KEY_COLUMN_DOES_NOT_EXITS', // index on column that doesn't exist yet
        ];
        if (skip.includes(err.code)) continue;
        throw err;
      }
    }

    await pool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
    console.log(`Migration applied: ${file}`);
  }
}

async function initDatabase() {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'tambos'");
    if (rows.length > 0) {
      console.log('Base de datos ya inicializada, aplicando migraciones pendientes...');
      await runMigrations(false);
      return;
    }

    const sqlPath = path.join(__dirname, '../../database.sql');
    if (!fs.existsSync(sqlPath)) {
      console.warn('No se encontró database.sql — omitiendo init automático');
      return;
    }

    console.log('Inicializando esquema de base de datos...');

    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .replace(/CREATE DATABASE[^;]+;/gi, '')
      .replace(/USE\s+\w+\s*;/gi, '')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await pool.query(stmt);
    }

    console.log('Esquema inicializado correctamente');
    // Mark all migrations as applied since they're included in database.sql
    await runMigrations(true);
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err.message);
    throw err;
  }
}

module.exports = initDatabase;
