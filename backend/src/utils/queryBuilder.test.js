const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUpdateSet } = require('./queryBuilder');

test('buildUpdateSet omite las claves undefined', () => {
  const { setClause, values, hasUpdates } = buildUpdateSet({ nombre: 'Cebada', tipo_insumo: undefined, activo: undefined });
  assert.equal(setClause, 'nombre = ?');
  assert.deepEqual(values, ['Cebada']);
  assert.equal(hasUpdates, true);
});

test('buildUpdateSet conserva null explicito (limpiar columna)', () => {
  const { setClause, values } = buildUpdateSet({ email: null });
  assert.equal(setClause, 'email = ?');
  assert.deepEqual(values, [null]);
});

test('buildUpdateSet devuelve hasUpdates=false sin campos validos', () => {
  const { setClause, values, hasUpdates } = buildUpdateSet({ nombre: undefined });
  assert.equal(setClause, '');
  assert.deepEqual(values, []);
  assert.equal(hasUpdates, false);
});

test('buildUpdateSet preserva el orden de las claves en el SET', () => {
  const { setClause, values } = buildUpdateSet({ a: 1, b: 2, c: 3 });
  assert.equal(setClause, 'a = ?, b = ?, c = ?');
  assert.deepEqual(values, [1, 2, 3]);
});
