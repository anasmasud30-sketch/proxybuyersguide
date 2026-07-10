'use strict';
/* ==========================================================================
   content.js — cluster page-list builder + per-page renderer.
   Produces unique, keyword-rich, internally-linked pages from the data banks.
   Uniqueness: entity facts + deterministic (slug-seeded) variant selection.
   ========================================================================== */
const L = require('./lib.js');
const { esc, IC, TYPE_ICON, rngFor, pick, pickN, between, fill, slugify, dot, clip, clipWords, shortPrice, aAn } = L;

const YEAR = L.YEAR;
const hl = (s) => `<span class="hl">${esc(s)}</span>`;
const P = (s) => `<p>${s}</p>`;
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
// lowercase the first letter only for normal capitalised words (leave acronyms like P2P/SEO/API/ISP intact)
const lowerFirst = (s) => /^[A-Z][a-z]/.test(String(s)) ? String(s).charAt(0).toLowerCase() + String(s).slice(1) : String(s || '');
// join a list with a serial comma + "and"
const andList = (arr) => { const a = (arr || []).filter(Boolean); if (a.length <= 1) return a[0] || ''; if (a.length === 2) return a[0] + ' and ' + a[1]; return a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; };
// join a common-noun phrase list for mid-sentence prose (lowercased first letters + serial "and")
const proseList = (arr, n) => andList((arr || []).slice(0, n || (arr || []).length).map(lowerFirst));

const TOPPICK = {
  external: true, name: 'Cheapest-Proxies.com', url: L.SITE.topPick.url,
  tagline: 'Best overall value across every proxy type and use case',
  rating: 4.9, startingPrice: 'flexible pay-as-you-go plans',
};

/* per-type prose helpers (never interpolate raw spec cells into sentences) */
const TYPE_EXTRA = {
  residential: { lower: 'residential proxies', trust: 'route through real ISP-assigned home IP addresses', detReason: 'because traffic exits through genuine consumer ISP connections, most sites treat it as an ordinary home visitor, so block rates stay low' },
  datacenter:  { lower: 'datacenter proxies', trust: 'come from fast commercial server IP ranges', detReason: 'because the IPs belong to known hosting providers, sophisticated targets can identify and block them more readily' },
  mobile:      { lower: 'mobile proxies', trust: 'use real 4G/5G carrier IP addresses shared behind CGNAT', detReason: 'because thousands of real subscribers share each carrier IP, sites are reluctant to block them outright' },
  isp:         { lower: 'ISP proxies', trust: 'pair datacenter speed with ISP-registered static IPs', detReason: 'because the IPs are registered to consumer ISPs yet hosted on fast infrastructure, they blend in while staying quick' },
  rotating:    { lower: 'rotating proxies', trust: 'cycle to a fresh IP on every request or timed interval', detReason: 'because each request can use a different IP, no single address builds up enough activity to be flagged' },
  socks5:      { lower: 'SOCKS5 proxies', trust: 'tunnel any TCP or UDP traffic at the protocol level', detReason: 'detection depends on the underlying IP source rather than the protocol, which simply forwards traffic transparently' },
  ipv6:        { lower: 'IPv6 proxies', trust: 'draw from the enormous, low-cost IPv6 address space', detReason: 'because IPv6 ranges are vast and inexpensive they are plentiful, though some older targets still do not accept IPv6 traffic' },
};
const TX = (t) => TYPE_EXTRA[t.slug] || { lower: t.name.toLowerCase(), trust: 'route traffic through a dedicated proxy pool', detReason: 'detection depends on the IP source and provider quality' };
const tlow = (t) => TX(t).lower;

/* countries that take a definite article */
const DEFINITE = new Set(['united-states', 'united-kingdom', 'netherlands', 'philippines', 'united-arab-emirates', 'czech-republic', 'dominican-republic', 'democratic-republic-of-the-congo', 'maldives']);
const DEFINITE_NAMES = new Set(['United States', 'United Kingdom', 'Netherlands', 'Philippines', 'United Arab Emirates', 'Czech Republic', 'Dominican Republic', 'Democratic Republic of the Congo', 'Maldives']);
const theName = (c) => (/^the /i.test(c.name) ? c.name : (DEFINITE.has(c.slug) ? 'the ' + c.name : c.name));
const theCountryName = (name) => (/^the /i.test(name) ? name : (DEFINITE_NAMES.has(name) ? 'the ' + name : name));

/* ---------------- variant prose pools (defensible; no unverifiable testing claims) ---------------- */
const VP = {
  authority: [
    'Our editors track {n}+ proxy providers, comparing published pool sizes, pricing, and feature sets.',
    'We compare {n}+ networks on price per GB, coverage, and protocol support to shortlist the strongest.',
    'These picks come from an ongoing comparison of {n}+ proxy providers across price, pool, and features.',
    'We weigh {n}+ providers on pricing, coverage, and reliability signals to surface the best value.',
    'Our shortlist is drawn from {n}+ providers, ranked on transparent pricing and pool quality.',
    'We line up {n}+ proxy services by cost, coverage, and feature depth so you do not have to.',
  ],
  whyProxyGeneric: [
    'Without proxies, every request leaves the same IP fingerprint, so rate limits and bans arrive fast.',
    'A single origin IP is trivially easy for modern anti-bot systems to throttle or blacklist.',
    'Sending traffic from one address caps throughput and flags automated behaviour almost immediately.',
    'Concentrated traffic from one IP is the quickest way to trip CAPTCHAs and connection resets.',
    'One IP handling everything is a bottleneck and a red flag to any rate-limiting system.',
    'Route everything through a single address and you throttle yourself long before the target does.',
  ],
  valueClose: [
    'The practical takeaway: match the proxy type to the target’s defences, then pick a provider with transparent per-GB pricing.',
    'Bottom line — the right proxy type plus honest pricing beats simply buying the biggest pool.',
    'In short, success comes from pairing the correct network type with a provider that publishes clear pricing.',
    'Ultimately, the winning setup is the cheapest network that still clears your target’s bot defences reliably.',
    'Choose on fit and price-per-GB, not raw pool size — the cheapest network that clears your target wins.',
  ],
  ctaSub: [
    'We compared 40+ providers on price, coverage, and reliability — this one offered the best overall value.',
    'Across the providers we compare, this network stood out for value and consistent performance.',
    'For most buyers this provider hits the best balance of price and reliability — check current pricing.',
    'It ranked first for value in our comparison — see live pricing and plans.',
    'Best value in our comparison, with competitive pricing across every proxy type — see the current deal.',
  ],
};
const paraPool = (rng, key, map = {}) => P(fill(pick(rng, VP[key]), Object.assign({ n: '40' }, map)));

/* ---------------- geo enrichment ---------------- */
function geoFacts(D, country) { return (D.geoExtra && D.geoExtra[country.slug]) || null; }
function geoPara(country, gf, type) {
  if (!gf) return '';
  const parts = [];
  if (gf.isps && gf.isps.length) parts.push(`${country.name}’s consumer internet is served mainly by ${andList(gf.isps.slice(0, 3))}`);
  if (type && type.slug === 'mobile' && gf.carriers && gf.carriers.length) parts.push(`with mobile traffic carried on ${andList(gf.carriers.slice(0, 3))}`);
  let s = parts.join(' ');
  if (s) s = dot(s);
  const sites = (gf.sites && gf.sites.length) ? ` Popular local targets include ${andList(gf.sites.slice(0, 4))}.` : '';
  const note = gf.note ? ' ' + String(gf.note).trim() : '';
  const out = (s + sites + note).trim();
  return out ? P(out) : '';
}

