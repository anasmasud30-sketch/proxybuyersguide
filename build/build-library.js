'use strict';
/* ==========================================================================
   build-library.js — orchestrates the ~20k programmatic library.
   Loads data banks, plans the page set across clusters, renders each page,
   writes flat-root .html files (idempotent via manifest), builds hub pages,
   sharded sitemaps + sitemap index, and updates robots.txt.

   Usage:
     node build/build-library.js            # full build (~20k)
     node build/build-library.js --limit 60 # quick smoke test (first 60 pages)
     node build/build-library.js --target 20000
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./lib.js');
const { R, TOPPICK, assemble } = require('./content.js');
const { esc, IC, slugify } = L;

const ROOT = path.resolve(__dirname, '..');            // deploy root
const DATA = path.join(__dirname, 'data');
const MANIFEST = path.join(__dirname, 'library-manifest.json');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const LIMIT = parseInt(arg('--limit', '0'), 10) || 0;
const TARGET = parseInt(arg('--target', '20000'), 10);

/* ---------------- load + preprocess data ---------------- */
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const types = load('types.json');
const usecases = load('usecases.json');
const platforms = load('platforms.json');
const tools = load('tools.json');
const providers = load('providers.json');
const geo = load('geo.json');
let geoExtra = {};
try { if (fs.existsSync(path.join(DATA, 'geo-extra.json'))) geoExtra = load('geo-extra.json'); } catch (e) { console.warn('geo-extra load failed:', e.message); }

// unique city slugs (global) so /<city>-<type>-proxies.html never collides
const usedCitySlug = new Set();
const countries = geo.countries.map(c => {
  const cslug = slugify(c.name);
  const cities = (c.cities || []).map(name => {
    let s = slugify(name);
    if (usedCitySlug.has(s)) s = s + '-' + cslug;
    let g = s, k = 2; while (usedCitySlug.has(g)) g = s + '-' + (k++);
    usedCitySlug.add(g);
    return { name, slug: g };
  });
  return { name: c.name, slug: cslug, demonym: c.demonym, region: c.region, capital: c.capital, cities };
});
const citiesFlat = [];
for (const c of countries) for (const ct of c.cities)
  citiesFlat.push({ name: ct.name, slug: ct.slug, country: c.name, countrySlug: c.slug, demonym: c.demonym, region: c.region });

const bySlug = {
  type: Object.fromEntries(types.map(t => [t.slug, t])),
  usecase: Object.fromEntries(usecases.map(u => [u.slug, u])),
  platform: Object.fromEntries(platforms.map(p => [p.slug, p])),
  tool: Object.fromEntries(tools.map(t => [t.slug, t])),
  provider: Object.fromEntries(providers.map(p => [p.slug, p])),
};
const D = { types, usecases, platforms, tools, providers, countries, citiesFlat, bySlug, geoExtra };

// market-size ordering for geo fill clusters
const countriesByMarket = countries.slice().sort((a, b) => b.cities.length - a.cities.length || a.name.localeCompare(b.name));

/* ---------------- plan the page set ---------------- */
// Each descriptor: { cluster, params }. Renderers compute the path.
const plan = [];
const add = (cluster, params) => plan.push({ cluster, params });

for (const type of types) add('type', { type });
for (const uc of usecases) add('usecase', { uc });
for (const pf of platforms) add('platform', { pf });
for (const tool of tools) add('tool', { tool });
// comparisons (unordered pairs)
for (let i = 0; i < providers.length; i++) for (let j = i + 1; j < providers.length; j++) add('comparison', { a: providers[i], b: providers[j] });
for (const prov of providers) add('alternative', { prov });
for (const type of types) for (const uc of usecases) add('usecaseType', { uc, type });
for (const type of types) for (const pf of platforms) add('platformType', { pf, type });
for (const prov of providers) for (const type of types) add('providerType', { prov, type });
for (const prov of providers) for (const uc of usecases) add('providerUsecase', { prov, uc });
for (const country of countries) add('country', { country });
for (const country of countries) for (const type of types) add('countryType', { country, type });
for (const uc of usecases) for (const country of countries) add('usecaseCountry', { uc, country });
for (const country of countries) for (const type of types) for (const city of country.cities) add('cityType', { city: citiesFlat.find(f => f.slug === city.slug), type });

// fill clusters (to reach TARGET): provider-country then platform-country
const fill = [];
for (const prov of providers) for (const country of countriesByMarket.slice(0, 60)) fill.push({ cluster: 'providerCountry', params: { prov, country } });
for (const pf of platforms) for (const country of countries) fill.push({ cluster: 'platformCountry', params: { pf, country } });

/* ---------------- render + write ---------------- */
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const newManifest = {};
const seen = new Set();
const sitemapPaths = [];
let written = 0, skipped = 0, dup = 0, errors = 0, count = 0;

