// api/download.js
// Called from the page via GET /api/download?format=excel or ?format=pdf
// Optional date range filter: &from=YYYY-MM-DD&to=YYYY-MM-DD
// Reads saved rows from the database (filtered by date range if given)
// and streams back a file.

const { pool } = require('../lib/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

module.exports = async (req, res) => {
  const format = (req.query.format || 'excel').toLowerCase();
  const from = req.query.from || null;
  const to = req.query.to || null;

  let rows;
  try {
    let query = `SELECT date, symbol, price FROM psx_prices`;
    const params = [];
    const conditions = [];

    if (from) {
      params.push(from);
      conditions.push(`date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`date <= $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY date DESC, id DESC`;

    const result = await pool.query(query, params);
    rows = result.rows;
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not read saved prices: ' + err.message });
  }

  const rangeLabel = from || to ? `${from || 'start'}_to_${to || 'now'}` : 'all';

  // ---------------- PDF ----------------
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="psx-prices-${rangeLabel}.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text('PSX Daily Prices', { align: 'center' });
    if (from || to) {
      doc.fontSize(10).fillColor('#666').text(`Range: ${from || 'start'} to ${to || 'today'}`, { align: 'center' });
      doc.fillColor('#000');
    }
    doc.moveDown();

    const colX = { date: 40, symbol: 180, price: 320 };
    let y = doc.y;

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Date', colX.date, y);
    doc.text('Symbol', colX.symbol, y);
    doc.text('Price (Rs.)', colX.price, y);
    y += 18;
    doc.moveTo(40, y).lineTo(500, y).stroke();
    y += 8;

    doc.font('Helvetica');
    rows.forEach((r) => {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      doc.text(String(r.date).split('T')[0], colX.date, y);
      doc.text(r.symbol, colX.symbol, y);
      doc.text(String(r.price), colX.price, y);
      y += 18;
    });

    doc.end();
    return;
  }

  // ---------------- Excel (default) ----------------
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PSX Prices');
  sheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Symbol', key: 'symbol', width: 15 },
    { header: 'Price', key: 'price', width: 15 },
  ];
  rows.forEach((r) =>
    sheet.addRow({
      date: String(r.date).split('T')[0],
      symbol: r.symbol,
      price: Number(r.price),
    })
  );
  sheet.getRow(1).font = { bold: true };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="psx-prices-${rangeLabel}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
};
