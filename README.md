# PSX Daily Price Tracker — Database Version

Type a PSX symbol → it fetches the current price and saves it into a
database (no Google account needed at all). Download everything saved
so far as an **Excel** or **PDF** file with one click.

## How it's structured

**Pages** (each with its own HTML, CSS, and JS file):
- `index.html` / `styles/tracker.css` / `scripts/tracker.js` — Save
  Price card + Recently Added list
- `top-stocks.html` / `styles/top-stocks.css` / `scripts/top-stocks.js`
  — 50+ PSX stocks across sectors, plus anything you've recently
  saved. Filter buttons: All, Recently Added, Cheap, Higher Priced,
  High Dividend, Future Growth, Petroleum, Fertilizer, Medicine.
  Click a stock to jump to the home page with it pre-filled.
- `news.html` / `styles/news.css` / `scripts/news.js` — recent news
  about PSX-listed companies (earnings, dividends, expansion plans)
- `stock-profit-calculator.html` / `styles/stock-profit-calculator.css`
  / `scripts/stock-profit-calculator.js`
- `mutual-fund-calculator.html` / `styles/mutual-fund-calculator.css`
  / `scripts/mutual-fund-calculator.js`

**Shared across every page:**
- `styles/nav.css` / `scripts/nav.js` — the top nav bar and its
  Calculators dropdown

**Backend (Vercel serverless functions, one job per file):**
- `api/psx.js` — fetches a PSX price (shared by save-price and top-stocks)
- `api/save-price.js` — saves a price to the database
- `api/top-stocks.js` — the curated 50+ stock list, merged with
  recently-saved symbols, tagged by sector/dividend/growth/price
- `api/recent.js` — returns the Recently Added list
- `api/news.js` — fetches PSX-related news headlines (Google News RSS,
  no API key needed)
- `api/download.js` — generates the Excel/PDF download
- `api/db.js` — shared database connection

**A note on the curation:** PSX doesn't publish a "top by dividend
yield" or "top growth stocks" API, so the sector/dividend/growth tags
in `api/top-stocks.js` are a static, hand-picked grouping meant to
help browsing — not live financial data. Edit the `STOCKS` array in
that file any time to add, remove, or re-tag symbols. The "cheap" vs
"higher priced" split IS computed live, from the fetched price (≤ Rs.
100 = cheap).

## 1. Add a Postgres database in Vercel (no separate account needed)

1. Open your project on vercel.com
2. Go to the **Storage** tab → **Create Database**
3. Choose **Postgres** (Vercel may label this **Neon** — it's the same
   thing, Neon is the Postgres provider behind Vercel's storage now)
   → give it any name → **Create**
4. When asked, **connect it to your project** (select Production, and
   Preview/Development too if you want)

That's it — Vercel automatically adds the database connection details
(`POSTGRES_URL` and related variables) to your project's environment
variables. Nothing to copy-paste manually.

## 2. Redeploy

**Deployments** tab → latest deployment → **...** menu → **Redeploy**.

The very first time you save a price, the code automatically creates
the `psx_prices` table if it doesn't exist yet — no manual database
setup required.

## 3. Use it

Open your Vercel URL (works on mobile too):
- Type a symbol (e.g. `ENGRO`) → **Save Price**
- Click **Download Excel** or **Download PDF** any time to get every
  row saved so far as a file

## Testing locally (optional)

```bash
npm install -g vercel
npm install
vercel env pull .env.development.local   # pulls the DB connection info from Vercel
vercel dev
```

Opens at `http://localhost:3000`, using the same live database.

## Notes on the PSX price source

Prices come from PSX's own data portal (`dps.psx.com.pk`) — tries the
end-of-day (closing) price first, falls back to the latest intraday
tick. If PSX changes their site structure, check `getStockPrice()` in
`api/save-price.js`; Vercel's **Logs** tab shows the raw error.
