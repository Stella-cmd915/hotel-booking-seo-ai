// JSON API: διαθεσιμότητα (για ενσωμάτωση/έλεγχο) και ψηφιακός βοηθός
const express = require('express');
const db = require('../db/database');
const B = require('../services/booking');
const { chatbotAnswer } = require('../services/ai');
const router = express.Router();

router.get('/availability', (req, res) => {
  const errors = B.validateSearch(req.query);
  if (errors.length) return res.status(400).json({ errors });
  const data = B.searchAvailability(req.query).map(r => ({
    room: r.slug, name: r.name, available: r.available, free_units: Math.max(r.free, 0),
    nights: r.price.nights, total_eur: r.price.total
  }));
  res.json({ check_in: req.query.check_in, check_out: req.query.check_out, guests: +req.query.guests, rooms: data });
});

// Απλό όριο αιτημάτων ανά IP για τον βοηθό (προστασία από κατάχρηση)
const hits = new Map();
router.post('/chat', (req, res) => {
  const ip = req.ip; const now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < 60000); h.push(now); hits.set(ip, h);
  if (h.length > 20) return res.status(429).json({ answer: 'Πολλά μηνύματα σε σύντομο χρόνο. Δοκιμάστε ξανά σε λίγο.' });
  const message = String(req.body.message || '').slice(0, 300);
  const faqs = db.prepare('SELECT * FROM faq').all();
  const r = chatbotAnswer(message, faqs);
  db.prepare('INSERT INTO chat_log (message,matched_faq,score) VALUES (?,?,?)').run(message, r.faqId || null, r.score || 0);
  res.json(r);
});

module.exports = router;
