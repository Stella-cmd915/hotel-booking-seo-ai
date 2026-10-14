// Λογική διαθεσιμότητας, τιμολόγησης και δημιουργίας κράτησης
const crypto = require('crypto');
const db = require('../db/database');

const DAY = 24 * 60 * 60 * 1000;

function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d) ? null : d;
}

function nightsBetween(checkIn, checkOut) {
  return Math.round((parseDate(checkOut) - parseDate(checkIn)) / DAY);
}

// Επικύρωση παραμέτρων αναζήτησης – επιστρέφει λίστα σφαλμάτων
function validateSearch({ check_in, check_out, guests }) {
  const errors = [];
  const ci = parseDate(check_in), co = parseDate(check_out);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const g = parseInt(guests, 10);
  if (!ci || !co) errors.push('Επιλέξτε έγκυρες ημερομηνίες άφιξης και αναχώρησης.');
  else {
    if (ci < today) errors.push('Η ημερομηνία άφιξης δεν μπορεί να είναι στο παρελθόν.');
    if (co <= ci) errors.push('Η αναχώρηση πρέπει να είναι μετά την άφιξη.');
    if ((co - ci) / DAY > 30) errors.push('Η μέγιστη διάρκεια διαμονής είναι 30 νύχτες.');
  }
  if (!(g >= 1 && g <= 6)) errors.push('Ο αριθμός επισκεπτών πρέπει να είναι από 1 έως 6.');
  return errors;
}

// Εποχικός συντελεστής: υψηλή ζήτηση Ιούνιο–Σεπτέμβριο (και ΔΕΘ), χαμηλή Ιαν–Φεβ
function seasonFactor(date) {
  const m = date.getUTCMonth() + 1;
  if (m >= 6 && m <= 9) return 1.2;
  if (m === 1 || m === 2) return 0.9;
  return 1.0;
}

// Υπολογισμός συνολικής τιμής ανά νύχτα (αναλυτικά)
function quote(room, check_in, check_out) {
  const start = parseDate(check_in);
  const n = nightsBetween(check_in, check_out);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const weekend = [5, 6].includes(d.getUTCDay()) ? 1.1 : 1.0; // Παρ-Σαβ
    total += room.base_price * seasonFactor(d) * weekend;
  }
  return { nights: n, total: Math.round(total), perNight: Math.round(total / n) };
}

// Πόσα δωμάτια του τύπου είναι ελεύθερα στο διάστημα (επικάλυψη διαστημάτων)
function availableUnits(roomTypeId, check_in, check_out) {
  const room = db.prepare('SELECT inventory FROM room_types WHERE id=?').get(roomTypeId);
  const busy = db.prepare(`SELECT COUNT(*) AS c FROM bookings
    WHERE room_type_id=? AND status!='cancelled' AND check_in < ? AND check_out > ?`)
    .get(roomTypeId, check_out, check_in).c;
  return room.inventory - busy;
}

function searchAvailability({ check_in, check_out, guests }) {
  const rooms = db.prepare('SELECT * FROM room_types ORDER BY base_price').all();
  return rooms.map(r => {
    const free = availableUnits(r.id, check_in, check_out);
    const fits = r.max_guests >= parseInt(guests, 10);
    return { ...r, free, fits, available: free > 0 && fits, price: quote(r, check_in, check_out) };
  });
}

function validateGuest(b) {
  const errors = [];
  if (!b.first_name || b.first_name.trim().length < 2) errors.push('Συμπληρώστε το όνομα.');
  if (!b.last_name || b.last_name.trim().length < 2) errors.push('Συμπληρώστε το επώνυμο.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email || '')) errors.push('Μη έγκυρη διεύθυνση email.');
  if (!/^[+0-9 ()-]{8,20}$/.test(b.phone || '')) errors.push('Μη έγκυρος αριθμός τηλεφώνου.');
  if (!b.consent) errors.push('Απαιτείται αποδοχή των όρων και της πολιτικής απορρήτου.');
  return errors;
}

function newCode() {
  return 'LK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Δημιουργία κράτησης μέσα σε συναλλαγή: ο έλεγχος διαθεσιμότητας επαναλαμβάνεται
// ώστε να αποκλείεται η διπλοκράτηση όταν δύο χρήστες κάνουν κράτηση ταυτόχρονα.
function createBooking(data) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const room = db.prepare('SELECT * FROM room_types WHERE id=?').get(data.room_type_id);
    if (!room) throw new Error('Ο τύπος δωματίου δεν βρέθηκε.');
    if (room.max_guests < data.guests) throw new Error('Ο αριθμός επισκεπτών υπερβαίνει τη χωρητικότητα.');
    if (availableUnits(room.id, data.check_in, data.check_out) <= 0)
      throw new Error('Δυστυχώς το δωμάτιο δεν είναι πλέον διαθέσιμο για τις ημερομηνίες σας.');
    const { total } = quote(room, data.check_in, data.check_out);
    const code = newCode();
    db.prepare(`INSERT INTO bookings (code,room_type_id,check_in,check_out,guests,first_name,last_name,email,phone,notes,total,status,source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'confirmed',?)`)
      .run(code, room.id, data.check_in, data.check_out, data.guests, data.first_name.trim(), data.last_name.trim(),
        data.email.trim(), data.phone.trim(), (data.notes || '').slice(0, 500), total, data.source || 'direct');
    db.exec('COMMIT');
    return code;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { validateSearch, searchAvailability, quote, availableUnits, validateGuest, createBooking, nightsBetween, parseDate };
