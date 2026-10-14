// Απλές λειτουργίες «AI» υποβοήθησης marketing (τοπικές, χωρίς εξωτερικό API):
// 1) Πρόταση SEO τίτλου/μετα-περιγραφής από τα δομημένα στοιχεία του δωματίου
// 2) Πρόταση αναρτήσεων κοινωνικών δικτύων / email
// 3) Ανάλυση αξιολογήσεων ανά θεματική ενότητα και συναίσθημα (λεξικό + κανόνες)
// 4) Βοηθός συχνών ερωτήσεων (ανάκτηση από ελεγχόμενη βάση FAQ)
// Όλες οι έξοδοι 1–2 αποθηκεύονται ως «πρόταση» και απαιτούν έγκριση διαχειριστή.

const HOTEL = { name: 'Leukon Urban Hotel', city: 'Θεσσαλονίκη', area: 'κέντρο Θεσσαλονίκης' };

// ---------- Βοηθητικά NLP ----------
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // αφαίρεση τόνων
    .replace(/ς/g, 'σ')
    .replace(/[^a-z0-9α-ω\s-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const STOP = new Set('και να το τα την τον της του των στο στη στην σε με για απο που ειναι ενα μια θα δεν ο η οι τι πως ποια ποιο ποσο εχει υπαρχει μπορω the a an is are to of and in for'.split(' '));
function tokens(text) {
  return normalize(text).split(' ').filter(t => t.length > 1 && !STOP.has(t));
}
// απλό «stemming»: σύγκριση με βάση τα πρώτα 5 γράμματα
const stem = t => t.slice(0, 5);

// ---------- 1. SEO meta ----------
function seoMeta(room) {
  const am = room.amenities.split('|');
  const top = am.filter(a => !/wi-fi|κλιματισμ|θέα/i.test(a)).slice(0, 2).join(' & ').toLowerCase();
  const view = room.view.split(' (')[0].toLowerCase();
  const guests = room.max_guests === 1 ? '1 άτομο' : `έως ${room.max_guests} άτομα`;
  const titles = [
    `${room.name} | ${room.size_m2} m² στο κέντρο Θεσσαλονίκης`,
    `${room.name} – Leukon Urban Hotel Θεσσαλονίκη`,
    `${room.name} · θέα ${view} | Leukon Hotel`
  ];
  const descs = [
    `${room.name} ${room.size_m2} m² για ${guests} στο κέντρο της Θεσσαλονίκης, με ${top}. Κάντε απευθείας κράτηση με πρωινό και δωρεάν ακύρωση.`,
    `Διαμονή στη Θεσσαλονίκη στο ${room.name}: ${room.bed.toLowerCase()}, θέα ${view}, ${top}. Καλύτερη τιμή στην επίσημη ιστοσελίδα.`,
    `Ανακαλύψτε το ${room.name} του Leukon Urban Hotel, λίγα βήματα από τον Λευκό Πύργο. ${room.size_m2} m², ${guests}, ${top}. Κλείστε online.`
  ];
  // Βαθμολόγηση βάσει κανόνων καλής πρακτικής (μήκος, λέξη-κλειδί, call to action)
  const scoreDesc = d => {
    let s = 0; const L = d.length;
    if (L >= 120 && L <= 160) s += 40; else if (L <= 170) s += 20;
    if (/θεσσαλονικ/i.test(normalize(d))) s += 25;
    if (/κρατησ|κλεισ|κλειστε/.test(normalize(d))) s += 20;
    if (d.includes(room.name)) s += 15;
    return s;
  };
  const scoreTitle = t => (t.length <= 60 ? 50 : 20) + (/θεσσαλονικ/.test(normalize(t)) ? 30 : 0) + (t.startsWith(room.name) ? 20 : 0);
  const bestTitle = titles.map(t => ({ text: t, len: t.length, score: scoreTitle(t) })).sort((a, b) => b.score - a.score);
  const bestDesc = descs.map(d => ({ text: d, len: d.length, score: scoreDesc(d) })).sort((a, b) => b.score - a.score);
  return { titles: bestTitle, descriptions: bestDesc };
}

// ---------- 2. Κείμενα κοινωνικών δικτύων / email ----------
function socialPost(room, channel = 'instagram', offer = '') {
  const am = room.amenities.split('|').slice(0, 3).join(', ').toLowerCase();
  const offerTxt = offer ? ` ${offer}.` : '';
  if (channel === 'email') {
    return `Θέμα: Η Θεσσαλονίκη σας περιμένει – ${room.name}\n\nΑγαπητέ επισκέπτη,\nτο ${room.name} (${room.size_m2} m², ${am}) είναι έτοιμο να σας υποδεχτεί στο κέντρο της πόλης.${offerTxt}\nΚάντε κράτηση απευθείας στην ιστοσελίδα μας και απολαύστε πρωινό και δωρεάν ακύρωση έως 3 ημέρες πριν.\n\nΜε εκτίμηση,\nΗ ομάδα του Leukon Urban Hotel`;
  }
  if (channel === 'facebook') {
    return `Σχεδιάζετε απόδραση στη Θεσσαλονίκη; Το ${room.name} προσφέρει ${am} και θέα ${room.view.toLowerCase()}, λίγα βήματα από τον Λευκό Πύργο.${offerTxt} Κλείστε απευθείας στο leukonhotel.gr για την καλύτερη διαθέσιμη τιμή.`;
  }
  return `Ξύπνα στο κέντρο της Θεσσαλονίκης ✨ ${room.name} · ${room.size_m2} m² · ${am}.${offerTxt}\nΚράτηση μέσω link in bio.\n#Thessaloniki #Θεσσαλονίκη #CityBreak #LeukonHotel #VisitGreece`;
}

// ---------- 3. Ανάλυση αξιολογήσεων ----------
const ASPECTS = {
  'Καθαριότητα': ['καθαρ', 'πεντακαθ', 'βρωμ', 'βρώμ', 'clean', 'spotless', 'dirty', 'χαλι'],
  'Προσωπικό': ['προσωπ', 'ευγεν', 'εξυπηρ', 'ρεσεψ', 'staff', 'friendly', 'helpful', 'service'],
  'Τοποθεσία': ['τοποθ', 'κεντρ', 'παραλ', 'location', 'central', 'waterfront', 'walking'],
  'Πρωινό': ['πρωιν', 'breakf'],
  'Θόρυβος': ['θορυβ', 'ησυχ', 'noisy', 'noise', 'quiet'],
  'Δωμάτιο': ['δωματ', 'κρεβατ', 'μπανι', 'σουιτ', 'room', 'bed', 'small', 'μικρο', 'ευρυχ', 'κλιματ'],
  'Τιμή/Αξία': ['τιμη', 'ακριβ', 'αξια', 'value', 'price', 'expens', 'money'],
  'Στάθμευση': ['παρκιν', 'σταθμ', 'parking']
};
const POS = ['εξαιρετ', 'υπεροχ', 'τελει', 'αψογ', 'καλη', 'καλο', 'καλ', 'ευγεν', 'εξυπηρετικ', 'πεντακαθ', 'καθαρ', 'ανετ', 'ευρυχ', 'μαγικ', 'πλουσι', 'λογικ', 'ησυχ', 'φιλικ', 'ενθουσ', 'ευκολ', 'αμεσ', 'γρηγορ', 'νοστιμ', 'great', 'excellent', 'amazing', 'perfect', 'delicious', 'clean', 'spotless', 'friendly', 'helpful', 'comfortable', 'good', 'fast', 'useful', 'central', 'super'];
const NEG = ['θορυβ', 'ενοχλ', 'μετρι', 'ακριβ', 'μακρια', 'αργ', 'βρωμ', 'μικρο', 'noisy', 'small', 'expensive', 'repetitive', 'dirty', 'slow', 'ανανεωσ', 'δεν ανταποκρ'];
const NEGATORS = ['δεν', 'not', 'no', 'μη'];

function sentenceSentiment(sentence) {
  const toks = normalize(sentence).split(' ');
  let s = 0;
  toks.forEach((t, i) => {
    const neg = i > 0 && NEGATORS.includes(toks[i - 1]);
    if (NEG.some(n => t.startsWith(n))) s += neg ? 1 : -1;
    else if (POS.some(p => t.startsWith(p))) s += neg ? -1 : 1;
  });
  return s;
}

function analyzeReviews(reviews) {
  const aspects = {};
  Object.keys(ASPECTS).forEach(a => (aspects[a] = { pos: 0, neg: 0, mentions: 0 }));
  const perReview = reviews.map(r => {
    const clauses = r.text.split(/[.!;?]|,| αλλα | αλλά | but /i).filter(c => c.trim());
    let total = 0; const found = [];
    for (const c of clauses) {
      const nc = normalize(c); const s = sentenceSentiment(c); total += s;
      for (const [asp, keys] of Object.entries(ASPECTS)) {
        if (keys.some(k => nc.includes(normalize(k)))) {
          aspects[asp].mentions++;
          if (s > 0) aspects[asp].pos++; else if (s < 0) aspects[asp].neg++;
          found.push({ aspect: asp, polarity: s > 0 ? 'θετικό' : s < 0 ? 'αρνητικό' : 'ουδέτερο' });
        }
      }
    }
    // Συνδυασμός κειμένου και βαθμολογίας για τη συνολική πολικότητα
    const blended = total + (r.rating - 3);
    const label = blended > 0 ? 'Θετική' : blended < 0 ? 'Αρνητική' : 'Ουδέτερη';
    return { ...r, sentiment: label, aspects: found };
  });
  const summary = Object.entries(aspects)
    .filter(([, v]) => v.mentions > 0)
    .map(([k, v]) => ({ aspect: k, ...v, net: v.pos - v.neg }))
    .sort((a, b) => b.mentions - a.mentions);
  const strengths = summary.filter(a => a.net > 0).sort((a, b) => b.net - a.net).slice(0, 3).map(a => a.aspect);
  const issues = summary.filter(a => a.neg > 0).sort((a, b) => b.neg - a.neg).slice(0, 3).map(a => a.aspect);
  const dist = { 'Θετική': 0, 'Ουδέτερη': 0, 'Αρνητική': 0 };
  perReview.forEach(r => dist[r.sentiment]++);
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / (reviews.length || 1);
  return { perReview, summary, strengths, issues, dist, avg: avg.toFixed(2) };
}

// ---------- 4. Βοηθός συχνών ερωτήσεων ----------
function chatbotAnswer(message, faqs) {
  const q = tokens(message).map(stem);
  if (!q.length) return { answer: 'Πώς μπορώ να σας βοηθήσω; Ρωτήστε με π.χ. για check-in, πάρκινγκ ή πολιτική ακύρωσης.', score: 0 };
  // Πρόθεση κράτησης/διαθεσιμότητας → παραπομπή στη μηχανή κρατήσεων (δεν «εφευρίσκει» διαθεσιμότητα)
  const n = normalize(message);
  if (/διαθεσιμ|κρατησ|κλεισω|τιμη|ποσο κοστιζ|available|book|price/.test(n)) {
    return { answer: 'Η διαθεσιμότητα και οι τιμές υπολογίζονται σε πραγματικό χρόνο από τη μηχανή κρατήσεων. Επιλέξτε ημερομηνίες εδώ: <a href="/booking">Έλεγχος διαθεσιμότητας</a>.', score: 1, intent: 'booking' };
  }
  let best = null;
  for (const f of faqs) {
    const kb = new Set([...tokens(f.keywords), ...tokens(f.question)].map(stem));
    const hits = q.filter(t => kb.has(t)).length;
    const score = hits / q.length;
    if (!best || score > best.score) best = { faq: f, score };
  }
  if (best && best.score >= 0.34) return { answer: best.faq.answer, score: best.score, faqId: best.faq.id };
  return {
    answer: 'Δεν είμαι βέβαιος για την απάντηση. Για να μη σας δώσω λανθασμένη πληροφορία, επικοινωνήστε με τη ρεσεψιόν στο +30 2310 000 000 ή μέσω της <a href="/contact">φόρμας επικοινωνίας</a>.',
    score: best ? best.score : 0, escalated: true
  };
}

module.exports = { seoMeta, socialPost, analyzeReviews, chatbotAnswer, normalize, HOTEL };
