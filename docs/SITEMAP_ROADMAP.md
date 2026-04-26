# SITEMAP ROADMAP

**Policy:** Sitemap and noindex are coupled. Promoting a page = removing it from
`NOINDEX_EXACT` (or `NOINDEX_PREFIX`) in `_worker.js` AND adding the URL to
`/sitemap.xml`. Both edits in the **same commit**. This keeps the two views of
the site (what Google sees, what we declare ready) consistent.

The principle is **quality first, slower OK**. We build a small, strong organic
footprint rather than a wide, thin one. Site quality score on a young domain is
fragile; thin pages discount the whole domain, including the good ones.

---

## Status — 2026-04-26

**In sitemap (29 URLs):** homepage, legal, 3× /tours/cannes/*, 6× shore
excursions (3 from Cannes, 3 from Villefranche), 13× /transfers/*,
3× /corporate/*, 2× cruise schedules.

**Noindex via Worker:** everything else in the repo.

---

## Timeline

| ETA | URL(s) | Notes |
|---|---|---|
| **+1 week** (≈ 03 May) | `/about` | André writing this week. Schema: AboutPage + Person + Organization. Trust signal for whole domain. |
| **+1-2 weeks** (≈ 10 May) | `/book` | Expand from 4 forms to v6 spec: lead paragraph, "what happens next", FAQ schema, trust elements. ~600-800 words wrapping the existing forms. |
| **+3 weeks** (≈ 17 May) | `/shore-excursions/cannes/provence-wine` `/shore-excursions/villefranche/provence-wine` | Last 2 shore excursion routes to complete the cluster. |
| **+4 weeks** (≈ 24 May) | `/slow-travel` | André deciding scope. Likely a hybrid of consulting offer + short manifesto. |
| **+5 weeks** (≈ 31 May) | `/tours/nice/eze-monaco-menton` `/tours/nice/cannes-antibes-saint-paul` `/tours/nice/grasse-gourdon-tourrettes` | Three tours from Nice. Routes parallel /tours/cannes but pickup and first 30 min change. Photos must be unique to avoid duplicate-image flagging. |
| **+6-8 weeks** (≈ Jun) | `/tours/cannes/menton-dolceacqua-apricale` | Replaces retired menton-sanremo-dolceacqua. Photos require trip to Apricale to shoot. Zero-competition keyword cluster. |
| **+6-8 weeks** (≈ Jun) | `/transfers/nice-airport-private-jet` `/transfers/cannes-mandelieu-airport` | High AOV niche, low search volume but strong conversion. Photos at Sky Valet (NCE T3) and ACAM (CEQ). |
| **Q3** (Jul-Sep) | `/multi-day` | Single hub page with one flagship itinerary (7-10 days Côte d'Azur) + general "we also build custom journeys through Provence/Italy/Liguria" + map + FAQ. Replaces 6 empty stubs. |
| **Q3-Q4** (Jul-Dec) | `/editorial/[slug]` × ~6-10 | Begins after commercial section is fully built out. Each post links to at least one commercial page it supports. Promote individually as published. |
| **Q4** (Oct-Dec) | `/tours/off-season/gastronomy` `/tours/off-season/snow-and-sea` `/tours/off-season/art-architecture` `/experiences/off-season` | Winter season. Photos require winter conditions (truffles, snow on Mercantour). |
| **Year 2** (2027+) | `/destinations/*` × 5 `/tours/boat/*` × 3 `/multi-day/[slug]` × ~5 More /editorial/* | Destinations are hubs built FROM accumulated editorial; need editorial first. Boat tours require partner negotiations. Additional multi-day routes added as Andre writes them. |

---

## Promotion procedure (when a page becomes ready)

1. Open `_worker.js`.
2. Remove the URL from `NOINDEX_EXACT` (or remove the prefix from
   `NOINDEX_PREFIX` if promoting a whole section).
3. Open `sitemap.xml`.
4. Add a new `<url>` entry. Use lastmod = today, sensible changefreq
   and priority (see existing entries for patterns).
5. Commit message: `feat(sitemap): promote /path/to/page to indexed`
6. Push. Cloudflare rebuilds in ~30 seconds.
7. Verify: `curl -I https://rivierajourneys.fr/path` should NOT have
   `x-robots-tag: noindex, follow` anymore.
8. (Optional) In Google Search Console → URL Inspection → request
   indexing for the new URL. This usually halves time to first index.

---

## Anti-patterns to avoid

- **Don't add a URL to sitemap before the page is v6 quality.** Even
  one thin page in sitemap signals "site has thin content" to Google
  and discounts the rest.
- **Don't leave promoted pages on the noindex list.** This causes the
  page to be in sitemap but blocked from indexing — a hard error
  Google will report in Search Console.
- **Don't bulk-promote when in doubt.** Promoting one well-built page
  is more valuable than promoting five questionable ones.
- **Don't skip the photo-uniqueness check.** Sister pages (e.g.
  /tours/cannes vs /tours/nice with similar routes) need at least
  some unique photos. All-identical imagery looks like template spam.

---

## Photo audit — open task for Sprint 1

Before /tours/nice/* are promoted, audit photo reuse across all
indexed pages. A bash one-liner over the repo can list which `.avif`
files appear on which pages. Pages that share too many images need
either (a) unique reshoots, or (b) a positioning split that makes
the overlap acceptable. To be done as a sub-task within Sprint 1.
