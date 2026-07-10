<?php
/**
 * Central Blog reader — configuration for THIS website.
 * Reads published posts from the shared Supabase project. Read-only: the anon
 * key below is public and RLS only ever exposes PUBLISHED posts for this site.
 */
declare(strict_types=1);

define('SUPABASE_URL', 'https://bybrfkaiqvelptejnfdj.supabase.co');
define('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5YnJma2FpcXZlbHB0ZWpuZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTk5NDMsImV4cCI6MjA5NzM3NTk0M30.7o16dIZDfYT4dtSow7vNYEv9fmmqawMVPv21b6x6yeY');

// Which website this is — MUST equal the domain stored in the dashboard.
define('SITE_KEY', 'proxybuyersguide.com');
define('SITE_URL', 'https://proxybuyersguide.com');   // no trailing slash
define('BLOG_BASE_PATH', '/blog');

/** GET rows from the Supabase REST API using the public anon key. */
function supa_get(string $path, array $query = []): array
{
    if (!function_exists('curl_init')) {
        return [];
    }
    $qs = [];
    foreach ($query as $k => $v) {
        $qs[] = rawurlencode((string) $k) . '=' . rawurlencode((string) $v);
    }
    $url = rtrim(SUPABASE_URL, '/') . '/rest/v1/' . ltrim($path, '/') . ($qs ? '?' . implode('&', $qs) : '');
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . SUPABASE_ANON_KEY,
            'Authorization: Bearer ' . SUPABASE_ANON_KEY,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res === false || $code < 200 || $code >= 300) {
        return [];
    }
    $data = json_decode($res, true);
    return is_array($data) ? $data : [];
}
