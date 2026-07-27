// scripts/sparkline.js
// Shared helper: builds a tiny inline SVG line chart from a price
// trend array. Green if trending up, red if down, gray if flat/
// unknown. Used on the Stocks page.

function sparklineSvg(trend, direction, size) {
  size = size || { w: 56, h: 24 };
  const w = size.w;
  const h = size.h;
  const color = direction === 'up' ? '#4ade80' : direction === 'down' ? '#f87171' : '#64748b';

  if (!trend || trend.length < 2) {
    return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="2" y1="${h / 2}" x2="${w - 2}" y2="${h / 2}" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const range = max - min || 1;
  const pad = 3;
  const points = trend
    .map((v, i) => {
      const x = pad + (i / (trend.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
