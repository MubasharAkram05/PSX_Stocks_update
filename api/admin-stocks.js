// api/admin-stocks.js
// Admin-only management of which stocks show up on the Top Stocks
// page and in what order.
//
//   GET    /api/admin-stocks              -> list, ordered by position (admin only)
//   POST   /api/admin-stocks   { symbol }  -> add a stock at the end (admin only)
//   DELETE /api/admin-stocks   { symbol }  -> remove a stock (admin only)
//   PATCH  /api/admin-stocks   { symbol, direction: 'up' | 'down' } -> reorder (admin only)

const { pool, ensureSchema } = require('./db');
const { isAdminRequest } = require('./admin-auth');

module.exports = async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Only admin can manage stocks.' });
  }

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT symbol, position FROM admin_stocks ORDER BY position ASC`
      );
      return res.status(200).json({ stocks: result.rows });
    }

    if (req.method === 'POST') {
      const { symbol } = req.body || {};
      if (!symbol || !symbol.trim()) {
        return res.status(400).json({ error: 'Please provide a stock symbol.' });
      }
      const sym = symbol.trim().toUpperCase();

      const existing = await pool.query(`SELECT id FROM admin_stocks WHERE symbol = $1`, [sym]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: `${sym} is already in the list.` });
      }

      const maxPos = await pool.query(`SELECT COALESCE(MAX(position), 0) AS max FROM admin_stocks`);
      const nextPos = Number(maxPos.rows[0].max) + 1;

      await pool.query(
        `INSERT INTO admin_stocks (symbol, position) VALUES ($1, $2)`,
        [sym, nextPos]
      );
      return res.status(200).json({ success: true, symbol: sym });
    }

    if (req.method === 'DELETE') {
      const { symbol } = req.body || {};
      if (!symbol || !symbol.trim()) {
        return res.status(400).json({ error: 'Please provide a stock symbol.' });
      }
      const sym = symbol.trim().toUpperCase();
      await pool.query(`DELETE FROM admin_stocks WHERE symbol = $1`, [sym]);
      return res.status(200).json({ success: true, symbol: sym });
    }

    if (req.method === 'PATCH') {
      const { symbol, direction } = req.body || {};
      if (!symbol || (direction !== 'up' && direction !== 'down')) {
        return res.status(400).json({ error: 'Please provide a symbol and direction (up/down).' });
      }
      const sym = symbol.trim().toUpperCase();

      const rows = (await pool.query(`SELECT id, symbol, position FROM admin_stocks ORDER BY position ASC`)).rows;
      const idx = rows.findIndex((r) => r.symbol === sym);
      if (idx === -1) {
        return res.status(404).json({ error: `${sym} not found.` });
      }
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= rows.length) {
        return res.status(200).json({ success: true, symbol: sym }); // already at edge, no-op
      }

      const a = rows[idx];
      const b = rows[swapIdx];
      await pool.query(`UPDATE admin_stocks SET position = $1 WHERE id = $2`, [b.position, a.id]);
      await pool.query(`UPDATE admin_stocks SET position = $1 WHERE id = $2`, [a.position, b.id]);

      return res.status(200).json({ success: true, symbol: sym });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
