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
}

module.exports = { pool, ensureSchema };
