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
      ? "You haven't saved any stocks yet — save one from the home page to see it here."
      : 'No stocks match this filter.';
    grid.appendChild(div);
    return;
  }
  stocks.forEach((item) => {
    const a = document.createElement('a');
    a.className = 'stock-card';
    a.href = `/?symbol=${encodeURIComponent(item.symbol)}`;
    a.innerHTML = `
      <div class="top-row">
        <div>
          <span class="sym">${item.symbol}</span>
          <span class="price">Rs. ${item.price}</span>
        </div>
        ${sparklineSvg(item.trend, item.direction)}
      </div>
      <div class="badges">${badgesFor(item)}</div>
    `;
    grid.appendChild(a);
  });
}

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
