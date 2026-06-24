const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularDiasRestantes,
  getNivelAlerta,
  calcularConsumoEstimado,
  calcularConsumoFormulado,
  calcularConsumoConOrigen,
} = require('./alertas');

test('calcularDiasRestantes divide stock por consumo estimado', async () => {
  assert.equal(await calcularDiasRestantes(900, 180), 5);
  assert.equal(await calcularDiasRestantes(842.5, 135), 6);
});

test('calcularDiasRestantes devuelve 999 sin consumo estimado', async () => {
  assert.equal(await calcularDiasRestantes(900, 0), 999);
  assert.equal(await calcularDiasRestantes(900, null), 999);
});

test('getNivelAlerta respeta los umbrales de severidad', () => {
  assert.equal(getNivelAlerta(5).label, 'CRITICO');
  assert.equal(getNivelAlerta(7).label, 'PRECAUCION');
  assert.equal(getNivelAlerta(20).label, 'NORMAL');
  assert.equal(getNivelAlerta(21).label, 'HOLGADO');
});

test('calcularConsumoEstimado usa los dias reales con datos, con tope en el tamano de la ventana', async () => {
  // Un tambo con pocos dias de historial (3 dias con registros) no debe diluirse de mas
  // dividiendo por el tamano de la ventana de 30 dias.
  const executor = async () => [[{ total: 270, dias: 3 }]];
  const consumo = await calcularConsumoEstimado(1, executor);
  // avg3d=270/min(3,3)=90, avg7d=270/min(3,7)=90, avg30d=270/min(3,30)=90 -> ponderado = 90
  assert.equal(consumo, 90);
});

test('calcularConsumoEstimado no cuenta dias sin registros (ventana vacia = sin datos)', async () => {
  const executor = async () => [[{ total: 0, dias: 0 }]];
  const consumo = await calcularConsumoEstimado(1, executor);
  assert.equal(consumo, 0);
});

test('calcularConsumoFormulado multiplica kg/vaca/dia por la cantidad de animales del lote', async () => {
  const executor = async () => [[{ cantidad_kg: '2.00', cantidad_animales: 90 }]];
  const consumo = await calcularConsumoFormulado(1, executor);
  assert.equal(consumo, 180);
});

test('calcularConsumoConOrigen usa el formulado cuando el historico es escaso (regresion bug Cebada)', async () => {
  // Caso real: un unico registro de consumo (90kg, turno AM) vs una dieta activa que formula
  // 2kg/vaca/dia para 90 animales (180kg/dia). El historico diluido (~19.5) no debe ganarle
  // al consumo real garantizado por la dieta activa.
  const executor = async (sql) => {
    if (sql.includes('dieta_ingredientes')) {
      return [[{ cantidad_kg: '2.00', cantidad_animales: 90 }]];
    }
    return [[{ total: 90, dias: 1 }]];
  };
  const { consumo, origen } = await calcularConsumoConOrigen(1, executor);
  assert.equal(origen, 'formulado');
  assert.equal(consumo, 180);
});

test('calcularConsumoConOrigen usa el historico cuando supera al formulado (desperdicio/sobras reales)', async () => {
  const executor = async (sql) => {
    if (sql.includes('dieta_ingredientes')) {
      return [[{ cantidad_kg: '1.00', cantidad_animales: 90 }]]; // formulado = 90/dia
    }
    return [[{ total: 2700, dias: 10 }]]; // 10 dias reales de consumo, bien por encima de lo formulado
  };
  const { consumo, origen } = await calcularConsumoConOrigen(1, executor);
  assert.equal(origen, 'historico');
  assert.ok(consumo > 90, `esperaba que el historico (mas conservador) ganara, obtuvo ${consumo}`);
});

test('calcularConsumoConOrigen devuelve sin_datos cuando no hay historico ni dieta activa', async () => {
  const executor = async (sql) => (sql.includes('dieta_ingredientes') ? [[]] : [[{ total: 0, dias: 0 }]]);
  const { consumo, origen } = await calcularConsumoConOrigen(1, executor);
  assert.equal(consumo, 0);
  assert.equal(origen, 'sin_datos');
});
