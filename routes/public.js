// Δημόσιες σελίδες: αρχική, δωμάτια, οδηγός πόλης, επικοινωνία, SEO αρχεία
const express = require('express');
const db = require('../db/database');
const { analyzeReviews } = require('../services/ai');
const router = express.Router();

const rooms = () => db.prepare('SELECT * FROM room_types ORDER BY base_price').all();

router.get('/', (req, res) => {
  const reviews = db.prepare('SELECT * FROM reviews WHERE rating>=4 ORDER BY created_at DESC LIMIT 3').all();
  const all = db.prepare('SELECT rating FROM reviews').all();
  const avg = (all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1);
  const faq = db.prepare('SELECT * FROM faq LIMIT 5').all();
  res.render('home', {
    title: 'Leukon Urban Hotel | Ξενοδοχείο στο κέντρο της Θεσσαλονίκης',
    description: 'Boutique ξενοδοχείο στην οδό Τσιμισκή, 7 λεπτά από τον Λευκό Πύργο. Κάντε απευθείας κράτηση με πρωινό, δωρεάν Wi-Fi και δωρεάν ακύρωση.',
    rooms: rooms(), reviews, avg, reviewCount: all.length, faq
  });
});

router.get('/rooms', (req, res) => {
  res.render('rooms', {
    title: 'Δωμάτια & Σουίτες στη Θεσσαλονίκη | Leukon Urban Hotel',
    description: 'Δείτε τα δωμάτια και τις σουίτες του Leukon Urban Hotel: δίκλινα, δωμάτια με θέα θάλασσα, οικογενειακές και executive σουίτες στο κέντρο της Θεσσαλονίκης.',
    rooms: rooms(), breadcrumbs: [{ name: 'Δωμάτια', url: '/rooms' }]
  });
});

router.get('/rooms/:slug', (req, res, next) => {
  const room = db.prepare('SELECT * FROM room_types WHERE slug=?').get(req.params.slug);
  if (!room) return next();
  const others = db.prepare('SELECT * FROM room_types WHERE id!=? ORDER BY base_price LIMIT 3').all(room.id);
  res.render('room', {
    title: room.meta_title || `${room.name} | Leukon Urban Hotel Θεσσαλονίκη`,
    description: room.meta_description || room.short_desc,
    ogImage: room.image, room, others,
    breadcrumbs: [{ name: 'Δωμάτια', url: '/rooms' }, { name: room.name, url: '/rooms/' + room.slug }]
  });
});

router.get('/thessaloniki-guide', (req, res) => {
  res.render('guide', {
    title: 'Οδηγός Θεσσαλονίκης: 10 αξιοθέατα κοντά στο ξενοδοχείο | Leukon',
    description: 'Τι να δείτε στη Θεσσαλονίκη με τα πόδια από το κέντρο: Λευκός Πύργος, Ροτόντα, Άνω Πόλη, Λαδάδικα, αγορές και γαστρονομία. Πρακτικός οδηγός.',
    breadcrumbs: [{ name: 'Οδηγός Θεσσαλονίκης', url: '/thessaloniki-guide' }]
  });
});

router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Επικοινωνία & Τοποθεσία | Leukon Urban Hotel Θεσσαλονίκη',
    description: 'Διεύθυνση, τηλέφωνο και οδηγίες πρόσβασης για το Leukon Urban Hotel στην οδό Τσιμισκή, στο κέντρο της Θεσσαλονίκης.',
    sent: req.query.sent, breadcrumbs: [{ name: 'Επικοινωνία', url: '/contact' }]
  });
});
router.post('/contact', (req, res) => res.redirect('/contact?sent=1'));

router.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Πολιτική απορρήτου | Leukon Urban Hotel', description: 'Πώς επεξεργαζόμαστε τα προσωπικά δεδομένα των επισκεπτών μας σύμφωνα με τον GDPR.', breadcrumbs: [{ name: 'Πολιτική απορρήτου', url: '/privacy' }] });
});

// ---------- Technical SEO ----------
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /booking/confirmation\nAllow: /\n\nSitemap: ${res.locals.siteUrl}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const base = res.locals.siteUrl;
  const urls = ['/', '/rooms', '/booking', '/thessaloniki-guide', '/contact', '/privacy', ...rooms().map(r => '/rooms/' + r.slug)];
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod><priority>${u === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n') +
    `\n</urlset>`;
  res.type('application/xml').send(xml);
});

module.exports = router;
