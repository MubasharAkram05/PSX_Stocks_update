// api/save-price.js
// Called by the frontend at POST /api/save-price with { symbol, low, high }.
// `low`/`high` come from the confirmation popup — the user can edit
// either fetched value before confirming, so whatever they confirm is
// what gets saved. If both are missing (e.g. a non-browser caller),
// they fall back to fetching today's range automatically.
//
// Saves the LOWEST and HIGHEST price seen for that symbol TODAY. If a
// row for this symbol + today already exists (saved earlier, manually
// or by the daily cron job), price_low only moves down and price_high
// only moves up — never a duplicate row, and a re-save never erases a
// more extreme value already captured today.
//
// Also makes sure the symbol shows up on the Stocks page: if it isn't
// already tracked there, it's added with a sector guessed from the
// static lookup (falling back to "other"), so saving a price is
// enough on its own — no separate trip to Add Stock required. Doesn't
// touch the sector of a symbol that's already tracked (e.g. edited by
// hand on the Stocks page).

const { pool, ensureSchema } = require('../lib/db');
const { getDailyRange } = require('../lib/psx');
const SECTOR_META = require('../lib/sector-meta');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, low: userLow, high: userHigh } = req.body || {};
  if (!symbol || !symbol.trim()) {
    return res.status(400).json({ error: 'Please provide a stock symbol.' });
  }

  try {
    let result;
    if (userLow !== undefined && userLow !== null && userLow !== '') {
      const numLow = Number(userLow);
      const numHigh = userHigh !== undefined && userHigh !== null && userHigh !== '' ? Number(userHigh) : numLow;
      if (isNaN(numLow) || numLow <= 0 || isNaN(numHigh) || numHigh <= 0) {
        return res.status(400).json({ error: 'Please provide valid prices.' });
      }
      if (numHigh < numLow) {
        return res.status(400).json({ error: 'High price cannot be lower than the low price.' });
      }
      result = {
        symbol: symbol.trim().toUpperCase(),
        low: numLow,
        high: numHigh,
        date: new Date().toISOString().split('T')[0],
      };
    } else {
      result = await getDailyRange(symbol);
    }

    await ensureSchema();

    await pool.query(
      `INSERT INTO psx_prices (date, symbol, price_low, price_high)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (symbol, date)
       DO UPDATE SET
         price_low = LEAST(psx_prices.price_low, EXCLUDED.price_low),
         price_high = GREATEST(psx_prices.price_high, EXCLUDED.price_high)`,
      [result.date, result.symbol, result.low, result.high]
    );

    const sector = SECTOR_META[result.symbol] || 'other';
    await pool.query(
      `INSERT INTO stock_sectors (symbol, sector) VALUES ($1, $2) ON CONFLICT (symbol) DO NOTHING`,
      [result.symbol, sector]
    );

    // Report back whatever ended up stored (could be an earlier, more
    // extreme save from today rather than this attempt's values).
    const stored = await pool.query(
      `SELECT price_low, price_high FROM psx_prices WHERE symbol = $1 AND date = $2`,
      [result.symbol, result.date]
    );
    const row = stored.rows[0];
    const finalLow = row ? Number(row.price_low) : result.low;
    const finalHigh = row ? Number(row.price_high) : result.high;

    res.status(200).json({
      success: true,
      symbol: result.symbol,
      date: result.date,
      low: finalLow,
      high: finalHigh,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
