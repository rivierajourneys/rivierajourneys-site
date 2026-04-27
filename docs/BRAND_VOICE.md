# Riviera Journeys — Brand Voice & Persona Policy

*Decision date: 27 April 2026. Supersedes any earlier mention of personal branding in MASTER_BRIEF v1.*

This document fixes a specific decision about persona on the public surface of the brand. It exists because the same question keeps re-emerging in sessions: **does the operator's name appear on the website, and where?** The answer below is the working policy. If a future session needs to revisit it, do so explicitly — don't drift.

---

## The decision: Variant B — Bureau-first, editor named only where appropriate

**Riviera Journeys is the bureau. The owner is the editor of the journal, not the face of the brand.**

The bureau is the voice on the front. The owner is named only where the law requires it, where entity-disambiguation requires it, or where editorial authorship requires it. Everywhere else — first-person plural ("we"), passive voice, or generic role nouns ("the driver", "the bureau").

This is the Monocle / Apartamento / Cereal model: a publication has an editor, and that editor has a name printed in the colophon, but the publication is not branded around the editor's personhood.

---

## What this means in practice

### Where the name MUST appear (do not remove)

| Surface | Why | Example |
|---|---|---|
| `/legal` | French law (LCEN) requires the publisher's identity. Copyright statements require attribution to the natural person, because the legal entity is an Entrepreneur individuel — the brand is not separately registered. | "Andrey Bondarenko, Entrepreneur individuel, SIREN 828 952 432" |
| `/llms.txt` | Entity disambiguation from Riviera Travel (UK) requires linking the website to a verifiable registered entity. AI search needs this hook. | "Registered as: Andrey Bondarenko, SIREN 828 952 432" |
| Schema.org `Author` on editorial articles (future) | When journal pieces ship, schema needs a Person with sameAs pointing to LinkedIn/Instagram. This signals authorship and is rewarded by Google E-E-A-T. | `{"@type":"Person","name":"Andrey Bondarenko","url":"https://rivierajourneys.fr/about"}` |
| `/about` masthead, when built (currently a stub) | A masthead names the editor. Reader trust requires knowing who is behind the journal. | "Edited and photographed by Andrey Bondarenko" — once, in the colophon. Not in body copy. |

### Where the name MUST NOT appear

| Surface | Why |
|---|---|
| Google Business Profile description | GBP is a commerce surface. People search "private driver Cannes", they want a service, not a person. Personal naming makes the bureau look smaller and harder to scale to villas/network later. |
| GBP posts and Q&A | Same reason. "We" voice throughout. |
| Commerce pages: `/transfers/*`, `/tours/*`, `/shore-excursions/*`, `/multi-day/*`, `/corporate/*` | Commercial intent. The bureau is the service provider. Use "we" or "the driver" for testimonials. |
| Schema.org `Service.provider` and `Organization` | These describe the service, not its author. Provider name = "Riviera Journeys", not the operator's personal name. |
| Hero copy on the homepage | Editorial statement, not value proposition (per MASTER_BRIEF §6). No persona on the hero. |
| Testimonials | Even if a real client wrote "André was wonderful", paraphrase: "the driver was at the pier" / "we were at the pier" / "the bureau suggested". Keep client voice but neutralise the operator's name. |
| Instagram bio | "@riviera.journeys" is the brand handle. Bio describes the bureau, not the operator. |
| Email signature for `hello@rivierajourneys.fr` | Sign as "Riviera Journeys" or "The bureau" or with first name only ("Andrey", but never "Andrey Bondarenko"). |

### Where the name MAY appear

| Surface | Conditions |
|---|---|
| Editorial articles (`/editorial/*`) | Author byline below the headline ("By Andrey Bondarenko") OR colophon at the end of the piece. Body copy stays in "we" voice. |
| Photo credits | "Photograph by Riviera Journeys" is preferred. "Photograph by Andrey Bondarenko" is acceptable on editorial only, never on commerce. |
| Personal social: LinkedIn | LinkedIn is, by definition, a personal CV surface. Andrey there is normal. Link from there to Riviera Journeys, never the reverse. |
| Press / interview pitches | Pitching a journalist requires a real person they can quote. There the name is the asset. But the resulting press should refer to "Riviera Journeys, founded by..." — not "Andrey's tours". |

---

## Voice and pronouns

- **First person plural ("we", "our") on commerce.** Default voice everywhere except editorial.
- **First person singular ("I", "my") on editorial.** When journal pieces are written in first person, that "I" is the editor's voice — but the editor is not named in body copy, only in byline / colophon.
- **No third-person self-reference.** Don't write "Riviera Journeys believes" or "Riviera Journeys recommends". Write "we believe", "we recommend".
- **No "André's tour" or "Andrey's bureau".** Never possessive form with the operator's name on any surface.

---

## Photo credits

Default photo credit on commerce: `Photograph by Riviera Journeys` (in caption, byline, schema `creator`).

Default photo credit on editorial: `Photograph by Riviera Journeys`. Acceptable: `By Riviera Journeys · field notes from [location]` if a location attribution is needed.

Internal note: copyright still belongs to the natural person (Andrey Bondarenko, per /legal §4). The credit is a brand display, not a copyright transfer.

---

## When the name *should* be foregrounded

Three growth scenarios will eventually require pulling the name forward:

1. **Press feature.** A journalist wants a person to write about. Lead with the bureau, allow them to drill into the editor.
2. **Villa arrangement (3-year plan).** When listing a villa, owner trust is built person-to-person, not bureau-to-bureau. Name appears in arrangement-specific copy. But the brand stays "Riviera Journeys arrangements".
3. **Hiring a second driver/editor.** Counter-intuitively, this is the moment the name appears more, not less — to clarify that "Andrey" is the founder of a small studio with employees. Until that hire happens, foregrounding the name signals "single operator", which is correct but limits the upper end.

When any of these activate, revisit this document and amend.

---

## Forbidden phrases anywhere on commerce or GBP

- "André's tours"
- "Tour with André"
- "Andrey, your driver"
- "Your private driver, Andrey"
- "Andrey will pick you up"
- "Andrey's photography"
- Any possessive that puts the operator before the bureau

---

## When in doubt

If a session is producing copy and isn't sure whether to name the operator: **don't.** Use "we", "the bureau", "the driver", "the editor", or passive voice. The bar for naming is high. The bar for not naming is zero.

---

## Document log

- **2026-04-27** — Initial version. Decision: Variant B (Monocle model). Removed name from GBP description, from two shore-excursion testimonials, from llms.txt brand-voice line. Retained in /legal (LCEN), /llms.txt (entity), internal docs.

---

*This file is for Claude sessions and any future contributor. Keep it short, keep it current, and update the log when the policy moves.*
