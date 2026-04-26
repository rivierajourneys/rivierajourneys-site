/**
 * Riviera Journeys — Cloudflare Workers Static Assets handler
 *
 * Path: repo-root/_worker.js
 * Activated by: wrangler.jsonc (main: "_worker.js")
 *
 * Closes from audit register:
 *   TS-001  → noindex header on *.workers.dev preview URLs
 *   TS-003  → 301 redirect /path/ → /path  (via wrangler html_handling)
 *   SEC-001 → standard security headers on every response
 *   CO-002  → review count / rating substitution from env vars
 *   GSC-410 → 410 Gone responses for legacy WordPress URLs
 *   TS-005  → noindex,follow on stub / WIP / thin-content pages
 *
 * Sitemap-noindex policy (rolling):
 *   - The sitemap.xml lists only production-quality v6 pages.
 *   - Everything in NOINDEX_EXACT or NOINDEX_PREFIX gets
 *     X-Robots-Tag: noindex, follow until the page is promoted.
 *   - Promotion = remove from this list + add to sitemap.xml in the
 *     SAME commit. See /docs/SITEMAP_ROADMAP.md for schedule.
 *
 * To update reviews values without code changes:
 *   Edit wrangler.jsonc → "vars" block → commit → push.
 *   The Cloudflare dashboard variables get overwritten on each deploy;
 *   wrangler.jsonc is the source of truth.
 */

// ─────────────────────────────────────────────────────────────
// 410 Gone — legacy WordPress URLs that should never come back
// ─────────────────────────────────────────────────────────────
const GONE_EXACT = new Set([
  // Old WordPress landing pages
  "/french-riviera-cruise-stop-tours",
  "/french-riviera-day-tours",
  "/french-riviera-private-transfers",
  "/private-day-tours-french-riviera",
  "/private-french-riviera-shore-excursions",
  "/cruise-stop-day-tours-from-cannes-villefranche",
  "/what-is-the-riviera-really-about",
  "/a-clearer-state-of-mind",
  "/where-energy-returns-quietly",
  "/jean-paul",
  // Old WordPress index pages
  "/tour",
  "/home",
  "/ru",
  // Ghost URLs from dead internal links
  "/editorial/getting-around-the-riviera",
  "/shore-excursions/cannes/menton-dolceacqua-apricale",
  "/tours/nice/saint-tropez",
  // Tours / routes intentionally retired
  "/tours/cannes/menton-sanremo-dolceacqua",
]);

const GONE_PREFIX = [
  "/wp-admin/",
  "/wp-content/",
  "/wp-includes/",
  "/wp-json/",
  "/?p=",
  "/tag/",
  "/category/",
  "/author/",
  "/feed/",
  "/comments/",
  "/trackback/",
];

// ─────────────────────────────────────────────────────────────
// Noindex policy — paths NOT yet ready for organic search
// ─────────────────────────────────────────────────────────────
//
// Exact path matches (path equals one of these strings).
// When promoting a page, remove it here AND add to sitemap.xml.
const NOINDEX_EXACT = new Set([
  // ── Sprint 1 — promoting in May/Jun 2026 ──
  "/about",                     // André writing this week
  "/book",                      // expanding to v6 spec, ~1-2 weeks
  "/slow-travel",               // ~4 weeks
  // Provence wine pages (~3 weeks)
  "/shore-excursions/cannes/provence-wine",
  "/shore-excursions/villefranche/provence-wine",

  // ── Sprint 2 — May/Jun ──
  "/tours/nice/eze-monaco-menton",
  "/tours/nice/cannes-antibes-saint-paul",
  "/tours/nice/grasse-gourdon-tourrettes",
  "/tours/nice/nice-eze-monaco",
  "/tours/nice/nice-cannes-antibes",

  // ── Sprint 3 — Jun/Jul ──
  "/tours/cannes/menton-dolceacqua-apricale",     // new URL, replaces old menton-sanremo
  "/transfers/nice-airport-private-jet",          // new URL
  "/transfers/cannes-mandelieu-airport",          // new URL

  // ── Q3 — Jul-Sep ──
  "/multi-day",                                   // single hub page replacing 6 stubs

  // ── Q4 — Oct-Dec, off-season ──
  "/tours/off-season/gastronomy",
  "/tours/off-season/snow-and-sea",
  "/tours/off-season/art-architecture",
  "/experiences/off-season",

  // ── Year 2 — boat tours, partner negotiations needed ──
  "/tours/boat/iles-de-lerins",
  "/tours/boat/saint-tropez",
  "/tours/boat/monaco-by-sea",
]);

