// api/require-admin.js
// Shared helper: checks the 'x-admin-token' header against the
// ADMIN_PASSWORD environment variable. This is a simple shared-secret
// check (not full user accounts) — good enough to stop random public
// visitors from adding/removing stocks or prices, not enterprise auth.

function isAdmin(req) {
  const token = req.headers['x-admin-token'];
  const adminPassword = process.env.ADMIN_PASSWORD;
  return !!adminPassword && token === adminPassword;
}

module.exports = { isAdmin };
