// api/cron-daily-save.js
// Triggered automatically once a day by Vercel Cron (see vercel.json).
// For every symbol that's ever been saved, fetches today's lowest
// price and upserts it — same "one row per symbol per day, lowest
// price wins" rule as manual saves via api/save-price.js.

const { pool, ensureSchema } = require('../lib/db');
const { getDailyLowPrice } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    const symbolsRes = await pool.query(`SELECT DISTINCT symbol FROM psx_prices`);
    const symbols = symbolsRes.rows.map((r) => r.symbol);

    const results = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const { date, price } = await getDailyLowPrice(sym);
          await pool.query(
            `INSERT INTO psx_prices (date, symbol, price)
             VALUES ($1, $2, $3)
             ON CONFLICT (symbol, date)
             DO UPDATE SET price = LEAST(psx_prices.price, EXCLUDED.price)`,
            [date, sym, price]
          );
          return { symbol: sym, ok: true };
        } catch (err) {
          return { symbol: sym, ok: false, error: err.message };
        }
      })
    );

    res.status(200).json({ ran: true, count: symbols.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
