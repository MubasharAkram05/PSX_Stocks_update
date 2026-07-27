// api/cron-daily-save.js
// Triggered automatically once a day by Vercel Cron (see vercel.json).
// For every symbol that's ever been saved, fetches today's low/high
// and upserts them — same "one row per symbol per day, most extreme
// values win" rule as manual saves via api/save-price.js.

const { pool, ensureSchema } = require('../lib/db');
const { getDailyRange } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    const symbolsRes = await pool.query(`SELECT DISTINCT symbol FROM psx_prices`);
    const symbols = symbolsRes.rows.map((r) => r.symbol);

    const results = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const { date, low, high } = await getDailyRange(sym);
          await pool.query(
            `INSERT INTO psx_prices (date, symbol, price_low, price_high)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (symbol, date)
             DO UPDATE SET
               price_low = LEAST(psx_prices.price_low, EXCLUDED.price_low),
               price_high = GREATEST(psx_prices.price_high, EXCLUDED.price_high)`,
            [date, sym, low, high]
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
