# PSX Daily Price Tracker

Type a PSX symbol → it saves today's LOWEST price into a database —
one row per stock per day, never a duplicate. Prices also save
automatically once a day via a cron job. Browse everything you've
saved with sparkline trends, read related news, and download it all
as Excel or PDF.

## Admin protection

Adding stock prices and managing the Top Stocks list now requires an
admin login — random visitors to your public Vercel URL can't add
junk data.

1. In Vercel → your project → **Settings → Environment Variables**,
   add `ADMIN_PASSWORD` = whatever password you want (pick something
   you'll remember — this is a simple shared password, not a full user
   account system).
2. Redeploy after adding it.
3. Open `/admin.html` on your site, log in with that password.
4. From there: **add** stocks (with sector + High Dividend/Future
   Growth tags), **edit** any existing stock's tags (✎ button),
   **remove** stocks, and **reorder** (↑/↓) — full control over what
   shows on the Top Stocks page and how it's categorized.
5. The login is stored in the browser's session storage — once logged
   in (on Admin or anywhere else in that browser tab), the **Save
   Price** button on the home page will work too. If someone who
   *isn't* logged in tries to save a price, they get a popup: "Only
   admin can add stock prices."

Note: `api/cron-daily-save.js` (the automatic daily save) isn't
affected by this — it runs on the server directly, not through the
public API, so it keeps working regardless of anyone's login state.

## How saving works (no duplicates, lowest price wins)

- Each stock gets **exactly one row per calendar date**, enforced by
  a database uniqueness constraint on `(symbol, date)`.
- When you save a symbol, the code fetches **today's lowest intraday
  price** (not just the current price) — from PSX's intraday tick
  data, falling back to the end-of-day close if that's unavailable.
- If you (or the daily cron job) save the same symbol again the same
  day, the stored price is only replaced if the new one is **lower**.
  Example: save FFC at 535, then 538, then 533 the same day — the row
  stays at 533. A higher re-save never overwrites a lower one.
- `api/db.js` → `ensureSchema()` handles this: creates the table if
  needed, de-duplicates any old rows from before this rule existed
  (keeping the lowest price), and adds the `(symbol, date)` unique
  constraint.

## Automatic daily saving

`api/cron-daily-save.js` re-fetches today's low for every symbol
you've ever saved, and upserts it the same way. `vercel.json` schedules
it via Vercel Cron:

```json
{ "path": "/api/cron-daily-save", "schedule": "45 10 * * 1-5" }
```

That's 10:45 UTC (≈15:45 PKT), shortly after PSX's market close,
Monday–Friday. Cron jobs only run once the project is deployed to
Vercel — check your Vercel plan's current Cron Jobs limits/availability
in their docs if it doesn't appear to fire.

## How it's structured

**Pages** (each with its own HTML, CSS, and JS file):
- `index.html` / `styles/tracker.css` / `scripts/tracker.js` — Save
  Price card (admin-only), Recently Added on the left (narrower) on
  wider screens.
- `top-stocks.html` / `styles/top-stocks.css` / `scripts/top-stocks.js`
  — the admin-curated stock list. Two dropdowns: **Category** (All,
  Cheap, Higher Priced, High Dividend, Future Growth) and **Sector**
  (Petroleum, Fertilizer, Medicine, Cement, Tech, Power, Chemical,
  Automobile). Each card has a sparkline; click a card for a popup
  with full details (price, sector, tags, date) and a link to the
  tracker.
- `admin.html` / `styles/admin.css` / `scripts/admin.js` — admin login,
  then add (with sector/dividend/growth tags), edit, remove, and
  reorder the Top Stocks list.
- `news.html` / `styles/news.css` / `scripts/news.js` — company
  announcements only (board meetings, dividends, book closures,
  AGM/EOGM, bonus/right issues) — general market news is filtered
  out. Search box plus a Dividend/Book Closure-only filter.
- `stock-profit-calculator.html` / `styles/stock-profit-calculator.css`
  / `scripts/stock-profit-calculator.js`
- `mutual-fund-calculator.html` / `styles/mutual-fund-calculator.css`
  / `scripts/mutual-fund-calculator.js`

**Shared across every page:**
- `styles/nav.css` / `scripts/nav.js` — nav bar, Calculators dropdown,
  and the KSE-100 index shown in the header
- `scripts/sparkline.js` — shared sparkline SVG builder

**Backend (Vercel serverless functions, one job per file):**
- `api/psx.js` — `getStockPrice()` (latest EOD price),
  `getStockPriceWithTrend()` (+ sparkline history),
  `getDailyLowPrice()` (today's lowest intraday price)
- `api/require-admin.js` — shared admin-token check
- `api/admin-login.js` — checks the password against `ADMIN_PASSWORD`
- `api/admin-stocks.js` — admin-only add/remove/reorder for the Top
  Stocks list (`stock_list` table)
- `api/save-price.js` — admin-only; upserts today's low price for a symbol
- `api/cron-daily-save.js` — same upsert, run automatically for every symbol on the stock list
- `api/top-stocks.js` — the admin-managed stock list, tagged by sector/dividend/growth/price/trend
- `api/recent.js` — the last 15 distinct symbols saved, with live trend
- `api/psx-index.js` — best-effort KSE-100 index level for the header
- `api/news.js` — PSX-related news (Google News RSS); supports `?q=` search and `&dividend=true`
- `api/download.js` — Excel/PDF export of everything saved
- `api/db.js` — shared database connection + schema/migration logic
  (creates both `psx_prices` and `stock_list`, one-time-seeds
  `stock_list` from any symbols already saved on an existing deployment)

## Honesty notes

- **Sector/dividend/growth tags** (`SECTOR_META` in `api/top-stocks.js`)
  are a static, hand-picked lookup for known symbols — not live
  financial data. Unlisted symbols still show up, just untagged.
- **"Cheap"/"Higher Priced" and trend direction ARE** computed live.
- **KSE-100 header index** is best-effort against an unofficial PSX
  endpoint; shows nothing if that lookup fails, rather than guessing.
- **News** comes from Google News' public feed, not PSX's own
  (rights-restricted) announcements feed.

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
