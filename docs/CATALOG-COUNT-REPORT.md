# Booknomics — कितनी books हैं? + improvement review

**Date:** 29 September 2026 · **Branch:** `arena/01a0ec77-booknomics-platform21`
**Scope:** read-only analysis of the repo + live site. Nothing in the database, design,
copy numbers, slugs or sitemap generator was touched.

---

## 1. सीधा जवाब — कितनी books हैं

| कहाँ की गिनती | कितनी | सबूत | भरोसा |
|---|---|---|---|
| **Live site पर दिखने वाली books (आज)** | **0** | `booknomics.com/browse` → "0 books" | ✅ आज जाँचा |
| **Google को बताई गई books (आज का sitemap)** | **0** | `booknomics.com/sitemap.xml` = 21 URLs, जिनमें 0 `/books/` | ✅ आज जाँचा |
| **आख़िरी index audit (3 Aug 2026)** | **123 published** | `reports/indexing-1785734165412.json` | ✅ फ़ाइल में दर्ज |
| **उससे पहले (6 Jul 2026)** | **126 published** | `reports/indexing-1783359164050.json` | ✅ फ़ाइल में दर्ज |
| **इस repo में असली book content** | **0** | कोई seed row, कोई summary text नहीं | ✅ grep से |
| **इस repo में cover placeholders** | **50** (30 English + 20 Hindi) | `src/assets/*-covers/*.asset.json` | ✅ गिना |
| **दावा marketing copy में** | "80+ summaries", "50+ books curated" | `Browse.tsx:104`, `Index.tsx:95,122` | ✅ कोड में |

### असली बात (plain Hindi)

1. **Repo में books की गिनती का कोई सच नहीं है।** `docs/AUDIT.md` line 14 ख़ुद कहता है:
   migrations में `INSERT INTO public.books` की एक भी row नहीं है। इस checkout में 50 covers
   के *metadata* हैं, असली images भी नहीं (पूरे repo में सिर्फ़ 4 असली image files हैं)।
2. **असली count एक ही जगह है — Supabase का `books` table.** वो मुझे यहाँ से नहीं दिख सकता
   (कोई key इस sandbox में नहीं है, और fresh project में `books=0`, `users=0` है —
   `FRESH-SETUP-STATUS.md`)।
3. **आज live साइट 0 books दिखा रही है** और हर book URL सिर्फ़ "Loading…" पर अटका है
   (`BookDetail.tsx:303` का पुराना behaviour)। जबकि 3 अगस्त तक 123 book pages index थे।
4. मतलब: **आपके पास 123 books का record है, code 123 pages दिखाने के लिए तैयार है, लेकिन
   आज live पर 0 render हो रही हैं** — यही सबसे बड़ा problem है, बाक़ी सब उसके बाद।

**पक्का number 60 सेकंड में:**

```bash
npm run books:count            # नया, read-only — local + live + DB तीनों गिनता है
npm run books:count -- --live  # सिर्फ़ production sitemap
npm run books:count -- --db    # सिर्फ़ Supabase (VITE_SUPABASE_URL + publishable key चाहिए)
```

या Supabase SQL editor में:

```sql
select count(*) filter (where is_draft = false)          as published,
       count(*) filter (where is_draft = true)           as drafts,
       count(*)                                          as total,
       count(*) filter (where language = 'hi')           as hindi,
       count(*) filter (where language <> 'hi')          as english,
       count(*) filter (where cover_url is null)         as missing_cover
from public.books;
```

---

## 2. जो अच्छा काम कर रहा है — इसे मत तोड़ो

| चीज़ | क्यों मज़बूत है |
|---|---|
| Page set + design + navigation | पूरा responsive page set, lazy-loaded routes, reusable UI — सब बरकरार |
| Database shape | 33 tables, हर public table पर RLS, premium columns अलग guarded, `books_admin` security-invoker view |
| Sitemap generator | slug audit (`auditSeoSlug`), `old_slugs` → 301 redirect map, image sitemap, `SITEMAP_MIN_BOOKS` का fail-safe (`scripts/generate-sitemap.ts:18,95`) |
| Monitoring | `monitor:indexing` + `check:sitemap:prod` + `check:image-sitemap` — असली SEO evidence reports (`reports/*.json`) generate करते हैं |
| Backend surface | 18 Edge Functions (Razorpay, MCP, SEO, content generation) — migration के लिए तैयार foundation |
| Doc discipline | `AUDIT.md`, `DEPLOYMENT.md`, `CHANGES.json`, `verification/` — हर change का सबूत |
| Content safety rules | `content-drafts/BRIEF-bulk-summaries.md` का "DB में सीधे मत लिखो, slug मत बदलो" नियम बिल्कुल सही है |
| Tests | 20+ tests पहले से pass; अब 37 pass |

यह अच्छा हिस्सा base है — नीचे के fixes इसे **replace नहीं, ठीक** करते हैं।

---

## 3. जो outcome रोक रहा है — impact order में

