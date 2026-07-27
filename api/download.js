// api/download.js
// Called from the page via GET /api/download?format=excel or ?format=pdf
// Optional date range filter: &from=YYYY-MM-DD&to=YYYY-MM-DD
// Reads saved rows from the database (filtered by date range if given)
// and streams back a file, arranged to match the Stocks page's
// current order — same sector grouping and stock order as
// lib/stock-order.js computes for stocks.html — with a Category
// column showing each stock's sector. A symbol no longer tracked on
// the Stocks page (but still with saved history) is grouped at the
// end, alphabetically, with a blank category.

const { pool, ensureSchema } = require('../lib/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { getOrderedStocks } = require('../lib/stock-order');
const { labelFor } = require('../lib/sector-labels');

// pg returns DATE columns as JS Date objects (midnight UTC), not
// strings — String(date) calls Date.prototype.toString(), which has
// no "T" to split on and instead prints the full verbose form
// ("Mon Jul 27 2026 00:00:00 GMT+0000 (Coordinated Universal Time)").
// Format explicitly instead, whether the driver hands back a Date or
// an already-formatted string.
function formatDate(value) {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
}

module.exports = async (req, res) => {
  const format = (req.query.format || 'excel').toLowerCase();
  const from = req.query.from || null;
  const to = req.query.to || null;

  let rows;
  try {
    await ensureSchema();

    let query = `SELECT date, symbol, price_low, price_high FROM psx_prices`;
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

    const result = await pool.query(query, params);
    rows = result.rows;
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not read saved prices: ' + err.message });
  }

  // Arrange to match the Stocks page's current order: sector group
  // order, then each stock's position within it. Symbols not tracked
  // there anymore go last, alphabetically.
  let rank = new Map();
  let sectorBySymbol = new Map();
  try {
    const { rows: stockRows } = await getOrderedStocks();
    stockRows.forEach((r, i) => rank.set(r.symbol, i));
    sectorBySymbol = new Map(stockRows.map((r) => [r.symbol, r.sector]));
  } catch (err) {
    console.error('Could not load stock order for download:', err);
  }
  const rankOf = (symbol) => (rank.has(symbol) ? rank.get(symbol) : Infinity);
  const categoryFor = (symbol) => {
    const sector = sectorBySymbol.get(symbol);
    return sector ? labelFor(sector) : '—';
  };

  rows.sort((a, b) => {
    // Compare ranks directly rather than subtracting first — both can
    // be Infinity (two symbols untracked on the Stocks page), and
    // Infinity - Infinity is NaN, which would silently break the
    // alphabetical fallback below.
    const ra = rankOf(a.symbol);
    const rb = rankOf(b.symbol);
    if (ra !== rb) return ra - rb;
    if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
    return new Date(b.date) - new Date(a.date); // newest first within a symbol
  });

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

    const colX = { date: 40, category: 130, symbol: 240, low: 330, high: 420 };
    let y = doc.y;

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Date', colX.date, y);
    doc.text('Category', colX.category, y);
    doc.text('Symbol', colX.symbol, y);
    doc.text('Low (Rs.)', colX.low, y);
    doc.text('High (Rs.)', colX.high, y);
    y += 18;
    doc.moveTo(40, y).lineTo(510, y).stroke();
    y += 8;

    doc.font('Helvetica');
    rows.forEach((r) => {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      doc.text(formatDate(r.date), colX.date, y);
      doc.text(categoryFor(r.symbol), colX.category, y);
      doc.text(r.symbol, colX.symbol, y);
      doc.text(String(r.price_low), colX.low, y);
      doc.text(r.price_high != null ? String(r.price_high) : '—', colX.high, y);
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
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Symbol', key: 'symbol', width: 15 },
    { header: 'Low', key: 'low', width: 15 },
    { header: 'High', key: 'high', width: 15 },
  ];
  rows.forEach((r) =>
    sheet.addRow({
      date: formatDate(r.date),
      category: categoryFor(r.symbol),
      symbol: r.symbol,
      low: Number(r.price_low),
      high: r.price_high != null ? Number(r.price_high) : null,
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
