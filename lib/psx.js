// lib/psx.js
// Shared PSX price-fetching logic used by save-price.js, recent.js,
// cron-daily-save.js, and psx-index.js

const axios = require('axios');

// PSX's data portal sits behind bot protection that rejects requests
// without browser-like headers (returns 403 instead of JSON) — every
// call needs these or the lookup silently fails.
const PSX_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://dps.psx.com.pk/',
};

async function getStockPrice(symbol) {
  const sym = symbol.trim().toUpperCase();

  // --- Try End-Of-Day (closing) price first ---
  try {
    const url = `https://dps.psx.com.pk/timeseries/eod/${sym}`;
    const { data } = await axios.get(url, { timeout: 8000, headers: PSX_HEADERS });
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
    const { data } = await axios.get(url, { timeout: 8000, headers: PSX_HEADERS });
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

module.exports = { getStockPrice, getStockPriceWithTrend, getDailyLowPrice };

// -------------------------------------------------------
// Returns the LOWEST price recorded for the symbol so far today,
// using intraday tick data (not just the latest/current price).
// Falls back to the EOD close if intraday data isn't available.
// -------------------------------------------------------
async function getDailyLowPrice(symbol) {
  const sym = symbol.trim().toUpperCase();
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const url = `https://dps.psx.com.pk/timeseries/int/${sym}`;
    const { data } = await axios.get(url, { timeout: 8000, headers: PSX_HEADERS });
    const rows = data && data.data ? data.data : data;
    if (Array.isArray(rows) && rows.length > 0) {
      const todayRows = rows.filter(
        (r) => new Date(r[0] * 1000).toISOString().split('T')[0] === todayStr
      );
      const useRows = todayRows.length > 0 ? todayRows : rows;
      const prices = useRows.map((r) => Number(r[1])).filter((p) => !isNaN(p) && p > 0);
      if (prices.length > 0) {
        return { symbol: sym, price: Math.min(...prices), date: todayStr };
      }
    }
  } catch (err) {
    console.log(`Daily low lookup failed for ${sym}: ${err.message}`);
  }

  // Fallback: EOD close, if intraday ticks aren't available
  const plain = await getStockPrice(sym);
  return { symbol: plain.symbol, price: plain.price, date: todayStr };
}

// -------------------------------------------------------
// Latest single intraday tick — used to keep the displayed price live
// during market hours, when the EOD feed below still only has
// yesterday's (or Friday's) close because today hasn't settled yet.
// -------------------------------------------------------
async function getLatestIntradayTick(symbol) {
  const sym = symbol.trim().toUpperCase();
  const url = `https://dps.psx.com.pk/timeseries/int/${sym}`;
  const { data } = await axios.get(url, { timeout: 8000, headers: PSX_HEADERS });
  const rows = data && data.data ? data.data : data;
  if (Array.isArray(rows) && rows.length > 0) {
    const [ts, price] = rows[0]; // newest first
    return { price: Number(price), date: new Date(ts * 1000).toISOString().split('T')[0] };
  }
  return null;
}

// -------------------------------------------------------
// Same as getStockPrice, but also returns a short recent price
// history (for a sparkline) and whether the trend is up or down.
// The trend/history comes from the EOD feed (daily closes), but the
// headline price/date is upgraded to today's latest intraday tick
// when one exists — otherwise this shows a stale prior-day close for
// the whole trading day, since EOD data only lands after market close.
// The EOD and intraday lookups run in parallel (not one after the
// other) so a single symbol never needs two full round-trips back to
// back — important when a page fetches many symbols at once.
//
// "direction" always means "vs. the previous close", computed against
// whichever baseline matches the headline price — the last EOD close
// when a live tick is showing, or the day-before's close when it
// isn't. It's calculated after the price is finalized so the
// up/down arrow can never disagree with the number next to it.
// -------------------------------------------------------
async function getStockPriceWithTrend(symbol) {
  const sym = symbol.trim().toUpperCase();

  try {
    const eodUrl = `https://dps.psx.com.pk/timeseries/eod/${sym}`;
    const [eodRes, liveTick] = await Promise.all([
      axios.get(eodUrl, { timeout: 8000, headers: PSX_HEADERS }),
      getLatestIntradayTick(sym).catch((err) => {
        console.log(`Live tick lookup failed for ${sym}: ${err.message}`);
        return null;
      }),
    ]);
    const rows = eodRes.data && eodRes.data.data ? eodRes.data.data : eodRes.data;
    if (Array.isArray(rows) && rows.length > 0) {
      // rows are newest-first; take the last 7 trading days, oldest to newest
      const recent = rows.slice(0, 7).reverse();
      const trend = recent.map((r) => Number(r[1]));
      const [latestTs, latestPrice] = rows[0];
      const lastClose = Number(latestPrice);
      const prevClose = trend.length >= 2 ? trend[trend.length - 2] : null;

      const result = {
        symbol: sym,
        price: lastClose,
        date: new Date(latestTs * 1000).toISOString().split('T')[0],
        trend,
        direction: 'flat',
      };

      let baseline = prevClose;
      if (liveTick && liveTick.date >= result.date) {
        result.price = liveTick.price;
        result.date = liveTick.date;
        baseline = lastClose;
      }

      if (baseline != null) {
        if (result.price > baseline) result.direction = 'up';
        else if (result.price < baseline) result.direction = 'down';
      }

      return result;
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