### P0-1 · Live catalog 0 है, book pages हमेशा "Loading…" ▶ product dead
**सबूत:** `booknomics.com/browse` = "0 books"; `booknomics.com/books/atomic-habits` = सिर्फ़ "Loading…"।
**वजह:** `BookDetail.tsx:303` पर `if (!book) return "Loading…"` — load हो रहा है, book है ही नहीं,
या request fail हुई — तीनों की पहचान ही नहीं थी।
**असर:** Google को 123 pages पर "Loading…" जैसा thin content मिलता है → वो pages गिरते हैं; user को लगता है साइट टूटी है।
**क्या किया:** इस branch में 3-state render जोड़ दिया (§5 देखें)। अब भी **DB ठीक करना बाक़ी है** —
आपको पहले ये तय करना है कि catalog वापस लाना है (पुराने project का backup/export) या नए सिरे से भरना है।

### P0-2 · Google को 0 book URLs मिल रहे हैं ▶ ट्रैफ़िक का पूरा engine बंद
**सबूत:** live sitemap में 21 URLs, 0 books; live `robots.txt` में सिर्फ़ `sitemap.xml` + `image-sitemap.xml`
(book sitemap announce ही नहीं था); repo की committed `public/books-sitemap.xml` ख़ाली `<urlset>` है।
**कदम:** (a) `books-sitemap.xml` को robots में announce करो — **इस branch में हो गया**;
(b) catalog restore के बाद `pnpm/npm run build` से sitemap regenerate करो (prebuild ख़ुद लिखेगा);
(c) GSC में `books-sitemap.xml` submit करो और `check:sitemap:prod` चलाओ (165–185 URLs expect करता है)।

### P0-3 · Fail-safe off था ▶ ख़ाली sitemap चुपचाप ship हो गया
**सबूत:** `.env.example:53` पर `SITEMAP_MIN_BOOKS="0"` — जो guard `generate-sitemap.ts:95` को disable कर देता है।
यह ठीक उसी चीज़ को रोकता था जो आज हुआ।
**कदम:** production env (Vercel) में `SITEMAP_MIN_BOOKS` = असली published count (≥50) रखो; template में
warning comment जोड़ दिया। Local/empty-catalog build के लिए 0 ठीक है, production के लिए कभी नहीं।

### P0-4 · दावा और हक़ीक़त में फ़र्क़ ▶ trust + policy risk
**सबूत:** `Browse.tsx:104` "Browse **80+** Book Summaries", `Index.tsx:95` "Search **80+** summaries",
`Index.tsx:122` "**50+** books curated", `content/blog.ts:51` "30+ books" — live पर 0।
**कदम:** एक config constant (`src/config/catalogClaims.ts`) बनाकर तीनों जगह वही number use करो,
और उसे DB count से verify करो (या published count से auto)। ऐसे बदलाव जान-बूझकर नहीं किए — copy
एक marketing decision है और असली count मेरे पास नहीं है।

### P1-5 · Canonical leak ▶ 177/178 pages Google को "duplicate" लगते हैं
**सबूत:** `reports/indexing-1785734165412.json`: `canonicalMismatches: 177`, `bookLdMissing: 123`,
`breadcrumbLdMissing: 123` — यानी /browse, /english, /hindi, book pages, categories, सबका canonical
homepage बन रहा था।
**कदम:** हर route पर `<SEO path="/..."/>` दो (component support करता है — `SEO.tsx:10,45,69`),
फिर `monitor:indexing` दोबारा चलाकर `canonicalMismatches: 0` साबित करो।

### P1-6 · Book pages पर structured data नहीं ▶ rich results का नुक़सान
Book + Breadcrumb JSON-LD 123 pages पर missing थे। Canonical fix के साथ ही लगाओ, वरना content अच्छा
होने पर भी Google में बड़ा card नहीं मिलेगा।

### P1-7 · Data repo में नहीं है ▶ single point of failure (आज की जड़)
`docs/AUDIT.md`: ZIP में live rows, users, media कुछ नहीं। पुराना Supabase project access भी deny करता है।
इसीलिए catalog 0 हो गया और 0 से वापस लाने का रास्ता नहीं है।
**कदम:** read-only export script (books + covers URL + 301 map → JSON/CSV), nightly schedule,
**git के बाहर** (Supabase Storage/Drive), और quarter में एक restore drill. यह एक बार का काम है,
हर आगे का दर्द बचाता है।

### P1-8 · Slug hygiene ▶ 11 pages एक महीने में गिरे
6 Jul → 3 Aug के बीच junk slugs हटे — `--apt8`, `-1eot`, `-etkl`, `-j84e`, `-kawy`, `-l6fg`,
`the-mountain-is-you-a2fg`, `the-power-of-your-subconscious-mind-6znj` — और सही slugs जुड़े
(`meghdutam`, `srikant`, `premashram`...)। यह अच्छा सफ़ाई था, पर हर हटा slug = खोया ranking।
**कदम:** `seo_slug` सेट करते समय admin SEO dashboard दिखाए (audit score <30 वाले block), और हर rename पर
`old_slugs` में पुराना slug डालो — redirect generator ख़ुद 301 लिख देगा।

