/* ==========================================================================
   Central Blog — client-side hybrid reader (drop-in for an EXISTING blog page).
   Keeps the site's own static posts exactly as they are and adds the newest
   Central-Dashboard (Supabase) posts:
     • listing page  -> clones the site's own card and prepends new posts
     • post.html     -> renders a single Supabase post inside the site's chrome
   Pure browser JS, no PHP — works on static hosts (Cloudflare/Netlify/Vercel)
   as well as Apache/LiteSpeed/cPanel. Config comes from window.__BLOG_SUPA__.
   ========================================================================== */
(function () {
    'use strict';
    var C = window.__BLOG_SUPA__ || {};
    if (!C.supabaseUrl || !C.anonKey || !C.siteKey) { return; }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function txt(s) { return String(s == null ? '' : s); }
    function fmtDate(s) {
        if (!s) return '';
        var d = new Date(s); if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    function strip(html) { return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
    function excerpt(html, n) { var t = strip(html); n = n || 160; return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…'; }
    function readMins(html) { return Math.max(1, Math.ceil(strip(html).split(' ').length / 200)); }
    function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\-]/g, ''); }
    // Author byline shown at the END of a post (name + optional social link).
    function authorHtml(post) {
        var name = (post.author_name || '').trim();
        if (!name) return '';
        var soc = (post.author_social || '').trim(), social = '';
        if (soc) {
            if (/^https?:\/\//i.test(soc) || /^www\./i.test(soc)) {
                var url = /^https?:\/\//i.test(soc) ? soc : 'https://' + soc;
                social = ' · <a href="' + esc(url) + '" target="_blank" rel="noopener nofollow" style="color:inherit">'
                    + esc(soc.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')) + '</a>';
            } else {
                social = ' · ' + esc(soc);
            }
        }
        return '<div class="cdblog-author" style="margin-top:34px;padding-top:20px;border-top:1px solid rgba(128,128,128,.28);'
            + 'font-size:.95rem;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
            + '<span aria-hidden="true" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;'
            + 'width:36px;height:36px;border-radius:50%;background:rgba(128,128,128,.2);font-weight:700">'
            + esc(name.charAt(0).toUpperCase()) + '</span>'
            + '<span>Written by <strong>' + esc(name) + '</strong>' + social + '</span></div>';
    }
    function qsSlug() {
        var m = /[?&]slug=([^&]*)/.exec(location.search);
        return m ? slugify(decodeURIComponent(m[1].replace(/\+/g, ' '))) : '';
    }
    function supa(params) {
        var url = C.supabaseUrl.replace(/\/$/, '') + '/rest/v1/blogs?' + params;
        return fetch(url, { headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey, Accept: 'application/json' } })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    function q(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }

    /* ---------------- LIST mode: inject cards into existing grid ---------- */
    function pickGrid() {
        var sel = C.gridSelector || '.blog-grid';
        var grids = Array.prototype.slice.call(document.querySelectorAll(sel));
        if (!grids.length) return null;
        if (C.anchorText) {
            // choose the grid nearest AFTER a heading containing anchorText (the main "All Articles" grid)
            var heads = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3'));
            var anchor = heads.filter(function (h) { return (h.textContent || '').indexOf(C.anchorText) !== -1; })[0];
            if (anchor) {
                for (var i = 0; i < grids.length; i++) {
                    if (anchor.compareDocumentPosition(grids[i]) & Node.DOCUMENT_POSITION_FOLLOWING) return grids[i];
                }
            }
        }
        return grids[0];
    }
    function fillCard(node, post) {
        // the clone is (or contains) the link
        var a = node.tagName === 'A' ? node : node.querySelector('a');
        if (a) { a.setAttribute('href', (C.postUrl || 'post.html?slug=') + encodeURIComponent(post.slug)); a.removeAttribute('target'); a.removeAttribute('rel'); }
        node.classList.remove('active', 'blog-card-external', 'is-external', 'featured');
        var title = node.querySelector(C.titleSelector || 'h1,h2,h3,h4');
        if (title) title.textContent = txt(post.title);
        var ps = node.querySelectorAll('p');
        if (ps.length) ps[0].textContent = post.meta_description ? txt(post.meta_description) : excerpt(post.content);
        var cat = node.querySelector(C.catSelector || '.blog-card-cat,.cat,.category,.badge,.pill,.tag');
        if (cat) cat.textContent = post.category ? txt(post.category) : 'Blog';
        var rd = node.querySelector(C.readSelector || '.blog-card-read,.read,.readtime,.read-time');
        if (rd) rd.textContent = '· ' + readMins(post.content) + ' min read';
        var img = node.querySelector('img');
        if (img) {
            if (post.featured_image) { img.setAttribute('src', post.featured_image); img.setAttribute('alt', txt(post.title)); }
            else { img.parentNode && img.parentNode.removeChild(img); }
        }
        return node;
    }
    function runList() {
        var grid = pickGrid();
        if (!grid) return;
        var template = (C.cardSelector && grid.querySelector(C.cardSelector)) || grid.querySelector('a') || grid.firstElementChild;
        if (!template) return;
        supa(q({
            select: 'title,slug,meta_description,featured_image,category,content,published_at',
            site_key: 'eq.' + C.siteKey, status: 'eq.published',
            order: 'published_at.desc.nullslast', limit: 50
        })).then(function (rows) {
            if (!rows || !rows.length) return;
            // dedupe against slugs already present as static cards
            var present = {};
            Array.prototype.forEach.call(grid.querySelectorAll('a[href]'), function (a) {
                var mm = /([a-z0-9\-]+)\/?(?:\?slug=([a-z0-9\-]+))?$/i.exec(a.getAttribute('href') || '');
                if (mm) { if (mm[1]) present[mm[1].toLowerCase()] = 1; if (mm[2]) present[mm[2].toLowerCase()] = 1; }
            });
            var frag = document.createDocumentFragment();
            rows.forEach(function (p) {
                if (!p.slug || present[String(p.slug).toLowerCase()]) return;
                frag.appendChild(fillCard(template.cloneNode(true), p));
            });
            if (frag.childNodes.length) grid.insertBefore(frag, grid.firstChild);
        }).catch(function (e) { if (window.console) console.warn('[central-blog]', e); });
    }

    /* ---------------- FULL-LIST mode: render whole listing ---------------- */
    function cardHtml(p) {
        var u = (C.postUrl || 'post.html?slug=') + encodeURIComponent(p.slug);
        var img = p.featured_image ? '<img src="' + esc(p.featured_image) + '" alt="' + esc(p.title) + '" loading="lazy">' : '';
        var meta = '<div class="cdblog-meta">'
            + (p.published_at ? '<time datetime="' + esc(p.published_at) + '">' + esc(fmtDate(p.published_at)) + '</time>' : '')
            + (p.category ? ' · <span class="cdblog-tag">' + esc(p.category) + '</span>' : '')
            + '</div>';
        return '<a class="cdblog-card" href="' + esc(u) + '">' + img + '<div class="p">' + meta
            + '<h2>' + esc(p.title) + '</h2><p>' + esc(p.meta_description ? p.meta_description : excerpt(p.content)) + '</p></div></a>';
    }
    function runFullList(root) {
        var page = Math.max(1, parseInt((/[?&]page=(\d+)/.exec(location.search) || [])[1] || '1', 10) || 1);
        var per = 12, offset = (page - 1) * per;
        root.innerHTML = '<p class="cdblog-empty">Loading…</p>';
        supa(q({
            select: 'title,slug,meta_description,featured_image,category,content,published_at',
            site_key: 'eq.' + C.siteKey, status: 'eq.published',
            order: 'published_at.desc.nullslast', limit: per + 1, offset: offset
        })).then(function (rows) {
            var more = rows.length > per; if (more) rows = rows.slice(0, per);
            var oldPager = root.parentNode && root.parentNode.querySelector('.cdblog-pager');
            if (oldPager) oldPager.parentNode.removeChild(oldPager);
            if (!rows.length) { root.innerHTML = '<p class="cdblog-empty">No posts published yet. Check back soon.</p>'; return; }
            root.innerHTML = rows.map(cardHtml).join('');
            if (page > 1 || more) {
                var pager = '<div class="cdblog-pager">'
                    + (page > 1 ? '<a href="?page=' + (page - 1) + '">← Newer</a>' : '<span></span>')
                    + (more ? '<a href="?page=' + (page + 1) + '">Older →</a>' : '<span></span>')
                    + '</div>';
                root.insertAdjacentHTML('afterend', pager);
            }
        }).catch(function (e) { root.innerHTML = '<p class="cdblog-empty">Couldn\'t load articles right now.</p>'; if (window.console) console.warn('[central-blog]', e); });
    }

    /* ---------------- POST mode: render single article -------------------- */
    function setMeta(name, content) {
        var m = document.querySelector('meta[name="' + name + '"]');
        if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
        m.setAttribute('content', content || '');
    }
    function setCanonical(href) {
        var l = document.querySelector('link[rel="canonical"]');
        if (!l) { l = document.createElement('link'); l.setAttribute('rel', 'canonical'); document.head.appendChild(l); }
        l.setAttribute('href', href);
    }
    function stripDupH1(html, title) {
        html = String(html || '');
        try {
            var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim().toLowerCase(); };
            var t = document.createElement('template'); t.innerHTML = html;
            var f = t.content.firstElementChild;
            if (f && f.tagName === 'H1' && norm(f.textContent) === norm(title)) { f.remove(); return t.innerHTML; }
        } catch (e) {}
        return html;
    }
    function runPost(root) {
        var slug = qsSlug();
        var home = C.blogHome || './';
        if (!slug) return notFound(root, home);
        supa(q({
            select: 'title,slug,meta_title,meta_description,featured_image,content,category,tags,published_at,updated_at,author_name,author_social',
            site_key: 'eq.' + C.siteKey, status: 'eq.published', slug: 'eq.' + slug, limit: 1
        })).then(function (rows) {
            var post = rows && rows[0];
            if (!post) return notFound(root, home);
            document.title = (post.meta_title || post.title) + (C.titleSuffix || '');
            setMeta('description', post.meta_description || excerpt(post.content, 160));
            var canonical = (C.siteUrl || '') + (C.blogPath || '/blog') + '/post.html?slug=' + encodeURIComponent(post.slug);
            setCanonical(canonical);
            injectSchema(post, canonical);
            var tags = post.tags ? (Array.isArray(post.tags) ? post.tags : String(post.tags).split(',')) : [];
            tags = tags.map(function (t) { return String(t).trim(); }).filter(Boolean);
            var html = '';
            html += '<p class="cdblog-back"><a href="' + esc(home) + '">← All articles</a></p>';
            if (post.category) html += '<div class="cdblog-meta"><span class="cdblog-tag">' + esc(post.category) + '</span></div>';
            html += '<h1>' + esc(post.title) + '</h1>';
            if (post.published_at) html += '<div class="cdblog-meta"><time datetime="' + esc(post.published_at) + '">' + esc(fmtDate(post.published_at)) + '</time></div>';
            if (post.featured_image) html += '<img class="cdblog-hero" src="' + esc(post.featured_image) + '" alt="' + esc(post.title) + '">';
            html += '<div class="cdblog-content">' + stripDupH1(post.content, post.title) + '</div>';
            if (tags.length) html += '<div class="cdblog-tags">' + tags.map(function (t) { return '<span class="cdblog-tag">' + esc(t) + '</span> '; }).join('') + '</div>';
            html += authorHtml(post);
            root.innerHTML = html;
            window.scrollTo(0, 0);
        }).catch(function (e) { notFound(root, home); if (window.console) console.warn('[central-blog]', e); });
    }
    function notFound(root, home) {
        document.title = 'Article not found' + (C.titleSuffix || '');
        setMeta('robots', 'noindex');
        root.innerHTML = '<p class="cdblog-back"><a href="' + esc(home) + '">← All articles</a></p>'
            + '<h1>Article not found</h1><p>Sorry, that article could not be found or is no longer published.</p>';
    }
    function injectSchema(post, url) {
        try {
            var old = document.getElementById('cb-ldjson'); if (old) old.remove();
            var d = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title,
                description: post.meta_description || '', mainEntityOfPage: url, url: url };
            if (post.featured_image) d.image = post.featured_image;
            if (post.published_at) d.datePublished = post.published_at;
            if (post.updated_at) d.dateModified = post.updated_at;
            var s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'cb-ldjson';
            s.textContent = JSON.stringify(d); document.head.appendChild(s);
        } catch (e) {}
    }

    /* ---------------- boot ------------------------------------------------ */
    function boot() {
        var post = document.getElementById('cb-post-root');
        if (post) { runPost(post); return; }
        var list = document.getElementById('cb-list-root');
        if (list) { runFullList(list); return; }
        runList();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
