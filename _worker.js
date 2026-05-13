/**
 * Riviera Journeys — Cloudflare Workers Static Assets handler
 *
 * Path: repo-root/_worker.js
 * Activated by: wrangler.jsonc (main: "_worker.js")
 *
 * Closes from audit register:
 *   TS-001  → noindex header on *.workers.dev preview URLs
 *   TS-003  → 301 redirect /path/ → /path  (now explicit in Worker, see STEP 2)
 *   SEC-001 → standard security headers on every response
 *   CO-002  → review count / rating substitution from env vars
 *   GSC-410 → 410 Gone responses for legacy WordPress URLs
 *   TS-005  → noindex,follow on stub / WIP / thin-content pages
 *   GSC-REDIRECT → www → apex canonicalization handled in Worker so legacy
 *                  URLs on www return direct 410, not 301-then-410 chains
 *                  (which Google's GSC flags as "Redirect error")
 *   GSC-FEED-SUFFIX → WordPress puts /feed/ at the END of paths
 *                     (e.g. /some-post/feed/). prefix-based matching missed
 *                     these. Added GONE_SUFFIX (endsWith) to cover them.
 *
 *   v2 PATCH (2026-05-07) — QA-reviewed before deploy:
 *
 *   CONTENT-001 → /tours/boat/iles-de-lerins and /tours/boat/monaco-by-sea
 *                 are 404 orphans (file slugs differ). Moved from NOINDEX_EXACT
 *                 to GONE_EXACT for direct 410 (permanent-gone signal).
 *                 The actual file slugs /tours/boat/lerins-islands and
 *                 /tours/boat/monaco are added to NOINDEX_EXACT.
 *   CONTENT-002 → wrangler html_handling="drop-trailing-slash" returned
 *                 HTTP 307 — Google treated /path/ as canonical. Now explicit
 *                 301 in STEP 2 below.
 *   REG-001 → v1-of-this-patch introduced 301-then-410 chain for /home/, /tour/
 *             etc. Fixed: STEP 1 now matches GONE_EXACT against both raw and
 *             slash-stripped pathname → /home/ returns 410 directly.
 *   REG-002 → v1 only stripped one trailing slash. Fixed: STEP 2 now uses
 *             /\/+$/ regex to strip ALL trailing slashes → /path// → /path
 *             in single 301, no chain.
 *   NEW-GONE → Added /excursion/, /e-floating-buttons/, /search/ to
 *              GONE_PREFIX (found in GSC NotFound drilldown — old WP plugin
 *              and excursion permalinks).
 *
 *   v3 PATCH (2026-05-08) — cruise schedule auto-refresh:
 *
 *   CRUISE-001 → /villefranche-cruise-schedule rewrites <tbody>, sidebar
 *                stats and last-updated date from SCHEDULES KV (binding in
 *                wrangler.jsonc). KV is filled weekly by a separate cron
 *                Worker (cruise-schedule-fetcher repo). Static fallback in
 *                index.html is preserved if KV is empty/stale (>14 days).
 *                See injectCruiseSchedule() at bottom of file.
 *
 *   v4 PATCH (2026-05-13) — added Cannes:
 *
 *   CRUISE-002 → /cannes-cruise-schedule joins /villefranche-cruise-schedule
 *                using the same injector. KV key for Cannes is "cannes".
 *                Cron worker now refreshes both ports in parallel.
 *
 *   v5 PATCH (2026-05-13) — exact-match 301 redirects:
 *
 *   SITE-001 → /corporate/mipim was in sitemap but the file is named
 *              /corporate/mipim-transfers — Google logged it as 404 for
 *              weeks. Sitemap fixed in separate commit. This patch adds a
 *              new STEP 2 (between GONE and trailing-slash) that handles
 *              an extensible REDIRECTS_EXACT map: old-URL → new-URL with
 *              explicit 301. Future renames go into REDIRECTS_EXACT, not
 *              into ad-hoc if blocks.
 *
 *   KNOWN LIMITATIONS (intentional, not fixes):
 *   - Query strings like /?feed=rss2 are NOT in GONE — pathname doesn't
 *     include search. Existing GONE_PREFIX entries /?p= and /?feed= would
 *     never match. Separate ticket if needed.
 *   - Editorial 404s (/editorial/menton, /editorial/grasse etc.) left as
 *     404 (not 410) since these slugs MIGHT eventually become real pages.
 *     410 would signal "permanently gone" which is wrong for a page that
 *     could be created in the future.
 */

// ──────────────────────────────────────────────────────────────────────────
// 410 Gone — legacy WordPress URLs that should never come back
// ──────────────────────────────────────────────────────────────────────────
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
  // Boat tour orphan slugs — file slugs differ (see CONTENT-001 in NOINDEX_EXACT)
  "/tours/boat/iles-de-lerins",
  "/tours/boat/monaco-by-sea",
]);

