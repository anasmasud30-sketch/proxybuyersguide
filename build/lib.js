'use strict';
/* ==========================================================================
   lib.js — shared rendering engine for the proxybuyersguide programmatic library.
   Pure functions: chrome (nav/footer), components, deterministic per-slug variation,
   schema (JSON-LD), and the full HTML page shell. No file I/O here.
   ========================================================================== */

const SITE = {
  url: 'https://proxybuyersguide.com',
  brand: "Proxy Buyer's Guide",
  email: 'info@proxybuyersguide.com',
  topPick: { name: 'Cheapest-Proxies.com', url: 'https://cheapest-proxies.com/' },
};

const NAV = [
  ['Guide', '/'],
  ['Reviews', '/proxy-provider-analysis/bright-data-review'],
  ['Top Lists', '/compare'],
  ['Resources', '/tips'],
  ['Compare', '/compare'],
  ['Locations', '/locations/us-proxy-network'],
  ['Blog', '/blog/'],
  ['Guides', '/proxy-guides.html'],
];

const FOOTER_COLS = [
  ['Proxy Types', [
    ['Residential Proxies', '/residential-proxies.html'],
    ['Datacenter Proxies', '/datacenter-proxies.html'],
    ['Mobile Proxies', '/mobile-proxies.html'],
    ['ISP Proxies', '/isp-proxies.html'],
    ['Rotating Proxies', '/rotating-proxies.html'],
  ]],
  ['Popular Guides', [
    ['Proxies by City', '/proxies-by-city.html'],
    ['Proxies by Country', '/proxies-by-country.html'],
    ['Proxies by Use Case', '/proxies-by-use-case.html'],
    ['Proxies for Platforms', '/proxies-by-platform.html'],
    ['Proxy Setup Guides', '/proxy-setup-guides.html'],
  ]],
  ['Reviews', [
    ['Bright Data Review', '/proxy-provider-analysis/bright-data-review'],
    ['Oxylabs Review', '/proxy-provider-analysis/oxylabs-review'],
    ['Smartproxy Review', '/proxy-provider-analysis/smartproxy-review'],
    ['IPRoyal Review', '/proxy-provider-analysis/iproyal-review'],
    ['All Provider Reviews', '/compare'],
  ]],
  ['Compare', [
    ['Bright Data vs Oxylabs', '/bright-data-vs-oxylabs.html'],
    ['Provider Comparisons', '/proxy-comparisons.html'],
    ['Residential vs Datacenter', '/resources/residential-vs-datacenter-proxies'],
    ['Proxy vs VPN', '/resources/proxy-vs-vpn'],
    ['Best Proxy Lists', '/best-proxies.html'],
  ]],
];

/* ---------- escaping ---------- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const jsonEsc = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* ---------- slug ---------- */
const slugify = (s) => String(s).toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ---------- text helpers ---------- */
// ensure a single trailing period (strip existing trailing punctuation/space first)
const dot = (s) => String(s || '').replace(/[\s.;,]+$/, '') + '.';
// word-boundary truncation with ellipsis (never cut mid-word)
const clipWords = (s, max) => { s = String(s || '').trim(); if (s.length <= max) return s; const cut = s.slice(0, max); const sp = cut.lastIndexOf(' '); return (sp > 10 ? cut.slice(0, sp) : cut).replace(/[\s,.;]+$/, '') + '…'; };
// clip a full sentence string to <= max chars at a word boundary (no ellipsis, for meta)
const clip = (s, max) => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length <= max) return s; const cut = s.slice(0, max); const sp = cut.lastIndexOf(' '); return (sp > 10 ? cut.slice(0, sp) : cut).replace(/[\s,.;]+$/, ''); };
// strip a leading "from"/"~" and any parenthetical qualifier (for compact price chips)
const shortPrice = (s) => String(s || '').replace(/^\s*from\s+/i, '').replace(/\s*\([^)]*\)/g, '').replace(/^\s*~\s*/, '~').trim();
// strip only a leading "from " (keeps qualifier)
const cleanFrom = (s) => String(s || '').replace(/^\s*from\s+/i, '').trim();
// a / an by leading sound (letter heuristic)
const aAn = (w) => (/^[aeiou]/i.test(String(w || '')) ? 'an' : 'a');
// build/generation date (generator runs in Node — Date is available here)
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();

