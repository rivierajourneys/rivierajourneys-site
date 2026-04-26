# MIGRATION 2026-04-26 — GH Pages → Cloudflare Worker

**Status:** ✅ Complete (Sprint 0 + initial sitemap policy)
**Production URL:** https://rivierajourneys.fr
**Worker name:** rivierajourneys
**Cloudflare account:** Rivierajourneys@gmail.com (id: e0c27b298447c61e9d0c85572ec92df2)

---

## What changed

The site moved from GitHub Pages to Cloudflare Workers Static Assets in a single
session on 26 April 2026. DNS authority for `rivierajourneys.fr` was already on
Cloudflare (`dante.ns.cloudflare.com`, `kia.ns.cloudflare.com`); the only
remaining cutover step was replacing 3× A records (185.199.108-111.153 → GitHub
Pages) with a Worker custom-domain binding. The Worker was deployed and tested
at `rivierajourneys.rivierajourneys.workers.dev` before cutover.

Sprint 0 audit findings closed:

- BLD-001 build pipeline restored
- TS-001 workers.dev preview now `noindex, nofollow`
- TS-002 preview homepage serves correctly (was serving stale shore-excursion)
- TS-003 trailing-slash 301 handled natively by `wrangler.html_handling`
- SEC-001 5 security headers applied (HSTS, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, X-Frame-Options)
- GSC-410 ~30 legacy WordPress URLs return HTTP 410 Gone (was 200/404)
- LEG-002 Mentions Légales verified at /legal/ with SIREN/SIRET/APE/hosting
- LEAK-001 internal `*.md` and template files verified absent from public assets
- CO-002 hardcoded `48 reviews` replaced with placeholders, substitution via
  Worker env vars (schema and visible copy both correct on production)
- MIGR-001 GH Pages → Cloudflare Worker
- TS-005 (initial pass) noindex,follow applied to all stub / WIP pages via
  Worker; production sitemap.xml lists only 29 v6-quality URLs

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
        ├─ add X-Robots-Tag noindex,follow if path is in
        │   NOINDEX_EXACT or matches NOINDEX_PREFIX
        ├─ noindex,nofollow on *.workers.dev
        └─ return Response
```

The Worker is the single source of truth for all production traffic.
GitHub Pages is still configured in repo settings as a passive fallback;
do not disable it without reason.

---

## Files that drive production

```
/_worker.js          — request handler (410, headers, substitution, noindex)
/wrangler.jsonc      — config + env vars (REVIEWS_COUNT, REVIEWS_RATING, REVIEWS_BEST)
/sitemap.xml         — 29 indexed URLs only; rolling promotion
/.assetsignore       — excludes *.md, templates, _worker.js from public assets
/docs/SITEMAP_ROADMAP.md — promotion timeline
```

Cloudflare auto-deploys on every git push to `main`. Build takes ~30 seconds.

---

## Sitemap and noindex — rolling policy

**The sitemap and the Worker noindex list are coupled.** Promotion of a page
to organic search means TWO edits in the SAME commit:

1. Remove the URL from `NOINDEX_EXACT` (or its prefix from `NOINDEX_PREFIX`)
   in `_worker.js`.
2. Add a `<url>` entry to `sitemap.xml`.

This guarantees the two views of the site stay consistent: nothing in sitemap
that's also blocked, nothing fully indexed without being declared in sitemap.

See `/docs/SITEMAP_ROADMAP.md` for the full timeline of what gets promoted when.

The principle is **quality first, slower OK**. We add only production-grade
v6 pages to sitemap. Stubs, work-in-progress, and intentionally deferred
pages live behind `noindex, follow` until the page is genuinely ready.

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

Commit, push. All indexed pages reflect new value within ~30 seconds.
Do **not** edit env vars in the Cloudflare dashboard — they will be overwritten
on the next deploy. The source of truth is `wrangler.jsonc` in git.

### Promote a page from noindex to indexed

See `/docs/SITEMAP_ROADMAP.md` § "Promotion procedure".

### Add a new 410 Gone path

Edit `_worker.js`. For an exact path, append to `GONE_EXACT`. For all paths
starting with a prefix, append to `GONE_PREFIX`. Commit, push.

### Add a new page (still WIP)

Drop the HTML at the appropriate path under `/`, push. Cloudflare serves it
within 30 seconds. By default it returns `200 OK`, but if the path is in
`NOINDEX_EXACT` or matches `NOINDEX_PREFIX`, it gets `X-Robots-Tag: noindex,
follow` and stays out of Google's index until promoted.

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
| MX | rivierajourneys.fr | mx01.ionos.fr (10) | See CO-007 below |
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
3. `run_worker_first: ["/*"]` is required for substitution and noindex headers
   to apply on paths where a static HTML file exists. Removing it silently
   breaks both — placeholders remain in HTML, stubs become indexable.
4. The 4× IONOS NS records inside the zone (`ns1077.ui-dns.biz`, etc.) are
   non-authoritative artifacts — actual authority is `dante` / `kia`
   `.ns.cloudflare.com`. Don't waste time "fixing" them.
5. **Never add a URL to sitemap.xml without also removing it from
   `NOINDEX_EXACT` / `NOINDEX_PREFIX` in `_worker.js`.** Sitemap+noindex
   conflict is a Search Console error and signals quality issues to Google.

---

## Pending issues (deferred to Sprint 1+)

- **LOC-004** Address mismatch: legal page says Spéracèdes 06530, brand says
  Cannes 06400. Reconcile.
- **LEG-004** APE code 4932Z is "taxi", business is VTC. Flag for accountant.
- **CO-007** Email mismatch: copy mentions `hello@rivierajourneys.fr`, mailbox
  doesn't exist. Set up Cloudflare Email Routing.
- **TS-006/007** Schema gaps on stub pages; no global Organization schema.
- **FE-001/002** Typography and palette inconsistency across templates;
  three different "white" values (`--bone`, `--bone2`, `#FFFFFF` literals).
- **FE-005 / LEG-001** Google Fonts hot-link is a GDPR + perf issue;
  self-host Cormorant Garamond, Cormorant SC, Newsreader, and Jost.
- **GEO-002** No Wikidata entity for Riviera Journeys.
- **A11Y-001** No focus indicators; no `prefers-reduced-motion` handling.
- **A11Y-003** `--stone:#8C8880` fails 4.5:1 contrast on bone background.
- **FE-006** `/site.webmanifest` returns 404.
- **LOC-003** Google Business Profile optimization checklist not done.

GEO-001 partially closed: Cloudflare manages robots.txt with AI bot policy
(blocks Bytespider, GPTBot, ClaudeBot, Google-Extended, etc.) and includes
Sitemap reference. Custom llms.txt still TBD if we want stronger AEO control.

---

## Locked design decisions still pending (from MASTER_BRIEF §8)

1. CTA color: terra / ink-black / darker terra — undecided
2. Section numbering style: § 01 / 01. / none — undecided
3. Italic on "Riviera Journeys" wordmark — undecided
4. Homepage villa block timing — undecided
5. Journal article length standard — undecided
6. Nav order — undecided
