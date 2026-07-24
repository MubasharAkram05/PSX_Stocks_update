// api/admin-login.js
// Called by admin.html at POST /api/admin-login with { password }.
// If it matches the ADMIN_PASSWORD environment variable, returns a
// token (the password itself) that the browser stores and sends back
// as the 'x-admin-token' header on protected admin requests.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({
      error: 'Admin password is not configured. Set ADMIN_PASSWORD in your Vercel project environment variables.',
    });
  }

  const { password } = req.body || {};
  if (password === adminPassword) {
    return res.status(200).json({ success: true, token: adminPassword });
  }

  res.status(401).json({ error: 'Incorrect password.' });
};
