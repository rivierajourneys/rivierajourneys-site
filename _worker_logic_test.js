// Logic simulator for v2 _worker.js — tests all critical paths
// without needing an actual Cloudflare deploy.

// Mirror the data structures from the patched _worker.js
const GONE_EXACT = new Set([
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
  "/tour",
  "/home",
  "/ru",
  "/editorial/getting-around-the-riviera",
  "/shore-excursions/cannes/menton-dolceacqua-apricale",
  "/tours/nice/saint-tropez",
  "/tours/cannes/menton-sanremo-dolceacqua",
  "/tours/boat/iles-de-lerins",
  "/tours/boat/monaco-by-sea",
]);

const GONE_PREFIX = [
  "/wp-admin/", "/wp-content/", "/wp-includes/", "/wp-json/",
  "/?p=", "/tag/", "/category/", "/author/", "/feed/",
  "/comments/", "/trackback/",
  "/excursion/", "/e-floating-buttons/", "/search/",
];

const GONE_SUFFIX = [
  "/feed/", "/feed", "/trackback/", "/trackback",
  "/embed/", "/embed", "/amp/", "/amp",
];

const NOINDEX_EXACT = new Set([
  "/about", "/book", "/slow-travel",
  "/tours/boat/lerins-islands",
  "/tours/boat/saint-tropez",
  "/tours/boat/monaco",
]);

const NOINDEX_PREFIX = ["/editorial/", "/destinations/", "/multi-day/france/", "/multi-day/italy/"];
const CANONICAL_HOST = "rivierajourneys.fr";

function processRequest(host, pathname, search = "") {
  // STEP 1: GONE check (with REG-001 fix)
  const pathStripped = (pathname.length > 1 && pathname.endsWith("/"))
    ? pathname.replace(/\/+$/, "") || "/"
    : pathname;

  if (
    GONE_EXACT.has(pathname) ||
    GONE_EXACT.has(pathStripped) ||
    GONE_PREFIX.some(p => pathname.startsWith(p)) ||
    GONE_SUFFIX.some(s => pathname.endsWith(s))
  ) {
    return { status: 410, location: null, xRobots: "noindex" };
  }

  // STEP 2: Trailing slash → 301 (CONTENT-002 + REG-002)
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const cleanPath = pathname.replace(/\/+$/, "") || "/";
    return { status: 301, location: `https://${CANONICAL_HOST}${cleanPath}${search}`, xRobots: null };
  }

  // STEP 3: www → apex
  if (host === "www." + CANONICAL_HOST) {
    return { status: 301, location: `https://${CANONICAL_HOST}${pathname}${search}`, xRobots: null };
  }

  // STEP 4: Asset fetch — assume 200 (or 404 if file doesn't exist)
  // STEP 5: Apply NOINDEX
  let xRobots = null;
  if (host.endsWith(".workers.dev") || host.endsWith(".pages.dev")) {
    xRobots = "noindex, nofollow";
  } else if (
    NOINDEX_EXACT.has(pathname) ||
    NOINDEX_PREFIX.some(p => pathname.startsWith(p))
  ) {
    xRobots = "noindex, follow";
  }

  return { status: 200, location: null, xRobots };
}

// =======================================================================
// TEST CASES — covers regressions, new content, and existing functionality
// =======================================================================

