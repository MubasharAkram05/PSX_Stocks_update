// api/psx-index.js
// Called by the frontend at GET /api/psx-index
// Best-effort fetch of the KSE-100 index level, using the same
// unofficial PSX data endpoint as individual stock prices (indices
// are queryable the same way as symbols on dps.psx.com.pk). If this
// fails, the frontend just hides the index line rather than showing
// wrong data.

const { getStockPriceWithTrend } = require('../lib/psx');

module.exports = async (req, res) => {
  try {
    const result = await getStockPriceWithTrend('KSE100');
    res.status(200).json({
      points: result.price,
      date: result.date,
      direction: result.direction,
      trend: result.trend,
    });
  } catch (err) {
    console.log('KSE100 index lookup failed: ' + err.message);
    res.status(200).json({ points: null });
  }
};
