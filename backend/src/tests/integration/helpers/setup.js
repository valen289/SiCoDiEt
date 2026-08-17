// Helper compartido por los tests de integración. Apunta a la DB de test levantada
// con `docker compose -f backend/docker-compose.test.yml up -d` (ver ese archivo).
// Las variables de entorno deben quedar seteadas ANTES de requerir server.js/config/
// database.js (que crean el pool de conexión al cargarse), por eso van al tope del
// archivo, antes de cualquier otro require de la app.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '3307';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'testroot';
process.env.DB_NAME = process.env.DB_NAME || 'gestion_tambo_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_do_not_use_in_prod';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
// BREVO_API_KEY queda sin definir a propósito: los emails "se envían" en modo
// no-op (solo console.log), igual que en cualquier entorno de dev sin Brevo.

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../../../config/database');
const app = require('../../../server');
const initDatabase = require('../../../scripts/initDb');

let cached = null;

// Corre una vez por proceso de test: verifica que la DB de test responda y le
// aplica el esquema + migraciones (initDb ya sabe hacer esto de forma idempotente,
// es lo mismo que corre el servidor real al arrancar). Si la DB no está disponible
// (docker-compose.test.yml no está levantado), devuelve available:false para que
// cada test se salte en vez de fallar -- así "npm test" sigue siendo hermético
// sin depender de que haya Docker corriendo.
async function getSetup() {
  if (cached) return cached;
  try {
    const conn = await pool.getConnection();
    conn.release();
    await initDatabase();
    cached = { available: true };
  } catch (err) {
    console.warn(
      `[tests] DB de test no disponible (${err.message}). Se saltean los tests de integración.\n` +
      '[tests] Para correrlos: docker compose -f backend/docker-compose.test.yml up -d && npm run test:integration'
    );
    cached = { available: false };
  }
  return cached;
}

// Cada test file crea su propio tambo con datos únicos (cédulas al azar) y solo
// opera sobre lo que él mismo creó -- así varios archivos de test pueden compartir
// la misma DB sin pisarse, sin necesitar un TRUNCATE global entre archivos.
async function crearTambo(nombre = 'Tambo Test') {
  const [result] = await pool.query('INSERT INTO tambos (nombre) VALUES (?)', [nombre]);
  return result.insertId;
}

function cedulaAlAzar() {
  return String(Math.floor(10000000 + Math.random() * 89999999));
}

async function crearUsuario({ tamboId, rol = 'dueno', cedula, email = null, password = 'Password1!', nombre }) {
  const hashed = await bcrypt.hash(password, 4); // costo bajo: son tests, no producción
  const cedulaFinal = cedula || cedulaAlAzar();
  const [result] = await pool.query(
    'INSERT INTO usuarios (tambo_id, cedula, nombre, password, email, rol) VALUES (?, ?, ?, ?, ?, ?)',
    [tamboId, cedulaFinal, nombre || `Usuario ${rol}`, hashed, email, rol]
  );
  return { id: result.insertId, cedula: cedulaFinal, tambo_id: tamboId, rol, password, nombre: nombre || `Usuario ${rol}` };
}

// Firma un JWT con la misma forma que emitirSesion() en auth.js, sin pasar por
// login/2FA -- para tests que solo necesitan un request autenticado y no están
// probando el login en sí (ese caso lo cubre two-factor.test.js aparte).
function generarToken(usuario, tokenVersion = 1) {
  return jwt.sign(
    {
      id: usuario.id,
      cedula: usuario.cedula,
      nombre: usuario.nombre || 'Test',
      rol: usuario.rol,
      tambo_id: usuario.tambo_id,
      token_version: tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function crearInsumo({ tamboId, nombre = 'Fardo Test', tipoInsumo = 'fardo', unidad = 'unidades', stockActual = 100, capacidadMaxima = 1000, stockMinimo = 10 }) {
  const [result] = await pool.query(
    'INSERT INTO insumos (tambo_id, nombre, tipo_insumo, unidad, stock_actual, capacidad_maxima, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [tamboId, nombre, tipoInsumo, unidad, stockActual, capacidadMaxima, stockMinimo]
  );
  return { id: result.insertId, tambo_id: tamboId, nombre, unidad, stock_actual: stockActual, capacidad_maxima: capacidadMaxima };
}

async function crearLote({ tamboId, nombre = 'Lote Test', cantidadAnimales = 10 }) {
  const [result] = await pool.query(
    'INSERT INTO lotes (tambo_id, nombre, tipo_animal, cantidad_animales) VALUES (?, ?, ?, ?)',
    [tamboId, nombre, 'Vaca lechera', cantidadAnimales]
  );
  return { id: result.insertId, tambo_id: tamboId, nombre, cantidad_animales: cantidadAnimales };
}

module.exports = {
  getSetup,
  crearTambo,
  crearUsuario,
  crearInsumo,
  crearLote,
  cedulaAlAzar,
  generarToken,
  pool,
  app,
};
