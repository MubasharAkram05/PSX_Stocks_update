// api/top-stocks.js
// Called by the frontend at GET /api/top-stocks
// Returns the stock list as fully managed by the admin — symbol,
// order, sector, dividend, and growth all come from the stock_list
// table (edited via admin.html + api/admin-stocks.js), not a static
// lookup. Live price/trend is fetched fresh each time.

const { pool, ensureSchema } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const dbRes = await pool.query(
      `SELECT symbol, sector, dividend, growth FROM stock_list ORDER BY sort_order ASC`
    );

    if (dbRes.rows.length === 0) {
      return res.status(200).json({ stocks: [] });
    }

    const results = await Promise.all(
      dbRes.rows.map((row) =>
        getStockPriceWithTrend(row.symbol)
          .then((r) => ({ ...r, sector: row.sector, dividend: row.dividend, growth: row.growth }))
          .catch(() => null)
      )
    );

    let stocks = results.filter(Boolean);
    stocks = stocks.map((s) => ({
      ...s,
      priceCategory: s.price <= 100 ? 'cheap' : 'higher',
    }));

    res.status(200).json({ stocks });
  } catch (err) {
    console.error(err);
    // Table may not exist yet if nothing has been added at all
    res.status(200).json({ stocks: [] });
  }
};
