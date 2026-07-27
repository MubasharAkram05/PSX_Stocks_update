# PSX Daily Price Tracker

Type a PSX symbol → it saves today's LOW and HIGH price into a
database — one row per stock per day, never a duplicate. Prices also
save automatically once a day via a cron job. Download everything as
Excel or PDF, optionally filtered to a date range.

## How saving works (no duplicates, most extreme values win)

- Clicking Save Price fetches today's low and high and opens a popup
  showing both — **both fields are editable**, so you can adjust
  either before confirming (`api/preview-price.js` fetches without
  saving; `api/save-price.js` saves whatever you confirm).
- Each stock gets **exactly one row per calendar date**, enforced by
  a database uniqueness constraint on `(symbol, date)`, with separate
  `price_low` / `price_high` columns.
- Re-saving the same symbol later the same day only moves `price_low`
  down or `price_high` up — never a duplicate row, and a later save
  never overwrites a more extreme value already captured that day.
  (This applies even to manually-edited prices.)

## Automatic daily saving

`api/cron-daily-save.js` re-fetches today's low/high for every symbol
you've ever saved, and upserts them the same way. `vercel.json`
schedules it via Vercel Cron:

```json
{ "path": "/api/cron-daily-save", "schedule": "45 10 * * 1-5" }
```

That's 10:45 UTC (≈15:45 PKT), shortly after PSX's market close,
Monday–Friday.

## How it's structured

**Pages:**
- `index.html` / `styles/tracker.css` / `scripts/tracker.js` — Save
  Price card (with editable confirmation popup), download buttons
  with an optional date-range filter, and a Remove Saved Data tool
  (same date-range filter, permanent — open to anyone, no login
  required). Saving a price for a symbol that isn't tracked on the
  Stocks page yet adds it there automatically, with a sector guessed
  from a static lookup — no separate Add Stock step needed.
- `stocks.html` / `styles/stocks.css` / `scripts/stocks.js` — every
  stock that's been saved (via Save Price, the daily cron, or the
  **Add Stock** form here) grouped into labeled sector rows (Petroleum,
  Fertilizer, Medicine, Bank, Cement, Tech, Power, Chemical,
  Automobile, Engineering, Steel, or a custom sector you type in). A
  **Save All** button saves today's low/high for every symbol ever
  saved on demand (same as the daily cron), and a **✕ remove** button
  on each card takes it off this list — both open to anyone, no login
  required. Removing doesn't delete any saved price history. Click a
  card (not the ✕) to jump to the home page with it pre-filled.

**Shared across every page:**
- `styles/nav.css` / `scripts/nav.js` — nav bar and the KSE-100 index
  shown below it
- `scripts/sparkline.js` — sparkline SVG builder for the Stocks page

**Backend (Vercel serverless functions):**

`lib/db.js` and `lib/psx.js` are shared helper modules, deliberately
kept **outside** `/api` — Vercel's Hobby plan caps you at 12 serverless
functions per deployment, and treats every file directly inside `/api`
as one, even plain helpers with no route of their own.

- `lib/psx.js` — `getStockPrice()`, `getStockPriceWithTrend()` (+
  sparkline history), `getDailyRange()` (today's lowest and highest
  intraday price)
- `lib/db.js` — shared database connection + schema/migration logic
- `lib/concurrency.js` — runs an async lookup over a list with at most N in flight at once, instead of an uncapped `Promise.all` — used anywhere a page fetches live prices for many symbols at once, to avoid tripping PSX's rate limiting
- `api/save-price.js` — upserts today's low/high price for a symbol (accepts edited values from the popup; open to anyone)
- `api/preview-price.js` — fetches today's low/high without saving, to prefill the editable popup
- `api/delete-data.js` — deletes saved rows within a date range (open to anyone)
- `api/cron-daily-save.js` — same upsert, run automatically for every saved symbol
- `api/stocks.js` — every stock in `stock_sectors`, tagged with its sector
- `api/manage-stocks.js` — add/remove stocks and set their sector (open to anyone)
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
