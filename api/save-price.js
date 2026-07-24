// api/save-price.js
// Called by the frontend at POST /api/save-price with { symbol }.
// Saves the LOWEST price seen for that symbol TODAY. If a row for
// this symbol + today already exists (saved earlier, manually or by
// the daily cron job), it's updated only if the new price is lower —
// never a duplicate row, never a higher price overwriting a lower one.

const { pool, ensureSchema } = require('../lib/db');
const { getDailyLowPrice } = require('../lib/psx');
const { isAdmin } = require('../lib/require-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Only admin can add stock prices.' });
  }

  const { symbol } = req.body || {};
  if (!symbol || !symbol.trim()) {
    return res.status(400).json({ error: 'Please provide a stock symbol.' });
  }

  try {
    const result = await getDailyLowPrice(symbol);
    await ensureSchema();

    await pool.query(
      `INSERT INTO psx_prices (date, symbol, price)
       VALUES ($1, $2, $3)
       ON CONFLICT (symbol, date)
       DO UPDATE SET price = LEAST(psx_prices.price, EXCLUDED.price)`,
      [result.date, result.symbol, result.price]
    );

    // Report back whatever ended up stored (could be an earlier,
    // lower save from today rather than this attempt's price).
    const stored = await pool.query(
      `SELECT price FROM psx_prices WHERE symbol = $1 AND date = $2`,
      [result.symbol, result.date]
    );
    const finalPrice = stored.rows[0] ? Number(stored.rows[0].price) : result.price;

    res.status(200).json({
      success: true,
      symbol: result.symbol,
      date: result.date,
      price: finalPrice,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
