// Προσομοίωση επισκεψιμότητας για επίδειξη του πίνακα ελέγχου (ΔΕΝ είναι πραγματικά δεδομένα).
// Εκτελεί πραγματικά HTTP αιτήματα στη μηχανή κρατήσεων, ώστε να δοκιμάζεται και η λογική διαθεσιμότητας.
const BASE = process.env.BASE || 'http://localhost:3000';
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sources = ['google', 'google', 'google', 'instagram', 'newsletter', 'facebook', 'direct', 'direct'];
const pages = ['/', '/', '/', '/rooms', '/rooms/superior-sea-view', '/rooms/classic-double', '/rooms/family-suite', '/rooms/executive-suite', '/thessaloniki-guide', '/contact'];
const names = [['Ελένη', 'Παπαδοπούλου'], ['Νίκος', 'Γεωργίου'], ['Anna', 'Schmidt'], ['Δημήτρης', 'Ιωάννου'], ['Maria', 'Rossi'], ['Κατερίνα', 'Νικολάου'], ['John', 'Smith'], ['Γιάννης', 'Αλεξίου'], ['Sofia', 'Lindberg'], ['Πέτρος', 'Μακρής'], ['Αγγελική', 'Σταύρου'], ['Luca', 'Bianchi']];
const rooms = ['classic-double', 'classic-double', 'superior-sea-view', 'superior-sea-view', 'family-suite', 'executive-suite'];
const questions = ['Τι ώρα είναι το check in;', 'Έχει πάρκινγκ;', 'Περιλαμβάνεται πρωινό;', 'Πώς πάω από το αεροδρόμιο;', 'Δέχεστε σκύλο;', 'Έχετε πισίνα;', 'Μπορώ να ακυρώσω δωρεάν;', 'Υπάρχει γυμναστήριο;', 'Πόσο απέχει ο Λευκός Πύργος;'];
(async () => {
  for (let i = 0; i < 380; i++) await fetch(`${BASE}${pick(pages)}?utm_source=${pick(sources)}`);
  let booked = 0;
  for (let i = 0; i < 95; i++) {
    const src = pick(sources); const start = 2 + Math.floor(rnd() * 40); const len = 1 + Math.floor(rnd() * 4); const g = rnd() < .8 ? 2 : 3;
    await fetch(`${BASE}/booking?check_in=${day(start)}&check_out=${day(start + len)}&guests=${g}&utm_source=${src}`);
    if (rnd() < 0.36) {
      const room = g === 3 ? pick(['family-suite', 'executive-suite']) : pick(rooms);
      await fetch(`${BASE}/booking/checkout?room=${room}&check_in=${day(start)}&check_out=${day(start + len)}&guests=${g}`);
      if (rnd() < 0.72) {
        const [fn, ln] = pick(names);
        const r = await fetch(BASE + '/booking/checkout', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ room, check_in: day(start), check_out: day(start + len), guests: g, first_name: fn, last_name: ln, email: `${ln.toLowerCase()}@example.com`, phone: '+30 69' + String(10000000 + Math.floor(rnd() * 8e7)), consent: '1', source: src }) });
        if (r.status === 302) booked++;
      }
    }
  }
  for (const q of questions) await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q }) });
  console.log('Ολοκληρώθηκε η προσομοίωση. Κρατήσεις:', booked);
})();
