// lib/sector-labels.js
// Curated display labels for sector keys — mirrors the same map in
// scripts/stocks.js (duplicated rather than shared, since the
// frontend has no access to server-side modules with no build step
// in this project). Falls back to title-casing the key itself for a
// sector not in this list (custom-typed ones).

const SECTOR_LABELS = {
  petroleum: 'Petroleum', fertilizer: 'Fertilizer', pharma: 'Medicine',
  cement: 'Cement', tech: 'Technology', power: 'Power', chemical: 'Chemical',
  auto: 'Automobile', engineering: 'Engineering', steel: 'Steel',
  bank: 'Bank', other: 'Other', 'short-term': 'Short Term',
};

function labelFor(key) {
  return SECTOR_LABELS[key] || String(key).replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { SECTOR_LABELS, labelFor };
