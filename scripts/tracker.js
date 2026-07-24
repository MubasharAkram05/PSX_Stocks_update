// scripts/tracker.js
// Logic specific to index.html: saving a price and showing the
// Recently Added list. Top Stocks now lives on its own page
// (top-stocks.html), fetched by scripts/top-stocks.js instead.

const input = document.getElementById('symbol');
const btn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const recentList = document.getElementById('recentList');

async function savePrice() {
  const symbol = input.value.trim();
  if (!symbol) return;

  btn.disabled = true;
  status.textContent = 'Fetching price and saving...';
  status.className = '';

  try {
    const res = await fetch('/api/save-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Something went wrong.');

    status.textContent = `Saved: ${data.symbol} = Rs. ${data.price} on ${data.date}`;
    status.className = 'ok';
    input.value = '';
    loadRecent(); // refresh the recently-added list
  } catch (err) {
    status.textContent = err.message;
    status.className = 'err';
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', savePrice);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') savePrice(); });

function renderList(el, items, emptyText) {
  el.innerHTML = '';
  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = emptyText;
    el.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="sym">${item.symbol}</span><span class="price">Rs. ${item.price}</span>`;
    li.addEventListener('click', () => {
      input.value = item.symbol;
      input.focus();
    });
    el.appendChild(li);
  });
}

async function loadRecent() {
  try {
    const res = await fetch('/api/recent');
    const data = await res.json();
    renderList(recentList, data.recent, 'Nothing saved yet.');
  } catch {
    renderList(recentList, [], 'Nothing saved yet.');
  }
}

// If arriving from the Top Stocks page (e.g. /?symbol=ENGRO), prefill the input
const params = new URLSearchParams(window.location.search);
const prefill = params.get('symbol');
if (prefill) {
  input.value = prefill.toUpperCase();
}

loadRecent();
