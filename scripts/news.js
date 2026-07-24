// scripts/news.js
// Fetches and renders PSX-related news headlines on news.html,
// with a search box and a Dividend/AGM-focused filter.

const newsList = document.getElementById('newsList');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const allBtn = document.getElementById('allBtn');
const dividendBtn = document.getElementById('dividendBtn');

let dividendOnly = false;

function renderNews(items) {
  newsList.innerHTML = '';
  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = 'No news available right now.';
    newsList.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'news-item';
    const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString() : '';
    li.innerHTML = `
      <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
      <span class="meta">${item.source || ''}${date ? ' · ' + date : ''}</span>
    `;
    newsList.appendChild(li);
  });
}

async function loadNews() {
  newsList.innerHTML = '<li class="placeholder">Loading...</li>';
  const params = new URLSearchParams();
  const q = searchInput.value.trim();
  if (q) params.set('q', q);
  if (dividendOnly) params.set('dividend', 'true');

  try {
    const res = await fetch(`/api/news?${params.toString()}`);
    const data = await res.json();
    renderNews(data.news);
  } catch {
    renderNews([]);
  }
}

searchBtn.addEventListener('click', loadNews);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadNews(); });

allBtn.addEventListener('click', () => {
  dividendOnly = false;
  allBtn.classList.add('active');
  dividendBtn.classList.remove('active');
  loadNews();
});
dividendBtn.addEventListener('click', () => {
  dividendOnly = true;
  dividendBtn.classList.add('active');
  allBtn.classList.remove('active');
  loadNews();
});

loadNews();
