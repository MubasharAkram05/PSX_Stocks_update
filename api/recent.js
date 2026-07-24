// api/recent.js
// Called by the frontend at GET /api/recent
// Returns the last 15 rows saved into the database, most recent first.

const { pool } = require('./db');

module.exports = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date, symbol, price FROM psx_prices ORDER BY id DESC LIMIT 15`
    );
    res.status(200).json({ recent: result.rows });
  } catch (err) {
    console.error(err);
    // Table may not exist yet if nothing has been saved at all
    res.status(200).json({ recent: [] });
  }
};
