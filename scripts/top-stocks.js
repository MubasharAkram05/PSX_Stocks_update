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

// Builds a tiny inline SVG line chart from a price trend array.
// Green if the trend is up, red if down, gray if flat/unknown.
function sparklineSvg(trend, direction) {
  const color = direction === 'up' ? '#4ade80' : direction === 'down' ? '#f87171' : '#64748b';
  if (!trend || trend.length < 2) {
    return `<svg class="sparkline" width="56" height="24" viewBox="0 0 56 24"><line x1="2" y1="12" x2="54" y2="12" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const range = max - min || 1;
  const w = 56, h = 24, pad = 3;
  const points = trend.map((v, i) => {
    const x = pad + (i / (trend.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

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