// Path STARTS with one of these → 410
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
  // v2 PATCH (2026-05-07) — additions from GSC NotFound drilldown:
  "/excursion/",            // old WP excursion permalinks (6 URLs in 404 list)
  "/e-floating-buttons/",   // WP plugin paths (3 URLs)
  "/search/",               // WP search results (e.g. /search/{term}/feed/rss2/)
];

// Path ENDS with one of these → 410.
// WordPress puts feed / trackback / embed / amp suffixes at the end of paths
// like /post-name/feed/ — these cannot be caught by GONE_PREFIX startsWith.
const GONE_SUFFIX = [
  "/feed/",
  "/feed",
  "/trackback/",
  "/trackback",
  "/embed/",
  "/embed",
  "/amp/",
  "/amp",
];

// ──────────────────────────────────────────────────────────────────────────
// Noindex policy — paths NOT yet ready for organic search
// ──────────────────────────────────────────────────────────────────────────
const NOINDEX_EXACT = new Set([
  // ── Sprint 1 — promoting in May/Jun 2026 ──
  "/about",
  "/book",
  "/slow-travel",
  "/shore-excursions/cannes/provence-wine",
  "/shore-excursions/villefranche/provence-wine",

  // ── Sprint 2 — May/Jun ──
  "/tours/nice/eze-monaco-menton",
  "/tours/nice/cannes-antibes-saint-paul",
  "/tours/nice/grasse-gourdon-tourrettes",
  "/tours/nice/nice-eze-monaco",
  "/tours/nice/nice-cannes-antibes",

  // ── Sprint 3 — Jun/Jul ──
  "/tours/cannes/menton-dolceaqua-apricale",
  "/transfers/nice-airport-private-jet",
  "/transfers/cannes-mandelieu-airport",

  // ── Q3 — Jul-Sep ──
  "/multi-day",

  // ── Q4 — Oct-Dec, off-season ──
  "/tours/off-season/gastronomy",
  "/tours/off-season/snow-and-sea",
  "/tours/off-season/art-architecture",
  "/experiences/off-season",

  // ── Year 2 — boat tours ──
  // CONTENT-001 (2026-05-07): file slugs are /lerins-islands and /monaco
  // (not /iles-de-lerins or /monaco-by-sea — those are now in GONE_EXACT).
  "/tours/boat/lerins-islands",
  "/tours/boat/saint-tropez",
  "/tours/boat/monaco",
]);

const NOINDEX_PREFIX = [
  "/editorial/",
  "/destinations/",
  "/multi-day/france/",
  "/multi-day/italy/",
];

// ──────────────────────────────────────────────────────────────────────────
// Security headers applied to every response
// ──────────────────────────────────────────────────────────────────────────
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "interest-cohort=(), geolocation=(), camera=(), microphone=()",
  "X-Frame-Options": "DENY",
};

const CANONICAL_HOST = "rivierajourneys.fr";

// ──────────────────────────────────────────────────────────────────────────
// Exact-match 301 redirects — old-URL → new-URL.
// v5 PATCH (2026-05-13): added for SITE-001 (/corporate/mipim renamed).
// Place future single-URL renames here, not in ad-hoc if blocks.
// ──────────────────────────────────────────────────────────────────────────
const REDIRECTS_EXACT = {
  "/corporate/mipim": "/corporate/mipim-transfers",
};

// ──────────────────────────────────────────────────────────────────────────
// Cruise schedule auto-refresh
//
// /villefranche-cruise-schedule is a static fallback page with markers:
//   <tbody data-cruise-schedule>...</tbody>      → replaced with fresh rows
//   <span data-last-updated>...</span>           → replaced with fresh date
//   data-stat="calls|ships|lines" inside divs    → replaced with fresh totals
//
// A separate cron Worker (cruise-schedule-fetcher) writes fresh JSON into
// SCHEDULES KV every Sunday under key "villefranche". If KV is empty,
// missing, or older than CRUISE_SCHEDULE_STALE_DAYS, we leave the static
// fallback in place — the page never breaks.
// ──────────────────────────────────────────────────────────────────────────
const CRUISE_SCHEDULE_PATHS = new Set([
  "/villefranche-cruise-schedule",
  "/cannes-cruise-schedule",
]);
const CRUISE_SCHEDULE_STALE_DAYS = 14;

