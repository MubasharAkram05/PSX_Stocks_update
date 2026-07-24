// api/news.js
// Called by the frontend at GET /api/news
//   ?q=SYMBOL_OR_COMPANY   — search announcements for a specific stock/company
//   &dividend=true         — narrow further to dividend/book-closure/board-meeting only
//
// Returns ONLY company-announcement-style news — board meetings,
// dividend declarations, book closures, AGM/EOGM, bonus/right issues
// — not general market commentary. Pulled from Google News' public
// RSS search feed (no API key needed), then filtered so only results
// whose headline actually mentions an announcement-type term make it
// through, since a broad OR query can still surface loosely-related
// articles.

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

// Keywords that mark a headline as an actual company announcement,
// not general market news. Used both to build the search query and
// to filter results afterward.
const ANNOUNCEMENT_TERMS = [
  'board meeting', 'dividend', 'book closure', 'agm', 'eogm',
  'bonus issue', 'right issue', 'rights issue', 'interim result',
  'annual result', 'profit after tax', 'announces', 'announcement',
];

const DIVIDEND_TERMS = ['dividend', 'book closure', 'board meeting', 'agm', 'eogm'];

module.exports = async (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    const dividendOnly = req.query.dividend === 'true';

    const termGroup = dividendOnly
      ? '(dividend OR "book closure" OR "board meeting" OR AGM OR EOGM)'
      : '("board meeting" OR dividend OR "book closure" OR AGM OR EOGM OR "bonus issue" OR "right issue")';

    const query = search
      ? `"${search}" ${termGroup} PSX`
      : `${termGroup} (PSX OR "Pakistan Stock Exchange")`;

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PK&gl=PK&ceid=PK:en`;

    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PSXTracker/1.0)' },
    });

    const parser = new XMLParser();
    const parsed = parser.parse(data);
    const rawItems = parsed?.rss?.channel?.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const relevantTerms = dividendOnly ? DIVIDEND_TERMS : ANNOUNCEMENT_TERMS;

    let news = items.map((it) => ({
      title: typeof it.title === 'string' ? it.title : '',
      link: typeof it.link === 'string' ? it.link : '',
      pubDate: it.pubDate || '',
      source: it.source ? (it.source['#text'] || String(it.source)) : '',
    }));

    // Keep only headlines that actually mention an announcement term —
    // filters out loosely-related general market articles.
    news = news.filter((item) => {
      const lower = item.title.toLowerCase();
      return relevantTerms.some((term) => lower.includes(term));
    });

    res.status(200).json({ news: news.slice(0, 25) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, news: [] });
  }
};
