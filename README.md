# PSX Daily Price Tracker

Type a PSX symbol → it saves today's LOWEST price into a database —
one row per stock per day, never a duplicate. Prices also save
automatically once a day via a cron job. Download everything as Excel
or PDF, optionally filtered to a date range.

## How saving works (no duplicates, lowest price wins)

- Clicking Save Price fetches today's lowest price and opens a popup
  showing it — **the price field is editable**, so you can adjust it
  before confirming (`api/preview-price.js` fetches without saving;
  `api/save-price.js` saves whatever you confirm).
- Each stock gets **exactly one row per calendar date**, enforced by
  a database uniqueness constraint on `(symbol, date)`.
- Re-saving the same symbol later the same day only replaces the
  stored price if the new one is **lower** — never a duplicate, never
  a higher price overwriting a lower one. (This applies even to
  manually-edited prices — if you type a higher value than what's
  already saved for today, the lower one stays.)

## Automatic daily saving

`api/cron-daily-save.js` re-fetches today's low for every symbol
you've ever saved, and upserts it the same way. `vercel.json` schedules
it via Vercel Cron:

```json
{ "path": "/api/cron-daily-save", "schedule": "45 10 * * 1-5" }
```

That's 10:45 UTC (≈15:45 PKT), shortly after PSX's market close,
Monday–Friday.

## How it's structured

**Pages:**
- `index.html` / `styles/tracker.css` / `scripts/tracker.js` — Save
  Price card (with editable confirmation popup), Recently Added on
  the left on wider screens, download buttons with an optional
  date-range filter, and a Remove Saved Data tool (same date-range
  filter, permanent — open to anyone, no login required).
- `stock-profit-calculator.html` / `styles/stock-profit-calculator.css`
  / `scripts/stock-profit-calculator.js`
- `mutual-fund-calculator.html` / `styles/mutual-fund-calculator.css`
  / `scripts/mutual-fund-calculator.js`

**Shared across every page:**
- `styles/nav.css` / `scripts/nav.js` — nav bar, Calculators dropdown,
  and the KSE-100 index shown in the header
- `scripts/sparkline.js` — sparkline SVG builder for Recently Added

**Backend (Vercel serverless functions):**

`lib/db.js` and `lib/psx.js` are shared helper modules, deliberately
kept **outside** `/api` — Vercel's Hobby plan caps you at 12 serverless
functions per deployment, and treats every file directly inside `/api`
as one, even plain helpers with no route of their own.

- `lib/psx.js` — `getStockPrice()`, `getStockPriceWithTrend()` (+
  sparkline history), `getDailyLowPrice()` (today's lowest intraday
  price)
- `lib/db.js` — shared database connection + schema/migration logic
- `api/save-price.js` — upserts today's low price for a symbol (accepts an edited price from the popup; open to anyone)
- `api/preview-price.js` — fetches today's price without saving, to prefill the editable popup
- `api/delete-data.js` — deletes saved rows within a date range (open to anyone)
- `api/cron-daily-save.js` — same upsert, run automatically for every saved symbol
- `api/recent.js` — the last 15 distinct symbols saved, with live trend
- `api/psx-index.js` — best-effort KSE-100 index level for the header
- `api/download.js` — Excel/PDF export, optional `?from=&to=` date filter

## Honesty notes

- **KSE-100 header index** is best-effort against an unofficial PSX
  endpoint; shows nothing if that lookup fails, rather than guessing.
- Prices come from `dps.psx.com.pk`, PSX's own (unofficial) public
  data portal — not a licensed data feed.

## Setup

### 1. Add a Postgres database in Vercel
Storage tab → Create Database → Postgres (may show as "Neon") →
connect it to your project.

### 2. Deploy
Push to GitHub, import into Vercel. First save (manual or cron)
auto-creates/migrates the `psx_prices` table.

### 3. Testing locally (optional)
```bash
npm install -g vercel
npm install
vercel env pull .env.development.local
vercel dev
```
