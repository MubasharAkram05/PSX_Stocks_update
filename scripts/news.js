// scripts/news.js
// Fetches and renders PSX-related news headlines on news.html

const newsList = document.getElementById('newsList');

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
  try {
    const res = await fetch('/api/news');
    const data = await res.json();
    renderNews(data.news);
  } catch {
    renderNews([]);
  }
}

loadNews();
