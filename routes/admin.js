// Περιβάλλον διαχείρισης: πίνακας ελέγχου, κρατήσεις, δωμάτια, εργαλεία AI
const express = require('express');
const db = require('../db/database');
const { verifyPassword, requireAdmin } = require('../services/auth');
const AI = require('../services/ai');
const router = express.Router();
const meta = t => ({ title: t + ' | Διαχείριση Leukon', description: '', noindex: true, isAdmin: true });

router.get('/login', (req, res) => res.render('admin/login', { ...meta('Σύνδεση'), error: null }));
router.post('/login', (req, res) => {
  const u = db.prepare('SELECT * FROM admins WHERE username=?').get(req.body.username || '');
  if (u && verifyPassword(req.body.password || '', u.password_hash)) {
    req.session.regenerate(() => { req.session.admin = { id: u.id, username: u.username }; res.redirect('/admin'); });
  } else res.status(401).render('admin/login', { ...meta('Σύνδεση'), error: 'Λανθασμένα στοιχεία σύνδεσης.' });
});
router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

router.use(requireAdmin);

// ---------- Πίνακας ελέγχου ----------
router.get('/', (req, res) => {
  const k = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) rev FROM bookings WHERE status!='cancelled'`).get();
  const ev = t => db.prepare('SELECT COUNT(*) c FROM events WHERE type=?').get(t).c;
  const funnel = [
    { step: 'Προβολές σελίδων', n: ev('page_view') },
    { step: 'Αναζητήσεις διαθεσιμότητας', n: ev('search') },
    { step: 'Φόρμα στοιχείων', n: ev('checkout_view') },
    { step: 'Ολοκληρωμένες κρατήσεις', n: ev('booking') }
  ];
  const sources = db.prepare(`SELECT COALESCE(source,'direct') s, COUNT(*) n FROM bookings GROUP BY s ORDER BY n DESC`).all();
  // Πληρότητα επόμενων 30 ημερών
  const inv = db.prepare('SELECT SUM(inventory) s FROM room_types').get().s;
  const today = new Date(); let occ = 0;
  const cnt = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE status!='cancelled' AND check_in<=? AND check_out>?`);
  const days = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() + i * 864e5).toISOString().slice(0, 10);
    const c = cnt.get(d, d).c; occ += c; days.push({ d, pct: Math.round((c / inv) * 100) });
  }
  const recent = db.prepare(`SELECT b.*, r.name room FROM bookings b JOIN room_types r ON r.id=b.room_type_id ORDER BY b.id DESC LIMIT 6`).all();
  const unanswered = db.prepare('SELECT COUNT(*) c FROM chat_log WHERE matched_faq IS NULL AND score<0.34').get().c;
  res.render('admin/dashboard', {
    ...meta('Πίνακας ελέγχου'), k, funnel, sources, occupancy: Math.round((occ / (inv * 30)) * 100), days, recent, unanswered,
    adr: k.n ? Math.round(k.rev / db.prepare(`SELECT COALESCE(SUM(julianday(check_out)-julianday(check_in)),1) n FROM bookings WHERE status!='cancelled'`).get().n) : 0
  });
});

// ---------- Κρατήσεις ----------
router.get('/bookings', (req, res) => {
  const status = req.query.status || '';
  const list = db.prepare(`SELECT b.*, r.name room FROM bookings b JOIN room_types r ON r.id=b.room_type_id
    WHERE (?='' OR b.status=?) ORDER BY b.check_in`).all(status, status);
  res.render('admin/bookings', { ...meta('Κρατήσεις'), list, status });
});
router.post('/bookings/:id/status', (req, res) => {
  if (['pending', 'confirmed', 'cancelled'].includes(req.body.status))
    db.prepare('UPDATE bookings SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.redirect('/admin/bookings');
});

// ---------- Δωμάτια & SEO πεδία ----------
router.get('/rooms', (req, res) => res.render('admin/rooms', { ...meta('Δωμάτια'), rooms: db.prepare('SELECT * FROM room_types ORDER BY base_price').all(), saved: req.query.saved }));
router.post('/rooms/:id', (req, res) => {
  const b = req.body;
  db.prepare(`UPDATE room_types SET base_price=?, inventory=?, short_desc=?, meta_title=?, meta_description=? WHERE id=?`)
    .run(parseFloat(b.base_price), parseInt(b.inventory, 10), b.short_desc, b.meta_title || null, b.meta_description || null, req.params.id);
  res.redirect('/admin/rooms?saved=1');
});

// ---------- Εργαλεία AI ----------
router.get('/ai', (req, res) => {
  const rooms = db.prepare('SELECT * FROM room_types ORDER BY base_price').all();
  const room = rooms.find(r => r.id == req.query.room) || rooms[0];
  const channel = req.query.channel || 'instagram';
  const seo = AI.seoMeta(room);
  const social = AI.socialPost(room, channel, req.query.offer || '');
  const suggestions = db.prepare(`SELECT s.*, r.name room FROM ai_suggestions s LEFT JOIN room_types r ON r.id=s.room_type_id ORDER BY s.id DESC LIMIT 8`).all();
  res.render('admin/ai', { ...meta('Εργαλεία AI'), rooms, room, seo, social, channel, offer: req.query.offer || '', suggestions, tab: req.query.tab || 'seo' });
});
router.post('/ai/suggest', (req, res) => {
  const b = req.body;
  const content = b.kind === 'meta' ? JSON.stringify({ title: b.title, description: b.description }) : b.content;
  db.prepare('INSERT INTO ai_suggestions (kind,room_type_id,content) VALUES (?,?,?)').run(b.kind, b.room_type_id, content);
  res.redirect(`/admin/ai?room=${b.room_type_id}&tab=${b.kind === 'meta' ? 'seo' : 'social'}`);
});
// Ανθρώπινη έγκριση: μόνο μετά την έγκριση η πρόταση εφαρμόζεται στην ιστοσελίδα
router.post('/ai/suggestions/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM ai_suggestions WHERE id=?').get(req.params.id);
  if (s && ['approved', 'rejected'].includes(req.body.action)) {
    db.prepare('UPDATE ai_suggestions SET status=? WHERE id=?').run(req.body.action, s.id);
    if (req.body.action === 'approved' && s.kind === 'meta') {
      const m = JSON.parse(s.content);
      db.prepare('UPDATE room_types SET meta_title=?, meta_description=? WHERE id=?').run(m.title, m.description, s.room_type_id);
    }
  }
  res.redirect('/admin/ai?room=' + (s ? s.room_type_id : ''));
});

router.get('/reviews', (req, res) => {
  const reviews = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all();
  res.render('admin/reviews', { ...meta('Ανάλυση αξιολογήσεων'), a: AI.analyzeReviews(reviews) });
});

router.get('/chatbot', (req, res) => {
  const log = db.prepare(`SELECT c.*, f.question FROM chat_log c LEFT JOIN faq f ON f.id=c.matched_faq ORDER BY c.id DESC LIMIT 25`).all();
  const faq = db.prepare('SELECT * FROM faq').all();
  res.render('admin/chatbot', { ...meta('Ψηφιακός βοηθός'), log, faq });
});
router.post('/chatbot/faq', (req, res) => {
  const b = req.body;
  if (b.question && b.answer) db.prepare('INSERT INTO faq (question,answer,keywords) VALUES (?,?,?)').run(b.question, b.answer, b.keywords || '');
  res.redirect('/admin/chatbot');
});

module.exports = router;