const tests = [
  // ── CONTENT-002 — trailing-slash redirects (was 307, must be 301) ──
  ["[CONTENT-002] /transfers/nice-airport-cannes/ from apex",
    "rivierajourneys.fr", "/transfers/nice-airport-cannes/",
    { status: 301, location: "https://rivierajourneys.fr/transfers/nice-airport-cannes" }],
  ["[CONTENT-002] /villefranche-cruise-schedule/ from apex",
    "rivierajourneys.fr", "/villefranche-cruise-schedule/",
    { status: 301, location: "https://rivierajourneys.fr/villefranche-cruise-schedule" }],
  ["[CONTENT-002] /about/ from apex (NOINDEX path with slash)",
    "rivierajourneys.fr", "/about/",
    { status: 301, location: "https://rivierajourneys.fr/about" }],

  // ── CONTENT-001 — boat tour NOINDEX with correct slugs ──
  ["[CONTENT-001] /tours/boat/lerins-islands → noindex,follow",
    "rivierajourneys.fr", "/tours/boat/lerins-islands",
    { status: 200, xRobots: "noindex, follow" }],
  ["[CONTENT-001] /tours/boat/monaco → noindex,follow",
    "rivierajourneys.fr", "/tours/boat/monaco",
    { status: 200, xRobots: "noindex, follow" }],

  // ── REG-001 — slash-stripped GONE_EXACT match (DIRECT 410, no chain) ──
  ["[REG-001] /home/ → direct 410 (was: 301→410 chain)",
    "rivierajourneys.fr", "/home/", { status: 410 }],
  ["[REG-001] /tour/ → direct 410",
    "rivierajourneys.fr", "/tour/", { status: 410 }],
  ["[REG-001] /ru/ → direct 410",
    "rivierajourneys.fr", "/ru/", { status: 410 }],
  ["[REG-001] /jean-paul/ → direct 410",
    "rivierajourneys.fr", "/jean-paul/", { status: 410 }],
  ["[REG-001] /private-day-tours-french-riviera/ → direct 410",
    "rivierajourneys.fr", "/private-day-tours-french-riviera/", { status: 410 }],

  // ── REG-002 — multi-trailing-slash one-pass redirect ──
  ["[REG-002] /path// → single 301 to /path",
    "rivierajourneys.fr", "/path//",
    { status: 301, location: "https://rivierajourneys.fr/path" }],
  ["[REG-002] /path/// → single 301 to /path",
    "rivierajourneys.fr", "/path///",
    { status: 301, location: "https://rivierajourneys.fr/path" }],

  // ── NEW-GONE — new prefix entries from drilldown ──
  ["[NEW-GONE] /excursion/some-old-post/ → 410",
    "rivierajourneys.fr", "/excursion/three-chateaux/", { status: 410 }],
  ["[NEW-GONE] /e-floating-buttons/wabutton/ → 410",
    "rivierajourneys.fr", "/e-floating-buttons/wabutton/", { status: 410 }],
  ["[NEW-GONE] /search/anything/ → 410",
    "rivierajourneys.fr", "/search/foo/feed/rss2/", { status: 410 }],

  // ── CONTENT-001 orphan slugs now 410 not 404 ──
  ["[CONTENT-001b] /tours/boat/iles-de-lerins → 410 (was 404)",
    "rivierajourneys.fr", "/tours/boat/iles-de-lerins", { status: 410 }],
  ["[CONTENT-001b] /tours/boat/monaco-by-sea → 410 (was 404)",
    "rivierajourneys.fr", "/tours/boat/monaco-by-sea", { status: 410 }],

  // ── Sanity — root and basic operations ──
  ["[SANITY] / from apex → 200",
    "rivierajourneys.fr", "/", { status: 200 }],
  ["[SANITY] /transfers/nice-airport-cannes (no slash) → 200",
    "rivierajourneys.fr", "/transfers/nice-airport-cannes", { status: 200 }],
  ["[SANITY] /villefranche-cruise-schedule (no slash) → 200",
    "rivierajourneys.fr", "/villefranche-cruise-schedule", { status: 200 }],
  ["[SANITY] /about (no slash, in NOINDEX_EXACT) → 200 noindex",
    "rivierajourneys.fr", "/about",
    { status: 200, xRobots: "noindex, follow" }],

  // ── www → apex canonicalization ──
  ["[WWW] www.rivierajourneys.fr/ → 301 to apex",
    "www.rivierajourneys.fr", "/",
    { status: 301, location: "https://rivierajourneys.fr/" }],
  ["[WWW] www.rivierajourneys.fr/path → 301 to apex",
    "www.rivierajourneys.fr", "/path",
    { status: 301, location: "https://rivierajourneys.fr/path" }],
  ["[WWW] www.rivierajourneys.fr/path/ → 301 to apex no-slash (single hop!)",
    "www.rivierajourneys.fr", "/path/",
    { status: 301, location: "https://rivierajourneys.fr/path" }],
  ["[WWW+GONE] www.rivierajourneys.fr/wp-admin/ → DIRECT 410 no chain",
    "www.rivierajourneys.fr", "/wp-admin/", { status: 410 }],
  ["[WWW+GONE+SLASH] www.rivierajourneys.fr/home/ → DIRECT 410 no chain",
    "www.rivierajourneys.fr", "/home/", { status: 410 }],

  // ── Existing GONE behavior preserved ──
  ["[GONE] /wp-admin/login.php → 410",
    "rivierajourneys.fr", "/wp-admin/login.php", { status: 410 }],
  ["[GONE] /feed/ → 410 (prefix)",
    "rivierajourneys.fr", "/feed/", { status: 410 }],
  ["[GONE] /some-post/feed/ → 410 (suffix)",
    "rivierajourneys.fr", "/some-post/feed/", { status: 410 }],
  ["[GONE] /tag/cannes/ → 410 (prefix)",
    "rivierajourneys.fr", "/tag/cannes/", { status: 410 }],

  // ── Query string preservation ──
  ["[QUERY] /book/?service=transfer-nice-cannes → 301 preserves query",
    "rivierajourneys.fr", "/book/", "?service=transfer-nice-cannes",
    { status: 301, location: "https://rivierajourneys.fr/book?service=transfer-nice-cannes" }],

  // ── Preview deploy noindex ──
  ["[PREVIEW] *.workers.dev → noindex,nofollow",
    "rivierajourneys.rivierajourneys.workers.dev", "/",
    { status: 200, xRobots: "noindex, nofollow" }],
];

let passed = 0, failed = 0;
const failures = [];

for (const test of tests) {
  const [name, host, pathname, ...rest] = test;
  let search = "", expected;
  if (rest.length === 2) { [search, expected] = rest; } 
  else { expected = rest[0]; }
  
  const result = processRequest(host, pathname, search);
  
  let ok = true;
  let why = [];
  if (result.status !== expected.status) {
    ok = false;
    why.push(`status: got ${result.status}, expected ${expected.status}`);
  }
  if ('location' in expected && result.location !== expected.location) {
    ok = false;
    why.push(`location: got "${result.location}", expected "${expected.location}"`);
  }
  if ('xRobots' in expected && result.xRobots !== expected.xRobots) {
    ok = false;
    why.push(`xRobots: got "${result.xRobots}", expected "${expected.xRobots}"`);
  }
  
  if (ok) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name}`);
    why.forEach(w => console.log(`    ${w}`));
    failures.push(name);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
