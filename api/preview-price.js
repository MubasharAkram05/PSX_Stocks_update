// api/preview-price.js
// Called by the frontend at GET /api/preview-price?symbol=SYM
// Fetches today's lowest price for a symbol WITHOUT saving it — used
// to prefill the confirmation popup before the user commits to saving
// (and can edit the value if they want).

const { getDailyLowPrice } = require('../lib/psx');

module.exports = async (req, res) => {
  const symbol = (req.query.symbol || '').trim();
  if (!symbol) {
    return res.status(400).json({ error: 'Please provide a stock symbol.' });
  }

  try {
    const result = await getDailyLowPrice(symbol);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
