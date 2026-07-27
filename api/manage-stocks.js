// api/manage-stocks.js
// Called by the frontend at:
//   POST   /api/manage-stocks  { symbol, sector }                    -> add a stock
//   POST   /api/manage-stocks  { action: 'move-stock', symbol, direction }   -> reorder within its sector
//   POST   /api/manage-stocks  { action: 'move-sector', sector, direction } -> reorder a sector group
//   DELETE /api/manage-stocks  { symbol }                             -> remove a stock
// Open to anyone — no login required. Only affects which stocks show
// on the Stocks page, their sector, and display order; doesn't touch
// saved price history.

const { pool, ensureSchema } = require('../lib/db');
const { getOrderedStocks } = require('../lib/stock-order');

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

async function moveStock(res, symbol, direction) {
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Direction must be "up" or "down".' });
  }
  const sym = symbol.trim().toUpperCase();
  const { rows } = await getOrderedStocks();

  const target = rows.find((r) => r.symbol === sym);
  if (!target) {
    return res.status(404).json({ error: 'That symbol is not currently tracked.' });
  }
  const sectorRows = rows.filter((r) => r.sector === target.sector);
  const idx = sectorRows.findIndex((r) => r.symbol === sym);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sectorRows.length) {
    return res.status(200).json({ success: true }); // already at that edge
  }

  const reordered = [...sectorRows];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  await Promise.all(
    reordered.map((r, i) => pool.query(`UPDATE stock_sectors SET sort_order = $1 WHERE symbol = $2`, [i, r.symbol]))
  );
  res.status(200).json({ success: true });
}

async function moveSector(res, sector, direction) {
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Direction must be "up" or "down".' });
  }
  const { sectorOrder } = await getOrderedStocks();
  const idx = sectorOrder.indexOf(sector);
  if (idx === -1) {
    return res.status(404).json({ error: 'That sector is not currently shown.' });
  }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sectorOrder.length) {
    return res.status(200).json({ success: true }); // already at that edge
  }

  const reordered = [...sectorOrder];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  await Promise.all(
    reordered.map((s, i) =>
      pool.query(
        `INSERT INTO sector_order (sector, sort_order) VALUES ($1, $2)
         ON CONFLICT (sector) DO UPDATE SET sort_order = $2, updated_at = NOW()`,
        [s, i]
      )
    )
  );
  res.status(200).json({ success: true });
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method === 'POST') {
      const { action, symbol, sector, direction } = req.body || {};

      if (action === 'move-stock') {
        if (!symbol || !symbol.trim()) return res.status(400).json({ error: 'Symbol is required.' });
        return moveStock(res, symbol, direction);
      }
      if (action === 'move-sector') {
        if (!sector) return res.status(400).json({ error: 'Sector is required.' });
        return moveSector(res, sector, direction);
      }

      // No action (or unrecognized) falls through to the original
      // behavior: add/update a stock's sector.
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
