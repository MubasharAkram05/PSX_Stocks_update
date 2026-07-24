// scripts/top-stocks.js
// Fetches the top stocks list and lets the user filter it via two
// separate dropdowns (Category, Sector). Each stock card shows a
// small sparkline colored green (trending up) or red (trending down).

const grid = document.getElementById('stockGrid');
const categoryBtn = document.getElementById('categoryBtn');
const sectorBtn = document.getElementById('sectorBtn');

let allStocks = [];
let activeCategory = 'all';
let activeSector = 'all';

function matchesCategory(stock, category) {
  switch (category) {
    case 'all': return true;
    case 'cheap': return stock.priceCategory === 'cheap';
    case 'higher': return stock.priceCategory === 'higher';
    case 'dividend': return !!stock.dividend;
    case 'growth': return !!stock.growth;
    default: return true;
  }
}

function matchesSector(stock, sector) {
  if (sector === 'all') return true;
  return stock.sector === sector;
}

function badgesFor(stock) {
  const badges = [];
  if (stock.sector && stock.sector !== 'other') badges.push(`<span class="badge">${stock.sector}</span>`);
  if (stock.dividend) badges.push('<span class="badge dividend">High Dividend</span>');
  if (stock.growth) badges.push('<span class="badge growth">Growth</span>');
  return badges.join('');
}

// Sparkline rendering now comes from the shared scripts/sparkline.js
// (see sparklineSvg()), loaded before this file.

function renderStocks(stocks) {
  grid.innerHTML = '';
  if (!stocks || stocks.length === 0) {
    const div = document.createElement('div');
    div.className = 'placeholder';
    div.textContent = allStocks.length === 0
      ? 'No stocks on the list yet — an admin can add some from the Admin page.'
      : 'No stocks match this filter.';
    grid.appendChild(div);
    return;
  }
  stocks.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'stock-card';
    card.innerHTML = `
      <div class="top-row">
        <div>
          <span class="sym">${item.symbol}</span>
          <span class="price">Rs. ${item.price}</span>
        </div>
        ${sparklineSvg(item.trend, item.direction)}
      </div>
      <div class="badges">${badgesFor(item)}</div>
    `;
    card.addEventListener('click', () => openModal(item));
    grid.appendChild(card);
  });
}

// --- Stock detail popup ---
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function openModal(item) {
  const dirLabel = item.direction === 'up' ? 'Trending Up' : item.direction === 'down' ? 'Trending Down' : 'Flat';
  const dirClass = item.direction === 'up' ? 'up' : item.direction === 'down' ? 'down' : '';

  modalBody.innerHTML = `
    <div class="modal-sym">${item.symbol}</div>
    <div class="modal-price">Rs. ${item.price} <span class="value ${dirClass}">· ${dirLabel}</span></div>
    <div class="modal-spark">${sparklineSvg(item.trend, item.direction, { w: 280, h: 60 })}</div>
    <div class="modal-rows">
      <div class="modal-row"><span class="label">Date</span><span class="value">${item.date || '—'}</span></div>
      <div class="modal-row"><span class="label">Sector</span><span class="value">${item.sector || 'other'}</span></div>
      <div class="modal-row"><span class="label">High Dividend</span><span class="value">${item.dividend ? 'Yes' : 'No'}</span></div>
      <div class="modal-row"><span class="label">Future Growth</span><span class="value">${item.growth ? 'Yes' : 'No'}</span></div>
      <div class="modal-row"><span class="label">Price Category</span><span class="value">${item.priceCategory === 'cheap' ? 'Cheap' : 'Higher Priced'}</span></div>
    </div>
    <a class="modal-link" href="/?symbol=${encodeURIComponent(item.symbol)}">Go to Tracker →</a>
  `;
  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function applyFilters() {
  renderStocks(
    allStocks.filter((s) => matchesCategory(s, activeCategory) && matchesSector(s, activeSector))
  );
}

function wireDropdown(dropdownEl, btnEl, dataAttr, onSelect, labelPrefix) {
  dropdownEl.querySelectorAll('.dropdown-content a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownEl.querySelectorAll('.dropdown-content a').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      const value = link.dataset[dataAttr];
      onSelect(value);
      btnEl.textContent = `${labelPrefix}: ${link.textContent} ▾`;
      dropdownEl.classList.remove('open');
      applyFilters();
    });
  });
}

const categoryDropdown = categoryBtn.closest('.dropdown');
const sectorDropdown = sectorBtn.closest('.dropdown');

wireDropdown(categoryDropdown, categoryBtn, 'category', (v) => { activeCategory = v; }, 'Category');
wireDropdown(sectorDropdown, sectorBtn, 'sector', (v) => { activeSector = v; }, 'Sector');

async function loadTopStocks() {
  try {
    const res = await fetch('/api/top-stocks');
    const data = await res.json();
    allStocks = data.stocks || [];
    applyFilters();
  } catch {
    allStocks = [];
    applyFilters();
  }
}

loadTopStocks();
