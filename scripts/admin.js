// scripts/admin.js
// Login (shared-password), then add/remove/reorder the Top Stocks list.

const loginCard = document.getElementById('loginCard');
const adminPanel = document.getElementById('adminPanel');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const logoutBtn = document.getElementById('logoutBtn');
const newSymbolInput = document.getElementById('newSymbol');
const addBtn = document.getElementById('addBtn');
const addStatus = document.getElementById('addStatus');
const manageList = document.getElementById('manageList');

function getToken() {
  return sessionStorage.getItem('adminToken') || '';
}

function showPanel() {
  loginCard.style.display = 'none';
  adminPanel.style.display = 'block';
  loadStocks();
}

function showLogin(message) {
  loginCard.style.display = 'block';
  adminPanel.style.display = 'none';
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

function renderList(stocks) {
  manageList.innerHTML = '';
  if (!stocks || stocks.length === 0) {
    manageList.innerHTML = '<li class="placeholder">No stocks yet — add one above.</li>';
    return;
  }
  stocks.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="sym">${s.symbol}</span>
      <span class="actions">
        <button class="icon-btn" data-action="up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-action="down" ${i === stocks.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn remove" data-action="remove">✕</button>
      </span>
    `;
    li.querySelector('[data-action="up"]').addEventListener('click', () => reorder(s.symbol, 'up'));
    li.querySelector('[data-action="down"]').addEventListener('click', () => reorder(s.symbol, 'down'));
    li.querySelector('[data-action="remove"]').addEventListener('click', () => removeStock(s.symbol));
    manageList.appendChild(li);
  });
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
    await adminFetch('/api/admin-stocks', { method: 'POST', body: JSON.stringify({ symbol }) });
    newSymbolInput.value = '';
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

// If already logged in this browser session, skip straight to the panel
if (getToken()) {
  showPanel();
} else {
  showLogin();
}
