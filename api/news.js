// api/news.js
// Called by the frontend at GET /api/news
// Returns recent news headlines about PSX-listed companies —
// earnings, dividends, expansion plans, and market-moving stories —
// pulled from Google News' public RSS search feed (no API key
// needed). This is a general news aggregator, not PSX's own
// (rights-restricted) data feed.

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

module.exports = async (req, res) => {
  try {
    const query = encodeURIComponent('PSX OR "Pakistan Stock Exchange" stocks dividend');
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-PK&gl=PK&ceid=PK:en`;

    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PSXTracker/1.0)' },
    });

    const parser = new XMLParser();
    const parsed = parser.parse(data);
    const rawItems = parsed?.rss?.channel?.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const news = items.slice(0, 25).map((it) => ({
      title: typeof it.title === 'string' ? it.title : '',
      link: typeof it.link === 'string' ? it.link : '',
      pubDate: it.pubDate || '',
      source: it.source ? (it.source['#text'] || String(it.source)) : '',
    }));

    res.status(200).json({ news });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, news: [] });
  }
};
