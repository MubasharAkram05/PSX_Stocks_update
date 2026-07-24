// api/psx.js
// Shared PSX price-fetching logic used by save-price.js and top-stocks.js

const axios = require('axios');

async function getStockPrice(symbol) {
  const sym = symbol.trim().toUpperCase();

  // --- Try End-Of-Day (closing) price first ---
  try {
    const url = `https://dps.psx.com.pk/timeseries/eod/${sym}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const rows = data && data.data ? data.data : data;
    if (Array.isArray(rows) && rows.length > 0) {
      const [ts, price] = rows[0]; // PSX returns newest first
      return {
        symbol: sym,
        price: Number(price),
        date: new Date(ts * 1000).toISOString().split('T')[0],
      };
    }
  } catch (err) {
    console.log(`EOD lookup failed for ${sym}: ${err.message}`);
  }

  // --- Fallback: latest intraday tick ---
  try {
    const url = `https://dps.psx.com.pk/timeseries/int/${sym}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const rows = data && data.data ? data.data : data;
    if (Array.isArray(rows) && rows.length > 0) {
      const [ts, price] = rows[0];
      return {
        symbol: sym,
        price: Number(price),
        date: new Date(ts * 1000).toISOString().split('T')[0],
      };
    }
  } catch (err) {
    console.log(`Intraday lookup failed for ${sym}: ${err.message}`);
  }

  throw new Error(
    `Could not find a price for "${sym}". Check the symbol is correct (e.g. ENGRO, MEBL, LUCK).`
  );
}

module.exports = { getStockPrice };
