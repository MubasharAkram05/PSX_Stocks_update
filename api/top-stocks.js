// api/top-stocks.js
// Called by the frontend at GET /api/top-stocks
// Returns the stock list as managed by the admin (add/remove/reorder
// via admin.html + api/admin-stocks.js) — NOT an independent fetch
// from PSX, and no longer tied directly to price-save history.
//
// A static metadata table (SECTOR_META below) enriches known symbols
// with sector / dividend / growth tags purely for the filter dropdowns
// — it does NOT add any stock to the list on its own. Symbols not in
// this table just get sector: 'other' and no dividend/growth tag, so
// they still show up (with fewer filter matches).

const { pool, ensureSchema } = require('./db');
const { getStockPriceWithTrend } = require('./psx');

const SECTOR_META = {
  OGDC: { sector: 'petroleum', dividend: true },
  PPL: { sector: 'petroleum', dividend: true },
  POL: { sector: 'petroleum', dividend: true },
  PSO: { sector: 'petroleum', dividend: true },
  MARI: { sector: 'petroleum', dividend: true },
  SNGP: { sector: 'petroleum' },

  FFC: { sector: 'fertilizer', dividend: true },
  EFERT: { sector: 'fertilizer', dividend: true },
  ENGRO: { sector: 'fertilizer', dividend: true, growth: true },
  FATIMA: { sector: 'fertilizer' },

  SEARL: { sector: 'pharma', growth: true },
  GLAXO: { sector: 'pharma' },
  HINOON: { sector: 'pharma' },
  AGP: { sector: 'pharma' },

  LUCK: { sector: 'cement', growth: true },
  DGKC: { sector: 'cement' },
  MLCF: { sector: 'cement' },
  FCCL: { sector: 'cement' },
  PIOC: { sector: 'cement' },

  SYS: { sector: 'tech', growth: true },
  TRG: { sector: 'tech', growth: true },
  NETSOL: { sector: 'tech', growth: true },

  HUBC: { sector: 'power', dividend: true },
  KAPCO: { sector: 'power', dividend: true },
  KEL: { sector: 'power' },

  ICI: { sector: 'chemical' },

  INDU: { sector: 'auto', dividend: true },
  PSMC: { sector: 'auto' },

  ISL: { sector: 'engineering' },
  ASTL: { sector: 'steel' },
  MEBL: { sector: 'other', growth: true },
};

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const dbRes = await pool.query(`SELECT symbol FROM stock_list ORDER BY sort_order ASC`);
    const symbols = dbRes.rows.map((r) => r.symbol);

    if (symbols.length === 0) {
      return res.status(200).json({ stocks: [] });
    }

    const results = await Promise.all(
      symbols.map((sym) =>
        getStockPriceWithTrend(sym)
          .then((r) => ({ ...r, sector: 'other', ...(SECTOR_META[sym] || {}) }))
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
    // Table may not exist yet if nothing has been saved at all
    res.status(200).json({ stocks: [] });
  }
};
