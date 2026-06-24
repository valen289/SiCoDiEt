// Calculo de costos y aporte nutricional de los ingredientes de una dieta.
// cantidad_kg de cada ingrediente viene expresada por vaca/dia (ver formulario de Dietas),
// asi que costoTotal resultante ya es el costo por vaca/dia, no el costo total del lote.
async function calcularCostosIngredientes(ingredientes, executor) {
  let costoTotal = 0;
  let materiaSecaTotal = 0;
  let energiaTotal = 0;
  let proteinaTotal = 0;
  let fibraTotal = 0;
  let cantidadTotalKg = 0;
  const detalle = [];

  for (const ing of ingredientes) {
    const insumoId = parseInt(ing.insumo_id);
    const cantidadKg = parseFloat(ing.cantidad_kg) || 0;
    if (!insumoId || cantidadKg <= 0) continue;

    const [params] = await executor('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [insumoId]);
    const [costos] = await executor('SELECT precio_por_kg FROM costos_ingredientes WHERE insumo_id = ?', [insumoId]);

    const param = params[0] || { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };
    const precioPorKg = parseFloat(costos[0]?.precio_por_kg) || 0;

    const costoParcial = cantidadKg * precioPorKg;
    const msAportada = cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100);
    const energiaAportada = cantidadKg * parseFloat(param.energia_mcal_por_kg);
    const proteinaAportada = cantidadKg * (parseFloat(param.proteina_porcentaje) / 100);
    const fibraAportada = cantidadKg * (parseFloat(param.fibra_porcentaje) / 100);

    costoTotal += costoParcial;
    materiaSecaTotal += msAportada;
    energiaTotal += energiaAportada;
    proteinaTotal += proteinaAportada;
    fibraTotal += fibraAportada;
    cantidadTotalKg += cantidadKg;

    detalle.push({
      insumoId,
      cantidadKg,
      precioPorKg,
      costoParcial,
      msAportada,
      energiaAportada,
      proteinaAportada,
      fibraAportada,
      porcentajeAm: Math.min(100, Math.max(0, parseFloat(ing.porcentaje_am ?? 50))),
    });
  }

  return { costoTotal, materiaSecaTotal, energiaTotal, proteinaTotal, fibraTotal, cantidadTotalKg, detalle };
}

// Resumen economico de la dieta (costo por vaca, por litro o por kg ganado, margenes, etc).
// costoTotal ya es el costo por vaca/dia (ver calcularCostosIngredientes); cantAnimales solo
// se usa para informar el costo del lote completo, nunca para recalcular el costo por vaca.
function calcularResumenEconomico({
  costoTotal,
  cantAnimales,
  objetivoProductivo,
  produccionLecheEsperada,
  precioLechePorLitro,
  gananciaKgEsperada,
  precioKgEnPie,
}) {
  const costoPorVaca = costoTotal;
  const costoTotalLote = costoTotal * (parseInt(cantAnimales) || 1);

  let prodLeche = 0, precioLeche = 0, costoPorLitro = 0, margenPorLitro = 0;
  let gananciaKg = 0, precioKg = 0, costoPorKgGanado = 0, margenPorKgGanado = 0;
  let ingresoPorVaca = 0;

  if (objetivoProductivo === 'leche') {
    prodLeche = parseFloat(produccionLecheEsperada) || 0;
    precioLeche = parseFloat(precioLechePorLitro) || 0;
    ingresoPorVaca = prodLeche * precioLeche;
    costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
    margenPorLitro = prodLeche > 0 ? (ingresoPorVaca - costoPorVaca) / prodLeche : 0;
  } else {
    gananciaKg = parseFloat(gananciaKgEsperada) || 0;
    precioKg = parseFloat(precioKgEnPie) || 0;
    ingresoPorVaca = gananciaKg * precioKg;
    costoPorKgGanado = gananciaKg > 0 ? costoPorVaca / gananciaKg : 0;
    margenPorKgGanado = gananciaKg > 0 ? (ingresoPorVaca - costoPorVaca) / gananciaKg : 0;
  }

  const margenAlimenticio = ingresoPorVaca - costoPorVaca;
  const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

  return {
    costoPorVaca,
    costoTotalLote,
    prodLeche,
    precioLeche,
    costoPorLitro,
    margenPorLitro,
    gananciaKg,
    precioKg,
    costoPorKgGanado,
    margenPorKgGanado,
    ingresoPorVaca,
    margenAlimenticio,
    porcentajeGasto,
  };
}

module.exports = { calcularCostosIngredientes, calcularResumenEconomico };
