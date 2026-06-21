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

async function obtenerNombreTambo(tamboId) {
  const [[tambo]] = await pool.query('SELECT nombre FROM tambos WHERE id = ?', [tamboId]);
  return tambo?.nombre || 'Establecimiento';
}

// Arma el encabezado comun a todos los reportes: nombre del tambo, titulo del reporte,
// periodo (si aplica) y fecha de generacion.
function buildHeader({ tamboNombre, titulo, periodo }) {
  return [
    { text: 'SiCoDiEt', style: 'marca' },
    { text: tamboNombre, style: 'tambo' },
    { text: titulo, style: 'titulo' },
    {
      text: [
        periodo ? `Periodo: ${periodo}  -  ` : '',
        `Generado: ${new Date().toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })}`,
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
  const tamboNombre = await obtenerNombreTambo(tamboId);

  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    pageMargins: [40, 40, 40, 40],
    content: [...buildHeader({ tamboNombre, titulo, periodo }), ...content],
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
