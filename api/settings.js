// api/settings.js
// GET  -> public, returns current settings (e.g. the confirmation
//         popup message shown before saving a price)
// POST { save_confirm_message } -> admin-only, updates a setting

const { pool, ensureSchema } = require('../lib/db');
const { isAdmin } = require('../lib/require-admin');

const DEFAULT_CONFIRM_MESSAGE = 'Save this price to the tracker?';

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'save_confirm_message'`
      );
      const message = result.rows[0] ? result.rows[0].value : DEFAULT_CONFIRM_MESSAGE;
      return res.status(200).json({ save_confirm_message: message });
    }

    if (req.method === 'POST') {
      if (!isAdmin(req)) {
        return res.status(401).json({ error: 'Only admin can change settings.' });
      }
      const { save_confirm_message } = req.body || {};
      if (typeof save_confirm_message !== 'string' || !save_confirm_message.trim()) {
        return res.status(400).json({ error: 'A confirmation message is required.' });
      }
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('save_confirm_message', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [save_confirm_message.trim()]
      );
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
