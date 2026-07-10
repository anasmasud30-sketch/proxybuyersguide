<?php
/**
 * _bottom.php — Proxy Buyer's Guide site footer + end-of-body.
 * Static reconstruction from the compiled bundle; closes the wrappers opened
 * in _top.php (<main>, <body>, <html>). No React JS bundle is loaded.
 */
declare(strict_types=1);

if (!isset($hh) || !is_callable($hh)) {
    $hh = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

// Footer link columns (verbatim from the shipped bundle: WS).
$footer_cols = [
    'Proxy Types' => [
        ['Residential Proxies', '/resources/residential-proxies-guide'],
        ['Datacenter Proxies', '/resources/datacenter-proxies-guide'],
        ['Mobile Proxies', '/resources/mobile-proxy-guide'],
        ['ISP Proxies', '/resources/isp-proxies-guide'],
        ['SOCKS5 Proxies', '/top/socks5-proxy-providers'],
    ],
    'Top Picks' => [
        ['Best Residential Proxies', '/top/residential-proxy-services'],
        ['Best Datacenter Proxies', '/top/datacenter-proxy-providers'],
        ['Best Sneaker Proxies', '/top/sneaker-proxy-services'],
        ['Best SEO Proxies', '/top/seo-proxy-services'],
        ['Best Rotating Proxies', '/top/rotating-proxy-services'],
    ],
    'Resources' => [
        ['What Is a Proxy?', '/resources/what-is-a-proxy'],
        ['Proxy vs VPN', '/resources/proxy-vs-vpn'],
        ['How to Use Proxies', '/resources/how-to-use-proxies'],
        ['Web Scraping Guide', '/resources/web-scraping-best-practices'],
        ['Python Proxy Setup', '/resources/proxy-setup-python-requests'],
    ],
    'Compare' => [
        ['Bright Data Alternatives', '/compare/bright-data-alternatives'],
        ['Smartproxy Alternatives', '/compare/smartproxy-alternatives'],
        ['Residential vs Datacenter', '/resources/residential-vs-datacenter-proxies'],
        ['Proxy vs VPN', '/compare/proxy-vs-vpn-comparison'],
        ['All Provider Reviews', '/proxy-provider-analysis/bright-data-review'],
    ],
];
$brand_svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
?>
</main>

<footer class="border-t border-white/10 bg-[#060d1a] mt-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
      <?php foreach ($footer_cols as $heading => $links): ?>
        <div>
          <h3 class="text-sm font-semibold text-white uppercase tracking-wide mb-3"><?= $hh($heading) ?></h3>
          <ul class="space-y-2">
            <?php foreach ($links as $l): ?>
              <li><a href="<?= $hh($l[1]) ?>" class="text-sm text-slate-400 hover:text-slate-200 transition-colors"><?= $hh($l[0]) ?></a></li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endforeach; ?>
    </div>
    <div class="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
          <span class="w-3 h-3 text-white"><?= $brand_svg ?></span>
        </div>
        <span class="text-sm text-slate-400">The industry's most trusted technical resource for proxy infrastructure.</span>
      </div>
      <div class="flex items-center gap-4 text-sm text-slate-500">
        <a href="/privacy-policy" class="hover:text-slate-300 transition-colors">Privacy Policy</a>
        <a href="/about" class="hover:text-slate-300 transition-colors">About</a>
        <a href="mailto:info@proxybuyersguide.com" class="hover:text-slate-300 transition-colors">Contact</a>
      </div>
    </div>
    <p class="text-center text-xs text-slate-600 mt-4">© 2025 ProxyBuyersGuide.com. All rights reserved. | Contact: info@proxybuyersguide.com</p>
    <p class="text-center text-xs text-slate-700 mt-2">This site contains affiliate links. We may earn a commission when you purchase through our links at no extra cost to you.</p>
  </div>
</footer>

<script src="/blog-nav.js" defer></script>
</body>
</html>