/* ---------- deterministic RNG (stable per slug => idempotent output) ---------- */
function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngFor = (seed) => mulberry32(hashStr(seed));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const pickN = (rng, arr, n) => {
  const a = arr.slice(); const out = [];
  while (a.length && out.length < n) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
  return out;
};
const between = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const fill = (tpl, map) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`));

/* ---------- inline icons ---------- */
const IC = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.5 7 .6-5.3 4.6 1.6 6.9L12 17.3 5.7 20.6l1.6-6.9L2 9.1l7-.6z"/></svg>',
};
const TYPE_ICON = { residential: 'globe', datacenter: 'server', mobile: 'phone', isp: 'layers', rotating: 'bolt', socks5: 'lock', ipv6: 'target' };

/* ---------- rating stars ---------- */
function stars(rating) {
  const full = Math.round(rating);
  let s = '';
  for (let i = 0; i < 5; i++) s += `<span style="color:${i < full ? '#ffc233' : '#5a5a5a'}">${IC.star}</span>`;
  return `<span class="rate" aria-label="${rating} out of 5">${s} ${rating.toFixed(1)}</span>`
    .replace('class="rate"', 'class="rate" style="display:inline-flex;gap:1px;align-items:center"');
}

/* ---------- chrome ---------- */
function navHtml() {
  const links = NAV.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join('');
  return `<nav class="nav"><div class="nav-in">
  <a class="brand" href="/"><span class="logo">${IC.shield}</span><span>${esc(SITE.brand)}</span></a>
  <div class="nav-links">${links}</div>
  <a class="nav-cta" href="${SITE.topPick.url}" target="_blank" rel="noopener sponsored">Top Pick ${IC.arrow}</a>
</div></nav>`;
}
function footerHtml() {
  const cols = FOOTER_COLS.map(([h, links]) => `<div><h4>${esc(h)}</h4><ul>${
    links.map(([t, u]) => `<li><a href="${u}">${esc(t)}</a></li>`).join('')}</ul></div>`).join('');
  return `<footer class="foot"><div class="wrap">
  <div class="foot-cols">${cols}</div>
  <div class="foot-bar">
    <a class="brand" href="/"><span class="logo">${IC.shield}</span><span>${esc(SITE.brand)}</span></a>
    <div class="foot-links"><a href="/privacy-policy">Privacy</a><a href="/about">About</a><a href="mailto:${SITE.email}">Contact</a><a href="/sitemap.xml">Sitemap</a></div>
  </div>
  <p class="foot-note">&copy; ${YEAR} ProxyBuyersGuide.com. All rights reserved. This site contains affiliate links and our top pick is a paid partner; we may earn a commission at no extra cost to you. Rankings are based on published provider data and hands-on evaluation. Provider details and pricing change &mdash; always verify on the provider's site.</p>
