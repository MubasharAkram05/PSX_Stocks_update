// lib/stock-order.js
// Shared ordering logic for the Stocks page — used both to render it
// (api/stocks.js) and to know what "up"/"down" means when reordering
// a stock or a whole sector group (api/manage-stocks.js), so both
// agree on the same "current order".
//
// Default order: sectors in this curated list first (in this order),
// any other sector (custom-typed ones, or "other") alphabetically
// after; stocks within a sector alphabetically by symbol. Either can
// be overridden — sectors via the sector_order table, stocks via
// stock_sectors.sort_order — once a user reorders something.

const { pool } = require('./db');

const DEFAULT_SECTOR_ORDER = [
  'petroleum', 'fertilizer', 'pharma', 'bank', 'cement', 'tech',
  'power', 'chemical', 'auto', 'engineering', 'steel',
];

// Returns { rows, sectorOrder }:
//   rows        — every stock_sectors row, sorted (sector group order,
//                 then position within that sector)
//   sectorOrder — the distinct sectors present, in display order
async function getOrderedStocks() {
  const [stocksRes, sectorOrderRes] = await Promise.all([
    pool.query(`SELECT symbol, sector, sort_order FROM stock_sectors`),
    pool.query(`SELECT sector, sort_order FROM sector_order`),
  ]);

  const sectorOverride = new Map(sectorOrderRes.rows.map((r) => [r.sector, r.sort_order]));
  const sectorRank = (sector) => {
    if (sectorOverride.has(sector)) return sectorOverride.get(sector);
    const idx = DEFAULT_SECTOR_ORDER.indexOf(sector);
    return idx === -1 ? DEFAULT_SECTOR_ORDER.length : idx;
  };

  const sectorsPresent = [...new Set(stocksRes.rows.map((r) => r.sector))];
  const sectorOrder = sectorsPresent.sort((a, b) => {
    const diff = sectorRank(a) - sectorRank(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
  const sectorIndex = new Map(sectorOrder.map((s, i) => [s, i]));

  const rows = [...stocksRes.rows].sort((a, b) => {
    const sectorDiff = sectorIndex.get(a.sector) - sectorIndex.get(b.sector);
    if (sectorDiff !== 0) return sectorDiff;
    if (a.sort_order != null && b.sort_order != null) return a.sort_order - b.sort_order;
    if (a.sort_order != null) return -1;
    if (b.sort_order != null) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return { rows, sectorOrder };
}

module.exports = { getOrderedStocks, DEFAULT_SECTOR_ORDER };
