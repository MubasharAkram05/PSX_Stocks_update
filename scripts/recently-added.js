// scripts/recently-added.js
// Fetches and renders the last 15 saved symbols with live price and
// trend (same data api/recent.js provides). Clicking a row jumps to
// the tracker with that symbol pre-filled. Save All re-fetches and
// saves today's low/high for every symbol ever saved, same as the
// automatic daily cron (api/cron-daily-save.js) — just triggered
// on demand instead of waiting for it.

const recentList = document.getElementById('recentList');
const saveAllBtn = document.getElementById('saveAllBtn');
const saveAllStatus = document.getElementById('saveAllStatus');

function renderList(items) {
  recentList.innerHTML = '';
  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = 'Nothing saved yet.';
    recentList.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    const priceClass = item.direction === 'down' ? 'price down' : item.direction === 'up' ? 'price up' : 'price';
    li.innerHTML = `
      <span class="sym">${item.symbol}</span>
      ${sparklineSvg(item.trend, item.direction, { w: 40, h: 20 })}
      <span class="${priceClass}">Rs. ${item.price}</span>
    `;
    li.addEventListener('click', () => {
      window.location.href = `/?symbol=${encodeURIComponent(item.symbol)}`;
    });
    recentList.appendChild(li);
  });
}

async function loadRecent() {
  try {
    const res = await fetch('/api/recent');
    const data = await res.json();
    renderList(data.recent);
  } catch {
    renderList([]);
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
    loadRecent();
  } catch (err) {
    saveAllStatus.textContent = err.message;
    saveAllStatus.className = 'status err';
  } finally {
    saveAllBtn.disabled = false;
  }
}
saveAllBtn.addEventListener('click', saveAll);

loadRecent();
