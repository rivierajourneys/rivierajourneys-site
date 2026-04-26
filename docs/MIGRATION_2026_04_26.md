# MIGRATION 2026-04-26 — GH Pages → Cloudflare Worker

**Status:** ✅ Complete
**Production URL:** https://rivierajourneys.fr
**Worker name:** rivierajourneys
**Cloudflare account:** Rivierajourneys@gmail.com (id: e0c27b298447c61e9d0c85572ec92df2)

---

## What changed

The site moved from GitHub Pages to Cloudflare Workers Static Assets in a single
session. DNS authority for `rivierajourneys.fr` was already on Cloudflare
(`dante.ns.cloudflare.com`, `kia.ns.cloudflare.com`); the only remaining cutover
step was replacing 3× A records (185.199.108-111.153 → GitHub Pages) with a
Worker custom-domain binding. The Worker was already deployed and tested at
`rivierajourneys.rivierajourneys.workers.dev` before cutover.

Sprint 0 audit findings closed in this session:

- BLD-001 build pipeline restored
- TS-001 workers.dev preview now `noindex`
- TS-002 preview homepage serves correctly (was serving stale shore-excursion)
- TS-003 trailing-slash 301 handled natively by `wrangler.html_handling`
- SEC-001 5 security headers applied (HSTS, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, X-Frame-Options)
- GSC-410 ~30 legacy WordPress URLs return HTTP 410 Gone (was 200/404)
- LEG-002 Mentions Légales verified at /legal/ with SIREN/SIRET/APE/hosting
- LEAK-001 internal `*.md` and template files verified absent from repo
- CO-002 hardcoded `48 reviews` replaced with placeholders (substitution via
  Worker env vars; schema and visible copy both correct)
- MIGR-001 GH Pages → Cloudflare Worker

---

## Architecture

```
User → Cloudflare DNS (dante/kia.ns.cloudflare.com)
     → Cloudflare edge (CDG/Paris)
     → Worker rivierajourneys (run_worker_first: ["/*"])
        ├─ check GONE_EXACT / GONE_PREFIX → 410 if match
        ├─ env.ASSETS.fetch(request) → static asset from repo
        ├─ if HTML: substitute {{REVIEWS_*}} placeholders
        ├─ add 5 security headers
        ├─ noindex on *.workers.dev
        └─ return Response
```

The Worker is the single source of truth for all production traffic.
GitHub Pages is still configured in repo settings as a passive fallback;
do not disable it without reason.

---

## Files that drive production

```
/_worker.js          — request handler (410, headers, substitution)
/wrangler.jsonc      — config + env vars (REVIEWS_COUNT, REVIEWS_RATING, REVIEWS_BEST)
/.assetsignore       — excludes *.md, templates, _worker.js from public assets
```

Cloudflare auto-deploys on every git push to `main`. Build takes ~30 seconds.

---

## Common operations

### Update review count

Edit `wrangler.jsonc`:

```jsonc
"vars": {
  "REVIEWS_COUNT":  "12",   // change here
  "REVIEWS_RATING": "5.0",
  "REVIEWS_BEST":   "5"
}
```

Commit, push. All 69+ pages reflect new value within ~30 seconds.
Do **not** edit env vars in the Cloudflare dashboard — they will be overwritten
on the next deploy. The source of truth is `wrangler.jsonc` in git.

### Add a new 410 Gone path

Edit `_worker.js`. For an exact path:

```js
const GONE_EXACT = new Set([
  // ...existing entries...
  "/some-old-page",
]);
```

For all paths starting with a prefix:

```js
const GONE_PREFIX = [
  // ...existing entries...
  "/old-section/",
];
```

Commit, push.

### Add a new page

Drop the HTML at the appropriate path under `/`, push. Cloudflare serves it
within 30 seconds. The Worker's substitution and headers apply automatically.

### Roll back a bad deploy

Cloudflare dashboard → Workers & Pages → rivierajourneys → Deployments → click
the last good version → Promote to active. Takes ~5 seconds. No git revert
needed for emergency rollback.

---

## DNS records — current state

