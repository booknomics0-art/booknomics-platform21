# Booknomics — 5,027-book quality gateway (2026-10-21)

## Scope and preservation contract
Source of truth: production `public.books`, **read-only**. Published, non-draft: **5,027** (3,459 English; 1,568 Hindi). Another 35 records are `duplicate_hidden` and outside this published audit. **Zero book bodies were edited by this audit.**

Live review register: [Google Sheets quality gateway](https://docs.google.com/spreadsheets/d/1nDLCvggvDspzgaVIKvYTC3T5zDTM0DFsSgLiIM56rd0/edit).

Tabs:
- **Dashboard** — live counts and priority, no misleading automatic certification.
- **Book Audit** — one row per published book, immutable ID, language, title, genre, canonical-route candidate, section lengths, four-section reading word proxy, day-marker count, heading signal, generic-template signal, per-book issue flags, editor evidence, status.
- **7-Day Tracker QA** — separate rows for the same 5,027 book IDs, individual extracted Day 1–7 first-line tasks, number detected, identical-task warning, human review and evidence.
- **Exact Duplicate QA** — per-book full-text fingerprints and exact-copy group sizes for the tracker, action plan, ideas and overview.
- **QA Criteria** — 24 check areas, including all seven days separately, metadata, factual accuracy, takeaways, application, story, font, hierarchy, TOC, translation, release safety.

**Important:** This is 100% published-catalogue **structural screening**, not a 100% source-verified human editorial audit. Every row remains `HUMAN_PENDING` until a reviewer checks the book against trustworthy original material and records evidence. Text length alone is never a final quality judgment. Absent explicit "Day N" markers can be an alternate formatting convention rather than missing content.

## Read-only screening results

| Priority | Count | Definition |
|---|---:|---|
| P0 | 291 | Overview or key ideas or dedicated deep-summary field below 100 characters |
| P1 | 1,684 | No P0, but application or action plan or tracker below 70 characters |
| P2 | 2,566 | No P0/P1, but day-marker, example, reflection, template, or heading review signal |
| P3 | 486 | No listed automated flag; **NOT a certified pass** |
| Total | **5,027** | Exactly one priority per published book |

Other overlapping signals: **2,742** have fewer than seven explicitly detected unique Day 1–7 markers; **1,306** have a narrowly defined repeat-template phrase indicator; **10** have no scanned Markdown `###` signal. These flags are heuristic and **must not** be added together as disjoint counts.

### Confirmed exact-copy evidence (separate from structural priority)

A full-catalogue, same-language comparison was performed using normalized complete text (case and whitespace normalized) for published book records, only counting non-empty fields with more than 100 characters. These are **actual exact text matches**, not fuzzy LLM judgments.

| Same-language complete text repeated | English books | Hindi books |
|---|---:|---:|
| Practice tracker | **2,387** | 2 |
| Action system | **1,065** | 2 |
| Key ideas | **21** | 0 |
| Overview | **2** | 0 |

The largest exact tracker template appears in **1,060 distinct English books**. For English books, **2,618 unique book records** have an exactly shared tracker or action system (834 have both); Hindi has two such records. Counts overlap with structural flags and each other: never sum them.

Additional **Exact Duplicate QA** tab gives all 5,027 IDs, exact same-language copy counts, fingerprint group IDs, sample passages, and a separate escalation priority (`P0 - REPEATED IDEAS / OVERVIEW`, `P1 - REPEATED TRACKER / ACTION`). Do not infer all other prose is unique from these exact-copy checks; near-duplicates and semantic generic text require expert review. Duplicate book title/edition and public-domain boilerplate need separate attention, but identical trackers attached to hundreds of unrelated titles violate personalization standards.

The day-by-day sheet extracts short first-line tasks by common `Day 1` / `दिन 1` / `दिवस 1` conventions; missing/undetected text is labeled for review. Day uniqueness and personalization have **not** been independently verified.

### Sample concrete records requiring review
- **$100M Leads** (EN): 6 explicitly detected day markers, plus an exact repeated-template signal. Review day 7 and all seven distinct tasks.
- **100 Ways to Improve Your Writing** (EN): action plan, tracker, reflection and real-life example fields empty at the time of the audit.
- **हुंकार** (HI): dedicated deep-summary field empty; alternate analysis text exists and must be inspected before calling the page deficient.
- **... Trotzdem Ja zum Leben sagen** (EN): daily_application empty and template signal; avoid inferring content quality from one field alone.

## Human editorial certification contract
For each book:
1. Confirm title, original work, author, genre, characters and claims against named source(s), recording evidence links.
2. Inspect **every** section independently: overview, dedicated summary, key ideas, deep analysis, real-life example, practice, reflection, action system, 7-day tracker.
3. Read the actual text of Day 1 through Day 7. Each should have a **distinct**, verifiable objective directly connected to the book, not a generic daily routine. Check actionable inputs and measurable output or feedback.
4. Check key takeaways are transferable insights, not rewritten plot. Check examples, event chronology, named characters and qualifications.
5. Compare suspicious repeated blocks across books; report exact passages and book IDs rather than assuming a template from length.
6. Review rendered page on Hindi/English, desktop/mobile and light/sepia/dark reader themes; verify headings, bold, contrast, TOC anchors, font rendering and reading experience.
7. Verify full-summary English→Hindi and Hindi→English faithfully, including names and differentiated days. Compare source and translation before marking language QA passed.
8. Mark `EDITOR_VERIFIED` **only after human source-backed signoff**, never from SQL heuristics. Otherwise `NEEDS_REWRITE` / `IN_REVIEW`; preserve evidence links and field-specific issues.

Maintain 500-row editorial cohorts without changing source content during auditing. Escalate P0 first; do not mass update canonical/noindex/published status or overwrite good text.

## Reader changes proposed separately
Branch `fix/bilingual-reader-quality-gate-20261021` adds a bidirectional EN⇄HI toggle with a full-text chunked translation request and a theme-aware high-contrast Table of Contents, with chapters **1, 2, …, 14** and nested **A, B, C** markers. Reader changes must pass lint/typecheck, tests, preview QA and real authenticated translation QA before merging to production.

The previously absent `translate-to-hindi` Supabase Edge Function has been deployed as a new active authenticated backend endpoint, but **provider configuration, live translation completion, fluency and website UI behavior are not yet proven by an end-to-end user session**. It uses Lovable AI gateway with a configured provider API key and may incur usage/credit limits. Never promise unlimited or free translations. The database has no validated separate translation-edition pair for published books, so this is on-demand translation rather than a preverified editorial translation.

## Release verification and safe rollback
- Keep frontend PR draft until CI and preview tests pass, and verify both language directions on distinct books (English business/nonfiction, English fiction, Hindi novel, Hindi philosophy), including all nine textual fields, headings, all 7 tracker days, session/auth and incomplete-provider failures.
- Existing published book rows are untouched. Any frontend regression is reversed by reverting this PR commit(s), not rewriting the database.
- If the new backend breaks other consumers, redeploy a vetted previous version or disable this endpoint, while preserving books and indexability.
- Track failing samples and remediation work separately from editorial certification.
