/**
 * Riviera Journeys — Cloudflare Workers Static Assets entry
 *
 * Path: repo-root/_worker.js
 * Activated by: wrangler.jsonc (main: "_worker.js") + .assetsignore
 *
 * Closes from audit register:
 *   TS-001  → noindex header on *.workers.dev preview URLs
 *   TS-003  → 301 redirect /path/ → /path  (via wrangler.jsonc html_handling)
 *   SEC-001 → standard security headers on every response
 *   CO-002  → review count / rating substitution from env vars
 *   GSC-410 → 410 Gone responses for legacy WordPress / dead URLs
 *
 * To update review count without code changes:
 *   Cloudflare dashboard → Workers & Pages → rivierajourneys
 *     → Settings → Variables and Secrets → Production:
 *         REVIEWS_COUNT  = 10
 *         REVIEWS_RATING = 5.0
 *         REVIEWS_BEST   = 5
 *
 * To add another path to "410 Gone":
 *   Add it to GONE_EXACT (full path match) or
 *   GONE_PREFIX (prefix match, e.g. "/wp-admin/" catches /wp-admin/* )
 */

// ── 410 Gone — exact path matches ──────────────────────────────────────
//    Old landing pages, removed tours, dead internal links.
//    Returns honest HTTP 410 → Google deindexes faster than 404.
const GONE_EXACT = new Set([
  // Old WordPress landing pages
  '/french-riviera-cruise-stop-tours',
  '/french-riviera-day-tours',
  '/french-riviera-private-transfers',
  '/private-day-tours-french-riviera',
  '/private-french-riviera-shore-excursions',
  '/cruise-stop-day-tours-from-cannes-villefranche',
  '/what-is-the-riviera-really-about',
  '/a-clearer-state-of-mind',
  '/where-energy-returns-quietly',
  '/jean-paul',

  // Old WordPress index pages
  '/tour',
  '/home',
  '/ru',

  // Ghost URLs from dead internal links
  '/editorial/getting-around-the-riviera',
  '/shore-excursions/cannes/menton-dolceacqua-apricale',
  '/tours/nice/saint-tropez',
  '/transfers/nice-airport-private-jet-acam',

  // Tour not currently offered
  '/tours/cannes/menton-sanremo-dolceacqua',
]);

// ── 410 Gone — prefix matches ──────────────────────────────────────────
//    Catches everything under these prefixes.
const GONE_PREFIX = [
  '/tag/',
  '/category/',
  '/author/',
  '/tour/',
  '/excursion/',
  '/search/',
  '/ru/',
  '/wp-content/',
  '/wp-admin/',
  '/wp-json/',
  '/wp-includes/',
  '/e-floating-buttons/',
];

// ── HTML for 410 response ──────────────────────────────────────────────
const GONE_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Gone — Riviera Journeys</title>
<style>
  body{font-family:Georgia,serif;max-width:560px;margin:120px auto;padding:0 24px;color:#3D3D38;background:#FDFAF6;line-height:1.7}
  h1{font-weight:300;font-size:36px;margin-bottom:16px;color:#1C1C1A}
  a{color:#A86543}
</style></head><body>
<h1>This page is gone.</h1>
<p>The page you are looking for is no longer part of Riviera Journeys. It may have moved, or it may have been a page from an earlier version of the site.</p>
<p>Return to the <a href="/">homepage</a>, or browse <a href="/tours">tours</a>, <a href="/shore-excursions">shore excursions</a>, or <a href="/transfers">transfers</a>.</p>
</body></html>`;

function isGone(pathname) {
  if (GONE_EXACT.has(pathname)) return true;
  for (const prefix of GONE_PREFIX) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── 1 · 410 Gone for legacy / dead URLs ─────────────────────────────
    if (isGone(url.pathname)) {
      const headers = new Headers({
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
        'cache-control': 'public, max-age=86400',
      });
      return new Response(GONE_HTML, { status: 410, headers });
    }

    // ── 2 · Fetch the static asset ──────────────────────────────────────
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    // ── 3 · noindex preview / worker subdomains (TS-001) ────────────────
    if (url.hostname.endsWith('.workers.dev')
     || url.hostname.endsWith('.pages.dev')) {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // ── 4 · Security headers (SEC-001) ──────────────────────────────────
    headers.set('Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy',
                'interest-cohort=(), geolocation=(), camera=(), microphone=()');
    headers.set('X-Frame-Options', 'SAMEORIGIN');

    // ── 5 · Pass non-HTML through untouched ─────────────────────────────
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // ── 6 · Substitute review placeholders (CO-002) ─────────────────────
    const html = await response.text();
    const rewritten = html
      .replaceAll('{{REVIEWS_COUNT}}',  env.REVIEWS_COUNT  ?? '10')
      .replaceAll('{{REVIEWS_RATING}}', env.REVIEWS_RATING ?? '5.0')
      .replaceAll('{{REVIEWS_BEST}}',   env.REVIEWS_BEST   ?? '5');

    return new Response(rewritten, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
