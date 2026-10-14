// Leukon Urban Hotel – διαδικτυακή εφαρμογή με online κρατήσεις, SEO και λειτουργίες AI
// Εκκίνηση: npm install && npm start  →  http://localhost:3000
const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

// Βασικές κεφαλίδες ασφαλείας
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'leukon-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 }
}));

// Κοινές μεταβλητές για όλα τα templates
app.use((req, res, next) => {
  res.locals.siteUrl = SITE_URL;
  res.locals.path = req.path;
  res.locals.canonical = SITE_URL + req.path;
  res.locals.admin = req.session.admin || null;
  res.locals.today = new Date().toISOString().slice(0, 10);
  next();
});

// Ανώνυμη καταγραφή προβολών σελίδων (first-party, χωρίς cookies/προσωπικά δεδομένα)
const logEvent = db.prepare('INSERT INTO events (type,path,source) VALUES (?,?,?)');
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/admin') && !req.path.startsWith('/api') && !/\.\w+$/.test(req.path)) {
    const src = req.query.utm_source || (req.get('referer') && !req.get('referer').startsWith(SITE_URL) ? 'referral' : 'direct');
    logEvent.run('page_view', req.path, String(src).slice(0, 40));
  }
  next();
});

app.use('/', require('./routes/public'));
app.use('/booking', require('./routes/booking'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('404', { title: 'Η σελίδα δεν βρέθηκε | Leukon Urban Hotel', description: 'Η σελίδα που αναζητήσατε δεν υπάρχει.', noindex: true }));

app.listen(PORT, () => console.log(`Leukon Urban Hotel: ${SITE_URL}  (διαχείριση: ${SITE_URL}/admin)`));
