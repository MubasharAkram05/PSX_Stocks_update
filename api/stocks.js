// api/stocks.js
// Called by the frontend at GET /api/stocks
// Returns every symbol that's ever been saved (from psx_prices),
// each with a live price + trend, tagged with a sector for grouping
// on the Stocks page. SECTOR_META is a static lookup purely for
// grouping display — not live financial data. Symbols not in it fall
// under "other".

const { pool } = require('../lib/db');
const { getStockPriceWithTrend } = require('../lib/psx');

const SECTOR_META = {
  OGDC: 'petroleum', PPL: 'petroleum', POL: 'petroleum', PSO: 'petroleum',
  MARI: 'petroleum', SNGP: 'petroleum', SSGC: 'petroleum', ATRL: 'petroleum', NRL: 'petroleum',

  FFC: 'fertilizer', EFERT: 'fertilizer', ENGRO: 'fertilizer', FATIMA: 'fertilizer', FFBL: 'fertilizer',

  SEARL: 'pharma', GLAXO: 'pharma', HINOON: 'pharma', AGP: 'pharma', IBLHL: 'pharma', HIGHNOON: 'pharma',

  LUCK: 'cement', DGKC: 'cement', MLCF: 'cement', FCCL: 'cement',
  PIOC: 'cement', CHCC: 'cement', KOHC: 'cement', ACPL: 'cement',

  SYS: 'tech', TRG: 'tech', NETSOL: 'tech', AVN: 'tech', PTC: 'tech',

  HUBC: 'power', KAPCO: 'power', KEL: 'power', NPL: 'power',

  ICI: 'chemical', LOTCHEM: 'chemical', EPCL: 'chemical',

  INDU: 'auto', PSMC: 'auto', HCAR: 'auto', MTL: 'auto',

  ISL: 'engineering', ASTL: 'steel',

  MEBL: 'bank', UBL: 'bank', HBL: 'bank', MCB: 'bank', BAHL: 'bank',
  ABL: 'bank', BOP: 'bank', NBP: 'bank', FABL: 'bank', AKBL: 'bank',
};

module.exports = async (req, res) => {
  try {
    const dbRes = await pool.query(`SELECT DISTINCT symbol FROM psx_prices ORDER BY symbol`);
    const symbols = dbRes.rows.map((r) => r.symbol);

    if (symbols.length === 0) {
      return res.status(200).json({ stocks: [] });
    }

    const results = await Promise.all(
      symbols.map((sym) =>
        getStockPriceWithTrend(sym)
          .then((r) => ({ ...r, sector: SECTOR_META[sym] || 'other' }))
          .catch(() => null)
      )
    );

    res.status(200).json({ stocks: results.filter(Boolean) });
  } catch (err) {
    console.error(err);
    // Table may not exist yet if nothing has been saved at all
    res.status(200).json({ stocks: [] });
  }
};
