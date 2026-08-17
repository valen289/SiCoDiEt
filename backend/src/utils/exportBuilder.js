const ExcelJS = require('exceljs');

const BOM = String.fromCharCode(0xFEFF);

// CSV con BOM UTF-8 (para que Excel en Windows detecte los acentos correctamente),
// mismo formato que ya se usaba en movimientos.js.
function buildCsv(headers, rows) {
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))];
  return BOM + lines.join('\n');
}

async function buildXlsx(headers, rows, sheetName = 'Datos') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  rows.forEach(row => sheet.addRow(row));
  sheet.columns.forEach(col => { col.width = 18; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  return workbook.xlsx.writeBuffer();
}

async function enviarExport(res, { formato, filename, headers, rows, sheetName }) {
  if (formato === 'xlsx') {
    const buffer = await buildXlsx(headers, rows, sheetName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
    return res.send(Buffer.from(buffer));
  }

  const csv = buildCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
  return res.send(csv);
}

module.exports = { buildCsv, buildXlsx, enviarExport };
