// api/admin-auth.js
// Minimal admin-check shared by every admin-only endpoint. There's no
// user-accounts system in this app, so "admin" just means "knows the
// ADMIN_PASSWORD env var". Login exchanges the password for a token
// (a hash of the password) that's then sent as a header on every
// admin request — nothing is stored server-side, so this stays valid
// across serverless invocations without needing session storage.

const crypto = require('crypto');

function getAdminToken() {
  const secret = process.env.ADMIN_PASSWORD || '';
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function isAdminRequest(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = req.headers['x-admin-token'];
  return !!token && token === getAdminToken();
}

module.exports = { getAdminToken, isAdminRequest };
