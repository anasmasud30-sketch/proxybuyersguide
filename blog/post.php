<?php
/**
 * Central Blog — single article, rendered INSIDE this site's header/footer.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$slug = (string) ($_GET['slug'] ?? '');
if ($slug === '' && !empty($_SERVER['PATH_INFO'])) {
    $slug = trim((string) $_SERVER['PATH_INFO'], '/');
}
$slug = trim((string) preg_replace('/[^a-z0-9\-]/', '', strtolower($slug)), '-');

$post = null;
if ($slug !== '') {
    $r = supa_get('blogs', [
        'select'   => 'title,slug,meta_title,meta_description,featured_image,content,category,tags,published_at,updated_at',
        'site_key' => 'eq.' . SITE_KEY,
        'slug'     => 'eq.' . $slug,
        'status'   => 'eq.published',
        'limit'    => 1,
    ]);
    if (!empty($r[0])) {
        $post = $r[0];
    }
}

$hh       = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$blogHome = rtrim(SITE_URL, '/') . rtrim(BLOG_BASE_PATH, '/');

if ($post === null) {
    http_response_code(404);
    $page_title = 'Article not found';
    $meta_desc  = '';
    $canonical  = $blogHome . '/';
    $seo_extra  = '<meta name="robots" content="noindex">';
    include __DIR__ . '/_top.php';
    include __DIR__ . '/_style.php';
    echo '<div class="cdblog cdblog-article"><p class="cdblog-back"><a href="' . $hh($blogHome) . '/">← All articles</a></p>'
       . '<h1>Article not found</h1><p>Sorry, that article could not be found.</p></div>';
    include __DIR__ . '/_bottom.php';
    exit;
}

$page_title = ($post['meta_title'] ?? '') !== '' ? (string) $post['meta_title'] : (string) $post['title'];
$meta_desc  = ($post['meta_description'] ?? '') !== ''
    ? (string) $post['meta_description']
    : trim((string) preg_replace('/\s+/', ' ', mb_substr(strip_tags((string) ($post['content'] ?? '')), 0, 200)));
$canonical  = $blogHome . '/post.php?slug=' . rawurlencode((string) $post['slug']);
$img        = (string) ($post['featured_image'] ?? '');
$pub        = !empty($post['published_at']) ? date('c', strtotime((string) $post['published_at'])) : '';
$tags       = array_filter(array_map('trim', explode(',', (string) ($post['tags'] ?? ''))));

$ld = ['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => (string) $post['title'],
       'description' => $meta_desc, 'mainEntityOfPage' => $canonical, 'url' => $canonical];
if ($img !== '') { $ld['image'] = $img; }
if ($pub !== '') { $ld['datePublished'] = $pub; }
$seo_extra = '<meta property="og:type" content="article">'
    . '<meta property="og:title" content="' . $hh($page_title) . '">'
    . '<meta property="og:description" content="' . $hh($meta_desc) . '">'
    . '<meta property="og:url" content="' . $hh($canonical) . '">'
    . ($img !== '' ? '<meta property="og:image" content="' . $hh($img) . '">' : '')
    . '<meta name="twitter:card" content="' . ($img !== '' ? 'summary_large_image' : 'summary') . '">'
    . '<script type="application/ld+json">' . json_encode($ld, JSON_UNESCAPED_UNICODE) . '</script>';

include __DIR__ . '/_top.php';
include __DIR__ . '/_style.php';
?>
<article class="cdblog cdblog-article">
    <p class="cdblog-back"><a href="<?= $hh($blogHome) ?>/">← All articles</a></p>
    <?php if (!empty($post['category'])): ?><div class="cdblog-meta"><span class="cdblog-tag"><?= $hh($post['category']) ?></span></div><?php endif; ?>
    <h1><?= $hh($post['title']) ?></h1>
    <?php if ($pub !== ''): ?><div class="cdblog-meta"><time datetime="<?= $hh($pub) ?>"><?= $hh(date('F j, Y', strtotime((string) $post['published_at']))) ?></time></div><?php endif; ?>
    <?php if ($img !== ''): ?><img class="cdblog-hero" src="<?= $hh($img) ?>" alt="<?= $hh($post['title']) ?>"><?php endif; ?>
    <div class="cdblog-content">
        <?php echo $post['content'] ?? ''; // trusted admin HTML ?>
    </div>
    <?php if ($tags): ?><div class="cdblog-tags"><?php foreach ($tags as $t): ?><span class="cdblog-tag"><?= $hh($t) ?></span> <?php endforeach; ?></div><?php endif; ?>
</article>
<?php include __DIR__ . '/_bottom.php'; ?>
