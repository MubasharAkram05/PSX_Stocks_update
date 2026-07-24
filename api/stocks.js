// api/stocks.js
// Called by the frontend at GET /api/stocks
// Returns every symbol in the stock_sectors table (added via the
// Stocks page's Add Stock form, or carried over from earlier saves)
// with a live price + trend, grouped by sector on the frontend.

const { pool, ensureSchema } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const dbRes = await pool.query(`SELECT symbol, sector FROM stock_sectors ORDER BY symbol`);

    if (dbRes.rows.length === 0) {
      return res.status(200).json({ stocks: [] });
    }

    const results = await Promise.all(
      dbRes.rows.map((row) =>
        getStockPriceWithTrend(row.symbol)
          .then((r) => ({ ...r, sector: row.sector }))
          .catch(() => null)
      )
    );

    res.status(200).json({ stocks: results.filter(Boolean) });
  } catch (err) {
    console.error(err);
    res.status(200).json({ stocks: [] });
  }
};
