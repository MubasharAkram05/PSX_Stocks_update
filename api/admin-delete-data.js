// api/admin-delete-data.js
// Admin-only. DELETE with body { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
// removes all saved price rows within that (inclusive) date range.
// Requires the 'x-admin-token' header (see require-admin.js).

const { pool, ensureSchema } = require('./db');
const { isAdmin } = require('./require-admin');

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Only admin can remove saved data.' });
  }
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
