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

module.exports = { pool };
