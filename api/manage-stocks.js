// api/manage-stocks.js
// Called by the frontend at:
//   POST   /api/manage-stocks  { symbol, sector, list }                     -> add a stock
//   POST   /api/manage-stocks  { action: 'bulk-add', symbols: [...], list } -> add many at once
//   POST   /api/manage-stocks  { action: 'move-stock', symbol, direction, list }   -> reorder within its sector
//   POST   /api/manage-stocks  { action: 'move-sector', sector, direction, list } -> reorder a sector group
//   DELETE /api/manage-stocks  { symbol, list }                             -> remove a stock
// `list` is 'main' (stocks.html, the default) or 'short-term'
// (short-term.html) — the same symbol can be tracked independently on
// both. Open to anyone — no login required. Only affects which stocks
// show on a page, their sector, and display order; doesn't touch
// saved price history.

const { pool, ensureSchema } = require('../lib/db');
const { getOrderedStocks } = require('../lib/stock-order');
const SECTOR_META = require('../lib/sector-meta');

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

async function bulkAdd(res, symbols, listType) {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: 'Provide at least one symbol.' });
  }
  const unique = [...new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    return res.status(400).json({ error: 'Provide at least one symbol.' });
  }

  const results = await Promise.all(
    unique.map(async (sym) => {
      const sector = SECTOR_META[sym] || 'other';
      const result = await pool.query(
        `INSERT INTO stock_sectors (symbol, sector, list_type) VALUES ($1, $2, $3)
         ON CONFLICT (symbol, list_type) DO NOTHING
         RETURNING symbol`,
        [sym, sector, listType]
      );
      return { symbol: sym, added: result.rows.length > 0 };
    })
  );

  res.status(200).json({
    success: true,
    added: results.filter((r) => r.added).length,
    alreadyTracked: results.filter((r) => !r.added).length,
    total: unique.length,
  });
}

async function moveStock(res, symbol, direction, listType) {
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Direction must be "up" or "down".' });
  }
  const sym = symbol.trim().toUpperCase();
  const { rows } = await getOrderedStocks(listType);

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
    reordered.map((r, i) =>
      pool.query(`UPDATE stock_sectors SET sort_order = $1 WHERE symbol = $2 AND list_type = $3`, [i, r.symbol, listType])
    )
  );
  res.status(200).json({ success: true });
}

async function moveSector(res, sector, direction, listType) {
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Direction must be "up" or "down".' });
  }
  const { sectorOrder } = await getOrderedStocks(listType);
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
        `INSERT INTO sector_order (sector, sort_order, list_type) VALUES ($1, $2, $3)
         ON CONFLICT (sector, list_type) DO UPDATE SET sort_order = $2, updated_at = NOW()`,
        [s, i, listType]
      )
    )
  );
  res.status(200).json({ success: true });
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method === 'POST') {
      const { action, symbol, sector, direction, symbols, list } = req.body || {};
      const listType = list === 'short-term' ? 'short-term' : 'main';

      if (action === 'bulk-add') {
        return bulkAdd(res, symbols, listType);
      }
      if (action === 'move-stock') {
        if (!symbol || !symbol.trim()) return res.status(400).json({ error: 'Symbol is required.' });
        return moveStock(res, symbol, direction, listType);
      }
      if (action === 'move-sector') {
        if (!sector) return res.status(400).json({ error: 'Sector is required.' });
        return moveSector(res, sector, direction, listType);
      }

      // No action (or unrecognized) falls through to the original
      // behavior: add/update a stock's sector.
      if (!symbol || !symbol.trim()) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      const sym = symbol.trim().toUpperCase();
      const sec = PRESET_SECTORS.includes(sector) ? sector : sanitizeCustomSector(sector);

      await pool.query(
        `INSERT INTO stock_sectors (symbol, sector, list_type) VALUES ($1, $2, $3)
         ON CONFLICT (symbol, list_type) DO UPDATE SET sector = EXCLUDED.sector`,
        [sym, sec, listType]
      );
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { symbol, list } = req.body || {};
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required.' });
      }
      const listType = list === 'short-term' ? 'short-term' : 'main';
      await pool.query(`DELETE FROM stock_sectors WHERE symbol = $1 AND list_type = $2`, [symbol.trim().toUpperCase(), listType]);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
