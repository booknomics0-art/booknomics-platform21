# Hindi section — story covers

Covers for the books on booknomics.com/hindi (`language = hi`, published, not draft) that
had **no cover** when the catalogue was checked on 2026-10-09. Books that already have a
cover are left alone.

## Style: the approved reference look, photorealistic

Modelled on the यशोधरा cover the user shared as the target:

- a **photorealistic film-still scene** with the story's characters at a key moment: real skin,
  fabric and natural light, so it does not look AI-generated. The composer adds a light film
  grain, a gentle vignette and slightly lower saturation.
- a big **gold-foil calligraphic Devanagari title** (Vesper Libre Bold by default), or a deep ink
  colour when the art is light
- a thin rule with a **lotus** in the middle
- the **author** in ivory
- an **open-book icon with BOOKNOMICS** at the foot

**Every book gets its own theme colour**, such as light, dark, blue, yellow, red or green, and
its own scene from its story. Both are recorded per book in `manifest.json` (`theme`,
`palette`, `concept`).

The artwork is AI-generated without text. The title, author and brand are set by
`tools/cover-studio/compose.mjs`, so the Devanagari matches the database exactly.

Format: 800×1200 JPG (2:3, what `BookCard` renders), about 150 KB each. `<slug>.jpg` matches `books.slug`.
`_preview-latest.jpg` is a contact sheet of the latest batch, for review only, and is never uploaded.

## Progress

| | Books | Status |
|---|---|---|
| Samples in the approved look | 3 | done: गोदान (yellow · light), काबुलीवाला (blue · dark), घरे-बाइरे (red · dark) |
| Narendra Kohli | 13 | done: बंधन (pearl white · light), अधिकार (green · light), कर्म (crimson · dark), धर्म (purple · dark), अंतराल (slate teal · dark), प्रच्छन्न (rose pink · light), प्रत्यक्ष (sapphire · light), निर्बन्ध (fiery orange · dark), आनुषंगिक (lavender · dark), दीक्षा (saffron · dark), अवसर (olive · light), युद्ध (storm blue · dark), अभ्युदय (coral · dark) |
| Other Devanagari titles, first five | 5 | done: क्षुधित पाषाण (emerald · dark), पथेर पाँचाली (silver grey · light), श्रीकांत (ink black · dark), अपने-अपने अजनबी (icy white · light), ऐ लड़की (marigold · light) |
| **50-book batch 1** (`"batch": 1` in the manifest) | 50 | 18 done: भूतनाथ (charcoal · dark), काजर की कोठरी (kohl black · dark), नरेंद्र-मोहिनी (peach · light), वीरेंद्र वीर (copper · dark), जय यौधेय (bronze · light), विस्मृत यात्री (glacier blue · light), मधुर स्वप्न (turquoise · dark), अँधेरे के जुगनू (firefly green · dark), चंद्रकांता संतति (amethyst · dark, redone), सिंह सेनापति (terracotta · light, redone), चीवर (sand · light), पक्षी और आकाश (sky blue · light), प्रतिदान (rust · dark), टूटे काँटे (plum · dark), भुवन विक्रम (mint · light), गोली (maroon · dark), सह्याद्रि की चट्टानें (midnight blue · dark), चाणक्य (bottle green · dark). 32 pending |
| **50-book batch 2** (`"batch": 2`) | 32 | pending (the rest of the pulp thrillers) |
| Regional-literature summaries with Latin titles in the DB (`भारतीय क्षेत्रीय साहित्य · …`) | ~589 | not in the manifest yet. **The title will be written in Devanagari on the cover** |

**All remaining covers in one run:** `tools/cover-studio/auto.mjs`, also available as the GitHub Actions
workflow *Generate Hindi covers (AI loop)*, plans a story-based scene and theme for every cover-less book and
renders them all with the OpenAI Images API. It needs the `OPENAI_API_KEY` secret; see `tools/cover-studio/README.md`.

`node tools/cover-studio/prompts.mjs --stats` gives the live count. Work is planned in batches of 50 books;
the image tool makes at most 10 artworks per working session, so each 50-book batch takes five sessions.

Skipped on purpose:
- **चित्रा**: a cover already exists (`../chitra-cover.jpg`). It only needs uploading.
- Every book whose `cover_url` is already set, including Premchand's novels.
  गोदान already has a cover too, so the one here is a sample and optional.

## Uploading

**Automatic (GitHub Actions):** `.github/workflows/upload-hindi-covers.yml` runs on every push that
changes this folder. It uploads every finished cover (`status: "done"`) to the Supabase
`book-covers` bucket under `hindi-story-covers/<book-id>/<timestamp>.jpg` and sets
`books.cover_url`, but only for books that still have no cover. The public URLs are listed in
the run summary and in the `hindi-cover-urls` artifact.

It needs one repository secret, added once: **`SUPABASE_SERVICE_ROLE_KEY`** (GitHub → Settings →
Secrets and variables → Actions → New repository secret; the value is in Supabase → Project
Settings → API Keys). Without it the workflow only prints a reminder. Re-run the latest run after
adding the secret.

**One at a time:** Admin → find the book → **HD Cover** (cloud icon) → pick `<slug>.jpg`.

**All finished covers at once:**

```bash
cd tools/cover-studio && npm install
node upload.mjs                                   # dry run: lists what would change
SUPABASE_SERVICE_ROLE_KEY=… node upload.mjs --apply
```

It only fills books whose `cover_url` is still empty. To use the new गोदान cover instead of the
current one: `node upload.mjs --apply --force --only godan`.
