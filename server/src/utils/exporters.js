const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const flatten = row => JSON.parse(JSON.stringify(row));

const toCsv = rows => {
  const data = rows.map(flatten);
  const headers = Array.from(data.reduce((set, row) => {
    Object.keys(row || {}).forEach(k => set.add(k));
    return set;
  }, new Set()));
  const escape = v => {
    if (v == null) return '';
    const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return [headers.join(','), ...data.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
};

const toExcelBuffer = rows => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows.map(flatten));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const toPdfBuffer = rows => new Promise(resolve => {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.fontSize(18).text('CRM Report', { underline: true });
  doc.moveDown();
  rows.map(flatten).forEach((row, index) => {
    doc.fontSize(12).text(`#${index + 1}`);
    Object.entries(row).slice(0, 20).forEach(([key, value]) => {
      doc.fontSize(9).text(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
    doc.moveDown(0.5);
    if (doc.y > 720) doc.addPage();
  });
  doc.end();
});

module.exports = { toCsv, toExcelBuffer, toPdfBuffer };
