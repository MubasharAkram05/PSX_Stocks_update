// api/recent.js
// Called by the frontend at GET /api/recent
// Returns the last 15 distinct symbols saved (most recently saved
// first), each with a LIVE current price + trend (not just the
// historical saved value) so the home page can color it red/green
// and draw a sparkline.

const { pool } = require('./db');
const { getStockPriceWithTrend } = require('./psx');

module.exports = async (req, res) => {
  try {
    const dbRes = await pool.query(`
      SELECT symbol FROM (
        SELECT DISTINCT ON (symbol) symbol, id
        FROM psx_prices
        ORDER BY symbol, id DESC
      ) t
      ORDER BY id DESC
      LIMIT 15
    `);
    const symbols = dbRes.rows.map((r) => r.symbol);

    const liveResults = await Promise.all(
      symbols.map((sym) => getStockPriceWithTrend(sym).catch(() => null))
    );
    const recent = liveResults.filter(Boolean);

    res.status(200).json({ recent });
  } catch (err) {
    console.error(err);
    // Table may not exist yet if nothing has been saved at all
    res.status(200).json({ recent: [] });
  }
};
