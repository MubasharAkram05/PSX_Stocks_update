// api/admin-login.js
// POST /api/admin-login with { password }. Returns a token to store
// client-side (localStorage) and send back as the x-admin-token
// header on every admin request (save price, add/remove/reorder
// stocks).

const { getAdminToken } = require('./admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password is not configured on the server.' });
  }

  const { password } = req.body || {};
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  res.status(200).json({ token: getAdminToken() });
};
