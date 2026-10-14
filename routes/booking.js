// Μηχανή κρατήσεων: αναζήτηση → επιλογή δωματίου → στοιχεία → επιβεβαίωση
const express = require('express');
const db = require('../db/database');
const B = require('../services/booking');
const router = express.Router();
const logEvent = db.prepare('INSERT INTO events (type,path,source) VALUES (?,?,?)');

// Βήμα 1: αναζήτηση διαθεσιμότητας
router.get('/', (req, res) => {
  const q = { check_in: req.query.check_in, check_out: req.query.check_out, guests: req.query.guests || 2 };
  let results = null, errors = [];
  if (q.check_in && q.check_out) {
    errors = B.validateSearch(q);
    if (!errors.length) {
      results = B.searchAvailability(q);
      logEvent.run('search', '/booking', req.query.utm_source || 'direct');
    }
  }
  res.render('booking', {
    title: 'Online κράτηση – Έλεγχος διαθεσιμότητας | Leukon Urban Hotel',
    description: 'Ελέγξτε διαθεσιμότητα και τιμές σε πραγματικό χρόνο και κάντε απευθείας κράτηση στο Leukon Urban Hotel Θεσσαλονίκη.',
    q, results, errors, nights: results ? B.nightsBetween(q.check_in, q.check_out) : 0, step: results ? 2 : 1
  });
});

// Βήμα 3: φόρμα στοιχείων επισκέπτη
router.get('/checkout', (req, res) => {
  const q = req.query;
  const errors = B.validateSearch(q);
  const room = db.prepare('SELECT * FROM room_types WHERE slug=?').get(q.room);
  if (errors.length || !room) return res.redirect('/booking');
  logEvent.run('checkout_view', '/booking/checkout', 'direct');
  res.render('checkout', {
    title: 'Στοιχεία κράτησης | Leukon Urban Hotel', description: 'Ολοκληρώστε την κράτησή σας.', noindex: true,
    q, room, price: B.quote(room, q.check_in, q.check_out), errors: [], form: {}, step: 3
  });
});

router.post('/checkout', (req, res) => {
  const b = req.body;
  const room = db.prepare('SELECT * FROM room_types WHERE slug=?').get(b.room);
  const errors = [...B.validateSearch(b), ...B.validateGuest(b)];
  if (!room) return res.redirect('/booking');
  if (!errors.length) {
    try {
      const code = B.createBooking({ ...b, room_type_id: room.id, guests: parseInt(b.guests, 10), source: b.source });
      logEvent.run('booking', '/booking/checkout', b.source || 'direct');
      return res.redirect('/booking/confirmation/' + code);
    } catch (e) { errors.push(e.message); }
  }
  res.status(422).render('checkout', {
    title: 'Στοιχεία κράτησης | Leukon Urban Hotel', description: 'Ολοκληρώστε την κράτησή σας.', noindex: true,
    q: b, room, price: B.quote(room, b.check_in, b.check_out), errors, form: b, step: 3
  });
});

// Βήμα 4: επιβεβαίωση
router.get('/confirmation/:code', (req, res, next) => {
  const bk = db.prepare(`SELECT b.*, r.name AS room_name, r.image FROM bookings b JOIN room_types r ON r.id=b.room_type_id WHERE code=?`).get(req.params.code);
  if (!bk) return next();
  res.render('confirmation', { title: 'Επιβεβαίωση κράτησης ' + bk.code, description: 'Η κράτησή σας ολοκληρώθηκε.', noindex: true, bk, nights: B.nightsBetween(bk.check_in, bk.check_out), step: 4 });
});

module.exports = router;
