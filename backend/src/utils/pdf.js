const pdfMake = require('pdfmake');
const pool = require('../config/database');

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

pdfMake.setFonts(fonts);
pdfMake.setUrlAccessPolicy(() => false);

async function obtenerDatosTambo(tamboId) {
  const [[tambo]] = await pool.query('SELECT nombre, zona_horaria FROM tambos WHERE id = ?', [tamboId]);
  return {
    nombre: tambo?.nombre || 'Establecimiento',
    zonaHoraria: tambo?.zona_horaria || 'America/Montevideo',
  };
}

// Arma el encabezado comun a todos los reportes: nombre del tambo, titulo del reporte,
// periodo (si aplica) y fecha de generacion (en la zona horaria del tambo).
function buildHeader({ tamboNombre, zonaHoraria, titulo, periodo }) {
  return [
    { text: 'Sicodiet', style: 'marca' },
    { text: tamboNombre, style: 'tambo' },
    { text: titulo, style: 'titulo' },
    {
      text: [
        periodo ? `Periodo: ${periodo}  -  ` : '',
        `Generado: ${new Date().toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short', timeZone: zonaHoraria })}`,
      ].join(''),
      style: 'meta',
    },
    { text: '', margin: [0, 0, 0, 10] },
  ];
}

const styles = {
  marca: { fontSize: 10, bold: true, color: '#5F8A61' },
  tambo: { fontSize: 14, bold: true, margin: [0, 2, 0, 0] },
  titulo: { fontSize: 12, margin: [0, 4, 0, 0] },
  meta: { fontSize: 9, color: '#6B7280', margin: [0, 2, 0, 0] },
  tableHeader: { bold: true, fontSize: 9, color: '#fff', fillColor: '#5F8A61' },
};

// Genera el buffer del PDF a partir de un encabezado + el contenido propio de cada reporte
// (tablas, totales, etc.). Cada ruta de reportes.js solo tiene que armar `content`.
async function generarReportePdf({ tamboId, titulo, periodo, content }) {
  const { nombre: tamboNombre, zonaHoraria } = await obtenerDatosTambo(tamboId);

  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    pageMargins: [40, 40, 40, 40],
    content: [...buildHeader({ tamboNombre, zonaHoraria, titulo, periodo }), ...content],
    styles,
  };

  const doc = pdfMake.createPdf(docDefinition);
  return doc.getBuffer();
}

// Helper para armar una tabla pdfmake con header destacado, dado un array de headers
// y un array de filas (arrays de celdas ya formateadas como string).
function tabla(headers, rows, widths) {
  return {
    table: {
      headerRows: 1,
      widths: widths || headers.map(() => '*'),
      body: [
        headers.map(h => ({ text: h, style: 'tableHeader' })),
        ...rows,
      ],
    },
    layout: {
      fillColor: (rowIndex) => (rowIndex === 0 ? null : rowIndex % 2 === 0 ? '#F5F7F4' : null),
    },
    margin: [0, 0, 0, 10],
  };
}

module.exports = { generarReportePdf, tabla };
