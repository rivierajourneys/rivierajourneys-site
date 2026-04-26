/**
 * Riviera Journeys — Cloudflare Workers Static Assets entry
 *
 * Path: repo-root/_worker.js
 * Activated by: wrangler.jsonc with `main: "_worker.js"` + .assetsignore
 *
 * Closes from audit register:
 *   TS-001  → noindex header on *.workers.dev preview URLs
 *   SEC-001 → standard security headers on every response
 *   CO-002  → review count / rating substitution from env vars
 *
 * (TS-003 trailing slash is handled natively by wrangler.jsonc
 *  via "html_handling": "drop-trailing-slash" — no JS needed.)
 *
 * To update review count without code changes:
 *   Cloudflare dashboard → Workers & Pages → rivierajourneys
 *     → Settings → Variables and Secrets
 *     → Add Production variables (after first successful deploy with this Worker):
 *         REVIEWS_COUNT  = 10
 *         REVIEWS_RATING = 5.0
 *         REVIEWS_BEST   = 5
 *     → Deploy → all 69 pages reflect new value within ~10 seconds.
 *
 * Note: env-vars cannot be added while Worker is in static-only mode.
 *       After this file deploys successfully, the dashboard will allow it.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Fetch the static asset Cloudflare would normally serve
    const response = await env.ASSETS.fetch(request);

    // Clone headers so we can mutate
    const headers = new Headers(response.headers);

    // ── Block indexing on preview / worker subdomains (TS-001) ──
    if (url.hostname.endsWith('.workers.dev')
     || url.hostname.endsWith('.pages.dev')) {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // ── Security headers (SEC-001) ──────────────────────────────
    headers.set('Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy',
                'interest-cohort=(), geolocation=(), camera=(), microphone=()');
    headers.set('X-Frame-Options', 'SAMEORIGIN');

    // ── Pass through non-HTML untouched ─────────────────────────
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // ── Substitute review placeholders (CO-002) ─────────────────
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
