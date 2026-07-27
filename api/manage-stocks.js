// api/manage-stocks.js
// Called by the frontend at:
//   POST   /api/manage-stocks  { symbol, sector }  -> add a stock
//   DELETE /api/manage-stocks  { symbol }           -> remove a stock
// Open to anyone — no login required. Only affects which stocks show
// on the Stocks page and their sector grouping; doesn't touch saved
// price history.

const { pool, ensureSchema } = require('../lib/db');

// Sectors offered as dropdown presets — kept as-is (they have curated
// display labels on the frontend). Anything else is a custom,
// free-typed sector name and gets sanitized instead.
const PRESET_SECTORS = [
  'petroleum', 'fertilizer', 'pharma', 'cement', 'tech',
  'power', 'chemical', 'auto', 'engineering', 'steel', 'bank',
];

function sanitizeCustomSector(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s&-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 30);
  return cleaned || 'other';
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method === 'POST') {
      const { symbol, sector } = req.body || {};
      if (!symbol || !symbol.trim()) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      const sym = symbol.trim().toUpperCase();
      const sec = PRESET_SECTORS.includes(sector) ? sector : sanitizeCustomSector(sector);

      await pool.query(
        `INSERT INTO stock_sectors (symbol, sector) VALUES ($1, $2)
         ON CONFLICT (symbol) DO UPDATE SET sector = EXCLUDED.sector`,
        [sym, sec]
      );
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { symbol } = req.body || {};
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      await pool.query(`DELETE FROM stock_sectors WHERE symbol = $1`, [symbol.trim().toUpperCase()]);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
