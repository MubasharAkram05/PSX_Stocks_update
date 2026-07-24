// api/delete-data.js
// Called by the frontend at DELETE /api/delete-data with
// { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }.
// Permanently removes saved price rows within that (inclusive) date
// range. The frontend confirms with the user before calling this.

const { pool, ensureSchema } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { from, to } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ error: 'Both a From and To date are required.' });
  }

  try {
    await ensureSchema();
    const result = await pool.query(
      `DELETE FROM psx_prices WHERE date >= $1 AND date <= $2`,
      [from, to]
    );
    res.status(200).json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
