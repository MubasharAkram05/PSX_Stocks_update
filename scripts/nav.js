// scripts/nav.js
// Market index (KSE-100) shown below the header nav on every page.
// Best-effort: if the lookup fails, the element is just left empty.
(function loadTopnavIndex() {
  const el = document.getElementById('topnavIndex');
  if (!el) return;

  fetch('/api/psx-index')
    .then((r) => r.json())
    .then((data) => {
      if (data.points == null) {
        el.textContent = '';
        return;
      }
      const dirSymbol = data.direction === 'up' ? '▲' : data.direction === 'down' ? '▼' : '';
      const dirClass = data.direction === 'up' ? 'up' : data.direction === 'down' ? 'down' : '';
      el.innerHTML = `KSE-100 <span class="points">${data.points}</span> <span class="dir ${dirClass}">${dirSymbol}</span>`;
    })
    .catch(() => { el.textContent = ''; });
})();
