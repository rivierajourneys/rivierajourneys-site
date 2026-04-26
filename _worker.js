/**
 * Riviera Journeys — Cloudflare Pages Advanced Mode Worker
 *
 * Place this file at the REPOSITORY ROOT (next to index.html).
 * On the next git push, Cloudflare Pages automatically detects it
 * and routes all requests through this Worker before serving static files.
 *
 * No wrangler.toml needed. No build command needed.
 *
 * What this closes from the audit register:
 *   TS-001  → noindex header on *.workers.dev / *.pages.dev preview URLs
 *   TS-003  → 301 redirect /path/  → /path  (canonical normalization)
 *   SEC-001 → standard security headers on every response
 *   CO-002  → review count / rating substitution from environment variables
 *
 * Update review count without pushing code:
 *   Cloudflare dashboard → Workers & Pages → Riviera Journeys project
 *     → Settings → Variables and Secrets
 *     → Add:
 *         REVIEWS_COUNT  = 10
 *         REVIEWS_RATING = 5.0
 *         REVIEWS_BEST   = 5
 *     → Save → wait ~10 seconds → all 69 pages show new value.
 *
 * To run locally: not required. Pages handles everything.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── 1 · Canonical normalization ──────────────────────────────
    //    Strip trailing slash from any path except "/" itself.
    //    Sends 301 so Google consolidates duplicate URLs.
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
      return Response.redirect(url.toString(), 301);
    }

    // ── 2 · Fetch the static asset Pages would normally serve ───
    const response = await env.ASSETS.fetch(request);

    // Clone headers so we can mutate
    const headers = new Headers(response.headers);

    // ── 3 · Block indexing on preview / worker subdomains ───────
    //    Anything not on the canonical rivierajourneys.fr domain
    //    gets noindex. Stops orphan workers.dev / pages.dev URLs
    //    from polluting Google's index and competing with production.
    const isPreview = url.hostname.endsWith('.workers.dev')
                   || url.hostname.endsWith('.pages.dev');
    if (isPreview) {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // ── 4 · Security headers (SEC-001) ──────────────────────────
    headers.set('Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy',
                'interest-cohort=(), geolocation=(), camera=(), microphone=()');
    headers.set('X-Frame-Options', 'SAMEORIGIN');

    // ── 5 · Only rewrite HTML responses ─────────────────────────
    //    AVIF, CSS, JS, fonts pass through untouched.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // ── 6 · Read HTML and substitute placeholders ───────────────
    //    Defaults (?? '10') are fallbacks if env vars not set yet.
    //    Set actual values in CF dashboard env vars (see header comment).
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
