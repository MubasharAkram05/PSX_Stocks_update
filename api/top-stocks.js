// api/top-stocks.js
// Called by the frontend at GET /api/top-stocks
// Returns current prices (+ a short trend for sparklines) for a
// curated list of actively-traded PSX symbols across major sectors,
// PLUS any symbol the user has recently saved that isn't already on
// the list (tagged fromRecent: true).
//
// Each stock also gets:
//   - sector: petroleum / fertilizer / pharma / cement / tech /
//     power / chemical / auto / engineering / steel / other
//   - dividend: true for stocks commonly known as steady dividend payers
//   - growth: true for stocks commonly viewed as growth-oriented
//   - priceCategory: 'cheap' (price <= 100) or 'higher' (price > 100)
//   - trend: last ~7 closing prices, oldest to newest
//   - direction: 'up' / 'down' / 'flat', based on that trend
//
// NOTE: sector/dividend/growth are a curated, static grouping to help
// browsing — not live financial metrics (PSX doesn't expose a "top by
// dividend yield" or "top growth" API). The Bank sector and thinly-
// traded/high-risk names have been deliberately left off this list.
// priceCategory and direction ARE computed live from fetched prices.

const { getStockPriceWithTrend } = require('./psx');
const { pool } = require('./db');

const STOCKS = [
  // Petroleum / Oil & Gas — large, liquid, actively traded
  { symbol: 'OGDC', sector: 'petroleum', dividend: true },
  { symbol: 'PPL', sector: 'petroleum', dividend: true },
  { symbol: 'POL', sector: 'petroleum', dividend: true },
  { symbol: 'PSO', sector: 'petroleum', dividend: true },
  { symbol: 'MARI', sector: 'petroleum', dividend: true },
  { symbol: 'SNGP', sector: 'petroleum' },

  // Fertilizer
  { symbol: 'FFC', sector: 'fertilizer', dividend: true },
  { symbol: 'EFERT', sector: 'fertilizer', dividend: true },
  { symbol: 'ENGRO', sector: 'fertilizer', dividend: true, growth: true },
  { symbol: 'FATIMA', sector: 'fertilizer' },

  // Pharma / Medicine
  { symbol: 'SEARL', sector: 'pharma', growth: true },
  { symbol: 'GLAXO', sector: 'pharma' },
  { symbol: 'HINOON', sector: 'pharma' },
  { symbol: 'AGP', sector: 'pharma' },

  // Cement
  { symbol: 'LUCK', sector: 'cement', growth: true },
  { symbol: 'DGKC', sector: 'cement' },
  { symbol: 'MLCF', sector: 'cement' },
  { symbol: 'FCCL', sector: 'cement' },
  { symbol: 'PIOC', sector: 'cement' },

  // Tech
  { symbol: 'SYS', sector: 'tech', growth: true },
  { symbol: 'TRG', sector: 'tech', growth: true },
  { symbol: 'NETSOL', sector: 'tech', growth: true },

  // Power
  { symbol: 'HUBC', sector: 'power', dividend: true },
  { symbol: 'KAPCO', sector: 'power', dividend: true },
  { symbol: 'KEL', sector: 'power' },

  // Chemical
  { symbol: 'ICI', sector: 'chemical' },

  // Auto
  { symbol: 'INDU', sector: 'auto', dividend: true },
  { symbol: 'PSMC', sector: 'auto' },

  // Engineering / Steel
  { symbol: 'ISL', sector: 'engineering' },
  { symbol: 'ASTL', sector: 'steel' },
  { symbol: 'MEBL', sector: 'other', growth: true },
];

module.exports = async (req, res) => {
  try {
    // --- Fetch prices + trend for the curated list ---
    const curatedResults = await Promise.all(
      STOCKS.map((s) =>
        getStockPriceWithTrend(s.symbol)
          .then((r) => ({ ...r, ...s }))
          .catch(() => null)
      )
    );
    let stocks = curatedResults.filter(Boolean);

    // --- Mark recently-saved symbols, and add any not already on the list ---
    try {
      const curatedSymbols = new Set(STOCKS.map((s) => s.symbol));
      const recentRes = await pool.query(
        `SELECT DISTINCT symbol FROM psx_prices ORDER BY symbol LIMIT 50`
      );
      const recentSymbols = new Set(recentRes.rows.map((r) => r.symbol));

      // A curated stock that's also been recently saved gets tagged too —
      // not just symbols missing from the curated list.
      stocks = stocks.map((s) =>
        recentSymbols.has(s.symbol) ? { ...s, fromRecent: true } : s
      );

      const extraSymbols = [...recentSymbols].filter((sym) => !curatedSymbols.has(sym));

      if (extraSymbols.length > 0) {
        const extraResults = await Promise.all(
          extraSymbols.map((sym) =>
            getStockPriceWithTrend(sym)
              .then((r) => ({ ...r, sector: 'other', fromRecent: true }))
              .catch(() => null)
          )
        );
        stocks = stocks.concat(extraResults.filter(Boolean));
      }
    } catch (err) {
      // psx_prices table may not exist yet if nothing has been saved
      console.log('Could not merge recently-added symbols: ' + err.message);
    }

    // --- Tag cheap vs. higher-priced based on the live price ---
    stocks = stocks.map((s) => ({
      ...s,
      priceCategory: s.price <= 100 ? 'cheap' : 'higher',
    }));

    res.status(200).json({ stocks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
