// Βάση δεδομένων SQLite (ενσωματωμένο module node:sqlite, χωρίς native εξαρτήσεις)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('../services/auth');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'hotel.db');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS room_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_desc TEXT NOT NULL,
  description TEXT NOT NULL,
  max_guests INTEGER NOT NULL,
  size_m2 INTEGER NOT NULL,
  bed TEXT NOT NULL,
  view TEXT NOT NULL,
  amenities TEXT NOT NULL,          -- λίστα διαχωρισμένη με "|"
  base_price REAL NOT NULL,         -- τιμή ανά νύχτα (€)
  inventory INTEGER NOT NULL,       -- πλήθος φυσικών δωματίων του τύπου
  image TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  guests INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | cancelled
  source TEXT,                              -- πηγή επισκεψιμότητας (utm_source/referrer)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS faq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  matched_faq INTEGER,
  score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,           -- meta | social
  room_type_id INTEGER,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | approved | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- page_view | search | checkout_view | booking
  path TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`);

// ---------- Αρχικά δεδομένα (seed) ----------
const count = db.prepare('SELECT COUNT(*) AS c FROM room_types').get().c;
if (count === 0) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
  const insRoom = db.prepare(`INSERT INTO room_types
    (slug,name,short_desc,description,max_guests,size_m2,bed,view,amenities,base_price,inventory,image,meta_title,meta_description)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of seed.rooms) {
    insRoom.run(r.slug, r.name, r.short_desc, r.description, r.max_guests, r.size_m2, r.bed, r.view,
      r.amenities.join('|'), r.base_price, r.inventory, r.image, r.meta_title || null, r.meta_description || null);
  }
  const insFaq = db.prepare('INSERT INTO faq (question,answer,keywords) VALUES (?,?,?)');
  for (const f of seed.faq) insFaq.run(f.q, f.a, f.k);
  const insRev = db.prepare('INSERT INTO reviews (author,rating,text,platform,created_at) VALUES (?,?,?,?,?)');
  for (const r of seed.reviews) insRev.run(r.author, r.rating, r.text, r.platform, r.date);
  db.prepare('INSERT INTO admins (username,password_hash) VALUES (?,?)')
    .run('admin', hashPassword(process.env.ADMIN_PASSWORD || 'leukon2026'));
  console.log('Η βάση δεδομένων αρχικοποιήθηκε με δεδομένα επίδειξης.');
}

module.exports = db;
