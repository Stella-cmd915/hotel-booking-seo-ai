# Hotel Booking Website with SEO & AI Features

A working prototype of a boutique-hotel website (fictional *Leukon Urban Hotel*) with a direct-booking engine, technical SEO and human-approved AI helpers. Original Greek documentation: [README_el.md](README_el.md).

## Tech stack
- Node.js 22 (built-in `node:sqlite`)
- Express 5 · EJS server-side rendering

## Features
- Availability search, seasonal pricing, 4-step booking, double-booking prevention (SQLite transactions)
- SEO: SSR, unique titles/meta, canonical URLs, JSON-LD (Hotel, HotelRoom, Breadcrumb), sitemap.xml, robots.txt
- AI helpers: SEO meta suggestions, social posts, review analysis, FAQ chatbot — all with admin approval
- Admin dashboard with bookings, rooms, reviews
- 18 automated functional test scenarios

## Getting started
```bash
npm install
npm start          # http://localhost:3000
npm test           # with the server running
```
The database is created automatically from `db/seed.json` on first start. Admin login: see `README_el.md` (demo credentials, change them).

---
Part of the **SIGMA LAB** project portfolio.
