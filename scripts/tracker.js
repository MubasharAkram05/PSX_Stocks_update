// scripts/tracker.js
// Logic specific to index.html: saving a price, the Recently Added
// list, the "trending down" suggestions panel, and the KSE-100 index
// bar at the bottom.

const input = document.getElementById('symbol');
const btn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const recentList = document.getElementById('recentList');
const suggestList = document.getElementById('suggestList');
const indexPoints = document.getElementById('indexPoints');
const indexDirection = document.getElementById('indexDirection');

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

function renderList(el, items, emptyText, { showDownPrice } = {}) {
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
    const priceClass = showDownPrice ? 'price down' : 'price';
    li.innerHTML = `<span class="sym">${item.symbol}</span><span class="${priceClass}">Rs. ${item.price}</span>`;
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

// "Consider" panel: stocks currently trending down, drawn from the
// Top Stocks list (a possible buying opportunity, not advice).
async function loadSuggestions() {
  try {
    const res = await fetch('/api/top-stocks');
    const data = await res.json();
    const declining = (data.stocks || []).filter((s) => s.direction === 'down').slice(0, 8);
    renderList(suggestList, declining, 'No declining stocks right now.', { showDownPrice: true });
  } catch {
    renderList(suggestList, [], 'Could not load suggestions.');
  }
}

async function loadIndex() {
  try {
    const res = await fetch('/api/psx-index');
    const data = await res.json();
    if (data.points == null) {
      indexPoints.textContent = 'Unavailable right now';
      indexDirection.textContent = '';
      return;
    }
    indexPoints.textContent = `${data.points} pts`;
    if (data.direction === 'up') {
      indexDirection.textContent = '▲ Up';
      indexDirection.className = 'index-direction up';
    } else if (data.direction === 'down') {
      indexDirection.textContent = '▼ Down';
      indexDirection.className = 'index-direction down';
    } else {
      indexDirection.textContent = '';
    }
  } catch {
    indexPoints.textContent = 'Unavailable right now';
  }
}

// If arriving from the Top Stocks page (e.g. /?symbol=ENGRO), prefill the input
const params = new URLSearchParams(window.location.search);
const prefill = params.get('symbol');
if (prefill) {
  input.value = prefill.toUpperCase();
}

loadRecent();
loadSuggestions();
loadIndex();
