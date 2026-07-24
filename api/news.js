// api/news.js
// Called by the frontend at GET /api/news
//   ?q=SYMBOL_OR_COMPANY   — search news for a specific stock/company
//   &dividend=true         — bias toward dividend/AGM/book-closure news
//
// Returns recent news headlines related to PSX-listed companies,
// pulled from Google News' public RSS search feed (no API key
// needed). This is a general news aggregator, not PSX's own
// (rights-restricted) data feed, so it can't guarantee every result
// is PSX-specific — results are biased toward Pakistan stock market
// terms to keep them relevant.

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

module.exports = async (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    const dividendOnly = req.query.dividend === 'true';

    let query;
    if (dividendOnly && search) {
      query = `"${search}" PSX dividend OR "book closure" OR "AGM" OR "board meeting"`;
    } else if (dividendOnly) {
      query = `PSX dividend OR "book closure" OR "AGM" OR "board meeting" Pakistan stock`;
    } else if (search) {
      query = `"${search}" PSX Pakistan stock`;
    } else {
      query = `"Pakistan Stock Exchange" OR PSX earnings OR dividend OR expansion stocks`;
    }

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PK&gl=PK&ceid=PK:en`;

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
