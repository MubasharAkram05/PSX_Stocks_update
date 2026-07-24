// scripts/admin.js
// Login (shared-password), then add/edit/remove/reorder the Top
// Stocks list, including each stock's sector/dividend/growth tags.

const loginCard = document.getElementById('loginCard');
const adminPanel = document.getElementById('adminPanel');
const settingsPanel = document.getElementById('settingsPanel');
const removePanel = document.getElementById('removePanel');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const logoutBtn = document.getElementById('logoutBtn');
const newSymbolInput = document.getElementById('newSymbol');
const newSectorSelect = document.getElementById('newSector');
const newDividendCheck = document.getElementById('newDividend');
const newGrowthCheck = document.getElementById('newGrowth');
const addBtn = document.getElementById('addBtn');
const addStatus = document.getElementById('addStatus');
const manageList = document.getElementById('manageList');
const confirmMessageInput = document.getElementById('confirmMessageInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsStatus = document.getElementById('settingsStatus');
const removeFrom = document.getElementById('removeFrom');
const removeTo = document.getElementById('removeTo');
const removeBtn = document.getElementById('removeBtn');
const removeStatus = document.getElementById('removeStatus');

const SECTOR_LABELS = {
  petroleum: 'Petroleum', fertilizer: 'Fertilizer', pharma: 'Medicine',
  cement: 'Cement', tech: 'Technology', power: 'Power', chemical: 'Chemical',
  auto: 'Automobile', engineering: 'Engineering', steel: 'Steel',
  bank: 'Bank', other: 'Other',
};

function getToken() {
  return sessionStorage.getItem('adminToken') || '';
}

function showPanel() {
  loginCard.style.display = 'none';
  adminPanel.style.display = 'block';
  settingsPanel.style.display = 'block';
  removePanel.style.display = 'block';
  loadStocks();
  loadSettings();
}

function showLogin(message) {
  loginCard.style.display = 'block';
  adminPanel.style.display = 'none';
  settingsPanel.style.display = 'none';
  removePanel.style.display = 'none';
  if (message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status err';
  }
}

async function login() {
  const password = passwordInput.value;
  if (!password) return;

  loginBtn.disabled = true;
  loginStatus.textContent = 'Checking...';
  loginStatus.className = 'status';

  try {
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    sessionStorage.setItem('adminToken', data.token);
    passwordInput.value = '';
    showPanel();
  } catch (err) {
    loginStatus.textContent = err.message;
    loginStatus.className = 'status err';
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('adminToken');
  showLogin();
});

async function adminFetch(url, options) {
  options = options || {};
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': getToken(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function sectorOptionsHtml(selected) {
  return Object.keys(SECTOR_LABELS)
    .map((key) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${SECTOR_LABELS[key]}</option>`)
    .join('');
}

function renderList(stocks) {
  manageList.innerHTML = '';
  if (!stocks || stocks.length === 0) {
    manageList.innerHTML = '<li class="placeholder">No stocks yet — add one above.</li>';
    return;
  }
  stocks.forEach((s, i) => {
    const li = document.createElement('li');
    const metaBits = [SECTOR_LABELS[s.sector] || 'Other'];
    if (s.dividend) metaBits.push('High Dividend');
    if (s.growth) metaBits.push('Growth');

    li.innerHTML = `
      <div class="row-top">
        <div>
          <span class="sym">${s.symbol}</span>
          <div class="meta">${metaBits.join(' · ')}</div>
        </div>
        <span class="actions">
          <button class="icon-btn" data-action="edit">✎</button>
          <button class="icon-btn" data-action="up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="down" ${i === stocks.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn remove" data-action="remove">✕</button>
        </span>
      </div>
    `;

    li.querySelector('[data-action="up"]').addEventListener('click', () => reorder(s.symbol, 'up'));
    li.querySelector('[data-action="down"]').addEventListener('click', () => reorder(s.symbol, 'down'));
    li.querySelector('[data-action="remove"]').addEventListener('click', () => removeStock(s.symbol));
    li.querySelector('[data-action="edit"]').addEventListener('click', () => toggleEditForm(li, s));

    manageList.appendChild(li);
  });
}

function toggleEditForm(li, stock) {
  const existing = li.querySelector('.edit-form');
  if (existing) {
    existing.remove();
    return;
  }
  const form = document.createElement('div');
  form.className = 'edit-form';
  form.innerHTML = `
    <select class="edit-sector">${sectorOptionsHtml(stock.sector)}</select>
    <label><input type="checkbox" class="edit-dividend" ${stock.dividend ? 'checked' : ''}/> High Dividend</label>
    <label><input type="checkbox" class="edit-growth" ${stock.growth ? 'checked' : ''}/> Growth</label>
    <button class="save-edit-btn">Save</button>
  `;
  form.querySelector('.save-edit-btn').addEventListener('click', async () => {
    const sector = form.querySelector('.edit-sector').value;
    const dividend = form.querySelector('.edit-dividend').checked;
    const growth = form.querySelector('.edit-growth').checked;
    try {
      await adminFetch('/api/admin-stocks', {
        method: 'PATCH',
        body: JSON.stringify({ symbol: stock.symbol, sector, dividend, growth }),
      });
      loadStocks();
    } catch (err) {
      alert(err.message);
    }
  });
  li.appendChild(form);
}

async function loadStocks() {
  manageList.innerHTML = '<li class="placeholder">Loading...</li>';
  try {
    const data = await adminFetch('/api/admin-stocks');
    renderList(data.stocks);
  } catch (err) {
    manageList.innerHTML = `<li class="placeholder">${err.message}</li>`;
    if (err.message.toLowerCase().includes('admin')) {
      sessionStorage.removeItem('adminToken');
      showLogin();
    }
  }
}

async function addStock() {
  const symbol = newSymbolInput.value.trim();
  if (!symbol) return;

  addBtn.disabled = true;
  addStatus.textContent = 'Adding...';
  addStatus.className = 'status';

  try {
    await adminFetch('/api/admin-stocks', {
      method: 'POST',
      body: JSON.stringify({
        symbol,
        sector: newSectorSelect.value,
        dividend: newDividendCheck.checked,
        growth: newGrowthCheck.checked,
      }),
    });
    newSymbolInput.value = '';
    newDividendCheck.checked = false;
    newGrowthCheck.checked = false;
    newSectorSelect.value = 'other';
    addStatus.textContent = '';
    loadStocks();
  } catch (err) {
    addStatus.textContent = err.message;
    addStatus.className = 'status err';
  } finally {
    addBtn.disabled = false;
  }
}
addBtn.addEventListener('click', addStock);
newSymbolInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addStock(); });

async function removeStock(symbol) {
  try {
    await adminFetch('/api/admin-stocks', { method: 'DELETE', body: JSON.stringify({ symbol }) });
    loadStocks();
  } catch (err) {
    alert(err.message);
  }
}

async function reorder(symbol, direction) {
  try {
    await adminFetch('/api/admin-stocks', { method: 'PATCH', body: JSON.stringify({ symbol, direction }) });
    loadStocks();
  } catch (err) {
    alert(err.message);
  }
}

// --- Save confirmation message setting ---
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    confirmMessageInput.value = data.save_confirm_message || '';
  } catch {
    // leave input blank if it can't load
  }
}

async function saveSettings() {
  const message = confirmMessageInput.value.trim();
  if (!message) return;

  saveSettingsBtn.disabled = true;
  settingsStatus.textContent = 'Saving...';
  settingsStatus.className = 'status';

  try {
    await adminFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ save_confirm_message: message }),
    });
    settingsStatus.textContent = 'Saved.';
  } catch (err) {
    settingsStatus.textContent = err.message;
    settingsStatus.className = 'status err';
  } finally {
    saveSettingsBtn.disabled = false;
  }
}
saveSettingsBtn.addEventListener('click', saveSettings);

// --- Remove saved data in a date range ---
async function removeData() {
  const from = removeFrom.value;
  const to = removeTo.value;
  if (!from || !to) {
    removeStatus.textContent = 'Pick both a From and To date.';
    removeStatus.className = 'status err';
    return;
  }
  if (!confirm(`Delete all saved prices from ${from} to ${to}? This cannot be undone.`)) return;

  removeBtn.disabled = true;
  removeStatus.textContent = 'Deleting...';
  removeStatus.className = 'status';

  try {
    const data = await adminFetch('/api/admin-delete-data', {
      method: 'DELETE',
      body: JSON.stringify({ from, to }),
    });
    removeStatus.textContent = `Deleted ${data.deleted} row(s).`;
  } catch (err) {
    removeStatus.textContent = err.message;
    removeStatus.className = 'status err';
  } finally {
    removeBtn.disabled = false;
  }
}
removeBtn.addEventListener('click', removeData);

// If already logged in this browser session, skip straight to the panel
if (getToken()) {
  showPanel();
} else {
  showLogin();
}