| Type | Name | Content | Notes |
|---|---|---|---|
| Worker | rivierajourneys.fr | rivierajourneys (Worker) | Replaces former 3× A records |
| CNAME | www | rivierajourneys.github.io | Legacy; can be re-pointed later |
| CNAME | autodiscover | adsredir.ionos.info | IONOS auto-discover (mail) |
| CNAME | _domainconnect | _domainconnect.ionos.com | IONOS auto-config |
| MX | rivierajourneys.fr | mx00.ionos.fr (10) | Mail — but no mailbox exists yet |
| MX | rivierajourneys.fr | mx01.ionos.fr (10) | See LEG-001 below |
| TXT | _github-pages-c... | (verify token) | Safe to keep |
| TXT | rivierajourneys.fr | google-site-verification=... | Search Console |
| TXT | rivierajourneys.fr | v=spf1 include:_spf-... | Mail SPF |

**Email mailbox `hello@rivierajourneys.fr` does not actually exist.** Mail sent
there bounces. Decision: configure Cloudflare Email Routing in Sprint 1 to
forward `hello@` to `rivierajourneys@gmail.com`.

---

## Don't break these

1. `_worker.js` and `wrangler.jsonc` are coupled. If you rename the binding
   (`ASSETS`), update both files in the same commit.
2. `.assetsignore` must contain `_worker.js` itself, otherwise Cloudflare
   will try to serve it as an asset and the build fails.
3. `run_worker_first: ["/*"]` is required for substitution to run on paths
   where a static HTML file exists. Removing it breaks the review-count
   substitution silently (placeholders remain in HTML).
4. The 4× IONOS NS records inside the zone (`ns1077.ui-dns.biz`, etc.) are
   non-authoritative artifacts — actual authority is `dante` / `kia`
   `.ns.cloudflare.com`. Don't waste time "fixing" them.

---

## Pending issues (deferred to Sprint 1+)

- **LOC-004** Address mismatch: legal page says Spéracèdes 06530, brand says
  Cannes 06400. Reconcile.
- **LEG-004** APE code 4932Z is "taxi", business is VTC. Flag for accountant.
- **CO-007** Email mismatch: copy mentions `hello@rivierajourneys.fr`, mailbox
  doesn't exist. Set up Cloudflare Email Routing.
- **TS-004** Verify `sitemap.xml` and `robots.txt` are correct; submit sitemap
  to Google Search Console.
- **TS-005** ~58 thin stubs are indexable; either flesh them out per the
  keyword research priority order, or `noindex` them until ready.
- **TS-006/007** Schema gaps on stub pages; no global Organization schema.
- **FE-001/002** Typography and palette inconsistency across templates;
  three different "white" values (`--bone`, `--bone2`, `#FFFFFF` literals).
- **FE-005 / LEG-001** Google Fonts hot-link is a GDPR + perf issue;
  self-host Cormorant Garamond, Cormorant SC, Newsreader, and Jost.
- **GEO-001** No `llms.txt` or AI bot policy in `robots.txt`.
- **GEO-002** No Wikidata entity for Riviera Journeys.
- **A11Y-001** No focus indicators; no `prefers-reduced-motion` handling.
- **A11Y-003** `--stone:#8C8880` fails 4.5:1 contrast on bone background.
- **CO-001** Build queue should follow keyword research priorities; current
  queue is ad-hoc.
- **CO-008** `menton-sanremo-dolceacqua` marked 410 in worker but is P1 in
  keyword research. Resolve this conflict before next deploy.
- **CO-009** `nice-airport-private-jet-acam` marked 410 but is P1
  zero-competition gap. Same conflict to resolve.
- **FE-006** `/site.webmanifest` returns 404.
- **LOC-003** Google Business Profile optimization checklist not done.

---

## Locked design decisions still pending (from MASTER_BRIEF §8)

1. CTA color: terra / ink-black / darker terra — undecided
2. Section numbering style: § 01 / 01. / none — undecided
3. Italic on "Riviera Journeys" wordmark — undecided
4. Homepage villa block timing — undecided
5. Journal article length standard — undecided
6. Nav order — undecided
