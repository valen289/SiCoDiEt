// Verifica que un usuario de un tambo no pueda leer datos de otro tambo, aunque
// adivine el ID. Esto es lo más peligroso de un bug multi-tenant: alcanza con
// olvidar un `AND tambo_id = ?` en un solo endpoint para filtrar datos entre clientes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, crearInsumo, generarToken, pool, app } = require('./helpers/setup');

let ctx;
let tokenA, insumoB;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  const tamboA = await crearTambo('Tambo A');
  const tamboB = await crearTambo('Tambo B');

  const usuarioA = await crearUsuario({ tamboId: tamboA, rol: 'dueno' });
  tokenA = generarToken(usuarioA);

  await crearInsumo({ tamboId: tamboA, nombre: 'Insumo de A' });
  insumoB = await crearInsumo({ tamboId: tamboB, nombre: 'Insumo de B' });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('un usuario no puede leer por ID un insumo de otro tambo', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .get(`/api/insumos/${insumoB.id}`)
    .set('Authorization', `Bearer ${tokenA}`);

  assert.equal(res.status, 404);
});

test('el listado de insumos no incluye insumos de otro tambo', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .get('/api/insumos')
    .set('Authorization', `Bearer ${tokenA}`);

  assert.equal(res.status, 200);
  const nombres = res.body.insumos.map(i => i.nombre);
  assert.ok(nombres.includes('Insumo de A'));
  assert.ok(!nombres.includes('Insumo de B'));
});
