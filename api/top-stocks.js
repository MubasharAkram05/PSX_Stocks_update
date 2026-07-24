// api/top-stocks.js
// Called by the frontend at GET /api/top-stocks
// Returns current prices for 20 well-known, heavily-traded PSX
// symbols, for the sidebar suggestion list. Fetched in parallel;
// any symbol that fails to look up is silently skipped rather than
// failing the whole list.

const { getStockPrice } = require('./psx');

// Frequently-traded / large-cap PSX symbols across major sectors.
// You can edit this list any time to change what shows up in the
// suggestions sidebar.
const TOP_SYMBOLS = [
  'OGDC', 'PPL', 'LUCK', 'ENGRO', 'MEBL', 'UBL', 'HBL', 'MCB',
  'FFC', 'PSO', 'HUBC', 'SYS', 'MARI', 'POL', 'BAHL', 'EFERT',
  'SNGP', 'FCCL', 'KEL', 'PAEL',
];

module.exports = async (req, res) => {
  try {
    const results = await Promise.all(
      TOP_SYMBOLS.map((sym) =>
        getStockPrice(sym).catch(() => null) // skip symbols that fail
      )
    );
    const stocks = results.filter(Boolean);
    res.status(200).json({ stocks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
