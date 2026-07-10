<?php
/**
 * Central Blog — listing, rendered INSIDE this site's own header/footer.
 * Site chrome comes from _top.php / _bottom.php; blog logic is identical
 * across all sites. Reads published posts for THIS site from Supabase.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$perPage = 12;
$page    = max(1, (int) ($_GET['page'] ?? 1));
$offset  = ($page - 1) * $perPage;

$rows = supa_get('blogs', [
    'select'   => 'title,slug,meta_description,featured_image,category,published_at,content',
    'site_key' => 'eq.' . SITE_KEY,
    'status'   => 'eq.published',
    'order'    => 'published_at.desc.nullslast',
    'limit'    => $perPage,
    'offset'   => $offset,
]);
$hasMore = count($rows) === $perPage;

$hh = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$ex = function (string $c, int $n = 150) {
    $t = trim((string) preg_replace('/\s+/', ' ', strip_tags($c)));
    return mb_strlen($t) <= $n ? $t : rtrim(mb_substr($t, 0, $n)) . '…';
};
$blogHome = rtrim(SITE_URL, '/') . rtrim(BLOG_BASE_PATH, '/');

// Vars consumed by _top.php (site head).
$page_title = 'Blog';
$meta_desc  = 'Latest articles, news and updates.';
$canonical  = $blogHome . '/' . ($page > 1 ? '?page=' . $page : '');
$seo_extra  = '';

include __DIR__ . '/_top.php';
include __DIR__ . '/_style.php';
?>
<div class="cdblog">
    <div class="cdblog-head"><h1>Blog</h1><p class="cdblog-sub">Latest articles, news and updates.</p></div>

    <?php if (empty($rows)): ?>
        <p class="cdblog-empty">No posts published yet. Check back soon.</p>
    <?php else: ?>
        <div class="cdblog-grid">
            <?php foreach ($rows as $p): $u = $blogHome . '/post.php?slug=' . rawurlencode((string) $p['slug']); ?>
                <a class="cdblog-card" href="<?= $hh($u) ?>">
                    <?php if (!empty($p['featured_image'])): ?>
                        <img src="<?= $hh($p['featured_image']) ?>" alt="<?= $hh($p['title']) ?>" loading="lazy">
                    <?php endif; ?>
                    <div class="p">
                        <div class="cdblog-meta">
                            <?php if (!empty($p['published_at'])): ?><time datetime="<?= $hh(date('c', strtotime((string) $p['published_at']))) ?>"><?= $hh(date('M j, Y', strtotime((string) $p['published_at']))) ?></time><?php endif; ?>
                            <?php if (!empty($p['category'])): ?> · <span class="cdblog-tag"><?= $hh($p['category']) ?></span><?php endif; ?>
                        </div>
                        <h2><?= $hh($p['title']) ?></h2>
                        <p><?= $hh(($p['meta_description'] ?? '') !== '' ? $p['meta_description'] : $ex((string) ($p['content'] ?? ''))) ?></p>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>
        <div class="cdblog-pager">
            <?php if ($page > 1): ?><a href="<?= $hh($blogHome . '/?page=' . ($page - 1)) ?>">← Newer</a><?php else: ?><span></span><?php endif; ?>
            <?php if ($hasMore): ?><a href="<?= $hh($blogHome . '/?page=' . ($page + 1)) ?>">Older →</a><?php endif; ?>
        </div>
    <?php endif; ?>
</div>
<?php include __DIR__ . '/_bottom.php'; ?>
