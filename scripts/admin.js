// scripts/admin.js
// Logic for admin.html: login (password -> token, kept in
// localStorage so the Save Price button on the home page also works
// once logged in), and add/remove/reorder stocks shown on the Top
// Stocks page.

const TOKEN_KEY = 'psxAdminToken';

const loginCard = document.getElementById('loginCard');
const manageCard = document.getElementById('manageCard');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const logoutBtn = document.getElementById('logoutBtn');

const newSymbolInput = document.getElementById('newSymbol');
const addBtn = document.getElementById('addBtn');
const addStatus = document.getElementById('addStatus');
const stockList = document.getElementById('stockList');

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function showManageView() {
  loginCard.style.display = 'none';
  manageCard.style.display = 'block';
  loadStocks();
}

function showLoginView() {
  loginCard.style.display = 'block';
  manageCard.style.display = 'none';
}

async function login() {
  const password = passwordInput.value;
  if (!password) return;

  loginBtn.disabled = true;
  loginStatus.textContent = 'Checking...';
  loginStatus.className = '';

  try {
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    localStorage.setItem(TOKEN_KEY, data.token);
    passwordInput.value = '';
    loginStatus.textContent = '';
    showManageView();
  } catch (err) {
    loginStatus.textContent = err.message;
    loginStatus.className = 'err';
    alert(err.message);
  } finally {
    loginBtn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  showLoginView();
}

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
logoutBtn.addEventListener('click', logout);

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': getToken(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function loadStocks() {
  stockList.innerHTML = '<li class="placeholder">Loading...</li>';
  try {
    const data = await adminFetch('/api/admin-stocks');
    renderStocks(data.stocks || []);
  } catch (err) {
    if (err.message.includes('Only admin')) {
      logout();
      return;
    }
    stockList.innerHTML = `<li class="placeholder">${err.message}</li>`;
  }
}

function renderStocks(stocks) {
  stockList.innerHTML = '';
  if (stocks.length === 0) {
    stockList.innerHTML = '<li class="placeholder">No stocks yet. Add one above.</li>';
    return;
  }
  stocks.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="sym">${s.symbol}</span>
      <button class="up-btn" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="down-btn" ${i === stocks.length - 1 ? 'disabled' : ''}>▼</button>
      <button class="remove-btn">Remove</button>
    `;
    li.querySelector('.up-btn').addEventListener('click', () => reorder(s.symbol, 'up'));
    li.querySelector('.down-btn').addEventListener('click', () => reorder(s.symbol, 'down'));
    li.querySelector('.remove-btn').addEventListener('click', () => removeStock(s.symbol));
    stockList.appendChild(li);
  });
}

async function addStock() {
  const symbol = newSymbolInput.value.trim();
  if (!symbol) return;

  addBtn.disabled = true;
  addStatus.textContent = 'Fetching price and saving...';
  addStatus.className = '';

  try {
    await adminFetch('/api/save-price', { method: 'POST', body: JSON.stringify({ symbol }) });
    addStatus.textContent = `Added ${symbol.toUpperCase()}.`;
    addStatus.className = 'ok';
    newSymbolInput.value = '';
    loadStocks();
  } catch (err) {
    addStatus.textContent = err.message;
    addStatus.className = 'err';
    alert(err.message);
  } finally {
    addBtn.disabled = false;
  }
}

async function removeStock(symbol) {
  if (!confirm(`Remove ${symbol} from the list?`)) return;
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

addBtn.addEventListener('click', addStock);
newSymbolInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addStock(); });

if (getToken()) {
  showManageView();
} else {
  showLoginView();
}