// ──────────────────────────────────────────────────────────────────────────
// Worker entry point
// ──────────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const hostname = url.hostname;
    const search = url.search;

    // ──────────────────────────────────────────────────────────────────
    // STEP 1. 410 Gone — legacy URLs.
    // Done BEFORE any redirect so legacy URLs (with or without trailing slash,
    // on www or apex) return a direct 410, NOT a 301-then-410 chain.
    //
    // REG-001 fix (v2): match GONE_EXACT against BOTH the raw pathname and
    // a slash-stripped variant — so /home/ matches the existing /home entry
    // and returns 410 directly.
    // ──────────────────────────────────────────────────────────────────
    const pathStripped = (pathname.length > 1 && pathname.endsWith("/"))
      ? pathname.replace(/\/+$/, "") || "/"
      : pathname;

    if (
      GONE_EXACT.has(pathname) ||
      GONE_EXACT.has(pathStripped) ||
      GONE_PREFIX.some(p => pathname.startsWith(p)) ||
      GONE_SUFFIX.some(s => pathname.endsWith(s))
    ) {
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

    // ──────────────────────────────────────────────────────────────────
    // STEP 2. Exact-match 301 redirects (v5 PATCH).
    // SITE-001 — /corporate/mipim → /corporate/mipim-transfers and any
    // future single-URL renames in REDIRECTS_EXACT.
    //
    // Done AFTER GONE (so legacy URLs win) and BEFORE trailing-slash
    // (so /corporate/mipim AND /corporate/mipim/ both 301 to the new URL).
    //
    // For pathname /foo/ where /foo is in REDIRECTS_EXACT, we strip the
    // trailing slash first so /foo/ → /foo/new in a single 301 hop, not
    // /foo/ → /foo → /foo/new (chain).
    // ──────────────────────────────────────────────────────────────────
    const pathNoSlash = (pathname.length > 1 && pathname.endsWith("/"))
      ? pathname.replace(/\/+$/, "")
      : pathname;
    if (REDIRECTS_EXACT[pathNoSlash]) {
      const target = `https://${CANONICAL_HOST}${REDIRECTS_EXACT[pathNoSlash]}${search}`;
      return new Response(null, {
        status: 301,
        headers: {
          "Location": target,
          "Cache-Control": "public, max-age=86400",
          ...SECURITY_HEADERS,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────
    // STEP 3. Trailing-slash drop — explicit 301 (not 307).
    // CONTENT-002 fix (v2): wrangler html_handling="drop-trailing-slash"
    // returns HTTP 307 by default. Google treats 307 as "keep original URL
    // canonical" — so /path/ stayed in the index instead of /path.
    // We override: explicit 301 here, BEFORE Static Assets is reached.
    //
    // REG-002 fix (v2): /\/+$/ regex strips ALL trailing slashes in one
    // pass — /path// → /path in single 301, no chain.
    //
    // Bonus: target uses CANONICAL_HOST so this single redirect ALSO does
    // www → apex canonicalization for any path with a trailing slash.
    // (Ordinary www → apex for no-slash paths is still STEP 4.)
    //
    // Root path "/" is preserved (length === 1).
    // ──────────────────────────────────────────────────────────────────
    if (pathname.length > 1 && pathname.endsWith("/")) {
      const cleanPath = pathname.replace(/\/+$/, "") || "/";
      const target = `https://${CANONICAL_HOST}${cleanPath}${search}`;
      return new Response(null, {
        status: 301,
        headers: {
          "Location": target,
          "Cache-Control": "public, max-age=86400",
          ...SECURITY_HEADERS,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────
    // STEP 4. Canonicalization: www.rivierajourneys.fr → apex.
    // (Only fires for no-slash paths; slash paths handled in STEP 3.)
    // ──────────────────────────────────────────────────────────────────
    if (hostname === "www." + CANONICAL_HOST) {
      const target = `https://${CANONICAL_HOST}${pathname}${search}`;
      return new Response(null, {
        status: 301,
        headers: {
          "Location": target,
          "Cache-Control": "public, max-age=3600",
          ...SECURITY_HEADERS,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────
    // STEP 5. Fetch the static asset.
    // ──────────────────────────────────────────────────────────────────
    const response = await env.ASSETS.fetch(request);

    // STEP 6. Build response headers — copy original, layer in our additions.
    const newHeaders = new Headers(response.headers);

    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));

    if (hostname.endsWith(".workers.dev") || hostname.endsWith(".pages.dev")) {
      newHeaders.set("X-Robots-Tag", "noindex, nofollow");
    }
    else if (
      NOINDEX_EXACT.has(pathname) ||
      NOINDEX_PREFIX.some(p => pathname.startsWith(p))
    ) {
      newHeaders.set("X-Robots-Tag", "noindex, follow");
    }

    // STEP 7. If HTML, substitute review placeholders.
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let transformed = await response.text();

      transformed = transformed
        .replaceAll("{{REVIEWS_COUNT}}", env.REVIEWS_COUNT || "0")
        .replaceAll("{{REVIEWS_RATING}}", env.REVIEWS_RATING || "5.0")
        .replaceAll("{{REVIEWS_BEST}}", env.REVIEWS_BEST || "5");

      // Cruise schedule pages — inject fresh data from SCHEDULES KV
      // (binding set in wrangler.jsonc). Falls through silently to the
      // static fallback if KV is unavailable, empty, or stale.
      if (CRUISE_SCHEDULE_PATHS.has(pathname) && env.SCHEDULES) {
        transformed = await injectCruiseSchedule(transformed, pathname, env);
      }

      return new Response(transformed, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // STEP 8. Non-HTML: return as-is with security headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 410 Gone HTML page (minimal, on-brand)
// ──────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────
// Cruise schedule — read from KV and rewrite tbody + sidebar stats + date
// ──────────────────────────────────────────────────────────────────────────
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function injectCruiseSchedule(html, pathname, env) {
  // Map pathname → KV key.
  let key = null;
  if (pathname === "/villefranche-cruise-schedule") key = "villefranche";
  else if (pathname === "/cannes-cruise-schedule") key = "cannes";
  if (!key) return html;

  let payload = null;
  try {
    const raw = await env.SCHEDULES.get(key);
    if (raw) payload = JSON.parse(raw);
  } catch (_) {
    return html;
  }
  if (!payload || !Array.isArray(payload.calls)) return html;

  const ageMs = Date.now() - new Date(payload.lastUpdated).getTime();
  if (ageMs > CRUISE_SCHEDULE_STALE_DAYS * 86400000) return html;

  // Filter to today onward.
  const today = new Date().toISOString().slice(0, 10);
  const future = payload.calls.filter(c => c.date >= today);
  if (future.length === 0) return html;

  // Build the fresh tbody.
  const tbodyInner = buildCruiseTbody(future);

  // Replace tbody content. Marker is unique enough that a non-greedy regex
  // is safe — we only match the cruise schedule one, never the fallback
  // tbody used elsewhere.
  html = html.replace(
    /(<tbody data-cruise-schedule[^>]*>)[\s\S]*?(<\/tbody>)/,
    (_, open, close) => `${open}\n${tbodyInner}\n${close}`
  );

  // Replace sidebar totals.
  const ships = new Set(future.map(c => c.ship));
  const lines = new Set(future.map(c => c.line));
  html = replaceStat(html, "calls", String(future.length));
  html = replaceStat(html, "ships", String(ships.size));
  html = replaceStat(html, "lines", String(lines.size));

  // Replace last-updated date.
  html = html.replace(
    /(<span data-last-updated[^>]*>)[\s\S]*?(<\/span>)/,
    (_, open, close) => `${open}${formatUpdated(payload.lastUpdated)}${close}`
  );

  return html;
}

function replaceStat(html, name, value) {
  // Match: <... data-stat="name">CONTENT</...>  (any tag, any attrs)
  const re = new RegExp(
    `(<[^>]+data-stat=["']${name}["'][^>]*>)[\\s\\S]*?(<\\/[^>]+>)`
  );
  return html.replace(re, (_, open, close) => `${open}${escapeHtml(value)}${close}`);
}

function buildCruiseTbody(calls) {
  // Group by year-month.
  const byMonth = new Map();
  for (const c of calls) {
    const ym = c.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(c);
  }

  const rows = [];
  for (const [ym, monthCalls] of byMonth) {
    const [y, m] = ym.split("-").map(Number);
    const label = `${MONTH_LABELS[m - 1]} ${y}`;
    rows.push(
      `        <tr class="month-header" onclick="toggleMonth(this)">` +
      `<td colspan="5"><span class="mh-name">${escapeHtml(label)}</span> ` +
      `<span class="mh-count">${monthCalls.length} ship${monthCalls.length === 1 ? "" : "s"}</span>` +
      `<span class="mh-arrow">&#9662;</span></td></tr>`
    );
    for (const c of monthCalls) {
      const day = parseInt(c.date.slice(8, 10), 10);
      const monthShort = MONTH_LABELS[m - 1].slice(0, 3);
      rows.push(
        `        <tr class="month-row">` +
        `<td class="td-date">${day} ${monthShort}</td>` +
        `<td class="td-ship">${escapeHtml(c.ship)}</td>` +
        `<td class="td-line">${escapeHtml(c.line)}</td>` +
        `<td class="td-time">${c.arrival ? escapeHtml(c.arrival) : "&mdash;"}</td>` +
        `<td class="td-time td-time-r">${c.departure ? escapeHtml(c.departure) : "&mdash;"}</td>` +
        `</tr>`
      );
    }
  }
  return rows.join("\n");
}

function formatUpdated(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
