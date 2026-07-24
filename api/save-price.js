// api/save-price.js
// Called by the frontend at POST /api/save-price with { symbol }.
// Fetches the current PSX price and inserts a row into the
// "psx_prices" table in the database.

const { pool } = require('./db');
const { getStockPrice } = require('./psx');

// -------------------------------------------------------
// Make sure the table exists, then insert the row
// -------------------------------------------------------
async function saveToDatabase({ date, symbol, price }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS psx_prices (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      symbol TEXT NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(
    `INSERT INTO psx_prices (date, symbol, price) VALUES ($1, $2, $3)`,
    [date, symbol, price]
  );
}

// -------------------------------------------------------
// The serverless function Vercel runs
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
