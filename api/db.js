// api/db.js
// Shared database connection.
// The Neon integration on Vercel provides the connection string as
// DATABASE_URL (not POSTGRES_URL, which @vercel/postgres expects by
// default) — so we point the pool at it explicitly here.

const { createPool } = require('@vercel/postgres');

const pool = createPool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED,
});

module.exports = { sql: pool.sql };
