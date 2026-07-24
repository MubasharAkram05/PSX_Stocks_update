// scripts/top-stocks.js
// Logic specific to top-stocks.html: fetches the top 20 PSX stocks
// and renders them. Clicking one goes to the home page with that
// symbol pre-filled, ready to save.

const grid = document.getElementById('stockGrid');

function renderStocks(stocks) {
  grid.innerHTML = '';
  if (!stocks || stocks.length === 0) {
    const div = document.createElement('div');
    div.className = 'placeholder';
    div.textContent = 'Could not load top stocks right now.';
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
      <span class="hint">Click to save this price →</span>
    `;
    grid.appendChild(a);
  });
}

async function loadTopStocks() {
  try {
    const res = await fetch('/api/top-stocks');
    const data = await res.json();
    renderStocks(data.stocks);
  } catch {
    renderStocks([]);
  }
}

loadTopStocks();
