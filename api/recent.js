// api/recent.js
// Called by the frontend at GET /api/recent
// Returns the last 15 distinct symbols saved (most recently saved
// first), with a live price/trend/direction for each — same live
// lookup used everywhere else in the app. Falls back to the stored
// (saved) price/date if the live lookup fails for a symbol.

const { pool } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    const dbRes = await pool.query(`
      SELECT symbol, price_low, date FROM (
        SELECT DISTINCT ON (symbol) symbol, price_low, date, id
        FROM psx_prices
        ORDER BY symbol, id DESC
      ) t
      ORDER BY id DESC
      LIMIT 15
    `);

    const recent = await Promise.all(
      dbRes.rows.map(async (row) => {
        const storedPrice = Number(row.price_low);
        try {
          const live = await getStockPriceWithTrend(row.symbol);
          return {
            symbol: row.symbol,
            price: live.price,
            date: live.date,
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
