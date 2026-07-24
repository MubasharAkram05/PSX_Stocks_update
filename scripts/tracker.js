// scripts/tracker.js
// Logic specific to index.html: saving a price and the Recently
// Added list. The market index now lives in the shared nav bar
// (see scripts/nav.js), since it shows on every page.

const input = document.getElementById('symbol');
const btn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const recentList = document.getElementById('recentList');
const downloadFrom = document.getElementById('downloadFrom');
const downloadTo = document.getElementById('downloadTo');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

let saveConfirmMessage = 'Save this price to the tracker?';

async function loadConfirmMessage() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.save_confirm_message) saveConfirmMessage = data.save_confirm_message;
  } catch {
    // Keep the default message if settings can't be loaded
  }
}

async function savePrice() {
  const symbol = input.value.trim();
  if (!symbol) return;

  const message = saveConfirmMessage.replace('{symbol}', symbol.toUpperCase());
  if (!confirm(message)) return;

  btn.disabled = true;
  status.textContent = 'Fetching price and saving...';
  status.className = '';

  try {
    const res = await fetch('/api/save-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': sessionStorage.getItem('adminToken') || '',
      },
      body: JSON.stringify({ symbol }),
    });
    const data = await res.json();

    if (res.status === 401) {
      alert(data.error || 'Only admin can add stock prices.');
      status.textContent = data.error || 'Only admin can add stock prices.';
      status.className = 'err';
      return;
    }

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

// If arriving from the Top Stocks page (e.g. /?symbol=ENGRO), prefill the input
const params = new URLSearchParams(window.location.search);
const prefill = params.get('symbol');
if (prefill) {
  input.value = prefill.toUpperCase();
}

loadRecent();
loadConfirmMessage();
