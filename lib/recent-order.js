// lib/recent-order.js
// Shared logic for computing the Recently Added page's symbol order —
// used by both api/recent.js (to render it) and api/manage-recent.js
// (to know what "up"/"down" means when reordering).
//
// Default order is "last saved first" (by psx_prices row id), same as
// before manual reordering existed. Any symbol with an explicit
// recent_meta.sort_order uses that instead; hidden symbols are
// dropped entirely. A generous candidate pool (well beyond the final
// page size) is pulled first so that hiding a few symbols doesn't
// shrink the visible list below its normal size.

const { pool } = require('./db');

const CANDIDATE_POOL_SIZE = 60;

async function getOrderedRecentSymbols(limit = 15) {
  const dbRes = await pool.query(
    `
    SELECT symbol FROM (
      SELECT DISTINCT ON (symbol) symbol, id
      FROM psx_prices
      ORDER BY symbol, id DESC
    ) t
    ORDER BY id DESC
    LIMIT $1
    `,
    [CANDIDATE_POOL_SIZE]
  );
  const candidates = dbRes.rows.map((r, i) => ({ symbol: r.symbol, naturalRank: i }));
  if (candidates.length === 0) return [];

  const metaRes = await pool.query(
    `SELECT symbol, sort_order, hidden FROM recent_meta WHERE symbol = ANY($1)`,
    [candidates.map((c) => c.symbol)]
  );
  const metaMap = new Map(metaRes.rows.map((r) => [r.symbol, r]));

  return candidates
    .filter((c) => !metaMap.get(c.symbol)?.hidden)
    .map((c) => {
      const meta = metaMap.get(c.symbol);
      const order = meta && meta.sort_order != null ? meta.sort_order : c.naturalRank;
      return { symbol: c.symbol, order };
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, limit)
    .map((c) => c.symbol);
}

module.exports = { getOrderedRecentSymbols };
