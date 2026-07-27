// lib/concurrency.js
// Runs an async mapper over a list with at most `limit` in flight at
// once, instead of firing everything via Promise.all. Every symbol
// lookup in lib/psx.js makes 1-2 outbound requests to PSX; doing that
// for every tracked stock all at once (uncapped Promise.all) is easy
// to get rate-limited/blocked for, which then makes every stock on
// the page look like it vanished. Order of results matches the input.

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

module.exports = { mapWithConcurrency };
