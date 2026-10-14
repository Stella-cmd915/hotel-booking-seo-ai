// Κατακερματισμός κωδικών με scrypt (ενσωματωμένο crypto του Node.js)
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.redirect('/admin/login');
}

module.exports = { hashPassword, verifyPassword, requireAdmin };
