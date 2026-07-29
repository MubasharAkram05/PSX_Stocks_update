// scripts/stocks.js
// Shared by stocks.html and short-term.html — which list a page shows
// is set via `window.STOCK_LIST_TYPE` ('main' or 'short-term') in an
// inline <script> before this file loads. Fetches every added stock
// for that list (already in display order — see lib/stock-order.js —
// via api/stocks.js), groups them into labeled sector rows, and
// handles the Add Stock / Bulk Add forms. Save All re-fetches and
// saves today's low/high for every symbol ever saved (shared price
// history across both lists), same as the automatic daily cron
// (api/cron-daily-save.js) — just triggered on demand instead of
// waiting for it. Edit mode reveals per-stock ↑/↓ (reorder within its
// sector) and ✕ (remove), plus ↑/↓ on each sector heading (reorder
// the whole group) — api/manage-stocks.js.

const LIST_TYPE = window.STOCK_LIST_TYPE === 'short-term' ? 'short-term' : 'main';

const container = document.getElementById('sectorGroups');
const addSymbolInput = document.getElementById('addSymbol');
const addSectorSelect = document.getElementById('addSector');
const customSectorInput = document.getElementById('customSector');
const addStockBtn = document.getElementById('addStockBtn');
const addStatus = document.getElementById('addStatus');
const saveAllBtn = document.getElementById('saveAllBtn');
const saveAllStatus = document.getElementById('saveAllStatus');
const editBtn = document.getElementById('editBtn');
const bulkAddToggleBtn = document.getElementById('bulkAddToggleBtn');
const bulkAddPanel = document.getElementById('bulkAddPanel');
const bulkAddInput = document.getElementById('bulkAddInput');
const bulkAddBtn = document.getElementById('bulkAddBtn');
const bulkAddStatus = document.getElementById('bulkAddStatus');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let editMode = false;
let lastStocks = [];
let lastSectorOrder = [];

const SECTOR_LABELS = {
  petroleum: 'Petroleum', fertilizer: 'Fertilizer', pharma: 'Medicine',
  cement: 'Cement', tech: 'Technology', power: 'Power', chemical: 'Chemical',
  auto: 'Automobile', engineering: 'Engineering', steel: 'Steel',
  bank: 'Bank', other: 'Other', 'short-term': 'Short Term',
};

function labelFor(key) {
  return SECTOR_LABELS[key] || key.replace(/\b\w/g, (c) => c.toUpperCase());
}

// The Short Term page (short-term.html) has no sector dropdown at all
// — everything added there goes in one "short-term" bucket, so these
// elements simply won't exist on that page.
function toggleCustomSectorInput() {
  if (!addSectorSelect || !customSectorInput) return;
  customSectorInput.style.display = addSectorSelect.value === 'custom' ? '' : 'none';
}
if (addSectorSelect) {
  addSectorSelect.addEventListener('change', toggleCustomSectorInput);
}
toggleCustomSectorInput();

