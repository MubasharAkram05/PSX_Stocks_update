// scripts/stocks.js
// Fetches every added stock, groups them into labeled sector rows,
// and handles the Add Stock form + per-card Remove button.

const container = document.getElementById('sectorGroups');
const addSymbolInput = document.getElementById('addSymbol');
const addSectorSelect = document.getElementById('addSector');
const addStockBtn = document.getElementById('addStockBtn');
const addStatus = document.getElementById('addStatus');

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
    container.innerHTML = '<p class="placeholder">Nothing added yet — use the form above to add a stock.</p>';
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
      const card = document.createElement('div');
      card.className = 'stock-card';
      card.innerHTML = `
        ${sparklineSvg(item.trend, item.direction, { w: 36, h: 20 })}
        <div class="info">
          <span class="sym">${item.symbol}</span>
          <span class="price">Rs. ${item.price}</span>
        </div>
        <button class="remove-btn" title="Remove ${item.symbol}">✕</button>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) return; // handled separately
        window.location.href = `/?symbol=${encodeURIComponent(item.symbol)}`;
      });
      card.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeStock(item.symbol);
      });
      row.appendChild(card);
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

async function addStock() {
  const symbol = addSymbolInput.value.trim();
  if (!symbol) return;

  addStockBtn.disabled = true;
  addStatus.textContent = 'Adding...';
  addStatus.className = 'status';

  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, sector: addSectorSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add that stock.');

    addSymbolInput.value = '';
    addStatus.textContent = '';
    loadStocks();
  } catch (err) {
    addStatus.textContent = err.message;
    addStatus.className = 'status err';
  } finally {
    addStockBtn.disabled = false;
  }
}
addStockBtn.addEventListener('click', addStock);
addSymbolInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addStock(); });

async function removeStock(symbol) {
  if (!confirm(`Remove ${symbol} from this list?`)) return;
  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not remove that stock.');
    loadStocks();
  } catch (err) {
    alert(err.message);
  }
}

loadStocks();
