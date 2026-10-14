// Client-side: μενού κινητού, έλεγχος ημερομηνιών, πηγή επισκεψιμότητας, ψηφιακός βοηθός
(function () {
  // Μενού σε κινητά
  const t = document.querySelector('.menu-toggle'), m = document.getElementById('menu');
  if (t && m) t.addEventListener('click', () => { const o = m.classList.toggle('open'); t.setAttribute('aria-expanded', o); });

  // Η αναχώρηση να είναι πάντα μετά την άφιξη
  document.querySelectorAll('.searchbox').forEach(f => {
    const ci = f.querySelector('[name=check_in]'), co = f.querySelector('[name=check_out]');
    if (!ci || !co) return;
    ci.addEventListener('change', () => {
      if (!ci.value) return;
      const next = new Date(ci.value); next.setDate(next.getDate() + 1);
      const iso = next.toISOString().slice(0, 10);
      co.min = iso; if (!co.value || co.value <= ci.value) co.value = iso;
    });
  });

  // Διατήρηση utm_source για απόδοση κράτησης σε κανάλι marketing (sessionStorage, όχι cookie)
  try {
    const p = new URLSearchParams(location.search).get('utm_source');
    if (p) sessionStorage.setItem('src', p);
    const s = document.getElementById('source'); if (s && sessionStorage.getItem('src')) s.value = sessionStorage.getItem('src');
  } catch (e) {}

  // Ψηφιακός βοηθός
  const btn = document.querySelector('.chat-toggle'), panel = document.getElementById('chat-panel');
  const form = document.getElementById('chat-form'), input = document.getElementById('chat-input'), log = document.getElementById('chat-log');
  if (!btn) return;
  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', !panel.hidden); if (!panel.hidden) input.focus(); });
  const add = (html, who) => { const d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  form.addEventListener('submit', async e => {
    e.preventDefault(); const text = input.value.trim(); if (!text) return;
    add(esc(text), 'user'); input.value = '';
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const j = await r.json(); add(j.answer, 'bot');   // οι απαντήσεις προέρχονται μόνο από την εγκεκριμένη βάση του ξενοδοχείου
    } catch (err) { add('Σφάλμα σύνδεσης. Δοκιμάστε ξανά.', 'bot'); }
  });
})();
