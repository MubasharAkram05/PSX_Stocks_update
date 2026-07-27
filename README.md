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
  required).
- `stocks.html` / `styles/stocks.css` / `scripts/stocks.js` — every
  stock you've added, grouped into labeled sector rows (Petroleum,
  Fertilizer, Medicine, Bank, Cement, Tech, Power, Chemical,
  Automobile, Engineering, Steel, or a custom sector you type in). An
  **Add Stock** form (symbol + sector) at the top, a **Save All**
  button that saves today's low/high for every symbol ever saved on
  demand (same as the daily cron), and a **✕ remove** button on each
  card — all open to anyone, no login required. Removing only takes
  it off this list; it doesn't delete any saved price history. Click
  a card (not the ✕) to jump to the home page with it pre-filled.
- `recently-added.html` / `styles/recently-added.css` /
  `scripts/recently-added.js` — up to 15 symbols you've saved a price
  for, with a live price and trend. **↑/↓** reorders a row and **✕**
  removes it from this list (open to anyone, no login required;
  doesn't touch saved price history). **Save All** re-fetches and
  saves today's low/high for every symbol ever saved, on demand.
  Click a row (not the buttons) to jump to the home page with it
  pre-filled.

**Shared across every page:**
- `styles/nav.css` / `scripts/nav.js` — nav bar and the KSE-100 index
  shown below it
- `scripts/sparkline.js` — sparkline SVG builder for the Stocks and
  Recently Added pages

**Backend (Vercel serverless functions):**

`lib/db.js` and `lib/psx.js` are shared helper modules, deliberately
kept **outside** `/api` — Vercel's Hobby plan caps you at 12 serverless
functions per deployment, and treats every file directly inside `/api`
as one, even plain helpers with no route of their own.

- `lib/psx.js` — `getStockPrice()`, `getStockPriceWithTrend()` (+
  sparkline history), `getDailyRange()` (today's lowest and highest
  intraday price)
- `lib/db.js` — shared database connection + schema/migration logic
- `lib/recent-order.js` — computes the Recently Added page's symbol order (default: last-saved-first, overridden by any manual reordering/removal)
- `api/save-price.js` — upserts today's low/high price for a symbol (accepts edited values from the popup; open to anyone)
- `api/preview-price.js` — fetches today's low/high without saving, to prefill the editable popup
- `api/delete-data.js` — deletes saved rows within a date range (open to anyone)
- `api/cron-daily-save.js` — same upsert, run automatically for every saved symbol
- `api/recent.js` — up to 15 symbols for the Recently Added page (in their current manual/default order), with a live price and trend
- `api/manage-recent.js` — reorder or remove a symbol from the Recently Added page (open to anyone)
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
