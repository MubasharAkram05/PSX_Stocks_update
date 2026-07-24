# PSX Daily Price Tracker

Type a PSX symbol → it fetches the current price and saves it into a
database. Browse a curated stock list with sparkline trends, read
related news, and download everything as Excel or PDF.

## How it's structured

**Pages** (each with its own HTML, CSS, and JS file):
- `index.html` / `styles/tracker.css` / `scripts/tracker.js` — Save
  Price card in the center. On laptop/tablet screens (900px+): Recently
  Added on the left, "Consider — Trending Down" suggestions on the
  right. A KSE-100 index bar sits at the bottom (best-effort — shows
  "Unavailable" if PSX's index endpoint doesn't respond).
- `top-stocks.html` / `styles/top-stocks.css` / `scripts/top-stocks.js`
  — curated, actively-traded PSX stocks (Bank sector and thin/illiquid
  names deliberately excluded). Two separate dropdowns: **Category**
  (All, Recently Added, Cheap, Higher Priced, High Dividend, Future
  Growth) and **Sector** (Petroleum, Fertilizer, Medicine, Cement,
  Tech, Power, Chemical, Automobile). Each card shows a small
  sparkline — green if the price trended up over the last ~7 trading
  days, red if down. Click a stock to jump to the home page with it
  pre-filled.
- `news.html` / `styles/news.css` / `scripts/news.js` — news about
  PSX-listed companies. Search box for a specific stock/company, plus
  a "Dividend / AGM News" filter for dividend announcements and board
  meeting news.
- `stock-profit-calculator.html` / `styles/stock-profit-calculator.css`
  / `scripts/stock-profit-calculator.js`
- `mutual-fund-calculator.html` / `styles/mutual-fund-calculator.css`
  / `scripts/mutual-fund-calculator.js`

**Shared across every page:**
- `styles/nav.css` / `scripts/nav.js` — the top nav bar and its
  Calculators dropdown

**Backend (Vercel serverless functions, one job per file):**
- `api/psx.js` — fetches PSX prices; `getStockPriceWithTrend()` also
  returns a short price history for sparklines (no extra API calls —
  reuses the same data)
- `api/save-price.js` — saves a price to the database
- `api/top-stocks.js` — the curated stock list, merged with any
  recently-saved symbol not already on it, tagged by sector/dividend/
  growth/price/trend
- `api/recent.js` — returns the Recently Added list
- `api/psx-index.js` — best-effort KSE-100 index level for the home
  page footer
- `api/news.js` — fetches PSX-related news (Google News RSS, no API
  key needed); supports `?q=` search and `&dividend=true`
- `api/download.js` — generates the Excel/PDF download
- `api/db.js` — shared database connection

## Honesty notes on the curated/best-effort parts

- **Sector, dividend, and growth tags** in `api/top-stocks.js` are a
  static, hand-picked list — PSX doesn't publish a "top dividend" or
  "top growth" API. Edit the `STOCKS` array anytime to adjust.
- **"Cheap" vs "Higher Priced" and the sparkline trend direction ARE**
  computed live from real fetched prices.
- **Risky/illiquid names removed:** this list was trimmed to more
  actively-traded, larger names based on general market knowledge —
  not a real volatility calculation (PSX doesn't expose one via this
  unofficial data source).
- **KSE-100 index bar** tries the same unofficial PSX endpoint used
  for stock prices. If PSX doesn't support that symbol the same way,
  it shows "Unavailable" rather than guessing.
- **News** comes from Google News' public search feed, biased toward
  Pakistan/PSX terms — it's real, live news, but not a guarantee every
  result is 100% PSX-specific, since it isn't pulled from PSX's own
  (rights-restricted) announcements feed.

## Setup

### 1. Add a Postgres database in Vercel
Storage tab → Create Database → Postgres (may show as "Neon") →
connect it to your project. Vercel auto-adds the connection env vars.

### 2. Deploy
Push to GitHub, import into Vercel, redeploy after adding the
database. First save auto-creates the `psx_prices` table.

### 3. Testing locally (optional)
```bash
npm install -g vercel
npm install
vercel env pull .env.development.local
vercel dev
```
