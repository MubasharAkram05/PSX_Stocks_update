// scripts/tracker.js
// Logic specific to index.html: saving a price (via an editable
// confirmation popup), downloads with a date filter, and removing
// saved data within a date range.

const input = document.getElementById('symbol');
const btn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const downloadFrom = document.getElementById('downloadFrom');
const downloadTo = document.getElementById('downloadTo');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const removeFrom = document.getElementById('removeFrom');
const removeTo = document.getElementById('removeTo');
const removeBtn = document.getElementById('removeBtn');
const removeStatus = document.getElementById('removeStatus');

// --- Confirmation popup elements ---
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmSymbolLine = document.getElementById('confirmSymbolLine');
const confirmPriceInput = document.getElementById('confirmPriceInput');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmSaveBtn = document.getElementById('confirmSaveBtn');

let pendingSymbol = null;

async function startSave() {
  const symbol = input.value.trim();
  if (!symbol) return;

  btn.disabled = true;
  status.textContent = 'Fetching current price...';
  status.className = '';

  try {
    const res = await fetch(`/api/preview-price?symbol=${encodeURIComponent(symbol)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not fetch a price for that symbol.');

    pendingSymbol = data.symbol;
    confirmSymbolLine.textContent = `${data.symbol} — ${data.date}`;
    confirmPriceInput.value = data.price;
    confirmOverlay.classList.add('open');
    status.textContent = '';
  } catch (err) {
    status.textContent = err.message;
    status.className = 'err';
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', startSave);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') startSave(); });

function closeConfirm() {
  confirmOverlay.classList.remove('open');
  pendingSymbol = null;
}
confirmCancelBtn.addEventListener('click', closeConfirm);
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) closeConfirm();
});

confirmSaveBtn.addEventListener('click', async () => {
  if (!pendingSymbol) return;
  const price = confirmPriceInput.value;

  confirmSaveBtn.disabled = true;
  status.textContent = 'Saving...';
  status.className = '';

  try {
    const res = await fetch('/api/save-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: pendingSymbol, price }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');

    status.textContent = `Saved: ${data.symbol} = Rs. ${data.price} on ${data.date}`;
    status.className = 'ok';
    input.value = '';
    closeConfirm();
  } catch (err) {
    status.textContent = err.message;
    status.className = 'err';
  } finally {
    confirmSaveBtn.disabled = false;
  }
});

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

// --- Remove saved data in a date range ---
async function removeData() {
  const from = removeFrom.value;
  const to = removeTo.value;
  if (!from || !to) {
    removeStatus.textContent = 'Pick both a From and To date.';
    removeStatus.className = 'err';
    return;
  }
  if (!confirm(`Delete all saved prices from ${from} to ${to}? This cannot be undone.`)) return;

  removeBtn.disabled = true;
  removeStatus.textContent = 'Deleting...';
  removeStatus.className = '';

  try {
    const res = await fetch('/api/delete-data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');

    removeStatus.textContent = `Deleted ${data.deleted} row(s).`;
    removeStatus.className = 'ok';
  } catch (err) {
    removeStatus.textContent = err.message;
    removeStatus.className = 'err';
  } finally {
    removeBtn.disabled = false;
  }
}
removeBtn.addEventListener('click', removeData);

// If arriving from the Stocks page (e.g. /?symbol=ENGRO), prefill the input
const urlParams = new URLSearchParams(window.location.search);
const prefill = urlParams.get('symbol');
if (prefill) {
  input.value = prefill.toUpperCase();
}
