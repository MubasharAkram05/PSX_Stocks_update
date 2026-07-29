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
      price_low NUMERIC NOT NULL,
      price_high NUMERIC,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Older deployments have a single "price" column (today's low
  // only). Migrate it to price_low and add price_high for the new
  // high/low tracking, without losing any saved history.
  const colsRes = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'psx_prices'
  `);
  const cols = colsRes.rows.map((r) => r.column_name);
  if (cols.includes('price') && !cols.includes('price_low')) {
    await pool.query(`ALTER TABLE psx_prices RENAME COLUMN price TO price_low`);
  }
  if (!cols.includes('price_high')) {
    await pool.query(`ALTER TABLE psx_prices ADD COLUMN price_high NUMERIC`);
  }

  // If old duplicate (symbol, date) rows exist from before this
  // constraint existed, clean them up first — keep the lowest price,
  // since that's the rule going forward too.
  await pool.query(`
    DELETE FROM psx_prices p
    WHERE p.id NOT IN (
      SELECT DISTINCT ON (symbol, date) id
      FROM psx_prices
      ORDER BY symbol, date, price_low ASC, id ASC
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

  // --- Which stocks show on the Stocks / Short Term pages, and their
  // sector. list_type separates the two pages' lists ('main' vs
  // 'short-term') so the same symbol can be tracked independently on
  // both. ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_sectors (
      symbol TEXT NOT NULL,
      sector TEXT NOT NULL DEFAULT 'other',
      sort_order INTEGER,
      list_type TEXT NOT NULL DEFAULT 'main',
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (symbol, list_type)
    )
  `);
  await pool.query(`ALTER TABLE stock_sectors ADD COLUMN IF NOT EXISTS sort_order INTEGER`);
  await pool.query(`ALTER TABLE stock_sectors ADD COLUMN IF NOT EXISTS list_type TEXT NOT NULL DEFAULT 'main'`);
  await widenPrimaryKey('stock_sectors', ['symbol', 'list_type']);

  // One-time seed: carry over any symbols already saved before this
  // table existed, guessing their sector from the static lookup.
  const countRes = await pool.query(`SELECT COUNT(*) FROM stock_sectors`);
  if (Number(countRes.rows[0].count) === 0) {
    const SECTOR_META = require('./sector-meta');
    const existingRes = await pool.query(`SELECT DISTINCT symbol FROM psx_prices`);
    for (const row of existingRes.rows) {
      const sector = SECTOR_META[row.symbol] || 'other';
      await pool.query(
        `INSERT INTO stock_sectors (symbol, sector) VALUES ($1, $2) ON CONFLICT (symbol, list_type) DO NOTHING`,
        [row.symbol, sector]
      );
    }
  }

  // Manual sector-group ordering for the Stocks / Short Term pages
  // (which sector shows first). Falls back to a curated default order
  // when a sector has no explicit row here — see lib/stock-order.js.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sector_order (
      sector TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      list_type TEXT NOT NULL DEFAULT 'main',
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (sector, list_type)
    )
  `);
  await pool.query(`ALTER TABLE sector_order ADD COLUMN IF NOT EXISTS list_type TEXT NOT NULL DEFAULT 'main'`);
  await widenPrimaryKey('sector_order', ['sector', 'list_type']);
}

// Older deployments have a single-column primary key on tables that
// now need a composite one (to add list_type without breaking
// uniqueness per-symbol/per-sector). Widens it in place, once.
async function widenPrimaryKey(table, cols) {
  const pkRes = await pool.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
    [table]
  );
  const pkCols = pkRes.rows.map((r) => r.column_name);
  const alreadyWide = pkCols.length === cols.length && cols.every((c) => pkCols.includes(c));
  if (alreadyWide) return;

  await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
  await pool.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${cols.join(', ')})`);
}

module.exports = { pool, ensureSchema };
