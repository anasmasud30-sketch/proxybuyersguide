/* ==========================================================================
   Central Blog — nav link injector.
   Adds a "Blog" item (-> /blog/) to the site's primary navigation, matching the
   nav's own markup by cloning an existing item. Works on static/prerendered
   pages and on client-rendered SPAs (waits for the nav via MutationObserver).
   Idempotent; falls back to a small floating button if no nav is found.
   ========================================================================== */
(function () {
    'use strict';
    var BLOG = '/blog/';

    function findNav() {
        var sels = ['header nav ul', '.nav-links', '.navbar-nav', 'nav ul.menu', '.main-nav ul',
            '.menu > ul', 'nav ul', 'header ul', '.navbar ul', '.nav ul'];
        for (var i = 0; i < sels.length; i++) {
            var el = document.querySelector(sels[i]);
            if (el && el.querySelectorAll('a').length >= 2) return el;
        }
        var cands = document.querySelectorAll('nav, header, [role="navigation"]');
        for (var j = 0; j < cands.length; j++) {
            if (cands[j].querySelectorAll('a').length >= 3) return cands[j];
        }
        return null;
    }
    // Point a link at the static /blog/ AND force a real page load, so a SPA
    // router (which may own the /blog route) can't intercept the click and keep
    // the visitor inside the app instead of loading our static blog.
    function wire(a) { a.setAttribute('href', BLOG); }
    // A document-level capture handler forces the static /blog/ to load for any
    // "Blog" index link — survives SPA re-renders and stops the app router from
    // swallowing the click. Individual post links (/blog/…something) are left alone.
    function isBlogIndexLink(a) {
        var href = a.getAttribute('href') || '', txt = (a.textContent || '').trim().toLowerCase();
        return txt === 'blog' || /\/blog\/?($|[?#])/.test(href) || /\/blog\.html($|[?#])/.test(href);
    }
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && isBlogIndexLink(a) && a.getAttribute('href') !== 'javascript:void(0)') {
            e.preventDefault(); e.stopPropagation(); window.location.assign(BLOG);
        }
    }, true);
    function existingBlog(container) {
        var as = container.querySelectorAll('a'), found = false;
        for (var i = 0; i < as.length; i++) {
            var href = as[i].getAttribute('href') || '';
            var txt = (as[i].textContent || '').trim().toLowerCase();
            if (txt === 'blog' || /\/blog\/?($|[?#])/.test(href) || /\/blog\.html($|[?#])/.test(href)) {
                wire(as[i]); found = true;
            }
        }
        return found;
    }
    function addLink() {
        if (document.querySelector('a[href="' + BLOG + '"]')) return true;
        var nav = findNav();
        if (!nav) return false;
        if (existingBlog(nav)) return true;
        var lis = nav.querySelectorAll('li');
        if (lis.length) {
            var src = lis[lis.length - 1];
            var li = src.cloneNode(true);
            li.querySelectorAll('ul, .dropdown, .submenu, .sub-menu').forEach(function (x) { x.remove(); });
            var a = li.querySelector('a') || li.appendChild(document.createElement('a'));
            a.textContent = 'Blog';
            a.className = (a.className || '').replace(/\b(active|current|is-active)\b/g, '').trim();
            a.removeAttribute('aria-current');
            wire(a);
            src.parentNode.appendChild(li);
        } else {
            var base = nav.querySelector('a');
            var la = base.cloneNode(true);
            la.textContent = 'Blog';
            la.className = (la.className || '').replace(/\b(active|current|is-active)\b/g, '').trim();
            wire(la);
            base.parentNode.appendChild(la);
        }
        return true;
    }
    function floatBtn() {
        if (document.getElementById('cb-blog-fab') || document.querySelector('a[href="' + BLOG + '"]')) return;
        var a = document.createElement('a');
        a.id = 'cb-blog-fab'; a.textContent = 'Blog'; wire(a);
        a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;background:#111;color:#fff;'
            + 'padding:10px 18px;border-radius:999px;font:600 14px/1 system-ui,-apple-system,sans-serif;'
            + 'text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
        (document.body || document.documentElement).appendChild(a);
    }
    function boot() {
        if (addLink()) return;
        var tries = 0;
        var mo = new MutationObserver(function () { if (addLink() || ++tries > 60) mo.disconnect(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(function () { mo.disconnect(); if (!addLink()) floatBtn(); }, 6000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