/* ---------------- provider ranking (deterministic, deduped) ---------------- */
function rankProviders(D, rng, { n = 4, bias = [], topPick = true, exclude = [] } = {}) {
  const ex = new Set(exclude);
  const pool = D.providers.filter(p => !ex.has(p.slug))
    .slice().sort((a, b) => (b.rating - a.rating) || ((b.poolSize || '').length - (a.poolSize || '').length) || a.name.localeCompare(b.name));
  const chosen = [];
  for (const s of bias) { const p = D.bySlug.provider[s]; if (p && !ex.has(s) && !chosen.includes(p)) chosen.push(p); }
  for (const p of pool) { if (chosen.length >= n) break; if (!chosen.includes(p)) chosen.push(p); }
  const list = chosen.slice(0, n);
  return topPick ? [TOPPICK, ...list] : list;
}
function providerCompareTable(list) {
  const rows = list.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${(p.rating || 4).toFixed(1)}/5</td><td>${esc(p.pricingModel || 'per GB')}</td><td>${esc(p.poolSize || '—')}</td><td>${esc((p.bestFor && p.bestFor[0]) || 'general use')}</td></tr>`).join('');
  return `<div class="tbl-wrap"><table><thead><tr><th>Provider</th><th>Rating</th><th>Pricing</th><th>Pool</th><th>Best for</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------------- type spec + compare tables ---------------- */
function typeSpecTable(t, opts = {}) {
  const r = (k, v) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`;
  const bestFor = opts.hideBestFor ? '' : r('Best for', (t.bestFor || []).slice(0, 3).join(', '));
  return `<div class="tbl-wrap"><table><tbody>
    ${r('Speed', t.speed)}${r('Anonymity', t.anonymity)}${r('Pricing model', t.priceModel)}
    ${r('Typical price', t.priceRange)}${r('Detection risk', t.detectionRisk)}
    ${bestFor}</tbody></table></div>`;
}
function typeCompareTable(types) {
  const rows = types.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.speed)}</td><td>${esc(t.anonymity.replace(/\s*\(.*\)/, ''))}</td><td>${esc(t.priceRange)}</td><td>${esc(t.detectionRisk)}</td></tr>`).join('');
  return `<div class="tbl-wrap"><table><thead><tr><th>Type</th><th>Speed</th><th>Anonymity</th><th>Price</th><th>Detection</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function prosConsGrid(t) {
  return `<div class="grid grid-2">
    <div class="feat"><div class="badge">${IC.check}</div><h3>Advantages</h3>${L.checks(t.pros || [])}</div>
    <div class="feat"><div class="badge">${IC.lock}</div><h3>Trade-offs</h3><ul class="checks cons">${(t.cons || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
  </div>`;
}

/* platform-adjusted detection risk (type risk can rise on hostile platforms) */
const HOSTILE = new Set(['instagram', 'tiktok', 'facebook', 'twitter-x', 'linkedin', 'nike', 'adidas', 'footlocker', 'supreme', 'ticketmaster', 'stubhub', 'cloudflare', 'google', 'amazon']);
function platformRisk(type, pf) {
  const base = type.detectionRisk;
  if (!HOSTILE.has(pf.slug)) return base;
  if (type.slug === 'datacenter' || type.slug === 'ipv6') return 'High';
  if (type.slug === 'residential' || type.slug === 'rotating' || type.slug === 'isp') return base === 'Low' ? 'Low–Medium' : base;
  return base;
}

/* ---------------- FAQ ---------------- */
function faqPick(rng, bank, n = 4) { return pickN(rng, bank, Math.min(n, bank.length)); }

/* disclosure line under provider lists that lead with the sponsored pick */
const DISCLOSURE = `<p style="font-size:.8rem;color:#8f8f8f;margin:.4em 0 0">Our #1 pick is a sponsored partner. Remaining providers are ranked editorially by rating and value.</p>`;

/* ---------------- assemble a page ---------------- */
function assemble(D, pc) {
  const rng = rngFor(pc.path);
  const crumbs = pc.crumbs;
  const chips = (pc.chips || []).map(c => `<span class="chip"><span class="i">${IC[c[0]] || IC.bolt}</span> ${c[2] ? '<b>' + esc(c[1]) + '</b> ' + esc(c[2]) : esc(c[1])}</span>`).join('');
  const sections = pc.sections.map(s => `<section>${s.title ? L.sectionTitle(s.icon || 'bolt', s.title) : ''}${s.html}</section>`).join('\n');
  const faqHtml = pc.faqs && pc.faqs.length
    ? `<section>${L.sectionTitle('search', 'Frequently Asked Questions')}${L.faqBlock(pc.faqs)}</section>` : '';
  const relHtml = pc.related && pc.related.length
    ? `<section>${L.sectionTitle('layers', 'Related Guides')}${L.relatedGrid(pc.related)}</section>` : '';
  const cta = L.ctaBand(rng, pc.ctaHead || 'Get the best value proxies', pc.ctaSub || pick(rng, VP.ctaSub));
  const body = `${L.crumbHtml(crumbs)}
<main>
  <header class="hero"><div class="wrap hero-in">
    <span class="eyebrow">${IC.shield} ${esc(pc.eyebrow || 'Proxy Buyer\'s Guide')}</span>
    <h1>${pc.h1}</h1>
    <p class="lede">${esc(pc.lede)}</p>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    <div class="btn-row">
      <a class="btn" href="${L.SITE.topPick.url}" target="_blank" rel="noopener sponsored">See our top pick ${IC.arrow}</a>
      <a class="btn btn-ghost" href="/compare">Compare all providers</a>
    </div>
  </div></header>
  <div class="wrap narrow prose">
    ${pc.tldr ? `<div class="tldr"><h2>Quick answer</h2><p>${pc.tldr}</p></div>` : ''}
    ${sections}
    ${faqHtml}
    ${relHtml}
    ${cta}
  </div>
</main>`;
  const ld = [L.breadcrumbLd(crumbs)];
  if (pc.faqs && pc.faqs.length) ld.push(L.faqLd(pc.faqs));
  const desc = clip(pc.desc, 160);
  ld.push(L.articleLd({ title: pc.title, desc, canonical: L.SITE.url + pc.path, slug: pc.path }));
  return { title: pc.title, desc, path: pc.path, html: L.pageShell({ title: pc.title, desc, path: pc.path, bodyHtml: body, ld, noindex: pc.noindex }), noindex: !!pc.noindex, cluster: pc.cluster };
}

/* ============================ RENDERERS ============================ */
const R = {};

R.type = (D, { type }) => {
  const t = type, rng = rngFor('type-' + t.slug);
  const path = `/${t.slug}-proxies.html`;
  const provs = rankProviders(D, rng, { n: 5 });
  const others = D.types.filter(x => x.slug !== t.slug);
  const relCities = pickN(rng, D.citiesFlat, 3).map(c => [`${c.name} ${t.name}`, `/${c.slug}-${t.slug}-proxies.html`]);
  return assemble(D, {
    cluster: 'type', path,
    title: `${t.name} (${YEAR}): How They Work, Pricing & Best Providers`,
    desc: `${t.name} explained: how they work, ${t.priceRange} pricing, speed, detection risk, and the top providers to buy from in ${YEAR}.`,
    eyebrow: 'Proxy Types',
    h1: `${hl(t.name)}`,
    lede: `${L.stripTags(t.tagline)}. Here is how ${tlow(t)} work, what they cost, and who offers the best value.`,
    chips: [['bolt', 'Speed', t.speed], [TYPE_ICON[t.slug] || 'globe', 'Price', t.priceRange], ['lock', 'Detection', t.detectionRisk]],
    crumbs: [['Home', '/'], ['Proxy Types', '/proxies-by-type.html'], [t.name, path]],
    tldr: `${esc(t.definition)}`,
    sections: [
      { icon: TYPE_ICON[t.slug] || 'globe', title: `How ${tlow(t)} work`, html: P(esc(t.howItWorks)) + paraPool(rng, 'whyProxyGeneric') + P(esc(t.poolNote)) },
      { icon: 'check', title: 'Advantages and trade-offs', html: prosConsGrid(t) },
      { icon: 'chart', title: `${t.name} specifications`, html: typeSpecTable(t) },
      { icon: 'star', title: `Best providers for ${tlow(t)}`, html: paraPool(rng, 'authority') + L.providerCards(provs, rng) + DISCLOSURE },
      { icon: 'layers', title: `${t.name} vs other proxy types`, html: typeCompareTable(D.types) + paraPool(rng, 'valueClose') },
    ],
    faqs: faqPick(rng, [
      { q: `How much do ${tlow(t)} cost?`, a: `${cap(tlow(t))} are typically priced ${esc(t.priceModel)} at around ${esc(t.priceRange)}. Higher volumes lower the effective rate, so estimate your monthly usage before choosing a plan.` },
      { q: `Are ${tlow(t)} good for ${lowerFirst((t.bestFor || ['scraping'])[0])}?`, a: `Yes — ${tlow(t)} suit ${esc(proseList(t.bestFor, 3))}, because they ${esc(TX(t).trust)}.` },
      { q: `What is the detection risk with ${tlow(t)}?`, a: `Detection risk is rated ${esc(t.detectionRisk.toLowerCase())} — ${esc(TX(t).detReason)}.` },
      { q: `How fast are ${tlow(t)}?`, a: `Speed is ${esc(t.speed.toLowerCase())} compared with other proxy types. ${esc(L.stripTags(t.howItWorks).split('. ')[0])}.` },
      { q: `What should I look for when buying ${tlow(t)}?`, a: `Prioritise transparent per-unit pricing, pool size and freshness, geo-targeting granularity, and a small trial so you can benchmark success rate before committing.` },
    ], 5),
    related: [
      ...others.slice(0, 4).map(x => [`${x.name}`, `/${x.slug}-proxies.html`]),
      ...relCities,
      ['All proxy types', '/proxies-by-type.html'],
      ['Best proxies overall', '/best-proxies.html'],
    ],
    ctaHead: `Ready to try ${tlow(t)}?`,
  });
};

R.usecase = (D, { uc }) => {
  const rng = rngFor('uc-' + uc.slug);
  const path = `/proxies-for-${uc.slug}.html`;
  const bt = (uc.bestTypes || []).map(s => D.bySlug.type[s]).filter(Boolean);
  const primary = bt[0] || D.bySlug.type.residential;
  const provs = rankProviders(D, rng, { n: 4 });
  const plats = (uc.relatedPlatforms || []).map(s => D.bySlug.platform[s]).filter(Boolean);
  return assemble(D, {
    cluster: 'usecase', path,
    title: `Best Proxies for ${uc.name} (${YEAR}) — Types & Top Providers`,
    desc: `The best proxies for ${uc.shortName} in ${YEAR}: which proxy types deliver the highest ${uc.keyMetric}, plus the top-value providers and expert tips.`,
    eyebrow: 'Use Cases',
    h1: `Best Proxies for ${hl(uc.name)}`,
    lede: `${cap(uc.shortName)} lives or dies on ${uc.keyMetric}. Here are the proxy types and providers that keep it high.`,
    chips: [['target', 'Key metric', uc.keyMetric], ['globe', 'Best type', primary.name]],
    crumbs: [['Home', '/'], ['Use Cases', '/proxies-by-use-case.html'], [uc.name, path]],
    tldr: `${esc(uc.whyProxy)}`,
    sections: [
      { icon: 'target', title: `Why ${uc.shortName} needs proxies`, html: P(esc(uc.intro)) + paraPool(rng, 'whyProxyGeneric') },
      { icon: 'lock', title: `Problems you hit without proxies`, html: L.checks(uc.painPoints || []) },
      { icon: 'globe', title: `Best proxy types for ${uc.shortName}`, html: (bt.length ? typeCompareTable(bt) : '') + P(`For ${esc(uc.shortName)}, ${esc(tlow(primary))} are usually the strongest fit because they ${esc(TX(primary).trust)}.`) + P(`<b>Pro tip:</b> ${esc(uc.tip)}`) },
      { icon: 'star', title: `Top providers for ${uc.shortName}`, html: paraPool(rng, 'authority') + L.providerCards(provs, rng) + DISCLOSURE },
      ...(plats.length ? [{ icon: 'search', title: 'Popular targets', html: L.relatedGrid(plats.map(p => [`Proxies for ${p.name}`, `/proxies-for-${p.slug}.html`])) }] : []),
    ],
    faqs: faqPick(rng, [
      { q: `What type of proxy is best for ${uc.shortName}?`, a: `${cap(tlow(primary))} are usually best for ${esc(uc.shortName)}, because they ${esc(TX(primary).trust)}, which keeps ${esc(uc.keyMetric)} high.` },
      { q: `How many proxies do I need for ${uc.shortName}?`, a: `It depends on request volume and target defences. Start with a modest rotating pool and scale up only while ${esc(uc.keyMetric)} holds steady.` },
      { q: `Can I use free proxies for ${uc.shortName}?`, a: `Free proxies are slow, unreliable, and often already blacklisted — a false economy for ${esc(uc.shortName)}. Paid residential or rotating proxies pay for themselves in saved time.` },
      { q: `How much should I budget for ${uc.shortName} proxies?`, a: `Residential pricing runs roughly $2–$8/GB; datacenter is cheaper per IP. Estimate monthly bandwidth first, then pick a plan with headroom.` },
    ], 4),
    related: [
      ...bt.slice(0, 3).map(t => [`${t.name} for ${uc.name}`, `/${t.slug}-proxies-for-${uc.slug}.html`]),
      ['All use cases', '/proxies-by-use-case.html'],
      ['Best proxies overall', '/best-proxies.html'],
      ['Compare providers', '/compare'],
    ],
    ctaHead: `The best proxies for ${uc.shortName}`,
  });
};

R.platform = (D, { pf }) => {
  const rng = rngFor('pf-' + pf.slug);
  const path = `/proxies-for-${pf.slug}.html`;
  const rt = D.bySlug.type[pf.recommendedType] || D.types[0];
  const provs = rankProviders(D, rng, { n: 4 });
  const ucs = (pf.relatedUseCases || []).map(s => D.bySlug.usecase[s]).filter(Boolean);
  const unit = pf.category === 'Social' ? 'account' : 'session';
  return assemble(D, {
    cluster: 'platform', path,
    title: `Best Proxies for ${pf.name} (${YEAR}) — ${rt.name} That Work`,
    desc: `Proxies for ${pf.name}: why ${tlow(rt)} beat its bot defences, the top-value providers, and setup tips to avoid bans in ${YEAR}.`,
    eyebrow: pf.category + ' Proxies',
    h1: `Best Proxies for ${hl(pf.name)}`,
    lede: `Reliable ${pf.name} access starts with the right proxy type. Here is what works against its defences, and how to set it up.`,
    chips: [['lock', 'Defences', clipWords(L.stripTags(pf.antiBot), 34)], [TYPE_ICON[rt.slug] || 'globe', 'Best type', rt.name]],
    crumbs: [['Home', '/'], ['Platforms', '/proxies-by-platform.html'], [pf.name, path]],
    tldr: `To access ${esc(pf.name)} reliably, use ${esc(tlow(rt))}. ${esc(pf.successNote)}`,
    sections: [
      { icon: 'search', title: `Using proxies with ${pf.name}`, html: P(esc(pf.scrapingContext)) + paraPool(rng, 'whyProxyGeneric') },
      { icon: 'lock', title: `${pf.name}’s bot defences`, html: P(`${esc(pf.name)} relies on ${esc(pf.antiBot)}. ${esc(pf.successNote)}`) + P(`That is why ${esc(tlow(rt))} — which ${esc(TX(rt).trust)} — are the recommended choice here.`) },
      { icon: TYPE_ICON[rt.slug] || 'globe', title: `Recommended proxy type`, html: typeSpecTable(rt, { hideBestFor: true }) },
      { icon: 'code', title: `Setup tips for ${pf.name}`, html: `<ul class="checks"><li>Assign one sticky IP per ${unit} rather than rotating mid-${unit}.</li><li>Pace actions to human speed — sudden bursts are the fastest way to trigger ${esc(lowerFirst(L.stripTags(pf.antiBot)))}.</li><li>Match the proxy’s geo to your target audience or the content you need to see.</li><li>Warm up new ${unit}s gradually before scaling volume.</li></ul>` },
      { icon: 'star', title: `Top providers for ${pf.name}`, html: L.providerCards(provs, rng) + DISCLOSURE },
      ...(ucs.length ? [{ icon: 'target', title: 'Common goals', html: L.relatedGrid(ucs.map(u => [`Proxies for ${u.name}`, `/proxies-for-${u.slug}.html`])) }] : []),
    ],
    faqs: faqPick(rng, [
      { q: `What proxies work best for ${pf.name}?`, a: `${cap(tlow(rt))} are the most reliable for ${esc(pf.name)}, because they ${esc(TX(rt).trust)}, which its defences struggle to flag.` },
      { q: `Will I get banned using proxies on ${pf.name}?`, a: `Quality residential or mobile IPs paired with sensible rate limits keep ban risk low. Avoid cheap datacenter ranges that ${esc(pf.name)} already blacklists.` },
      { q: `How many ${pf.name} proxies do I need?`, a: `Size the pool to your concurrency — roughly one sticky IP per active ${unit} is a safe starting rule for ${esc(pf.name)}.` },
      { q: `Do I need residential or datacenter proxies for ${pf.name}?`, a: `${esc(pf.name)} scrutinises IP reputation, so ${esc(tlow(rt))} are safer than datacenter IPs for sustained access.` },
    ], 4),
    related: [
      [`${rt.name} for ${pf.name}`, `/${rt.slug}-proxies-for-${pf.slug}.html`],
      ...ucs.slice(0, 2).map(u => [`Proxies for ${u.name}`, `/proxies-for-${u.slug}.html`]),
      ['All platforms', '/proxies-by-platform.html'],
      ['Best proxies overall', '/best-proxies.html'],
    ],
    ctaHead: `The best ${pf.name} proxies`,
  });
};

R.tool = (D, { tool }) => {
  const rng = rngFor('tool-' + tool.slug);
  const path = `/proxy-setup-${tool.slug}.html`;
  const provs = rankProviders(D, rng, { n: 3 });
  const browser = /browser/i.test(tool.category);
  const verb = browser ? `run your ${tool.name} script` : `send your ${tool.name} request`;
  return assemble(D, {
    cluster: 'tool', path,
    title: `How to Set Up Proxies in ${tool.name} (${YEAR} Guide + Code)`,
    desc: `Step-by-step ${tool.name} proxy setup for ${YEAR}: working authenticated-proxy code, rotation guidance, and the best proxies to use with ${tool.lang}.`,
    eyebrow: 'Setup Guides',
    h1: `How to Set Up Proxies in ${hl(tool.name)}`,
    lede: `Route ${tool.name} traffic through an authenticated proxy in a few lines. Copy the code below and swap in your credentials.`,
    chips: [['code', 'Language', tool.lang], ['bolt', 'Rotation', tool.supportsRotation ? 'Supported' : 'Manual'], ['layers', 'Category', tool.category]],
    crumbs: [['Home', '/'], ['Setup Guides', '/proxy-setup-guides.html'], [tool.name, path]],
    tldr: browser
      ? `Configure the proxy with a server URL plus separate username and password, then ${verb} through it. Full code below.`
      : `Set the proxy in the format <code>${esc(tool.proxyFormat)}</code> and ${verb} through it. Full code below.`,
    sections: [
      { icon: 'code', title: `${tool.name} proxy example`, html: `<pre><code>${esc(tool.setupSnippet)}</code></pre>` + P(esc(tool.notes)) },
      { icon: 'bolt', title: 'Rotating proxies', html: P(browser
        ? `For browser automation, give each ${esc(tool.name)} browser context its own sticky-session endpoint so every sub-request in a page load shares one IP — per-request rotation would break the session.`
        : (tool.supportsRotation
          ? `${esc(tool.name)} works cleanly with rotating backconnect endpoints — point it at a single gateway host and the provider rotates the exit IP for you.`
          : `${esc(tool.name)} rotates best by cycling proxies from a list yourself, swapping the ${esc(tool.proxyFormat)} string between requests.`)) },
      { icon: 'star', title: `Best proxies to use with ${tool.name}`, html: L.providerCards(provs, rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `How do I add a proxy in ${tool.name}?`, a: browser ? `Pass a server URL plus username and password to ${esc(tool.name)}’s proxy option, as shown in the code above.` : `Supply the proxy as <code>${esc(tool.proxyFormat)}</code> and pass it to ${esc(tool.name)} as shown in the code above.` },
      { q: `Does ${tool.name} support authenticated proxies?`, a: `Yes. Provide the username and password (as a URL or separate fields) and ${esc(tool.name)} handles the auth handshake.` },
      { q: `Can ${tool.name} rotate proxies automatically?`, a: browser ? `Use one sticky session per browser context; rotate by launching a new context with a fresh endpoint rather than per request.` : (tool.supportsRotation ? `Yes — point it at a rotating backconnect endpoint and the provider rotates IPs for you.` : `Not natively; rotate by swapping proxies from a pool between requests.`) },
      { q: `What proxies work best with ${tool.name}?`, a: `Residential or rotating proxies from a reliable provider give the best success rate for ${esc(tool.lang)} projects.` },
    ], 4),
    related: [
      ...pickN(rng, D.tools.filter(x => x.slug !== tool.slug), 4).map(x => [`Proxy setup in ${x.name}`, `/proxy-setup-${x.slug}.html`]),
      ['All setup guides', '/proxy-setup-guides.html'],
      ['Rotating proxies', '/rotating-proxies.html'],
    ],
    ctaHead: `Best proxies for ${tool.name}`,
  });
};

R.providerType = (D, { prov, type }) => {
  const rng = rngFor('pt-' + prov.slug + '-' + type.slug);
  const path = `/${prov.slug}-${type.slug}-proxies.html`;
  const alts = rankProviders(D, rng, { n: 4, topPick: false, exclude: [prov.slug] });
  return assemble(D, {
    cluster: 'providerType', path,
    title: `${prov.name} ${type.name} (${YEAR}) — Pricing, Pool & Alternatives`,
    desc: `${prov.name} ${tlow(type)} reviewed: ${L.stripTags(prov.tagline)}, ${shortPrice(prov.startingPrice)} pricing, pool size, and cheaper alternatives for ${YEAR}.`,
    eyebrow: 'Provider Analysis',
    h1: `${hl(prov.name)} ${type.name}`,
    lede: `${prov.name} offers ${tlow(type)} aimed at ${esc((prov.bestFor || ['scraping'])[0])}. Here is how they price, perform, and compare.`,
    chips: [['star', 'Rating', (prov.rating || 4).toFixed(1) + '/5'], ['globe', 'Pool', prov.poolSize || 'Large'], ['bolt', 'From', shortPrice(prov.startingPrice) || '—']],
    crumbs: [['Home', '/'], ['Reviews', prov.reviewPath], [`${prov.name} ${type.name}`, path]],
    tldr: `${esc(prov.name)} ${esc(tlow(type))} suit ${esc(proseList(prov.bestFor, 2))}. ${esc(prov.name)} ${esc(prov.pricingModel)} pricing starts ${esc(prov.startingPrice || 'with volume tiers')}.`,
    sections: [
      { icon: 'star', title: `${prov.name} ${tlow(type)} overview`, html: P(esc(type.definition)) + P(`${esc(prov.name)} positions itself as “${esc(prov.tagline)}”, with ${esc(prov.poolSize || 'a large pool')} and ${esc(prov.pricingModel)} pricing ${esc(prov.startingPrice || '')}.`) },
      { icon: 'check', title: 'Strengths', html: L.checks(prov.strengths || []) },
      ...((prov.weaknesses && prov.weaknesses.length) ? [{ icon: 'lock', title: 'Weaknesses', html: `<ul class="checks cons">${prov.weaknesses.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` }] : []),
      { icon: 'chart', title: `${type.name} specs`, html: typeSpecTable(type) },
      { icon: 'layers', title: `${prov.name} alternatives`, html: P(`If ${esc(prov.name)} is over budget, these ${esc(tlow(type))} providers offer strong value:`) + L.providerCards([TOPPICK, ...alts], rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `How much do ${prov.name} ${tlow(type)} cost?`, a: `${esc(prov.name)} uses ${esc(prov.pricingModel)} pricing, ${esc(prov.startingPrice || 'with volume tiers')}. Compare per-GB rates against the alternatives above before committing.` },
      { q: `Is ${prov.name} good for ${tlow(type)}?`, a: `${esc(prov.name)} is well regarded for ${esc(proseList(prov.bestFor))}. ${esc((prov.strengths || [''])[0])}.` },
      { q: `What are the best ${prov.name} alternatives?`, a: `${esc(andList(alts.slice(0, 3).map(a => a.name)))} are all strong ${esc(tlow(type))} options worth comparing on price and pool size.` },
    ], 3),
    related: [
      [`${prov.name} review`, prov.reviewPath],
      ...D.types.filter(x => x.slug !== type.slug).slice(0, 3).map(x => [`${prov.name} ${x.name}`, `/${prov.slug}-${x.slug}-proxies.html`]),
      [`${type.name}`, `/${type.slug}-proxies.html`],
      [`${prov.name} alternatives`, `/${prov.slug}-alternatives.html`],
    ],
    ctaHead: `Better value than ${prov.name}?`,
  });
};

R.providerUsecase = (D, { prov, uc }) => {
  const rng = rngFor('pu-' + prov.slug + '-' + uc.slug);
  const path = `/${prov.slug}-for-${uc.slug}.html`;
  const alts = rankProviders(D, rng, { n: 3, topPick: false, exclude: [prov.slug] });
  const bt = (uc.bestTypes || []).map(s => D.bySlug.type[s]).filter(Boolean);
  return assemble(D, {
    cluster: 'providerUsecase', path,
    title: `${prov.name} for ${uc.name}: Is It Worth It? (${YEAR})`,
    desc: `Is ${prov.name} good for ${uc.shortName}? We weigh its strengths, ${shortPrice(prov.startingPrice)} pricing, and value against cheaper alternatives for ${YEAR}.`,
    eyebrow: 'Provider Analysis',
    h1: `${hl(prov.name)} for ${uc.name}`,
    lede: `Can ${prov.name} deliver for ${uc.shortName}? We weigh its strengths and pricing against the alternatives.`,
    chips: [['star', 'Rating', (prov.rating || 4).toFixed(1) + '/5'], ['target', 'Key metric', uc.keyMetric]],
    crumbs: [['Home', '/'], ['Reviews', prov.reviewPath], [`${prov.name} for ${uc.name}`, path]],
    tldr: `${esc(prov.name)} works for ${esc(uc.shortName)} if you value ${esc((prov.bestFor || ['reliability'])[0])}. Compare its per-GB price against the alternatives below.`,
    sections: [
      { icon: 'target', title: `${prov.name} + ${uc.name}`, html: P(esc(uc.intro)) + P(`${esc(prov.name)} brings ${esc(proseList(prov.strengths, 2))}, which maps well to ${esc(uc.shortName)}.`) },
      { icon: 'globe', title: `Best proxy types for ${uc.shortName}`, html: bt.length ? typeCompareTable(bt) : P(`Residential and rotating proxies suit ${esc(uc.shortName)} best.`) },
      { icon: 'check', title: `Where ${prov.name} shines`, html: L.checks(prov.strengths || []) + P(`<b>Pro tip:</b> ${esc(uc.tip)}`) },
      { icon: 'layers', title: `Cheaper alternatives`, html: L.providerCards([TOPPICK, ...alts], rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `Is ${prov.name} good for ${uc.shortName}?`, a: `${esc(prov.name)} is a solid choice for ${esc(uc.shortName)} thanks to ${esc((prov.strengths || ['its network'])[0].toLowerCase())}. Weigh it against cheaper options on cost per GB.` },
      { q: `What is the best proxy type for ${uc.shortName}?`, a: `${esc((bt[0] && bt[0].name) || 'Residential proxies')} typically perform best for ${esc(uc.shortName)}.` },
      { q: `Are there cheaper alternatives to ${prov.name} for ${uc.shortName}?`, a: `Yes — ${esc(andList(alts.map(a => a.name)))} are worth comparing, and several undercut ${esc(prov.name)} on entry pricing.` },
    ], 3),
    related: [
      [`${prov.name} review`, prov.reviewPath],
      [`Best proxies for ${uc.name}`, `/proxies-for-${uc.slug}.html`],
      [`${prov.name} alternatives`, `/${prov.slug}-alternatives.html`],
      ['Compare providers', '/compare'],
    ],
    ctaHead: `Best value for ${uc.shortName}`,
  });
};

R.comparison = (D, { a, b }) => {
  const rng = rngFor('cmp-' + a.slug + '-' + b.slug);
  const path = `/${a.slug}-vs-${b.slug}.html`;
  const tie = Math.abs((a.rating || 0) - (b.rating || 0)) < 0.15;
  const winner = (a.rating || 0) >= (b.rating || 0) ? a : b;
  const loser = winner === a ? b : a;
  const aBest = (a.bestFor || ['general use'])[0], bBest = (b.bestFor || ['general use'])[0];
  const sameBest = lowerFirst(aBest) === lowerFirst(bBest);
  const verdict = tie
    ? (sameBest
      ? `Both rate closely (${(a.rating || 4).toFixed(1)} vs ${(b.rating || 4).toFixed(1)}) and both target ${esc(lowerFirst(aBest))}, so the decision comes down to price, pool size, and which free trial fits your workflow.`
      : `Both rate closely (${(a.rating || 4).toFixed(1)} vs ${(b.rating || 4).toFixed(1)}). ${cap(a.name)} leans toward ${esc(lowerFirst(aBest))}, while ${esc(b.name)} is stronger for ${esc(lowerFirst(bBest))} — so the better pick depends on your use case and budget.`)
    : `${esc(winner.name)} rates higher overall (${(winner.rating || 4).toFixed(1)} vs ${(loser.rating || 4).toFixed(1)}), largely on ${esc((winner.strengths || ['its network'])[0].toLowerCase())}. ${esc(loser.name)} still wins for buyers who prioritise ${esc(lowerFirst((loser.bestFor || ['budget'])[0]))}.`;
  return assemble(D, {
    cluster: 'comparison', path,
    title: `${a.name} vs ${b.name} (${YEAR}) — Which Proxy Provider Wins?`,
    desc: `${a.name} vs ${b.name}: compare pricing, pool size, ratings, and best use cases to decide which proxy provider is the better fit in ${YEAR}.`,
    eyebrow: 'Head-to-Head',
    h1: `${hl(a.name)} vs ${hl(b.name)}`,
    lede: `${a.name} (${(a.rating || 4).toFixed(1)}/5) and ${b.name} (${(b.rating || 4).toFixed(1)}/5) are both popular proxy networks. Here is how they compare on price, pool, and performance.`,
    chips: [['star', a.name, (a.rating || 4).toFixed(1)], ['star', b.name, (b.rating || 4).toFixed(1)]],
    crumbs: [['Home', '/'], ['Comparisons', '/proxy-comparisons.html'], [`${a.name} vs ${b.name}`, path]],
    tldr: verdict,
    sections: [
      { icon: 'chart', title: 'Side by side', html: providerCompareTable([a, b]) },
      { icon: 'check', title: `${a.name} strengths`, html: L.checks(a.strengths || []) },
      { icon: 'check', title: `${b.name} strengths`, html: L.checks(b.strengths || []) },
      { icon: 'star', title: 'Verdict', html: P(verdict) + P(pick(rng, VP.valueClose)) + L.providerCards([TOPPICK], rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `Is ${a.name} better than ${b.name}?`, a: tie ? `They are closely matched (${(a.rating || 4).toFixed(1)} vs ${(b.rating || 4).toFixed(1)}); the better choice depends on your use case and budget.` : `${esc(winner.name)} rates slightly higher overall (${(winner.rating || 4).toFixed(1)} vs ${(loser.rating || 4).toFixed(1)}), but ${esc(loser.name)} can be the better fit for specific needs.` },
      { q: `Which is cheaper, ${a.name} or ${b.name}?`, a: `${esc(a.name)} uses ${esc(a.pricingModel)} pricing (${esc(shortPrice(a.startingPrice) || 'tiered')}) and ${esc(b.name)} uses ${esc(b.pricingModel)} pricing (${esc(shortPrice(b.startingPrice) || 'tiered')}). Compare on your expected monthly volume, since per-GB rates drop with scale.` },
      { q: `Which has the bigger proxy pool?`, a: `${esc(a.name)} lists ${esc(a.poolSize || 'a large pool')} and ${esc(b.name)} lists ${esc(b.poolSize || 'a large pool')}. Bigger pools help with rotation and hard targets, but freshness matters as much as raw size.` },
    ], 3),
    related: [
      [`${a.name} review`, a.reviewPath], [`${b.name} review`, b.reviewPath],
      [`${a.name} alternatives`, `/${a.slug}-alternatives.html`],
      [`${b.name} alternatives`, `/${b.slug}-alternatives.html`],
      ['All comparisons', '/proxy-comparisons.html'],
    ],
    ctaHead: 'Prefer the best-value option?',
  });
};

R.alternative = (D, { prov }) => {
  const rng = rngFor('alt-' + prov.slug);
  const path = `/${prov.slug}-alternatives.html`;
  const alts = rankProviders(D, rng, { n: 6, topPick: false, exclude: [prov.slug] });
  const list = [TOPPICK, ...alts];
  return assemble(D, {
    cluster: 'alternative', path,
    title: `Top ${list.length} ${prov.name} Alternatives (${YEAR})`,
    desc: `The best ${prov.name} alternatives for ${YEAR}: proxy providers compared on price, pool size, and rating so you can switch with confidence.`,
    eyebrow: 'Alternatives',
    h1: `${hl(prov.name)} Alternatives`,
    lede: `Looking for a ${prov.name} alternative? Whether it is price, pool size, or support, these providers are worth comparing in ${YEAR}.`,
    chips: [['layers', 'Options', String(list.length)], ['star', 'Top value', 'Cheapest-Proxies.com']],
    crumbs: [['Home', '/'], ['Comparisons', '/proxy-comparisons.html'], [`${prov.name} alternatives`, path]],
    tldr: `${esc(andList(alts.slice(0, 3).map(a => a.name)))} are the strongest ${esc(prov.name)} alternatives on rating; our sponsored top pick leads on value.`,
    sections: [
      { icon: 'target', title: `Why switch from ${prov.name}?`, html: P(`Common reasons to seek a ${esc(prov.name)} alternative include pricing, pool coverage, or minimum commitments. The most-cited drawback is ${esc(((prov.weaknesses || ['a price point that suits some buyers better than others'])[0]).toLowerCase())}.`) },
      { icon: 'star', title: `Best ${prov.name} alternatives`, html: paraPool(rng, 'authority') + L.providerCards(list, rng) + DISCLOSURE },
      { icon: 'chart', title: 'At a glance', html: providerCompareTable(alts.slice(0, 5)) },
    ],
    faqs: faqPick(rng, [
      { q: `What is the best ${prov.name} alternative?`, a: `${esc(alts[0] && alts[0].name)} is the highest-rated alternative in our comparison; several others undercut ${esc(prov.name)} on entry pricing.` },
      { q: `Is there a cheaper alternative to ${prov.name}?`, a: `Yes — several providers, including ${esc(alts.slice(0, 2).map(a => a.name).join(' and '))}, offer lower entry pricing than ${esc(prov.name)}.` },
      { q: `Are ${prov.name} alternatives as reliable?`, a: `The top alternatives match or exceed ${esc(prov.name)} on rating. Always start with a small trial to confirm performance on your own targets.` },
    ], 3),
    related: [
      [`${prov.name} review`, prov.reviewPath],
      ...alts.slice(0, 3).map(a => [`${a.name} review`, a.reviewPath]),
      ['All comparisons', '/proxy-comparisons.html'],
      ['Best proxies overall', '/best-proxies.html'],
    ],
    ctaHead: `The best-value ${prov.name} alternative`,
  });
};

R.usecaseType = (D, { uc, type }) => {
  const rng = rngFor('ut-' + type.slug + '-' + uc.slug);
  const path = `/${type.slug}-proxies-for-${uc.slug}.html`;
  const provs = rankProviders(D, rng, { n: 4 });
  const good = (uc.bestTypes || []).includes(type.slug);
  return assemble(D, {
    cluster: 'usecaseType', path,
    title: `Best ${type.name} for ${uc.name} (${YEAR}) — Ranked`,
    desc: `Are ${tlow(type)} right for ${uc.shortName}? Success rate, ${type.priceRange} pricing, and the top providers to use for ${uc.shortName} in ${YEAR}.`,
    eyebrow: 'Use Cases',
    h1: `Best ${hl(type.name)} for ${uc.name}`,
    lede: `${type.name} and ${uc.shortName} are a common pairing. Here is how well they fit and which providers deliver.`,
    chips: [['bolt', 'Speed', type.speed], ['target', 'Metric', uc.keyMetric], ['globe', 'From', type.priceRange]],
    crumbs: [['Home', '/'], ['Use Cases', '/proxies-by-use-case.html'], [`${type.name} for ${uc.name}`, path]],
    tldr: `${esc(type.name)} ${esc(TX(type).trust)}, making them ${good ? 'an excellent' : 'a workable'} fit for ${esc(uc.shortName)}.`,
    sections: [
      { icon: 'target', title: `Why ${tlow(type)} for ${uc.shortName}`, html: P(esc(uc.intro)) + P(`${cap(esc(type.name))} ${esc(TX(type).trust)}. That makes them ${good ? 'especially' : 'reasonably'} well matched to ${esc(uc.shortName)}, where ${esc(uc.keyMetric)} is what counts.`) },
      { icon: 'check', title: `Advantages for ${uc.shortName}`, html: L.checks((type.pros || []).slice(0, 4)) + P(`<b>Pro tip:</b> ${esc(uc.tip)}`) },
      { icon: 'chart', title: `${type.name} specs`, html: typeSpecTable(type, { hideBestFor: true }) },
      { icon: 'star', title: `Top providers`, html: L.providerCards(provs, rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `Are ${tlow(type)} good for ${uc.shortName}?`, a: `${good ? 'Yes, they are among the best options' : 'They can work'} for ${esc(uc.shortName)}, because they ${esc(TX(type).trust)}.` },
      { q: `How much do ${tlow(type)} cost for ${uc.shortName}?`, a: `Expect ${esc(type.priceRange)} (${esc(type.priceModel)}). Estimate your monthly volume, since per-unit rates fall with scale.` },
      { q: `What else should I consider for ${uc.shortName}?`, a: `Pool freshness, geo-targeting, and rotation control matter as much as headline price. Trial a small plan and watch ${esc(uc.keyMetric)} before scaling.` },
    ], 3),
    related: [
      [`${type.name}`, `/${type.slug}-proxies.html`],
      [`Best proxies for ${uc.name}`, `/proxies-for-${uc.slug}.html`],
      ...D.types.filter(x => x.slug !== type.slug).slice(0, 2).map(x => [`${x.name} for ${uc.name}`, `/${x.slug}-proxies-for-${uc.slug}.html`]),
      ['All use cases', '/proxies-by-use-case.html'],
    ],
    ctaHead: `Best ${tlow(type)} for ${uc.shortName}`,
  });
};

R.platformType = (D, { pf, type }) => {
  const rng = rngFor('pft-' + type.slug + '-' + pf.slug);
  const path = `/${type.slug}-proxies-for-${pf.slug}.html`;
  const provs = rankProviders(D, rng, { n: 4 });
  const rec = pf.recommendedType === type.slug;
  const risk = platformRisk(type, pf);
  const recType = D.bySlug.type[pf.recommendedType] || D.types[0];
  return assemble(D, {
    cluster: 'platformType', path,
    title: `${type.name} for ${pf.name} (${YEAR}) — Do They Work?`,
    desc: `Using ${tlow(type)} for ${pf.name}: ban risk against its defences, whether they beat ${clipWords(L.stripTags(pf.antiBot), 40)}, and the best providers for ${YEAR}.`,
    eyebrow: pf.category + ' Proxies',
    h1: `${hl(type.name)} for ${pf.name}`,
    lede: `Can ${tlow(type)} handle ${pf.name}? Here is the ban risk, what works, and which providers to trust.`,
    chips: [['lock', 'Defences', clipWords(L.stripTags(pf.antiBot), 30)], ['bolt', 'Ban risk', risk]],
    crumbs: [['Home', '/'], ['Platforms', '/proxies-by-platform.html'], [`${type.name} for ${pf.name}`, path]],
    tldr: rec
      ? `${esc(type.name)} are the recommended choice for ${esc(pf.name)}. ${esc(pf.successNote)}`
      : `${esc(type.name)} can work for ${esc(pf.name)}, but ${esc(tlow(recType))} are usually the safer pick against its defences.`,
    sections: [
      { icon: 'search', title: `${type.name} on ${pf.name}`, html: P(esc(pf.scrapingContext)) + P(`${esc(pf.name)} uses ${esc(pf.antiBot)}. ${rec ? cap(esc(type.name)) + ' clear this reliably because they ' + esc(TX(type).trust) + '.' : cap(esc(type.name)) + ' carry a ' + esc(risk.toLowerCase()) + ' ban risk here, so pair them with careful pacing or step up to ' + esc(tlow(recType)) + '.'}`) },
      { icon: 'chart', title: `${type.name} specs`, html: typeSpecTable(type, { hideBestFor: true }) },
      { icon: 'star', title: `Best providers for ${pf.name}`, html: L.providerCards(provs, rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `Do ${tlow(type)} work on ${pf.name}?`, a: `${rec ? 'Yes, they are the recommended type' : 'They can, with careful use'} for ${esc(pf.name)}. Ban risk is ${esc(risk.toLowerCase())}.` },
      { q: `Will ${pf.name} ban ${tlow(type)}?`, a: `${rec ? 'Rarely, if you keep sensible rate limits' : 'It is more likely than with ' + esc(tlow(recType))}. Pair quality proxies with human-like pacing to reduce the risk.` },
      { q: `What is the best proxy type for ${pf.name}?`, a: `${cap(esc(recType.name))} are the recommended type for ${esc(pf.name)}, because they ${esc(TX(recType).trust)}.` },
    ], 3),
    related: [
      [`Best proxies for ${pf.name}`, `/proxies-for-${pf.slug}.html`],
      [`${type.name}`, `/${type.slug}-proxies.html`],
      ...D.types.filter(x => x.slug !== type.slug).slice(0, 2).map(x => [`${x.name} for ${pf.name}`, `/${x.slug}-proxies-for-${pf.slug}.html`]),
      ['All platforms', '/proxies-by-platform.html'],
    ],
    ctaHead: `Best ${pf.name} proxies`,
  });
};

R.country = (D, { country }) => {
  const rng = rngFor('country-' + country.slug);
  const path = `/${country.slug}-proxies.html`;
  const provs = rankProviders(D, rng, { n: 4 });
  const topUc = pickN(rng, D.usecases, 4);
  const gf = geoFacts(D, country);
  return assemble(D, {
    cluster: 'country', path,
    title: `${country.name} Proxies (${YEAR}) — ${country.demonym} IPs & Best Providers`,
    desc: `${country.name} proxies: get local ${country.demonym} IP addresses for geo-targeting, scraping, and localization. Compare proxy types, providers, and city coverage for ${YEAR}.`,
    eyebrow: country.region,
    h1: `${hl(country.name)} Proxies`,
    lede: `Get local ${country.demonym} IPs. ${country.name} proxies let you geo-target ${theName(country)} — from ${country.capital} outward — for accurate local data, ad verification, and content testing.`,
    chips: [['pin', 'Region', country.region], ['globe', 'Capital', country.capital], ['layers', 'Cities', String(country.cities.length)]],
    crumbs: [['Home', '/'], ['Locations', '/proxies-by-country.html'], [country.name, path]],
    tldr: `${esc(country.name)} proxies route through genuine ${esc(country.demonym)} IPs. For most use cases, residential proxies with ${esc(country.name)} coverage give the best balance of trust and price.`,
    sections: [
      { icon: 'pin', title: `Why use ${country.name} proxies`, html: P(`When a target serves ${esc(country.name)}-specific content, pricing, or availability, you need a local ${esc(country.demonym)} IP to see what a real user in ${esc(theName(country))} sees — across search results, ad delivery, e-commerce pricing, and streaming catalogues.`) + geoPara(country, gf) + paraPool(rng, 'whyProxyGeneric') },
      { icon: 'layers', title: `${country.name} proxy types`, html: L.relatedGrid(D.types.map(t => [`${country.name} ${t.name}`, `/${country.slug}-${t.slug}-proxies.html`])) + typeCompareTable(D.types) },
      { icon: 'star', title: `Best ${country.name} proxy providers`, html: paraPool(rng, 'authority') + L.providerCards(provs, rng) + DISCLOSURE },
      { icon: 'globe', title: `${country.name} cities`, html: L.relatedGrid(country.cities.slice(0, 12).map(c => [`${c.name} proxies`, `/${c.slug}-residential-proxies.html`])) },
      { icon: 'target', title: `Popular use cases in ${country.name}`, html: L.relatedGrid(topUc.map(u => [`${u.name} in ${country.name}`, `/proxies-for-${u.slug}-in-${country.slug}.html`])) },
    ],
    faqs: faqPick(rng, [
      { q: `How do I get ${aAn(country.demonym)} ${country.demonym} IP address?`, a: `Use a proxy provider with ${esc(country.name)} coverage. You connect to their ${esc(country.name)} gateway and your traffic exits from a genuine ${esc(country.demonym)} IP.` },
      { q: `What is the best proxy type for ${country.name}?`, a: `Residential proxies are the safest all-round choice for ${esc(country.name)}; datacenter proxies are cheaper and faster where the target does not block server IPs.` },
      { q: `Are ${country.name} proxies legal?`, a: `Using ${esc(country.name)} proxies for legitimate purposes such as testing, research, and public-data collection is generally legal. Always follow each site’s terms and local law.` },
      { q: `Which ${country.name} ISPs do residential proxies use?`, a: `${esc(gf && gf.isps ? country.name + ' residential IPs come mainly from ' + andList(gf.isps.slice(0, 3)) + ', among other local ISPs.' : 'They draw from major ' + country.demonym + ' consumer ISPs, with coverage varying by provider.')}` },
    ], 4),
    related: [
      ...D.types.slice(0, 3).map(t => [`${country.name} ${t.name}`, `/${country.slug}-${t.slug}-proxies.html`]),
      ...D.countries.filter(c => c.region === country.region && c.slug !== country.slug).slice(0, 2).map(c => [`${c.name} proxies`, `/${c.slug}-proxies.html`]),
      ['All countries', '/proxies-by-country.html'],
      ['Proxies by city', '/proxies-by-city.html'],
    ],
    ctaHead: `Best proxies for ${country.name}`,
  });
};

R.countryType = (D, { country, type }) => {
  const rng = rngFor('ct-' + country.slug + '-' + type.slug);
  const path = `/${country.slug}-${type.slug}-proxies.html`;
  const provs = rankProviders(D, rng, { n: 4 });
  const cities = country.cities.slice(0, 8);
  const gf = geoFacts(D, country);
  return assemble(D, {
    cluster: 'countryType', path,
    title: `${country.name} ${type.name} (${YEAR}) — ${country.demonym} IPs`,
    desc: `${country.name} ${tlow(type)}: ${country.demonym} IP addresses for geo-targeting, scraping, and localization. Best providers, ${type.priceRange} pricing, and city coverage for ${YEAR}.`,
    eyebrow: country.region,
    h1: `${hl(country.name)} ${type.name}`,
    lede: `Need ${country.demonym} IPs? ${country.name} ${tlow(type)} let you geo-target ${theName(country)} for scraping, ad verification, and localized testing.`,
    chips: [['pin', 'Country', country.name], [TYPE_ICON[type.slug] || 'globe', 'Type', type.name], ['bolt', 'From', type.priceRange]],
    crumbs: [['Home', '/'], ['Locations', '/proxies-by-country.html'], [country.name, `/${country.slug}-proxies.html`], [type.name, path]],
    tldr: `${esc(country.name)} ${esc(tlow(type))} provide genuine ${esc(country.demonym)} IPs for accurate ${esc(country.name)} geo-targeting. They ${esc(TX(type).trust)}.`,
    sections: [
      { icon: 'pin', title: `Why use ${country.name} ${tlow(type)}`, html: P(`Local ${esc(country.demonym)} IPs are essential when a target serves different content, prices, or availability inside ${esc(theName(country))}. From ${esc(country.capital)} to regional cities, ${esc(country.name)} ${esc(tlow(type))} let you see exactly what a local user sees.`) + geoPara(country, gf, type) },
      { icon: 'chart', title: `${type.name} specs`, html: typeSpecTable(type) },
      { icon: 'star', title: `Best ${country.name} proxy providers`, html: L.providerCards(provs, rng) + DISCLOSURE },
      { icon: 'globe', title: `${country.name} cities with coverage`, html: L.relatedGrid(cities.map(c => [`${c.name} ${type.name}`, `/${c.slug}-${type.slug}-proxies.html`])) },
    ],
    faqs: faqPick(rng, [
      { q: `How do I get ${aAn(country.demonym)} ${country.demonym} IP address?`, a: `Use ${esc(country.name)} ${esc(tlow(type))} from a provider with ${esc(country.name)} coverage. You connect and your traffic exits from a genuine ${esc(country.demonym)} IP.` },
      { q: `Are ${country.name} ${tlow(type)} good for geo-targeting?`, a: `Yes — they give you authentic ${esc(country.demonym)} IPs, ideal for checking ${esc(country.name)}-specific pricing, ads, and search results.` },
      { q: `What does ${country.name} proxy coverage look like?`, a: `${esc(gf && gf.isps ? country.name + ' residential IPs come mainly from ' + andList(gf.isps.slice(0, 3)) + '.' : 'Coverage spans major ' + country.demonym + ' ISPs, with pool size varying by provider.')} City and ASN-level targeting is available from premium networks.` },
    ], 3),
    related: [
      ...D.types.filter(x => x.slug !== type.slug).slice(0, 3).map(x => [`${country.name} ${x.name}`, `/${country.slug}-${x.slug}-proxies.html`]),
      [`${country.name} proxies (all types)`, `/${country.slug}-proxies.html`],
      [`${type.name}`, `/${type.slug}-proxies.html`],
      ['All countries', '/proxies-by-country.html'],
    ],
    ctaHead: `Best ${country.name} proxies`,
  });
};

R.cityType = (D, { city, type }) => {
  const rng = rngFor('cty-' + city.slug + '-' + type.slug);
  const path = `/${city.slug}-${type.slug}-proxies.html`;
  const provs = rankProviders(D, rng, { n: 3 });
  const sib = D.citiesFlat.filter(c => c.countrySlug === city.countrySlug && c.slug !== city.slug).slice(0, 5);
  const gf = D.geoExtra && D.geoExtra[city.countrySlug];
  return assemble(D, {
    cluster: 'cityType', path,
    title: `${city.name} ${type.name} (${YEAR}) — Local IPs in ${city.name}`,
    desc: `${city.name} ${tlow(type)}: target ${city.name}, ${city.country} with local ${city.demonym} IPs for scraping, ad verification, and localized testing in ${YEAR}.`,
    eyebrow: city.country,
    h1: `${hl(city.name)} ${type.name}`,
    lede: `Get local ${city.name} IPs. ${city.name} ${tlow(type)} let you geo-target ${city.name}, ${city.country} for accurate local data.`,
    chips: [['pin', 'City', city.name], ['globe', 'Country', city.country], [TYPE_ICON[type.slug] || 'globe', 'Type', type.name]],
    crumbs: [['Home', '/'], ['Locations', '/proxies-by-country.html'], [city.country, `/${city.countrySlug}-proxies.html`], [`${city.name} ${type.name}`, path]],
    tldr: `${esc(city.name)} ${esc(tlow(type))} route through ${esc(city.demonym)} IPs local to ${esc(theCountryName(city.country))}, ideal for city-level geo-targeting in ${esc(city.name)}.`,
    sections: [
      { icon: 'pin', title: `Why ${city.name} proxies`, html: P(`City-level targeting matters when content, pricing, or ad delivery varies within ${esc(theCountryName(city.country))}. ${esc(city.name)} ${esc(tlow(type))} give you a local vantage point — the same results a resident of ${esc(city.name)} would see.`) + P(`${cap(esc(type.name))} ${esc(TX(type).trust)}, so blocks are rare and the data stays accurate.${gf && gf.sites ? ' Common local targets across ' + esc(theCountryName(city.country)) + ' include ' + esc(gf.sites.slice(0, 3).join(', ')) + '.' : ''}`) },
      { icon: 'star', title: `Best providers with ${city.name} IPs`, html: L.providerCards(provs, rng) + DISCLOSURE },
      { icon: 'globe', title: `Other cities in ${city.country}`, html: L.relatedGrid(sib.map(c => [`${c.name} ${type.name}`, `/${c.slug}-${type.slug}-proxies.html`])) },
    ],
    faqs: faqPick(rng, [
      { q: `Can I get a proxy with a ${city.name} IP?`, a: `Yes. Providers with ${esc(city.country)} coverage can route through IPs local to ${esc(city.name)} or the surrounding region.` },
      { q: `Are ${city.name} ${tlow(type)} good for local data?`, a: `They are ideal for ${esc(city.name)}-specific pricing, search results, and ad verification, giving you an authentic local view.` },
      { q: `How is city-level targeting different from country targeting?`, a: `Country targeting picks any IP in ${esc(theCountryName(city.country))}; city targeting narrows to ${esc(city.name)}, which matters when prices, ads, or availability differ between regions.` },
    ], 3),
    related: [
      ...D.types.filter(x => x.slug !== type.slug).slice(0, 3).map(x => [`${city.name} ${x.name}`, `/${city.slug}-${x.slug}-proxies.html`]),
      [`${city.country} ${type.name}`, `/${city.countrySlug}-${type.slug}-proxies.html`],
      ['All countries', '/proxies-by-country.html'],
    ],
    ctaHead: `Best ${city.name} proxies`,
  });
};

R.usecaseCountry = (D, { uc, country }) => {
  const rng = rngFor('ucc-' + uc.slug + '-' + country.slug);
  const path = `/proxies-for-${uc.slug}-in-${country.slug}.html`;
  const bt = (uc.bestTypes || []).map(s => D.bySlug.type[s]).filter(Boolean);
  const primary = bt[0] || D.bySlug.type.residential;
  const provs = rankProviders(D, rng, { n: 4 });
  const gf = geoFacts(D, country);
  return assemble(D, {
    cluster: 'usecaseCountry', path,
    title: `Proxies for ${uc.name} in ${country.name} (${YEAR}) — ${country.demonym} IPs`,
    desc: `Best proxies for ${uc.shortName} in ${country.name}: use local ${country.demonym} IPs to boost ${uc.keyMetric}. Top proxy types and providers for ${YEAR}.`,
    eyebrow: country.region,
    h1: `Proxies for ${hl(uc.name)} in ${country.name}`,
    lede: `Running ${uc.shortName} targeting ${theName(country)}? Local ${country.demonym} IPs improve ${uc.keyMetric} and avoid geo-blocks.`,
    chips: [['pin', 'Country', country.name], ['target', 'Task', uc.shortName], ['globe', 'Best type', primary.name]],
    crumbs: [['Home', '/'], ['Use Cases', '/proxies-by-use-case.html'], [uc.name, `/proxies-for-${uc.slug}.html`], [country.name, path]],
    tldr: `For ${esc(uc.shortName)} in ${esc(theName(country))}, use ${esc(tlow(primary))} with ${esc(country.demonym)} IPs to maximise ${esc(uc.keyMetric)}.`,
    sections: [
      { icon: 'target', title: `${uc.name} in ${country.name}`, html: P(esc(uc.intro)) + P(`Doing this specifically for ${esc(theName(country))} means you need ${esc(country.demonym)} exit IPs — otherwise ${esc(country.name)} targets serve the wrong region’s content or block you outright.`) + geoPara(country, gf) },
      { icon: 'globe', title: `Best proxy types`, html: bt.length ? typeCompareTable(bt) : P(`Residential and rotating proxies work best for ${esc(uc.shortName)} in ${esc(country.name)}.`) },
      { icon: 'star', title: `Best providers for ${country.name}`, html: L.providerCards(provs, rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `What proxies are best for ${uc.shortName} in ${country.name}?`, a: `${cap(tlow(primary))} with ${esc(country.demonym)} IPs. They combine local geo-targeting with the trust ${esc(uc.shortName)} needs, because they ${esc(TX(primary).trust)}.` },
      { q: `Do I need local ${country.demonym} IPs for ${uc.shortName}?`, a: `If your data or targets are ${esc(country.name)}-specific, yes — local IPs are what make ${esc(uc.keyMetric)} reliable.` },
      { q: `What should I watch out for doing ${uc.shortName} in ${country.name}?`, a: `${esc(gf && gf.note ? gf.note : 'Follow local law and each site’s terms, and pace requests to stay under rate limits.')}` },
    ], 3),
    related: [
      [`Best proxies for ${uc.name}`, `/proxies-for-${uc.slug}.html`],
      [`${country.name} proxies`, `/${country.slug}-proxies.html`],
      ...bt.slice(0, 2).map(t => [`${country.name} ${t.name}`, `/${country.slug}-${t.slug}-proxies.html`]),
      ['All countries', '/proxies-by-country.html'],
    ],
    ctaHead: `Best proxies for ${country.name}`,
  });
};

R.providerCountry = (D, { prov, country }) => {
  const rng = rngFor('pc-' + prov.slug + '-' + country.slug);
  const path = `/${prov.slug}-proxies-in-${country.slug}.html`;
  const alts = rankProviders(D, rng, { n: 3, topPick: false, exclude: [prov.slug] });
  const gf = geoFacts(D, country);
  return assemble(D, {
    cluster: 'providerCountry', path,
    title: `${prov.name} Proxies in ${country.name} (${YEAR}) — ${country.demonym} IPs`,
    desc: `${prov.name} ${country.name} coverage: ${country.demonym} IPs, ${shortPrice(prov.startingPrice)} pricing, and value vs alternatives for targeting ${country.name} in ${YEAR}.`,
    eyebrow: country.region,
    h1: `${hl(prov.name)} Proxies in ${country.name}`,
    lede: `How good is ${prov.name} for ${theName(country)}? It offers ${country.demonym} IPs with ${prov.poolSize || 'broad coverage'} — here is the value verdict.`,
    chips: [['star', 'Rating', (prov.rating || 4).toFixed(1) + '/5'], ['pin', 'Country', country.name], ['bolt', 'From', shortPrice(prov.startingPrice) || '—']],
    crumbs: [['Home', '/'], ['Reviews', prov.reviewPath], [country.name, `/${country.slug}-proxies.html`], [`${prov.name} in ${country.name}`, path]],
    tldr: `${esc(prov.name)} provides ${esc(country.demonym)} IP coverage suitable for ${esc((prov.bestFor || ['general use'])[0])}. Compare its ${esc(country.name)} pricing against the alternatives below.`,
    sections: [
      { icon: 'pin', title: `${prov.name} in ${country.name}`, html: P(`${esc(prov.name)} — “${esc(prov.tagline)}” — supports ${esc(country.name)} targeting with ${esc(country.demonym)} exit IPs. ${esc((prov.strengths || [''])[0])}.`) + P(`This suits scraping, ad verification, and localization aimed at ${esc(theName(country))} and ${esc(country.capital)}.`) + geoPara(country, gf) },
      { icon: 'check', title: `${prov.name} strengths`, html: L.checks(prov.strengths || []) },
      { icon: 'layers', title: `Cheaper ${country.name} alternatives`, html: L.providerCards([TOPPICK, ...alts], rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `Does ${prov.name} have ${country.demonym} IPs?`, a: `Yes, ${esc(prov.name)} offers ${esc(country.name)} coverage with ${esc(country.demonym)} exit IPs across its ${esc(prov.poolSize || 'pool')}.` },
      { q: `How much does ${prov.name} cost for ${country.name}?`, a: `${esc(prov.name)} uses ${esc(prov.pricingModel)} pricing (${esc(prov.startingPrice || 'tiered')}). Compare it against the alternatives above on cost per GB.` },
      { q: `What are the best ${prov.name} alternatives for ${country.name}?`, a: `${esc(andList(alts.map(a => a.name)))} all offer ${esc(country.name)} coverage worth comparing on price and pool size.` },
    ], 3),
    related: [
      [`${prov.name} review`, prov.reviewPath],
      [`${country.name} proxies`, `/${country.slug}-proxies.html`],
      [`${prov.name} alternatives`, `/${prov.slug}-alternatives.html`],
      ['All countries', '/proxies-by-country.html'],
    ],
    ctaHead: `Best value in ${country.name}`,
  });
};

R.platformCountry = (D, { pf, country }) => {
  const rng = rngFor('pfc-' + pf.slug + '-' + country.slug);
  const path = `/${pf.slug}-proxies-in-${country.slug}.html`;
  const rt = D.bySlug.type[pf.recommendedType] || D.types[0];
  const provs = rankProviders(D, rng, { n: 3 });
  const gf = geoFacts(D, country);
  return assemble(D, {
    cluster: 'platformCountry', path,
    title: `${pf.name} Proxies in ${country.name} (${YEAR}) — ${country.demonym} IPs`,
    desc: `${pf.name} proxies with ${country.demonym} IPs: access ${pf.name} as a local user in ${country.name}. Best proxy type, providers, and tips for ${YEAR}.`,
    eyebrow: country.region,
    h1: `${hl(pf.name)} Proxies in ${country.name}`,
    lede: `Access ${pf.name} as a local ${country.demonym} user. Local IPs in ${theName(country)} unlock region-specific ${pf.name} content and pricing.`,
    chips: [['pin', 'Country', country.name], [TYPE_ICON[rt.slug] || 'globe', 'Best type', rt.name]],
    crumbs: [['Home', '/'], ['Platforms', '/proxies-by-platform.html'], [pf.name, `/proxies-for-${pf.slug}.html`], [country.name, path]],
    tldr: `For ${esc(pf.name)} in ${esc(theName(country))}, use ${esc(tlow(rt))} with ${esc(country.demonym)} IPs. ${esc(pf.successNote)}`,
    sections: [
      { icon: 'search', title: `${pf.name} in ${country.name}`, html: P(esc(pf.scrapingContext)) + P(`Targeting ${esc(pf.name)} inside ${esc(theName(country))} needs local ${esc(country.demonym)} IPs, so you see the same content, ads, and pricing as a resident.`) + (gf && gf.note ? P(esc(gf.note)) : '') },
      { icon: TYPE_ICON[rt.slug] || 'globe', title: `Recommended proxy type`, html: typeSpecTable(rt, { hideBestFor: true }) },
      { icon: 'star', title: `Best providers for ${country.name}`, html: L.providerCards(provs, rng) + DISCLOSURE },
    ],
    faqs: faqPick(rng, [
      { q: `How do I access ${pf.name} with ${aAn(country.demonym)} ${country.demonym} IP?`, a: `Use ${esc(tlow(rt))} from a provider with ${esc(country.name)} coverage; your ${esc(pf.name)} traffic exits from a local ${esc(country.demonym)} IP.` },
      { q: `What proxy type is best for ${pf.name} in ${country.name}?`, a: `${cap(esc(rt.name))} — they ${esc(TX(rt).trust)}, which ${esc(pf.name)} trusts.` },
      { q: `Is a local IP necessary for ${pf.name} in ${country.name}?`, a: `If you need the ${esc(country.name)} version of ${esc(pf.name)} — local content, pricing, or availability — then yes, a ${esc(country.demonym)} IP is required.` },
    ], 3),
    related: [
      [`Best proxies for ${pf.name}`, `/proxies-for-${pf.slug}.html`],
      [`${country.name} ${rt.name}`, `/${country.slug}-${rt.slug}-proxies.html`],
      [`${country.name} proxies`, `/${country.slug}-proxies.html`],
      ['All platforms', '/proxies-by-platform.html'],
    ],
    ctaHead: `Best ${pf.name} proxies in ${country.name}`,
  });
};

module.exports = { R, TOPPICK, assemble };
