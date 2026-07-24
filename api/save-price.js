// api/save-price.js
// Called by the frontend at POST /api/save-price with { symbol }.
// Fetches the current PSX price and inserts a row into the
// "psx_prices" table in Vercel Postgres.

const axios = require('axios');
const { sql } = require('@vercel/postgres');

// -------------------------------------------------------
// 1. Fetch the current/latest price for a PSX symbol
// -------------------------------------------------------
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

// -------------------------------------------------------
// 2. Make sure the table exists, then insert the row
// -------------------------------------------------------
async function saveToDatabase({ date, symbol, price }) {
  await sql`
    CREATE TABLE IF NOT EXISTS psx_prices (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      symbol TEXT NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO psx_prices (date, symbol, price)
    VALUES (${date}, ${symbol}, ${price})
  `;
}

// -------------------------------------------------------
// 3. The serverless function Vercel runs
// -------------------------------------------------------
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.body || {};
  if (!symbol || !symbol.trim()) {
    return res.status(400).json({ error: 'Please provide a stock symbol.' });
  }

  try {
    const result = await getStockPrice(symbol);
    await saveToDatabase(result);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
