// scripts/top-stocks.js
// Fetches the top stocks list (50+ curated symbols + anything
// recently saved) and lets the user filter it: All, Recently Added,
// Cheap, Higher Priced, High Dividend, Future Growth, Petroleum,
// Fertilizer, Medicine. Clicking a stock goes to the home page with
// that symbol pre-filled, ready to save.

const grid = document.getElementById('stockGrid');
const filterButtons = document.querySelectorAll('.filter-btn');

let allStocks = [];
let activeFilter = 'all';

function matchesFilter(stock, filter) {
  switch (filter) {
    case 'all': return true;
    case 'recent': return !!stock.fromRecent;
    case 'cheap': return stock.priceCategory === 'cheap';
    case 'higher': return stock.priceCategory === 'higher';
    case 'dividend': return !!stock.dividend;
    case 'growth': return !!stock.growth;
    case 'petroleum': return stock.sector === 'petroleum';
    case 'fertilizer': return stock.sector === 'fertilizer';
    case 'pharma': return stock.sector === 'pharma';
    default: return true;
  }
}

function badgesFor(stock) {
  const badges = [];
  if (stock.fromRecent) badges.push('<span class="badge recent">Recently Added</span>');
  if (stock.sector && stock.sector !== 'other') badges.push(`<span class="badge">${stock.sector}</span>`);
  if (stock.dividend) badges.push('<span class="badge dividend">High Dividend</span>');
  if (stock.growth) badges.push('<span class="badge growth">Growth</span>');
  return badges.join('');
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
      <span class="sym">${item.symbol}</span>
      <span class="price">Rs. ${item.price}</span>
      <div class="badges">${badgesFor(item)}</div>
    `;
    grid.appendChild(a);
  });
}

function applyFilter() {
  renderStocks(allStocks.filter((s) => matchesFilter(s, activeFilter)));
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilter();
  });
});

async function loadTopStocks() {
  try {
    const res = await fetch('/api/top-stocks');
    const data = await res.json();
    allStocks = data.stocks || [];
    applyFilter();
  } catch {
    allStocks = [];
    applyFilter();
  }
}

loadTopStocks();
