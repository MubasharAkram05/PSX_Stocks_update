// scripts/stocks.js
// Fetches every saved stock and groups them into labeled sector rows.

const container = document.getElementById('sectorGroups');

const SECTOR_LABELS = {
  petroleum: 'Petroleum', fertilizer: 'Fertilizer', pharma: 'Medicine',
  cement: 'Cement', tech: 'Technology', power: 'Power', chemical: 'Chemical',
  auto: 'Automobile', engineering: 'Engineering', steel: 'Steel',
  bank: 'Bank', other: 'Other',
};

// Preferred display order; any sector not listed here (shouldn't
// happen, but just in case) is appended at the end.
const SECTOR_ORDER = [
  'petroleum', 'fertilizer', 'pharma', 'bank', 'cement', 'tech',
  'power', 'chemical', 'auto', 'engineering', 'steel', 'other',
];

function groupBySector(stocks) {
  const groups = {};
  stocks.forEach((s) => {
    const key = s.sector || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function renderGroups(stocks) {
  container.innerHTML = '';

  if (!stocks || stocks.length === 0) {
    container.innerHTML = '<p class="placeholder">Nothing saved yet — save a stock from the home page to see it here.</p>';
    return;
  }

  const groups = groupBySector(stocks);
  const orderedKeys = [
    ...SECTOR_ORDER.filter((k) => groups[k]),
    ...Object.keys(groups).filter((k) => !SECTOR_ORDER.includes(k)),
  ];

  orderedKeys.forEach((key) => {
    const section = document.createElement('div');
    section.className = 'sector-group';

    const heading = document.createElement('div');
    heading.className = 'sector-heading';
    heading.innerHTML = `<span class="line"></span><span class="label">${SECTOR_LABELS[key] || key}</span><span class="line"></span>`;
    section.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'sector-row';

    groups[key].forEach((item) => {
      const a = document.createElement('a');
      a.className = 'stock-card';
      a.href = `/?symbol=${encodeURIComponent(item.symbol)}`;
      a.innerHTML = `
        ${sparklineSvg(item.trend, item.direction, { w: 40, h: 20 })}
        <div class="info">
          <span class="sym">${item.symbol}</span>
          <span class="price">Rs. ${item.price}</span>
        </div>
      `;
      row.appendChild(a);
    });

    section.appendChild(row);
    container.appendChild(section);
  });
}

async function loadStocks() {
  try {
    const res = await fetch('/api/stocks');
    const data = await res.json();
    renderGroups(data.stocks);
  } catch {
    container.innerHTML = '<p class="placeholder">Could not load stocks right now.</p>';
  }
}

loadStocks();
