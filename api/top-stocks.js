// api/top-stocks.js
// Called by the frontend at GET /api/top-stocks
// Returns current prices for a curated list of 50+ PSX symbols across
// major sectors, PLUS any symbol the user has recently saved that
// isn't already on the curated list (so "recently added" stocks
// always show up here too, tagged fromRecent: true).
//
// Each stock also gets:
//   - sector: petroleum / fertilizer / pharma / bank / cement / tech /
//     power / chemical / auto / engineering / steel / other
//   - dividend: true for stocks commonly known as steady dividend payers
//   - growth: true for stocks commonly viewed as growth-oriented
//   - priceCategory: 'cheap' (price <= 100) or 'higher' (price > 100)
//
// NOTE: sector/dividend/growth are a curated, static grouping to help
// browsing — not live financial metrics (PSX doesn't expose a simple
// "top by dividend yield" API). priceCategory is computed live from
// the fetched price.

const { getStockPrice } = require('./psx');
const { pool } = require('./db');

const STOCKS = [
  // Petroleum / Oil & Gas
  { symbol: 'OGDC', sector: 'petroleum', dividend: true },
  { symbol: 'PPL', sector: 'petroleum', dividend: true },
  { symbol: 'POL', sector: 'petroleum', dividend: true },
  { symbol: 'PSO', sector: 'petroleum', dividend: true },
  { symbol: 'ATRL', sector: 'petroleum' },
  { symbol: 'NRL', sector: 'petroleum', dividend: true },
  { symbol: 'SNGP', sector: 'petroleum' },
  { symbol: 'SSGC', sector: 'petroleum' },
  { symbol: 'MARI', sector: 'petroleum', dividend: true },

  // Fertilizer
  { symbol: 'FFC', sector: 'fertilizer', dividend: true },
  { symbol: 'EFERT', sector: 'fertilizer', dividend: true },
  { symbol: 'ENGRO', sector: 'fertilizer', dividend: true, growth: true },
  { symbol: 'FATIMA', sector: 'fertilizer' },
  { symbol: 'FFBL', sector: 'fertilizer' },

  // Pharma / Medicine
  { symbol: 'SEARL', sector: 'pharma', growth: true },
  { symbol: 'GLAXO', sector: 'pharma' },
  { symbol: 'HINOON', sector: 'pharma' },
  { symbol: 'AGP', sector: 'pharma' },
  { symbol: 'IBLHL', sector: 'pharma' },
  { symbol: 'HIGHNOON', sector: 'pharma' },

  // Banks
  { symbol: 'MEBL', sector: 'bank', growth: true },
  { symbol: 'UBL', sector: 'bank', dividend: true },
  { symbol: 'HBL', sector: 'bank', dividend: true },
  { symbol: 'MCB', sector: 'bank', dividend: true },
  { symbol: 'BAHL', sector: 'bank' },
  { symbol: 'ABL', sector: 'bank', dividend: true },
  { symbol: 'BOP', sector: 'bank' },
  { symbol: 'NBP', sector: 'bank' },
  { symbol: 'FABL', sector: 'bank' },
  { symbol: 'AKBL', sector: 'bank' },

  // Cement
  { symbol: 'LUCK', sector: 'cement', growth: true },
  { symbol: 'DGKC', sector: 'cement' },
  { symbol: 'MLCF', sector: 'cement' },
  { symbol: 'FCCL', sector: 'cement' },
  { symbol: 'CHCC', sector: 'cement' },
  { symbol: 'KOHC', sector: 'cement' },
  { symbol: 'PIOC', sector: 'cement' },
  { symbol: 'ACPL', sector: 'cement' },

  // Tech
  { symbol: 'SYS', sector: 'tech', growth: true },
  { symbol: 'TRG', sector: 'tech', growth: true },
  { symbol: 'NETSOL', sector: 'tech', growth: true },
  { symbol: 'AVN', sector: 'tech' },
  { symbol: 'PTC', sector: 'tech' },

  // Power
  { symbol: 'HUBC', sector: 'power', dividend: true },
  { symbol: 'KAPCO', sector: 'power', dividend: true },
  { symbol: 'KEL', sector: 'power' },
  { symbol: 'NPL', sector: 'power' },

  // Chemical
  { symbol: 'ICI', sector: 'chemical' },
  { symbol: 'LOTCHEM', sector: 'chemical' },
  { symbol: 'EPCL', sector: 'chemical' },

  // Auto
  { symbol: 'INDU', sector: 'auto', dividend: true },
  { symbol: 'PSMC', sector: 'auto' },
  { symbol: 'HCAR', sector: 'auto' },
  { symbol: 'MTL', sector: 'auto' },

  // Engineering / Steel
  { symbol: 'ISL', sector: 'engineering' },
  { symbol: 'ASTL', sector: 'steel' },
];

module.exports = async (req, res) => {
  try {
    // --- Fetch prices for the curated list ---
    const curatedResults = await Promise.all(
      STOCKS.map((s) =>
        getStockPrice(s.symbol)
          .then((r) => ({ ...r, ...s }))
          .catch(() => null)
      )
    );
    let stocks = curatedResults.filter(Boolean);

    // --- Merge in recently-saved symbols not already on the list ---
    try {
      const curatedSymbols = new Set(STOCKS.map((s) => s.symbol));
      const recentRes = await pool.query(
        `SELECT DISTINCT symbol FROM psx_prices ORDER BY symbol LIMIT 50`
      );
      const extraSymbols = recentRes.rows
        .map((r) => r.symbol)
        .filter((sym) => !curatedSymbols.has(sym));

      if (extraSymbols.length > 0) {
        const extraResults = await Promise.all(
          extraSymbols.map((sym) =>
            getStockPrice(sym)
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
