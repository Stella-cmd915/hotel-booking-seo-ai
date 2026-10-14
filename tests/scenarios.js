// Αυτοματοποιημένος έλεγχος βασικών σεναρίων χρήσης (λειτουργικός έλεγχος «μαύρου κουτιού»)
// Προϋπόθεση: ο server τρέχει (npm start). Εκτέλεση: npm test
const BASE = process.env.BASE || 'http://localhost:3000';
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const results = [];
async function t(id, name, fn) {
  try { await fn(); results.push({ id, name, ok: true }); console.log(`✔ ${id} ${name}`); }
  catch (e) { results.push({ id, name, ok: false, err: e.message }); console.log(`✘ ${id} ${name} → ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const get = (p, o = {}) => fetch(BASE + p, { redirect: 'manual', ...o });
const post = (p, data, o = {}) => fetch(BASE + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(o.headers || {}) }, body: new URLSearchParams(data) });
const guest = { first_name: 'Test', last_name: 'User', email: 'test@example.com', phone: '+30 6900000000', consent: '1' };

(async () => {
  const ci = day(40), co = day(43);
  await t('Σ01', 'Φόρτωση αρχικής σελίδας με title, meta description και JSON-LD Hotel', async () => {
    const h = await (await get('/')).text();
    assert(/<title>.+Θεσσαλονίκη/.test(h), 'title'); assert(h.includes('name="description"'), 'meta'); assert(h.includes('"@type":"Hotel"'), 'schema');
  });
  await t('Σ02', 'Αναζήτηση διαθεσιμότητας με έγκυρες ημερομηνίες', async () => {
    const h = await (await get(`/booking?check_in=${ci}&check_out=${co}&guests=2`)).text();
    assert(h.includes('Διαθεσιμότητα για 3 νύχτες'), 'results');
  });
  await t('Σ03', 'Απόρριψη αναχώρησης πριν την άφιξη', async () => {
    const h = await (await get(`/booking?check_in=${co}&check_out=${ci}&guests=2`)).text();
    assert(h.includes('Η αναχώρηση πρέπει να είναι μετά την άφιξη'), 'msg');
  });
  await t('Σ04', 'Απόρριψη ημερομηνίας άφιξης στο παρελθόν', async () => {
    const h = await (await get(`/booking?check_in=${day(-3)}&check_out=${day(-1)}&guests=2`)).text();
    assert(h.includes('στο παρελθόν'), 'msg');
  });
  await t('Σ05', 'Φιλτράρισμα δωματίων βάσει χωρητικότητας (4 άτομα)', async () => {
    const j = await (await get(`/api/availability?check_in=${ci}&check_out=${co}&guests=4`)).json();
    assert(!j.rooms.find(r => r.room === 'classic-double').available, 'classic'); assert(j.rooms.find(r => r.room === 'family-suite').available, 'family');
  });
  let code;
  await t('Σ06', 'Ολοκλήρωση κράτησης και σελίδα επιβεβαίωσης', async () => {
    const r = await post('/booking/checkout', { room: 'superior-sea-view', check_in: ci, check_out: co, guests: 2, ...guest });
    assert(r.status === 302, 'status ' + r.status); code = r.headers.get('location').split('/').pop();
    assert(/^LK-[0-9A-F]{6}$/.test(code), 'code'); const h = await (await get('/booking/confirmation/' + code)).text(); assert(h.includes(code), 'page');
  });
  await t('Σ07', 'Επικύρωση φόρμας: μη έγκυρο email και χωρίς συγκατάθεση', async () => {
    const r = await post('/booking/checkout', { room: 'classic-double', check_in: ci, check_out: co, guests: 2, ...guest, email: 'abc', consent: '' });
    const h = await r.text(); assert(r.status === 422 && h.includes('Μη έγκυρη διεύθυνση email') && h.includes('Απαιτείται αποδοχή'), 'validation');
  });
  await t('Σ08', 'Αποτροπή υπερκράτησης (Executive Suite, 2 δωμάτια, 3 αιτήματα)', async () => {
    const d1 = day(60), d2 = day(62); const st = [];
    for (let i = 0; i < 3; i++) st.push((await post('/booking/checkout', { room: 'executive-suite', check_in: d1, check_out: d2, guests: 2, ...guest })).status);
    assert(st[0] === 302 && st[1] === 302 && st[2] === 422, 'statuses ' + st.join(','));
  });
  await t('Σ09', 'Προστασία περιβάλλοντος διαχείρισης χωρίς σύνδεση', async () => {
    const r = await get('/admin'); assert(r.status === 302 && r.headers.get('location') === '/admin/login', 'redirect');
  });
  await t('Σ10', 'Απόρριψη λανθασμένου κωδικού διαχειριστή', async () => {
    const r = await post('/admin/login', { username: 'admin', password: 'wrong' }); assert(r.status === 401, 'status ' + r.status);
  });
  let cookie;
  await t('Σ11', 'Σύνδεση διαχειριστή και ακύρωση κράτησης που αποδεσμεύει διαθεσιμότητα', async () => {
    const r = await post('/admin/login', { username: 'admin', password: 'leukon2026' }); cookie = r.headers.get('set-cookie').split(';')[0];
    const d1 = day(60), d2 = day(62);
    let j = await (await get(`/api/availability?check_in=${d1}&check_out=${d2}&guests=2`)).json();
    assert(j.rooms.find(x => x.room === 'executive-suite').free_units === 0, 'full');
    const list = await (await get('/admin/bookings', { headers: { cookie } })).text();
    const id = [...list.matchAll(/\/admin\/bookings\/(\d+)\/status/g)].map(m => m[1]).pop();
    await post(`/admin/bookings/${id}/status`, { status: 'cancelled' }, { headers: { cookie } });
    j = await (await get(`/api/availability?check_in=${d1}&check_out=${d2}&guests=2`)).json();
    assert(j.rooms.find(x => x.room === 'executive-suite').free_units === 1, 'freed');
  });
  const chat = async m => (await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: m }) })).json();
  await t('Σ12', 'Ψηφιακός βοηθός: ερώτηση για στάθμευση', async () => { const j = await chat('Έχετε πάρκινγκ για το αυτοκίνητο;'); assert(j.answer.includes('15 €'), j.answer); });
  await t('Σ13', 'Ψηφιακός βοηθός: ερώτηση εκτός βάσης → κλιμάκωση', async () => { const j = await chat('Υπάρχει γυμναστήριο;'); assert(j.escalated, 'escalation'); });
  await t('Σ14', 'Ψηφιακός βοηθός: πρόθεση κράτησης → μηχανή κρατήσεων', async () => { const j = await chat('Έχετε διαθεσιμότητα για το Σαββατοκύριακο;'); assert(j.answer.includes('/booking'), 'link'); });
  await t('Σ15', 'Sitemap.xml και robots.txt', async () => {
    const s = await (await get('/sitemap.xml')).text(); const r = await (await get('/robots.txt')).text();
    assert((s.match(/<loc>/g) || []).length >= 10, 'urls'); assert(r.includes('Disallow: /admin'), 'robots');
  });
  await t('Σ16', 'Σελίδα 404 με noindex', async () => { const r = await get('/xyz'); const h = await r.text(); assert(r.status === 404 && h.includes('noindex'), '404'); });
  await t('Σ17', 'AI πρόταση meta → έγκριση → εφαρμογή στη σελίδα δωματίου', async () => {
    const title = 'Family Suite 38 m² | Οικογενειακή σουίτα στη Θεσσαλονίκη';
    await post('/admin/ai/suggest', { kind: 'meta', room_type_id: 3, title, description: 'Test description Θεσσαλονίκη' }, { headers: { cookie } });
    let h = await (await get('/rooms/family-suite')).text(); assert(!h.includes(title), 'not before approval');
    const ai = await (await get('/admin/ai?room=3', { headers: { cookie } })).text();
    const id = ai.match(/\/admin\/ai\/suggestions\/(\d+)/)[1];
    await post(`/admin/ai/suggestions/${id}`, { action: 'approved' }, { headers: { cookie } });
    h = await (await get('/rooms/family-suite')).text(); assert(h.includes(`<title>${title}</title>`), 'applied');
  });
  await t('Σ18', 'Κεφαλίδες ασφαλείας HTTP', async () => { const r = await get('/'); assert(r.headers.get('x-content-type-options') === 'nosniff' && !r.headers.get('x-powered-by'), 'headers'); });
  const ok = results.filter(r => r.ok).length;
  console.log(`\nΑποτέλεσμα: ${ok}/${results.length} σενάρια επιτυχή`);
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(results, null, 2));
  process.exit(ok === results.length ? 0 : 1);
})();