// Prefix matches (path starts with one of these strings).
// Anything under these directories is noindex until individually
// promoted by being added to sitemap and removed from this list.
const NOINDEX_PREFIX = [
  "/editorial/",            // 16 stubs, content begins after commercial section complete
  "/destinations/",         // 5 stubs, Year 2 (built from accumulated editorial)
  "/multi-day/france/",     // stubs, replaced by single /multi-day hub
  "/multi-day/italy/",      // stubs (incl cinque-terre-florence which is not built yet)
];

// ─────────────────────────────────────────────────────────────
// Security headers applied to every response
// ─────────────────────────────────────────────────────────────
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "interest-cohort=(), geolocation=(), camera=(), microphone=()",
  "X-Frame-Options": "DENY",
};

// ─────────────────────────────────────────────────────────────
// Worker entry point
// ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const hostname = url.hostname;

    // 1. Security: block legacy paths with HTTP 410 Gone
    if (GONE_EXACT.has(pathname) || GONE_PREFIX.some(p => pathname.startsWith(p))) {
      return new Response(buildGonePage(pathname), {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Robots-Tag": "noindex",
          ...SECURITY_HEADERS,
        },
      });
    }

    // 2. Fetch the static asset
    const response = await env.ASSETS.fetch(request);

    // 3. Build response headers — copy original, layer in our additions
    const newHeaders = new Headers(response.headers);

    // Apply security headers
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));

    // Force noindex on workers.dev preview URLs (TS-001)
    if (hostname.endsWith(".workers.dev") || hostname.endsWith(".pages.dev")) {
      newHeaders.set("X-Robots-Tag", "noindex, nofollow");
    }
    // Apply noindex policy on production for stub / WIP pages (TS-005)
    else if (
      NOINDEX_EXACT.has(pathname) ||
      NOINDEX_PREFIX.some(p => pathname.startsWith(p))
    ) {
      newHeaders.set("X-Robots-Tag", "noindex, follow");
    }

    // 4. If HTML, substitute review placeholders from env vars (CO-002)
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const text = await response.text();
      const transformed = text
        .replaceAll("{{REVIEWS_COUNT}}", env.REVIEWS_COUNT || "0")
        .replaceAll("{{REVIEWS_RATING}}", env.REVIEWS_RATING || "5.0")
        .replaceAll("{{REVIEWS_BEST}}", env.REVIEWS_BEST || "5");

      return new Response(transformed, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // 5. Non-HTML: return as-is with security headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

// ─────────────────────────────────────────────────────────────
// 410 Gone HTML page (minimal, on-brand)
// ─────────────────────────────────────────────────────────────
function buildGonePage(pathname) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Gone — Riviera Journeys</title>
<style>
  body {
    font-family: 'Cormorant Garamond', Georgia, serif;
    background: #FDFAF6;
    color: #3D3D38;
    margin: 0;
    padding: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wrap {
    max-width: 560px;
    padding: 48px 32px;
    text-align: center;
  }
  .label {
    font-family: 'Jost', sans-serif;
    font-size: 9px;
    font-weight: 300;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: #C4AA82;
    margin-bottom: 24px;
  }
  h1 {
    font-weight: 300;
    font-size: 48px;
    line-height: 1.2;
    margin: 0 0 24px;
    color: #1C1C1A;
  }
  p {
    font-family: 'Jost', sans-serif;
    font-size: 15px;
    font-weight: 300;
    line-height: 1.7;
    color: #8C8880;
    margin: 0 0 32px;
  }
  a {
    font-family: 'Jost', sans-serif;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #A86543;
    text-decoration: none;
    border-bottom: .5px solid #A86543;
    padding-bottom: 4px;
  }
  a:hover { opacity: .7; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="label">410 — Gone</div>
    <h1>This page no longer exists.</h1>
    <p>The address <code>${escapeHtml(pathname)}</code> belonged to an earlier version of this site and is permanently retired.</p>
    <a href="/">Return to Riviera Journeys</a>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
