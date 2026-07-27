// api/stocks.js
// Called by the frontend at GET /api/stocks
// Returns every symbol in the stock_sectors table (added via the
// Stocks page's Add Stock form, or carried over from earlier saves)
// with a live price + trend, in their current display order — see
// lib/stock-order.js — along with the current sector order, so the
// frontend doesn't have to guess either.
// Falls back to the last saved price/date if the live lookup fails
// for a symbol, rather than dropping it — a burst of PSX rate-limiting
// (e.g. right after clicking Save All) would otherwise make every
// stock disappear from the page at once, even though nothing was
// actually lost. Requests are also throttled instead of all firing at
// once, to make hitting that rate limit less likely in the first
// place.

const { pool, ensureSchema } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');
const { mapWithConcurrency } = require('../lib/concurrency');
const { getOrderedStocks } = require('../lib/stock-order');

const CONCURRENCY = 5;

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const { rows, sectorOrder } = await getOrderedStocks();

    if (rows.length === 0) {
      return res.status(200).json({ stocks: [], sectorOrder: [] });
    }

    const symbols = rows.map((r) => r.symbol);
    const storedRes = await pool.query(
      `SELECT DISTINCT ON (symbol) symbol, price_low, date
       FROM psx_prices WHERE symbol = ANY($1)
       ORDER BY symbol, id DESC`,
      [symbols]
    );
    const storedMap = new Map(storedRes.rows.map((r) => [r.symbol, r]));

    const results = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
      try {
        const live = await getStockPriceWithTrend(row.symbol);
        return { ...live, sector: row.sector };
      } catch {
        const stored = storedMap.get(row.symbol);
        if (!stored) return null;
        return {
          symbol: row.symbol,
          sector: row.sector,
          price: Number(stored.price_low),
          date: stored.date,
          trend: [],
          direction: 'flat',
        };
      }
    });

    res.status(200).json({ stocks: results.filter(Boolean), sectorOrder });
  } catch (err) {
    console.error(err);
    res.status(200).json({ stocks: [], sectorOrder: [] });
  }
};