function groupBySector(stocks) {
  const groups = {};
  stocks.forEach((s) => {
    const key = s.sector || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function renderGroups(stocks, sectorOrder) {
  container.innerHTML = '';

  if (!stocks || stocks.length === 0) {
    container.innerHTML = '<p class="placeholder">Nothing added yet — use the form above to add a stock.</p>';
    return;
  }

  const groups = groupBySector(stocks);
  const orderedKeys = [
    ...sectorOrder.filter((k) => groups[k]),
    ...Object.keys(groups).filter((k) => !sectorOrder.includes(k)),
  ];

  orderedKeys.forEach((key, sectorIdx) => {
    const section = document.createElement('div');
    section.className = 'sector-group';

    const heading = document.createElement('div');
    heading.className = 'sector-heading';
    heading.innerHTML = `
      <span class="line"></span>
      <span class="label">${labelFor(key)}</span>
      ${editMode ? `
        <div class="sector-actions">
          <button class="icon-btn" data-action="sector-up" title="Move sector up" ${sectorIdx === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="sector-down" title="Move sector down" ${sectorIdx === orderedKeys.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      ` : ''}
      <span class="line"></span>
    `;
    if (editMode) {
      heading.querySelector('[data-action="sector-up"]').addEventListener('click', () => moveSector(key, 'up'));
      heading.querySelector('[data-action="sector-down"]').addEventListener('click', () => moveSector(key, 'down'));
    }
    section.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'sector-row';

    groups[key].forEach((item, stockIdx) => {
      const card = document.createElement('div');
      card.className = 'stock-card';
      card.dataset.symbol = item.symbol;
      card.innerHTML = `
        ${sparklineSvg(item.trend, item.direction, { w: 36, h: 20 })}
        <div class="info">
          <span class="sym">${item.symbol}</span>
          <span class="price">${item.price != null ? `Rs. ${item.price}` : 'Price unavailable'}</span>
        </div>
        ${editMode ? `
          <div class="card-actions">
            <button class="icon-btn" data-action="stock-up" title="Move up" ${stockIdx === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-action="stock-down" title="Move down" ${stockIdx === groups[key].length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn remove" data-action="remove" title="Remove ${item.symbol}">✕</button>
          </div>
        ` : ''}
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions')) return;
        window.location.href = `/?symbol=${encodeURIComponent(item.symbol)}`;
      });
      if (editMode) {
        card.querySelector('[data-action="stock-up"]').addEventListener('click', (e) => {
          e.stopPropagation();
          moveStock(item.symbol, 'up');
        });
        card.querySelector('[data-action="stock-down"]').addEventListener('click', (e) => {
          e.stopPropagation();
          moveStock(item.symbol, 'down');
        });
        card.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
          e.stopPropagation();
          removeStock(item.symbol);
        });
      }
      row.appendChild(card);
    });

    section.appendChild(row);
    container.appendChild(section);
  });

  applySearchFilter();
}

// Filters the already-rendered cards by symbol substring — no
// server round trip, since everything's already on the page. Hides a
// sector group entirely once none of its cards match.
function applySearchFilter() {
  if (!searchInput) return;
  const term = searchInput.value.trim().toUpperCase();
  container.querySelectorAll('.sector-group').forEach((section) => {
    let anyVisible = false;
    section.querySelectorAll('.stock-card').forEach((card) => {
      const match = !term || card.dataset.symbol.includes(term);
      card.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    section.style.display = anyVisible ? '' : 'none';
  });
}
if (searchInput) searchInput.addEventListener('input', applySearchFilter);
if (searchBtn) searchBtn.addEventListener('click', applySearchFilter);

async function loadStocks() {
  try {
    const res = await fetch(`/api/stocks?list=${LIST_TYPE}`);
    const data = await res.json();
    lastStocks = data.stocks || [];
    lastSectorOrder = data.sectorOrder || [];
    renderGroups(lastStocks, lastSectorOrder);
  } catch {
    container.innerHTML = '<p class="placeholder">Could not load stocks right now.</p>';
  }
}

editBtn.addEventListener('click', () => {
  editMode = !editMode;
  editBtn.textContent = editMode ? 'Done' : 'Edit';
  editBtn.classList.toggle('active', editMode);
  renderGroups(lastStocks, lastSectorOrder);
});

async function addStock() {
  const symbol = addSymbolInput.value.trim();
  if (!symbol) return;

  const isCustom = addSectorSelect && addSectorSelect.value === 'custom';
  const sector = isCustom ? customSectorInput.value.trim() : (addSectorSelect ? addSectorSelect.value : '');
  if (isCustom && !sector) {
    addStatus.textContent = 'Please enter a sector name.';
    addStatus.className = 'status err';
    return;
  }

  addStockBtn.disabled = true;
  addStatus.textContent = 'Adding...';
  addStatus.className = 'status';

  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, sector, list: LIST_TYPE }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add that stock.');

    addSymbolInput.value = '';
    if (customSectorInput) customSectorInput.value = '';
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

bulkAddToggleBtn.addEventListener('click', () => {
  bulkAddPanel.hidden = !bulkAddPanel.hidden;
  bulkAddToggleBtn.classList.toggle('active', !bulkAddPanel.hidden);
  bulkAddToggleBtn.textContent = bulkAddPanel.hidden ? 'Bulk Add…' : 'Close Bulk Add';
});

async function bulkAddStocks() {
  const symbols = bulkAddInput.value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (symbols.length === 0) return;

  bulkAddBtn.disabled = true;
  bulkAddStatus.textContent = 'Adding...';
  bulkAddStatus.className = 'status';

  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk-add', symbols, list: LIST_TYPE }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add those stocks.');

    bulkAddStatus.textContent = `Added ${data.added} new stock(s); ${data.alreadyTracked} were already tracked.`;
    bulkAddStatus.className = 'status ok';
    bulkAddInput.value = '';
    loadStocks();
  } catch (err) {
    bulkAddStatus.textContent = err.message;
    bulkAddStatus.className = 'status err';
  } finally {
    bulkAddBtn.disabled = false;
  }
}
bulkAddBtn.addEventListener('click', bulkAddStocks);

async function removeStock(symbol) {
  if (!confirm(`Remove ${symbol} from this list?`)) return;
  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, list: LIST_TYPE }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not remove that stock.');
    loadStocks();
  } catch (err) {
    alert(err.message);
  }
}

async function moveStock(symbol, direction) {
  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move-stock', symbol, direction, list: LIST_TYPE }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not reorder that stock.');
    loadStocks();
  } catch (err) {
    alert(err.message);
  }
}

async function moveSector(sector, direction) {
  try {
    const res = await fetch('/api/manage-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move-sector', sector, direction, list: LIST_TYPE }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not reorder that sector.');
    loadStocks();
  } catch (err) {
    alert(err.message);
  }
}

async function saveAll() {
  saveAllBtn.disabled = true;
  saveAllStatus.textContent = 'Saving all...';
  saveAllStatus.className = 'status';

  try {
    const res = await fetch('/api/cron-daily-save');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');

    const okCount = data.results.filter((r) => r.ok).length;
    saveAllStatus.textContent = `Saved ${okCount} of ${data.count} stock(s).`;
    saveAllStatus.className = 'status ok';
    loadStocks();
  } catch (err) {
    saveAllStatus.textContent = err.message;
    saveAllStatus.className = 'status err';
  } finally {
    saveAllBtn.disabled = false;
  }
}
saveAllBtn.addEventListener('click', saveAll);

loadStocks();
