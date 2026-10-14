# Leukon Urban Hotel – Ιστοσελίδα online κρατήσεων με SEO και λειτουργίες AI

Λειτουργικό πρωτότυπο (portfolio project): ξενοδοχειακή ιστοσελίδα (υποθετικό boutique ξενοδοχείο στο κέντρο της Θεσσαλονίκης) με μηχανή άμεσων κρατήσεων, technical/on-page SEO και απλές λειτουργίες AI με ανθρώπινη έγκριση.

## Απαιτήσεις
- Node.js **22.13 ή νεότερο** (χρησιμοποιείται το ενσωματωμένο `node:sqlite`, δεν χρειάζεται εγκατάσταση βάσης)

## Εγκατάσταση & εκτέλεση
```bash
npm install        # express, ejs, express-session
npm start          # http://localhost:3000
```
- Δημόσια ιστοσελίδα: http://localhost:3000
- Διαχείριση: http://localhost:3000/admin — χρήστης `admin`, κωδικός `leukon2026`

Η βάση (`db/hotel.db`) δημιουργείται αυτόματα με δεδομένα επίδειξης στην πρώτη εκκίνηση.

## Χρήσιμες εντολές
```bash
npm test           # 18 αυτοματοποιημένα σενάρια ελέγχου (ο server πρέπει να τρέχει)
npm run demo       # προσομοίωση επισκεψιμότητας/κρατήσεων για τον πίνακα ελέγχου
npm run reset      # διαγραφή βάσης → επαναφορά στα αρχικά δεδομένα
```
Σημ.: τα tests δημιουργούν δοκιμαστικές κρατήσεις. Για «καθαρή» παρουσίαση: `npm run reset`, `npm start`, `npm run demo`.

## Δομή
```
server.js                 εξυπηρετητής Express, sessions, κεφαλίδες ασφαλείας
db/                       database.js (σχήμα), seed.json (δωμάτια, FAQ, αξιολογήσεις)
routes/                   public.js, booking.js, api.js, admin.js
services/                 booking.js (διαθεσιμότητα/τιμολόγηση), ai.js (AI), auth.js
views/                    πρότυπα EJS (δημόσια, partials/, admin/)
public/                   css/, js/, img/ (SVG)
tests/scenarios.js        λειτουργικοί έλεγχοι
scripts/simulate-traffic.js
```

## Λειτουργίες
- Αναζήτηση διαθεσιμότητας, εποχική τιμολόγηση, κράτηση σε 4 βήματα, αποτροπή διπλοκράτησης (συναλλαγή SQLite)
- SEO: SSR, μοναδικά title/meta, canonical, JSON-LD (Hotel, HotelRoom, BreadcrumbList), sitemap.xml, robots.txt, noindex σε σελίδες συναλλαγής
- AI (τοπικά, χωρίς εξωτερικό API): προτάσεις SEO meta, κείμενα social/email, ανάλυση αξιολογήσεων, ψηφιακός βοηθός FAQ με κλιμάκωση — όλα με ροή έγκρισης
- Πίνακας ελέγχου: κρατήσεις, έσοδα, ADR, πληρότητα, χωνί μετατροπής, πηγές (utm_source)

## Παραγωγή
Ορίστε `SESSION_SECRET`, `ADMIN_PASSWORD`, `SITE_URL` (και προαιρετικά `PORT`) και εξυπηρετήστε μέσω HTTPS.