### P2-9 · Lint 237 errors + 6 dependency advisories
`README.md`: "lint currently reports 237 errors and 22 warnings". Catalog के बाद, file-by-file,
batch में साफ़ करो — एक बार में 237 नहीं, वरना regression छिपेंगे।

### P2-10 · "written by humans, not generated filler" vs AI functions
`English.tsx:176` यह दावा करता है, जबकि backend में `generate-book-content`, `polish-book-content`,
`translate-to-hindi`, `generate-expert-perspective` मौजूद हैं। Wording soft करो या process disclose करो —
AdSense/Google policy और trust दोनों के लिए सुरक्षित।

### P2-11 · Revenue functions अभी deployed नहीं
`FRESH-SETUP-STATUS.md`: सिर्फ़ 5 functions ACTIVE; `razorpay-*`, `welcome-email`, `book-audio`,
`generate-action-plan`, `dispatch-n8n` pending; secrets भी सेट नहीं (`docs/FUNCTION-SECRETS.md`)।
यानी भुगतान/ईमेल/audio अभी कमाई नहीं कर सकते। Catalog ठीक होने के बाद यह अगला block है।

### P2-12 · Draft backlog
`content-drafts/BRIEF-bulk-summaries.md` के मुताबिक बहुत सारी books draft हैं (user को invisible)।
Publish एक-एक batch में — brief की अपनी सलाह सही है (एक साथ publish = spam signal)।

---

## 4. इस branch में जो बदला (सिर्फ़ जोड़ा, कुछ तोड़ा नहीं)

| File | बदलाव | जोखिम | सबूत |
|---|---|---|---|
| `src/pages/BookDetail.tsx` | `loading / missing / error` तीन अलग states; book मौजूद हो तो rendering बिल्कुल पहले जैसी; "missing" पर साफ़ message + `/browse` link + `noindex,follow`; "error" पर कभी noindex नहीं (network गड़बड़ = page गया नहीं) | बहुत कम, scoped | typecheck PASS, build PASS, lint 16 errors → 16 (कोई नया नहीं) |
| `public/robots.txt` | `Sitemap: .../books-sitemap.xml` announce | शून्य | test + live gap |
| `scripts/book-count-audit.mjs` | नया read-only audit — repo files, live sitemap, Supabase count (published/draft/Hindi/English/missing cover) | शून्य (कुछ लिखता नहीं) | `--local` output |
| `package.json` | `npm run books:count` | शून्य | चला कर देखा |
| `tests/robots-sitemap.test.ts` | robots.txt का regression guard (3 tests) | शून्य | 37/37 pass |
| `.env.example` | `SITEMAP_MIN_BOOKS=0` पर warning comment | शून्य | — |
| `docs/verification/book-count-audit.txt` | असली command outputs | शून्य | फ़ाइल |

पूरी verification: `docs/verification/book-count-audit.txt` (audit output, 37 tests pass, typecheck 0 errors, build ✓)।

**जो जान-बूझकर नहीं बदला:** copy के numbers, design, database, slugs, sitemap generator logic, RLS,
कोई secret/config — इनके लिए आपका approval चाहिए, और असली count के बिना ये अंधेरे में बदलाव होते।

---

## 5. अगले 7 दिन — इसी order में

1. **Day 1 — सच पता करो:** `npm run books:count` (या ऊपर वाली SQL)। Number लिख लो: published / drafts / missing cover।
2. **Day 1–2 — catalog वापस लाओ:** पुराने project का backup हो तो restore; न हो तो नए सिरे से भरो
   (`content-drafts/BRIEF-bulk-summaries.md` का safe तरीक़ा: file पहले, publish बाद में)।
3. **Day 2 — सबूत:** साइट पर एक book खोलो — page दिखे, "Loading…" न अटके। `/browse` पर count > 0।
4. **Day 3 — Google को बताओ:** `SITEMAP_MIN_BOOKS` = असली count, build, `npm run check:sitemap:prod`,
   GSC में `books-sitemap.xml` + `sitemap.xml` submit, indexing request कुछ top pages की।
5. **Day 4 — canonical + JSON-LD:** हर route पर `SEO path`; `npm run monitor:indexing` से `canonicalMismatches: 0` साबित करो।
6. **Day 5 — copy सच करो:** एक config से 80+/50+/30+ numbers replace करो (या dynamic)।
7. **Day 6 — backup habit:** export script + nightly job, git से बाहर।
8. **Day 7 — sales वापस:** Razorpay + welcome-email functions deploy (secrets के साथ), फिर lint/advisories की सफ़ाई।

**Golden rule:** हर step के बाद `npm test`, `npm run typecheck`, `npm run build` — जो आज pass है
(37 tests, 0 type errors, build ✓) वो हर बदलाव के बाद भी pass रहे। यही "कुछ न टूटे" की असली guarantee है।
