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
    case 'recent': return !!stock.fromRecent;
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
  if (stock.fromRecent) badges.push('<span class="badge recent">Recently Added</span>');
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
    div.textContent = 'No stocks match this filter.';
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

function renderTrendingDown(stocks) {
  const section = document.getElementById('trendingSection');
  const trendGrid = document.getElementById('trendingGrid');
  const declining = stocks.filter((s) => s.direction === 'down').slice(0, 8);
  if (declining.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  trendGrid.innerHTML = declining
    .map(
      (item) => `
      <a class="stock-card" href="/?symbol=${encodeURIComponent(item.symbol)}">
        <div class="top-row">
          <div>
            <span class="sym">${item.symbol}</span>
            <span class="price">Rs. ${item.price}</span>
          </div>
          ${sparklineSvg(item.trend, item.direction)}
        </div>
        <div class="badges">${badgesFor(item)}</div>
      </a>`
    )
    .join('');
}

async function loadTopStocks() {
  try {
    const res = await fetch('/api/top-stocks');
    const data = await res.json();
    allStocks = data.stocks || [];
    renderTrendingDown(allStocks);
    applyFilters();
  } catch {
    allStocks = [];
    renderTrendingDown([]);
    applyFilters();
  }
}

loadTopStocks();
