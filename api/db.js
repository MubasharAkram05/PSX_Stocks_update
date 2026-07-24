// api/db.js
// Shared database connection using the standard "pg" library.
// Neon (which powers Vercel's Postgres storage) provides the
// connection string as DATABASE_URL. Neon requires SSL.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
});

// -------------------------------------------------------
// Makes sure the table exists and enforces "one row per symbol per
// day" — needed so INSERT ... ON CONFLICT (symbol, date) upserts
// work. Safe to call every time: cheap no-ops once already applied.
// -------------------------------------------------------
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS psx_prices (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      symbol TEXT NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // If old duplicate (symbol, date) rows exist from before this
  // constraint existed, clean them up first — keep the lowest price,
  // since that's the rule going forward too.
  await pool.query(`
    DELETE FROM psx_prices p
    WHERE p.id NOT IN (
      SELECT DISTINCT ON (symbol, date) id
      FROM psx_prices
      ORDER BY symbol, date, price ASC, id ASC
    )
  `);

  try {
    await pool.query(`
      ALTER TABLE psx_prices
      ADD CONSTRAINT psx_prices_symbol_date_unique UNIQUE (symbol, date)
    `);
  } catch (err) {
    // Already exists — fine, ignore.
  }

  // --- Admin-managed stock list (what shows on the Top Stocks page) ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_list (
      symbol TEXT PRIMARY KEY,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // One-time seed: if the admin list is empty but prices have already
  // been saved before (e.g. an existing deployment), carry those
  // symbols over so the Top Stocks page doesn't go blank. After this,
  // only the admin adds/removes symbols from the list.
  const countRes = await pool.query(`SELECT COUNT(*) FROM stock_list`);
  if (Number(countRes.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO stock_list (symbol, sort_order)
      SELECT symbol, ROW_NUMBER() OVER (ORDER BY symbol) - 1
      FROM (SELECT DISTINCT symbol FROM psx_prices) s
      ON CONFLICT (symbol) DO NOTHING
    `);
  }
}

module.exports = { pool, ensureSchema };