function emit(desc) {
  let pageOut;
  try { pageOut = R[desc.cluster](D, desc.params); }
  catch (e) { errors++; if (errors <= 5) console.error('ERR', desc.cluster, e.message); return; }
  const p = pageOut.path;
  if (seen.has(p)) { dup++; return; }
  seen.add(p);
  count++;
  const file = path.join(ROOT, p.replace(/^\//, ''));
  const hash = crypto.createHash('md5').update(pageOut.html).digest('hex');
  newManifest[p] = { cluster: desc.cluster, hash, noindex: !!pageOut.noindex };
  if (!pageOut.noindex) sitemapPaths.push(p);
  if (manifest[p] && manifest[p].hash === hash && fs.existsSync(file)) { skipped++; return; }
  fs.writeFileSync(file, pageOut.html);
  written++;
}

console.log(`Planned: ${plan.length} core + up to ${fill.length} fill (target ${TARGET})`);
// core first
for (const d of plan) {
  if (LIMIT && count >= LIMIT) break;
  emit(d);
}
// fill to target
if (!LIMIT) {
  for (const d of fill) {
    if (count >= TARGET) break;
    emit(d);
  }
}

/* ---------------- hub pages ---------------- */
function hubPage({ path: hpath, title, desc, eyebrow, h1, lede, groups, crumbs }) {
  const rng = L.rngFor(hpath);
  const sections = groups.map(g => `<section>${L.sectionTitle(g.icon || 'layers', g.title)}
    <div class="hub-grid">${g.items.map(it => `<a class="hub-card" href="${it[1]}"><h3>${esc(it[0])}</h3>${it[2] ? `<p>${esc(it[2])}</p>` : ''}${it[3] ? `<span class="cnt">${esc(it[3])}</span>` : ''}</a>`).join('')}</div></section>`).join('\n');
  const body = `${L.crumbHtml(crumbs)}
<main>
  <header class="hero"><div class="wrap hero-in">
    <span class="eyebrow">${IC.book} ${esc(eyebrow)}</span>
    <h1>${h1}</h1><p class="lede">${esc(lede)}</p>
    <div class="btn-row"><a class="btn" href="${L.SITE.topPick.url}" target="_blank" rel="noopener sponsored">See our #1 pick ${IC.arrow}</a></div>
  </div></header>
  <div class="wrap">${sections}${L.ctaBand(rng, 'Find your perfect proxy', 'After testing 40+ providers, one delivered the best value overall. See why it is our top pick.')}</div>
</main>`;
  const ld = [L.breadcrumbLd(crumbs), L.articleLd({ title, desc, canonical: L.SITE.url + hpath, slug: hpath })];
  const html = L.pageShell({ title, desc, path: hpath, bodyHtml: body, ld });
  const file = path.join(ROOT, hpath.replace(/^\//, ''));
  fs.writeFileSync(file, html);
  sitemapPaths.push(hpath);
  newManifest[hpath] = { cluster: 'hub', hash: crypto.createHash('md5').update(html).digest('hex') };
  written++;
}

if (!LIMIT) {
  hubPage({
    path: '/proxies-by-type.html', title: `Proxy Types Explained (${2025}) — Residential, Datacenter, Mobile & More`,
    desc: 'Compare every proxy type — residential, datacenter, mobile, ISP, rotating, SOCKS5 and IPv6 — with pricing, speed and best use cases.',
    eyebrow: 'Proxy Types', h1: `${'<span class="hl">Proxy Types</span>'} Explained`,
    lede: 'Not sure which proxy type you need? Compare all seven by speed, price and detection risk.',
    crumbs: [['Home', '/'], ['Proxy Types', '/proxies-by-type.html']],
    groups: [{ title: 'All proxy types', icon: 'layers', items: types.map(t => [t.name, `/${t.slug}-proxies.html`, L.stripTags(t.tagline)]) }],
  });
  hubPage({
    path: '/proxies-by-use-case.html', title: `Proxies by Use Case (${2025}) — Find the Right Proxy for Any Task`,
    desc: 'The best proxies for web scraping, sneaker copping, ad verification, SEO, social media and 25+ more use cases.',
    eyebrow: 'Use Cases', h1: `Proxies by ${'<span class="hl">Use Case</span>'}`,
    lede: 'Pick your task and get the ideal proxy type and providers for it.',
    crumbs: [['Home', '/'], ['Use Cases', '/proxies-by-use-case.html']],
    groups: [{ title: 'Popular use cases', icon: 'target', items: usecases.map(u => [u.name, `/proxies-for-${u.slug}.html`, u.keyMetric ? 'Optimised for ' + u.keyMetric : '']) }],
  });
  hubPage({
    path: '/proxies-by-platform.html', title: `Proxies by Platform (${2025}) — Instagram, Amazon, Google & 37 More`,
    desc: 'The best proxies for Instagram, TikTok, Amazon, Google, Nike, Ticketmaster and dozens more platforms.',
    eyebrow: 'Platforms', h1: `Proxies by ${'<span class="hl">Platform</span>'}`,
    lede: 'Target-specific proxy guidance for the platforms people scrape and automate most.',
    crumbs: [['Home', '/'], ['Platforms', '/proxies-by-platform.html']],
    groups: [{ title: 'Supported platforms', icon: 'search', items: platforms.map(p => [p.name, `/proxies-for-${p.slug}.html`, p.category]) }],
  });
  hubPage({
    path: '/proxies-by-country.html', title: `Proxies by Country (${2025}) — 146 Countries & Local IPs`,
    desc: 'Residential, datacenter and mobile proxies for 146 countries. Get local IPs for accurate geo-targeting anywhere.',
    eyebrow: 'Locations', h1: `Proxies by ${'<span class="hl">Country</span>'}`,
    lede: 'Local IPs in 146 countries for geo-targeted scraping, ad verification and localization.',
    crumbs: [['Home', '/'], ['Locations', '/proxies-by-country.html']],
    groups: (() => {
      const byRegion = {};
      for (const c of countries) (byRegion[c.region] = byRegion[c.region] || []).push([c.name, `/${c.slug}-proxies.html`]);
      return Object.entries(byRegion).map(([r, items]) => ({ title: r, icon: 'globe', items }));
    })(),
  });
  hubPage({
    path: '/proxies-by-city.html', title: `Proxies by City (${2025}) — City-Level IP Targeting Worldwide`,
    desc: 'City-level proxy targeting across 1,300+ cities worldwide. Get local IPs in any major city for precise geo-data.',
    eyebrow: 'Locations', h1: `Proxies by ${'<span class="hl">City</span>'}`,
    lede: 'City-level IP targeting in 1,300+ cities for the most precise local data.',
    crumbs: [['Home', '/'], ['Locations', '/proxies-by-country.html'], ['By City', '/proxies-by-city.html']],
    groups: countriesByMarket.slice(0, 24).map(c => ({ title: c.name, icon: 'pin', items: c.cities.slice(0, 8).map(ct => [`${ct.name}`, `/${ct.slug}-residential-proxies.html`]) })),
  });
  hubPage({
    path: '/proxy-setup-guides.html', title: `Proxy Setup Guides (${2025}) — Python, Node, cURL, Playwright & More`,
    desc: 'Step-by-step proxy setup guides with code for Python Requests, Scrapy, Selenium, Playwright, Puppeteer, cURL, Go and more.',
    eyebrow: 'Setup Guides', h1: `Proxy ${'<span class="hl">Setup Guides</span>'}`,
    lede: 'Copy-paste proxy configuration for every popular language and scraping tool.',
    crumbs: [['Home', '/'], ['Setup Guides', '/proxy-setup-guides.html']],
    groups: [{ title: 'Languages & tools', icon: 'code', items: tools.map(t => [t.name, `/proxy-setup-${t.slug}.html`, t.category]) }],
  });
  hubPage({
    path: '/proxy-comparisons.html', title: `Proxy Provider Comparisons (${2025}) — Head-to-Head & Alternatives`,
    desc: 'Compare the top proxy providers head-to-head and find the best alternatives to Bright Data, Oxylabs, Smartproxy and more.',
    eyebrow: 'Comparisons', h1: `Proxy ${'<span class="hl">Comparisons</span>'}`,
    lede: 'Head-to-head provider matchups and the best alternatives to every major network.',
    crumbs: [['Home', '/'], ['Comparisons', '/proxy-comparisons.html']],
    groups: [
      { title: 'Popular head-to-heads', icon: 'chart', items: (() => { const out = []; for (let i = 0; i < Math.min(providers.length, 8); i++) for (let j = i + 1; j < Math.min(providers.length, 8); j++) out.push([`${providers[i].name} vs ${providers[j].name}`, `/${providers[i].slug}-vs-${providers[j].slug}.html`]); return out.slice(0, 18); })() },
      { title: 'Provider alternatives', icon: 'layers', items: providers.map(p => [`${p.name} alternatives`, `/${p.slug}-alternatives.html`]) },
    ],
  });
  hubPage({
    path: '/best-proxies.html', title: `Best Proxies (${2025}) — Top Providers Ranked by Value & Success Rate`,
    desc: 'The best proxy providers of 2025 ranked by value, pool quality and success rate — plus the best proxies by type, use case and platform.',
    eyebrow: 'Best Of', h1: `${'<span class="hl">Best Proxies</span>'} of 2025`,
    lede: 'Our top-ranked proxy providers plus the best picks for every type, task and platform.',
    crumbs: [['Home', '/'], ['Best Proxies', '/best-proxies.html']],
    groups: [
      { title: 'Best by type', icon: 'layers', items: types.map(t => [`Best ${t.name}`, `/${t.slug}-proxies.html`]) },
      { title: 'Best by use case', icon: 'target', items: usecases.slice(0, 12).map(u => [`Best for ${u.name}`, `/proxies-for-${u.slug}.html`]) },
    ],
  });
  hubPage({
    path: '/proxy-guides.html', title: `Proxy Guides & Resources (${2025}) — The Complete Library`,
    desc: 'Browse the full proxy library: guides by type, use case, platform, country, city, setup and provider comparisons.',
    eyebrow: 'Library', h1: `Proxy ${'<span class="hl">Guides</span>'} & Resources`,
    lede: 'Everything in one place — thousands of proxy guides across types, use cases, platforms and locations.',
    crumbs: [['Home', '/'], ['Guides', '/proxy-guides.html']],
    groups: [{
      title: 'Browse the library', icon: 'book', items: [
        ['Proxy Types', '/proxies-by-type.html', 'Residential, datacenter, mobile & more', `${types.length} types`],
        ['By Use Case', '/proxies-by-use-case.html', 'Scraping, sneakers, ads, SEO & more', `${usecases.length} use cases`],
        ['By Platform', '/proxies-by-platform.html', 'Instagram, Amazon, Google & more', `${platforms.length} platforms`],
        ['By Country', '/proxies-by-country.html', 'Local IPs worldwide', `${countries.length} countries`],
        ['By City', '/proxies-by-city.html', 'City-level targeting', `${citiesFlat.length}+ cities`],
        ['Setup Guides', '/proxy-setup-guides.html', 'Code for every language', `${tools.length} tools`],
        ['Comparisons', '/proxy-comparisons.html', 'Head-to-head & alternatives'],
        ['Best Proxies', '/best-proxies.html', 'Top providers ranked'],
      ],
    }],
  });
}

/* ---------------- sitemaps ---------------- */
function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
if (!LIMIT) {
  // preserve original core sitemap once
  const coreOut = path.join(ROOT, 'sitemap-core.xml');
  const smMain = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(coreOut) && fs.existsSync(smMain)) {
    const cur = fs.readFileSync(smMain, 'utf8');
    if (/<urlset/i.test(cur)) fs.writeFileSync(coreOut, cur);
  }
  const PER = 10000;
  const shards = [];
  for (let i = 0; i < sitemapPaths.length; i += PER) shards.push(sitemapPaths.slice(i, i + PER));
  const today = '2025-06-01';
  shards.forEach((sh, idx) => {
    const urls = sh.map(p => `<url><loc>${L.SITE.url}${xmlEsc(p)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>`).join('\n');
    fs.writeFileSync(path.join(ROOT, `sitemap-library-${idx + 1}.xml`),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });
  const idxItems = [];
  if (fs.existsSync(coreOut)) idxItems.push('sitemap-core.xml');
  shards.forEach((_, i) => idxItems.push(`sitemap-library-${i + 1}.xml`));
  const idxXml = idxItems.map(f => `<sitemap><loc>${L.SITE.url}/${f}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n');
  fs.writeFileSync(smMain, `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${idxXml}\n</sitemapindex>\n`);

  // robots.txt
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${L.SITE.url}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);

  // orphan cleanup: remove pages from a previous run that are no longer generated
  let removed = 0;
  for (const p in manifest) {
    if (!(p in newManifest)) {
      const file = path.join(ROOT, p.replace(/^\//, ''));
      try { if (fs.existsSync(file)) { fs.unlinkSync(file); removed++; } } catch (e) {}
    }
  }
  if (removed) console.log('Orphans removed      :', removed);

  fs.writeFileSync(MANIFEST, JSON.stringify(newManifest));
}

/* ---------------- summary ---------------- */
console.log('----------------------------------------');
console.log('Unique pages rendered :', count + (LIMIT ? 0 : Object.keys(newManifest).filter(k => newManifest[k].cluster === 'hub').length));
console.log('Files written         :', written);
console.log('Unchanged (skipped)   :', skipped);
console.log('Duplicate paths        :', dup);
console.log('Errors                :', errors);
if (!LIMIT) console.log('Sitemap URLs          :', sitemapPaths.length, `(in ${Math.ceil(sitemapPaths.length / 10000)} shards)`);
// cluster breakdown
const byCluster = {};
for (const k in newManifest) byCluster[newManifest[k].cluster] = (byCluster[newManifest[k].cluster] || 0) + 1;
console.log('By cluster            :', JSON.stringify(byCluster));
