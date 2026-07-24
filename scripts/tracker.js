// scripts/tracker.js
// Logic specific to index.html: saving a price and the Recently
// Added list. The market index lives in the shared nav bar
// (see scripts/nav.js), since it shows on every page.

const input = document.getElementById('symbol');
const btn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const recentList = document.getElementById('recentList');
const downloadFrom = document.getElementById('downloadFrom');
const downloadTo = document.getElementById('downloadTo');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

async function savePrice() {
  const symbol = input.value.trim();
  if (!symbol) return;

  if (!confirm(`Save this price for ${symbol.toUpperCase()}?`)) return;

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
    const priceClass = item.direction === 'down' ? 'price down' : item.direction === 'up' ? 'price up' : 'price';
    li.innerHTML = `
      <span class="sym">${item.symbol}</span>
      <span class="${priceClass}">Rs. ${item.price}</span>
      ${sparklineSvg(item.trend, item.direction, { w: 44, h: 20 })}
    `;
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

function updateDownloadLinks() {
  const params = new URLSearchParams();
  if (downloadFrom.value) params.set('from', downloadFrom.value);
  if (downloadTo.value) params.set('to', downloadTo.value);

  const excelParams = new URLSearchParams(params);
  excelParams.set('format', 'excel');
  downloadExcelBtn.href = `/api/download?${excelParams.toString()}`;

  const pdfParams = new URLSearchParams(params);
  pdfParams.set('format', 'pdf');
  downloadPdfBtn.href = `/api/download?${pdfParams.toString()}`;
}
downloadFrom.addEventListener('change', updateDownloadLinks);
downloadTo.addEventListener('change', updateDownloadLinks);

loadRecent();
