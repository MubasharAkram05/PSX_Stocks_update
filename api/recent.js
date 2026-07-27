// api/recent.js
// Called by the frontend at GET /api/recent
// Returns up to 15 symbols for the Recently Added page — last-saved
// first by default, but reordered/filtered by any manual changes made
// via api/manage-recent.js (see lib/recent-order.js) — with a live
// price/trend/direction for each. Falls back to the stored (saved)
// price/date if the live lookup fails for a symbol.

const { pool } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');
const { getOrderedRecentSymbols } = require('../lib/recent-order');

module.exports = async (req, res) => {
  try {
    const symbols = await getOrderedRecentSymbols(15);
    if (symbols.length === 0) {
      return res.status(200).json({ recent: [] });
    }

    const dbRes = await pool.query(
      `SELECT DISTINCT ON (symbol) symbol, price_low, date
       FROM psx_prices WHERE symbol = ANY($1)
       ORDER BY symbol, id DESC`,
      [symbols]
    );
    const storedMap = new Map(dbRes.rows.map((r) => [r.symbol, r]));

    const recent = await Promise.all(
      symbols.map(async (symbol) => {
        const stored = storedMap.get(symbol);
        const storedPrice = stored ? Number(stored.price_low) : null;
        try {
          const live = await getStockPriceWithTrend(symbol);
          return {
            symbol,
            price: live.price,
            date: live.date,
            trend: live.trend,
            direction: live.direction,
          };
        } catch {
          return { symbol, price: storedPrice, date: stored ? stored.date : null, trend: [], direction: 'flat' };
        }
      })
    );

    res.status(200).json({ recent });
  } catch (err) {
    console.error(err);
    // Table may not exist yet if nothing has been saved at all
    res.status(200).json({ recent: [] });
  }
};
