// api/admin-stocks.js
// Admin-only management of the Top Stocks list, requires the
// 'x-admin-token' header (see require-admin.js).
//   GET    -> list stocks in order, with sector/dividend/growth
//   POST   { symbol, sector, dividend, growth }         -> add a stock
//   DELETE { symbol }                                    -> remove a stock
//   PATCH  { symbol, direction }                         -> move 'up' or 'down'
//   PATCH  { symbol, sector, dividend, growth }           -> edit a stock's metadata
//          (PATCH is routed by whether `direction` is present)

const { pool, ensureSchema } = require('../lib/db');
const { isAdmin } = require('../lib/require-admin');

const VALID_SECTORS = [
  'petroleum', 'fertilizer', 'pharma', 'cement', 'tech',
  'power', 'chemical', 'auto', 'engineering', 'steel', 'bank', 'other',
];

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Only admin can manage the stock list.' });
  }

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT symbol, sort_order, sector, dividend, growth FROM stock_list ORDER BY sort_order ASC`
      );
      return res.status(200).json({ stocks: result.rows });
    }

    if (req.method === 'POST') {
      const { symbol, sector, dividend, growth } = req.body || {};
      if (!symbol || !symbol.trim()) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      const sym = symbol.trim().toUpperCase();
      const sec = VALID_SECTORS.includes(sector) ? sector : 'other';

      const maxRes = await pool.query(`SELECT COALESCE(MAX(sort_order), -1) AS max FROM stock_list`);
      const nextOrder = Number(maxRes.rows[0].max) + 1;

      await pool.query(
        `INSERT INTO stock_list (symbol, sort_order, sector, dividend, growth)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (symbol) DO NOTHING`,
        [sym, nextOrder, sec, !!dividend, !!growth]
      );
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { symbol } = req.body || {};
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      await pool.query(`DELETE FROM stock_list WHERE symbol = $1`, [symbol.trim().toUpperCase()]);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
      const { symbol, direction, sector, dividend, growth } = req.body || {};
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      const sym = symbol.trim().toUpperCase();

      // --- Reorder ---
      if (direction) {
        const listRes = await pool.query(
          `SELECT symbol, sort_order FROM stock_list ORDER BY sort_order ASC`
        );
        const list = listRes.rows;
        const idx = list.findIndex((r) => r.symbol === sym);
        if (idx === -1) {
          return res.status(404).json({ error: 'Symbol not found in the list.' });
        }
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= list.length) {
          return res.status(200).json({ success: true }); // already at the edge, no-op
        }
        const a = list[idx];
        const b = list[swapIdx];
        await pool.query(`UPDATE stock_list SET sort_order = $1 WHERE symbol = $2`, [b.sort_order, a.symbol]);
        await pool.query(`UPDATE stock_list SET sort_order = $1 WHERE symbol = $2`, [a.sort_order, b.symbol]);
        return res.status(200).json({ success: true });
      }

      // --- Edit metadata (sector / dividend / growth) ---
      const sec = VALID_SECTORS.includes(sector) ? sector : 'other';
      const result = await pool.query(
        `UPDATE stock_list SET sector = $1, dividend = $2, growth = $3 WHERE symbol = $4`,
        [sec, !!dividend, !!growth, sym]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Symbol not found in the list.' });
      }
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
