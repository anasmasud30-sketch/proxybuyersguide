<?php
/**
 * _top.php — Proxy Buyer's Guide site chrome (head + fixed header/nav).
 * Rebuilt as static HTML from the compiled Vite/React bundle (assets/index-*.js),
 * using the SAME Tailwind classes shipped in assets/index-C5B_R-Za.css.
 * The React JS bundle is intentionally NOT loaded. Wraps blog page content;
 * closing tags live in _bottom.php.
 */
declare(strict_types=1);

if (!isset($hh) || !is_callable($hh)) {
    $hh = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}
$page_title = $page_title ?? 'Blog';
$meta_desc  = $meta_desc  ?? '';
$canonical  = $canonical  ?? rtrim(SITE_URL, '/');
$seo_extra  = $seo_extra  ?? '';

// Brand mark used in the nav / footer (inline so no JS icon runtime is needed).
$brand_svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
?><!doctype html>
<html lang="en">
<head>
<base href="<?= rtrim(SITE_URL, '/') ?>/">
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/index-C5B_R-Za.css">
<link rel="stylesheet" href="/assets/theme-curvy.css">
<title><?= $hh($page_title) ?> — Proxy Buyer's Guide</title>
<meta name="description" content="<?= $hh($meta_desc) ?>">
<link rel="canonical" href="<?= $hh($canonical) ?>">
<?= $seo_extra ?>
</head>
<body style="background:#202020;color:#ededed;margin:0;font-family:'Open Sans',ui-sans-serif,system-ui,sans-serif;">

<nav class="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#060d1a]/95 backdrop-blur-md">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <span class="w-4 h-4 text-white"><?= $brand_svg ?></span>
        </div>
        <span class="font-bold text-white text-sm hidden sm:block">Proxy Buyer's Guide</span>
      </a>
      <div class="hidden lg:flex items-center gap-0.5">
        <a href="/" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Guide</a>
        <a href="/proxy-provider-analysis/bright-data-review" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Reviews</a>
        <a href="/compare" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Top Lists</a>
        <a href="/tips" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Resources</a>
        <a href="/compare" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Compare</a>
        <a href="/locations/us-proxy-network" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Locations</a>
        <a href="/blog" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-white bg-white/10">Blog</a>
        <a href="/sitemap" class="px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-white/5">Sitemap</a>
      </div>
      <div class="flex items-center gap-3">
        <a href="https://cheapest-proxies.com/" target="_blank" rel="noopener noreferrer" class="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap">Top Pick →</a>
      </div>
    </div>
  </div>
</nav>
<div style="height:64px"></div>
<main>
