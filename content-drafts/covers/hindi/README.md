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

## Standing rules

- Only books whose `cover_url` is still empty get a cover; every batch is re-checked live in Supabase just before the art is made.
- One cover per book id, never a reused or identical image (checked by file hash), and covers already made are never redone unless they fail review.
- Each cover's scene comes from the book's own story and characters (DB `overview`); its colour theme is not reused by any of the previous covers while unused themes remain.

## Progress

| | Books | Status |
|---|---|---|
| Samples in the approved look | 3 | done: गोदान (yellow · light), काबुलीवाला (blue · dark), घरे-बाइरे (red · dark) |
| Narendra Kohli | 13 | done: बंधन (pearl white · light), अधिकार (green · light), कर्म (crimson · dark), धर्म (purple · dark), अंतराल (slate teal · dark), प्रच्छन्न (rose pink · light), प्रत्यक्ष (sapphire · light), निर्बन्ध (fiery orange · dark), आनुषंगिक (lavender · dark), दीक्षा (saffron · dark), अवसर (olive · light), युद्ध (storm blue · dark), अभ्युदय (coral · dark) |
| Other Devanagari titles, first five | 5 | done: क्षुधित पाषाण (emerald · dark), पथेर पाँचाली (silver grey · light), श्रीकांत (ink black · dark), अपने-अपने अजनबी (icy white · light), ऐ लड़की (marigold · light) |
| **50-book batch 1** (`"batch": 1` in the manifest) | 50 | 50 done: चंद्रकांता संतति (amethyst · dark, redone), भूतनाथ (charcoal · dark), काजर की कोठरी (kohl black · dark), नरेंद्र-मोहिनी (peach · light), वीरेंद्र वीर (copper · dark), जय यौधेय (bronze · light), सिंह सेनापति (terracotta · light, redone), विस्मृत यात्री (glacier blue · light), मधुर स्वप्न (turquoise · dark), अँधेरे के जुगनू (firefly green · dark), चीवर (sand · light), पक्षी और आकाश (sky blue · light), प्रतिदान (rust · dark), टूटे काँटे (plum · dark), भुवन विक्रम (mint · light), गोली (maroon · dark), सह्याद्रि की चट्टानें (midnight blue · dark), चाणक्य (bottle green · dark), अंधेर नगरी (lemon · light), भारत दुर्दशा (smoky grey · dark), चाँद का मुँह टेढ़ा है (sodium yellow · dark), कविता के बहाने (blush · light), नए इलाके में (powder blue · light), कलम का सिपाही (teal · dark), खंजन नयन (apricot · light), देशद्रोही (indigo · dark), अ ट्रैम्प अब्रॉड (sage · light), अंग्रेज़ी उपन्यास और उसके विकास का सिद्धांत (sepia · dark), अंग्रेज़ी उपन्यास का विकास (seafoam · light), अंग्रेज़ी छंद का विज्ञान (ivory · light), अंग्रेज़ी साहित्य का इतिहास (lilac · light), अपराध और प्रथा आदिम समाज में (aqua · light), आज कत्ल हो के रहेगा (petrol blue · dark), आस्तीन के सांप (neon red · dark), इश्तिहारी मुजरिम (khaki · light), कालगर्ल की हत्या (wine · dark), काला मोती (aubergine · dark), खतरनाक अपराधी (oxblood · dark), खतरनाक ब्लैकमेलर (dusk teal · dark), दौलत और खून (crimson-gold · dark), पुराने गुनाह नये गुनाहगार (rain charcoal · dark), पैंसठ लाख की डकैती (lantern storm · dark), बदसूरत चेहरे (copper-bulb · dark), बैंक वैन रॉबरी (highway dust · light), ब्लैकमेलर की हत्या (ember black · dark), मीना मर्डर केस (courtroom pearl · light), मूर्ति की चोरी (temple marigold · light), मौत का खेल (baize green · dark), रिपोर्टर की हत्या (gunmetal · dark), रेड सर्किल सोसाइटी (scarlet · dark). all done |
| **50-book batch 2** (`"batch": 2`) | 32 | 32 done: विक्षिप्त हत्यारा (absinthe · dark), शैतान की मौत (ochre · light), समुद्र में खून (ultramarine · dark), हत्या की रात (moonstone · dark), हत्यारे (eucalyptus · light), हांगकांग में हंगामा (jade · light), होटल में खून (champagne · light), अपने कत्ल की सुपारी (cobalt · dark), असली खिलाड़ी (walnut · dark), एक मुट्ठी दर्द (dawn mauve · light), कलयुग की रामायण (rani pink · dark), कानून का बेटा (buttercream · light), कानून बदल डालो (violet dusk · dark), केशव पंडित (parchment · light), खलीफा (tobacco · dark), चकमा (pewter · light), तीन तिलंगे (tangerine · light), फांसी दो कानून को (graphite · dark), वर्दी वाला गुंडा (mustard · light), विजय और विकास (electric blue · dark), सबसे बड़ी मर्डर मिस्ट्री (mahogany · dark), हिंद का बेटा (alpenglow · light), इंसाफ का जनाजा (ash · light), कदम कदम पर धोखा (quicksilver · dark), खतरे की खोपड़ी (sulphur · dark), प्रेतों का निर्माता (verdigris · dark), रेलगाड़ी का भूत (fog white · light), एक रात का मेहमान (tempest · dark), एक हसीना थी (rose gold · dark), कब्रिस्तान का षड्यंत्र (moss · dark), केसरीगढ़ की काली रात (kesari night · dark), विषकन्या (nightshade · dark). all done |
| **50-book batch 3** (`"batch": 3`, regional titles from the snapshot) | 50 | 25 done: 47 नाट्कल (frost · light), आ मरत्तेयुम मरन्नु मरन्नु ञान (monsoon · light), आ...! (phosphor · dark), आदलिनाल कादल सेय्वीर (flamingo · light), आगमन (honey · light), आहुति (vermilion · dark), आकाशंलो सगं (cerulean · light), आकाशर इसारा (comet blue · dark), आलाहयुडे पेण्मक्कल (laterite · light), आल्क्कूट्टम (concrete · light), आलोहरी आनंदम (amber · dark), आनवारियुम पोन्कुरिशुम (areca · dark), आत्मगौरवम (marble · light), आत्मीयुलु (haldi · light), आविलायिले सूर्योदयम (first light · light), अबचूरिना पोस्ट ऑफ़िस (malnad green · light), अभयार्थिकल (camp smoke · dark), अभिजात (after-rain silver · light), अभिलाषा (courtroom teak · dark), अभिनेत्री (footlight gold · dark), अभिशप्त गंधर्व (lantern ochre · dark), अचलायतन (limewash · light), आदित्यनुम राधयुम मट्टु चिलरुम (monsoon violet · dark), एरक्कुरैया सोर्क्कम (pastel flat · light), आगंतुक (swing brass · light). 25 pending |
| Batches 4–29 (snapshot 2026-10-09: regional titles in Latin script get a Devanagari cover title; the last ones are Devanagari titles — spirituality, autobiography, history, philosophy, novels) | 1277 | pending |

The list of cover-less books comes from `tools/cover-studio/data/coverless-hindi.json`, written by the workflow *Snapshot cover-less Hindi books* (the sandbox cannot reach Supabase); every batch is still re-checked live before its covers are made.

**Keyless cover engine (running now):** `.github/workflows/cover-engine.yml` needs no API key at all. A keyless text model
(text.pollinations.ai) writes each book's scene and a new colour-theme name, then 80 Actions runners (20 at a time)
draw the art with FLUX.1-schnell on their own CPUs (stable-diffusion.cpp), compose the same foil cover and push every cover
as soon as it is made; a final merge step updates `manifest.json`, these progress rows and `_preview-latest.jpg`.
Restart: change `tools/cover-studio/engine/run.json` and push; `"stop": true` ends a running engine.

**All remaining covers in one run:** `tools/cover-studio/auto.mjs`, also available as the GitHub Actions
workflow *Generate Hindi covers (AI loop)*, plans a story-based scene and theme for every cover-less book and
renders them all with Gemini or OpenAI images. It needs ONE secret, `GEMINI_API_KEY` or `OPENAI_API_KEY`; see `tools/cover-studio/README.md`.

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