</div></footer>`;
}
function crumbHtml(items) {
  const parts = items.map((it, i) => i === items.length - 1
    ? `<span>${esc(it[0])}</span>`
    : `<a href="${it[1]}">${esc(it[0])}</a><span>/</span>`);
  return `<nav class="crumb wrap" aria-label="Breadcrumb">${parts.join('')}</nav>`;
}

/* ---------- components ---------- */
function sectionTitle(icon, title) {
  return `<div class="section-t"><span class="ic">${IC[icon] || IC.bolt}</span><h2>${esc(title)}</h2></div>`;
}
function checks(items, cls = 'checks') {
  return `<ul class="${cls}">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
}
function statsRow(stats) {
  return `<div class="stats">${stats.map(s => `<div class="stat"><div class="n">${esc(s[0])}</div><div class="l">${esc(s[1])}</div></div>`).join('')}</div>`;
}
function faqBlock(faqs) {
  const html = `<div class="faq">${faqs.map(f =>
    `<details><summary>${esc(f.q)}</summary><div class="a"><p>${f.a}</p></div></details>`).join('')}</div>`;
  return html;
}
function relatedGrid(links) {
  return `<div class="rel">${links.map(([t, u]) =>
    `<a href="${u}">${esc(t)}<span class="arw">${IC.arrow}</span></a>`).join('')}</div>`;
}
function providerCards(list, rng) {
  return `<div class="prov-list">${list.map((p, i) => {
    const ext = p.external;
    const href = ext ? p.url : p.reviewPath;
    const linkAttrs = ext ? ` target="_blank" rel="noopener sponsored"` : '';
    const linkText = ext ? `Visit ${esc(p.name)}` : `Read ${esc(p.name)} review`;
    return `
    <div class="prov${i === 0 ? ' top' : ''}">
      <div class="rank">${i + 1}</div>
      <div class="body">
        <h3>${esc(p.name)}${ext ? ' <span style="color:var(--orange-2);font-size:.7rem;font-weight:800;letter-spacing:.06em">EDITOR\'S CHOICE</span>' : ''}</h3>
        ${stars(p.rating || 4.2)}
        <p>${esc(p.tagline || (p.strengths && p.strengths[0]) || '')}${p.startingPrice ? ' &middot; ' + esc(p.startingPrice) : ''}</p>
        <a class="go" href="${href}"${linkAttrs}>${linkText} ${IC.arrow}</a>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function ctaBand(rng, headline, sub) {
  return `<div class="cta"><h2>${esc(headline)}</h2><p>${sub}</p>
    <a class="btn" href="${SITE.topPick.url}" target="_blank" rel="noopener sponsored">Visit ${esc(SITE.topPick.name)} ${IC.arrow}</a></div>`;
}

/* ---------- JSON-LD ---------- */
function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it[0],
      item: SITE.url + (it[1] || '/'),
    })),
  };
}
function faqLd(faqs) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: jsonEsc(f.q),
      acceptedAnswer: { '@type': 'Answer', text: jsonEsc(stripTags(f.a)) },
    })),
  };
}
function articleLd({ title, desc, canonical, slug }) {
  return {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: jsonEsc(title), description: jsonEsc(desc),
    mainEntityOfPage: canonical, url: canonical,
    author: { '@type': 'Organization', name: SITE.brand, url: SITE.url },
    publisher: { '@type': 'Organization', name: SITE.brand, url: SITE.url },
    datePublished: '2025-06-01', dateModified: BUILD_DATE,
  };
}

/* ---------- page shell ---------- */
function pageShell({ title, desc, path, bodyHtml, ld, noindex }) {
  const canonical = SITE.url + path;
  const ldBlocks = (ld || []).map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : '<meta name="robots" content="index,follow">\n'}<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(SITE.brand)}">
<meta property="og:image" content="${SITE.url}/opengraph.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/library.css">
${ldBlocks}
</head>
<body>
${navHtml()}
${bodyHtml}
${footerHtml()}
</body>
</html>`;
}

module.exports = {
  SITE, NAV, FOOTER_COLS, IC, TYPE_ICON, BUILD_DATE, YEAR,
  esc, stripTags, jsonEsc, slugify, dot, clip, clipWords, shortPrice, cleanFrom, aAn,
  hashStr, mulberry32, rngFor, pick, pickN, between, fill,
  stars, navHtml, footerHtml, crumbHtml,
  sectionTitle, checks, statsRow, faqBlock, relatedGrid, providerCards, ctaBand,
  breadcrumbLd, faqLd, articleLd, pageShell,
};
