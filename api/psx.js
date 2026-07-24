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

module.exports = { getStockPrice, getStockPriceWithTrend };

// -------------------------------------------------------
// Same as getStockPrice, but also returns a short recent price
// history (for a sparkline) and whether the trend is up or down.
// Uses the same EOD endpoint — no extra network calls.
// -------------------------------------------------------
async function getStockPriceWithTrend(symbol) {
  const sym = symbol.trim().toUpperCase();

  try {
    const url = `https://dps.psx.com.pk/timeseries/eod/${sym}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const rows = data && data.data ? data.data : data;
    if (Array.isArray(rows) && rows.length > 0) {
      // rows are newest-first; take the last 7 trading days, oldest to newest
      const recent = rows.slice(0, 7).reverse();
      const trend = recent.map((r) => Number(r[1]));
      const [latestTs, latestPrice] = rows[0];

      let direction = 'flat';
      if (trend.length >= 2) {
        const first = trend[0];
        const last = trend[trend.length - 1];
        if (last > first) direction = 'up';
        else if (last < first) direction = 'down';
      }

      return {
        symbol: sym,
        price: Number(latestPrice),
        date: new Date(latestTs * 1000).toISOString().split('T')[0],
        trend,
        direction,
      };
    }
  } catch (err) {
    console.log(`Trend lookup failed for ${sym}: ${err.message}`);
  }

  // Fall back to a plain price with no trend rather than failing entirely
  try {
    const plain = await getStockPrice(sym);
    return { ...plain, trend: [], direction: 'flat' };
  } catch (err) {
    throw err;
  }
}
