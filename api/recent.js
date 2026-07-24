// api/recent.js
// Called by the frontend at GET /api/recent
// Returns the last 15 distinct symbols saved (most recently saved
// first). The PRICE shown is the actual value stored in the database
// (what you saved — today's low, deduplicated) — not a fresh live
// lookup, so it always matches what "Save Price" confirmed. The
// sparkline/direction still comes from a live trend fetch, purely for
// the visual red/green trend line.

const { pool } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    const dbRes = await pool.query(`
      SELECT symbol, price, date FROM (
        SELECT DISTINCT ON (symbol) symbol, price, date, id
        FROM psx_prices
        ORDER BY symbol, id DESC
      ) t
      ORDER BY id DESC
      LIMIT 15
    `);

    const recent = await Promise.all(
      dbRes.rows.map(async (row) => {
        const storedPrice = Number(row.price);
        try {
          const live = await getStockPriceWithTrend(row.symbol);
          return {
            symbol: row.symbol,
            price: storedPrice,
            date: row.date,
            trend: live.trend,
            direction: live.direction,
          };
        } catch {
          return { symbol: row.symbol, price: storedPrice, date: row.date, trend: [], direction: 'flat' };
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
