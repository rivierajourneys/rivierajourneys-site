# MASTER_BRIEF v1 — Patch 2026-04-27

This patch updates the persona policy in MASTER_BRIEF v1. Apply by editing the master document in your Claude project knowledge directly. The patches below are surgical — only the indicated sections need to change.

---

## Why this patch exists

In session 27 April 2026, the persona question was closed: **Variant B (Monocle model) — bureau-first, editor named only on /about, /legal, /llms.txt, and editorial bylines.**

MASTER_BRIEF v1 §2 currently says "Owner: André (Андрей Бондаренко)" and several places throughout still imply a personal-brand register. This patch corrects those mentions and adds a pointer to the new policy doc in the repo.

The full policy is now in `/docs/BRAND_VOICE.md` in the repo. That document is the single source of truth on persona.

---

## Patches to apply

### Patch 1 — §2 BUSINESS CONTEXT, line about the owner

**Find:**
> Owner: André (Андрей Бондаренко), Cannes-based, drives Mercedes V-Class (dark blue, beige leather). Russian origin, long career in premium-client-facing position, now out.

**Replace with:**
> Owner: Andrey Bondarenko (transliteration on the website is "Andrey", not "André" — see `/docs/BRAND_VOICE.md`). Cannes-based, drives Mercedes V-Class (dark blue, beige leather). Russian origin, long career in premium-client-facing position, now out. **Persona policy:** the operator is named only on /legal, /llms.txt, /about masthead, and editorial bylines. Everywhere else the voice is "we" / "the bureau" / "the driver". GBP and commerce pages do not name the operator.

### Patch 2 — §6 (or wherever forbidden language is listed)

**Add to the rejected list:**
> - **"André's tours" / "Andrey's bureau" / "Tour with [name]"** — possessive forms that put the operator before the bureau. Use "we", "the bureau" or "the driver" instead. See `/docs/BRAND_VOICE.md`.
> - **Operator's name in GBP description, GBP posts, GBP Q&A, schema Service.provider, hero copy, testimonials, body copy on commerce pages.** Persona policy is Variant B — Monocle model.

### Patch 3 — §11 IF CLAUDE FORGETS, add a new bullet

**Add to "Signs that the direction is drifting wrongly":**
> - Naming the operator on GBP, on a commerce page, in a hero, in body copy, or in a testimonial. Persona policy is in `/docs/BRAND_VOICE.md` — Variant B.

### Patch 4 — §0 HOW TO READ THIS DOC, add a sentence at the end

**Append:**
> For brand voice and persona decisions, see `/docs/BRAND_VOICE.md` in the repo. That file is the canonical source on whether the operator's name appears anywhere on a given surface.

---

## How to apply

1. Open MASTER_BRIEF v1 in your Claude project's knowledge (the file you've been treating as canonical).
2. For each patch above, find the matching text and replace.
3. Save.
4. Either rename the file to MASTER_BRIEF_v1.1 / v2 with a version note at the top, or keep v1 and add a "Patches applied" log section at the bottom.

After this patch, future Claude sessions reading MASTER_BRIEF will see the updated rules and not relitigate the persona question.

---

## Spelling note on transliteration

The legal name in /legal is **Andrey Bondarenko** (registered transliteration with French authorities). Earlier docs used "André" (French stylisation) and "Андрей" (Cyrillic). Going forward:
- Internal docs may use either form interchangeably.
- Public surfaces always use "Andrey" — matching /legal and SIREN registration. Mismatch between the website name and the SIREN-registered name would be a small but real issue if anyone ever investigated.
- "André" is a French informal usage and should not appear in copy or schema.

---

*End of patch document. Once applied, this file can be deleted from the project knowledge.*
