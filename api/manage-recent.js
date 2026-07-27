// api/manage-recent.js
// Called by the frontend at POST /api/manage-recent with:
//   { action: 'move', symbol, direction: 'up' | 'down' }  -> reorder
//   { action: 'hide', symbol }                              -> remove from the list
// Open to anyone — no login required. Only affects the Recently Added
// page's order/visibility; doesn't touch any saved price history.

const { pool, ensureSchema } = require('../lib/db');
const { getOrderedRecentSymbols } = require('../lib/recent-order');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, symbol } = req.body || {};
  if (!symbol || !symbol.trim()) {
    return res.status(400).json({ error: 'Symbol is required.' });
  }
  const sym = symbol.trim().toUpperCase();

  try {
    await ensureSchema();

    if (action === 'hide') {
      await pool.query(
        `INSERT INTO recent_meta (symbol, hidden) VALUES ($1, true)
         ON CONFLICT (symbol) DO UPDATE SET hidden = true, updated_at = NOW()`,
        [sym]
      );
      return res.status(200).json({ success: true });
    }

    if (action === 'move') {
      const { direction } = req.body || {};
      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({ error: 'Direction must be "up" or "down".' });
      }

      const ordered = await getOrderedRecentSymbols(15);
      const idx = ordered.indexOf(sym);
      if (idx === -1) {
        return res.status(404).json({ error: 'That symbol is not currently in Recently Added.' });
      }
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= ordered.length) {
        return res.status(200).json({ success: true }); // already at that edge
      }

      // Give the whole visible list explicit, stable positions (0..n-1)
      // with these two swapped — after this, moves are plain integer
      // swaps rather than needing to fall back to save-recency.
      const reordered = [...ordered];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

      await Promise.all(
        reordered.map((s, i) =>
          pool.query(
            `INSERT INTO recent_meta (symbol, sort_order) VALUES ($1, $2)
             ON CONFLICT (symbol) DO UPDATE SET sort_order = $2, updated_at = NOW()`,
            [s, i]
          )
        )
      );
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
