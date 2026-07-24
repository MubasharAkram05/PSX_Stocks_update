// lib/db.js
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

  // --- Which stocks show on the Stocks page, and their sector ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_sectors (
      symbol TEXT PRIMARY KEY,
      sector TEXT NOT NULL DEFAULT 'other',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // One-time seed: carry over any symbols already saved before this
  // table existed, guessing their sector from the static lookup.
  const countRes = await pool.query(`SELECT COUNT(*) FROM stock_sectors`);
  if (Number(countRes.rows[0].count) === 0) {
    const SECTOR_META = require('./sector-meta');
    const existingRes = await pool.query(`SELECT DISTINCT symbol FROM psx_prices`);
    for (const row of existingRes.rows) {
      const sector = SECTOR_META[row.symbol] || 'other';
      await pool.query(
        `INSERT INTO stock_sectors (symbol, sector) VALUES ($1, $2) ON CONFLICT (symbol) DO NOTHING`,
        [row.symbol, sector]
      );
    }
  }
}

module.exports = { pool, ensureSchema };
