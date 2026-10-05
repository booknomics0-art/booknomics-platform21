# 3000+ books के covers — पूरा प्लान

यह दस्तावेज़ बताता है कि catalog के हज़ारों books पर cover कैसे लगाएँ, कितना ख़र्च
आएगा, कहाँ फँस सकते हैं, और काम किस क्रम में करना है। असली tool
[`tools/cover-forge/`](../tools/cover-forge/README.md) में है — यह उसका strategy
नोट है।

तारीख़: 4 अक्टूबर 2026.

---

## 1. शुरुआत कहाँ से: मौजूदा हालत

`content-drafts/covers/ANALYSIS-existing-covers.md` (16 अगस्त 2026) के मुताबिक़:

| बात | आँकड़ा |
| --- | --- |
| कुल covers | 109 |
| स्रोत | 5 अलग (Supabase 59, Lovable `__l5e` 22, Google Books 11, OpenLibrary 4, बाक़ी नाम-वाली files) |
| बिना cover वाली books | 17 (कामायनी, निर्मला, रामचरितमानस, मेघदूतम् जैसी बड़ी कृतियाँ शामिल) |
| बाहरी निर्भरता | 15 covers Google/OpenLibrary से — कभी भी टूट सकते हैं |
| Format | 48 JPG, 46 PNG (PNG 3–5× भारी), 11 Google API |
| Rendering | `BookCard.tsx` पर `object-contain` — यानी **2:3 से हटा cover letterbox दिखाएगा** |

दो निष्कर्ष:

1. हर नया cover **ठीक 800×1200 (2:3)** होना चाहिए, और हल्का (300 KB से कम)।
2. External URL की जगह Supabase `book-covers` bucket — वहीं से WebP transform मिलता है:
   `/render/image/public/...?width=W&height=H&resize=cover&quality=82&format=webp`

---

## 2. दो रास्ते, और सही जवाब: दोनों

### रास्ता A — Procedural covers (आज से चल सकता है)

एक program हर book की details (title, author, श्रेणी, विषय, शैली/टोन) से cover
बनाता है: theme engine mood चुनता है → उसी से palette + vector motif + layout,
ऊपर साफ़ Devanagari typography. कोई API नहीं, कोई per-cover ख़र्च नहीं।

- 450 covers ~2.5 मिनट में बने (concurrency 8, ~3 covers/सेकंड)
- औसत 46 KB, सबसे बड़ा 90 KB — यानी 3000 covers ≈ 140 MB
- Devanagari सही render होता है (Noto Serif/Sans Devanagari, HarfBuzz shaping)
- हर cover deterministic — एक ही book का cover हमेशा एक जैसा

### रास्ता B — AI artwork + अपनी typography

Image model सिर्फ़ **चित्र** बनाए, अक्षर नहीं। Text हम ख़ुद ऊपर चढ़ाएँ।

सबसे ज़रूरी बात यही है: आज `supabase/functions/generate-book-cover/index.ts`
prompt में title/author model को भेजता है, इसलिए अक्षर टूटे-फूटे आते हैं
(prompt में "no text artifacts" लिखा भी है, पर model वह मानता नहीं)। AI को
"चित्र बनाओ, नीचे तिहाई ख़ाली छोड़ो" कहना, और lettering ख़ुद करना — यही सही तरीक़ा है।

टूल दोनों को जोड़ देता है:

```sh
# 1) सिर्फ़ prompts निकालो (एक-एक book के लिए, copy-paste वाले generic prompt नहीं)
node generate.mjs --from-db --all --emit-prompts art-prompts.json

# 2) image model से एक-एक चित्र बनाओ, <slug>.jpg नाम से इस folder में रखो

# 3) वही typography उस चित्र पर चढ़ाओ (photo template + scrim)
node generate.mjs --from-db --all --art-dir art/ --out covers
```

जिन books का चित्र नहीं है, वे अपने-आप procedural design पर रहेंगे — कोई book
ख़ाली नहीं छूटेगी।

---

## 3. 3000 covers का गणित

| काम | रास्ता A | रास्ता B (AI art) |
| --- | --- | --- |
| समय | ~15 मिनट (एक मशीन, 8 parallel) | 2–6 घंटे (model की speed + rate limit) |
| पैसा | 0 | नीचे की table |
| Storage | ~140 MB (JPEG) | ~140 MB + 3000 raw चित्र (2–6 GB, अस्थायी) |
| Deliver | card पर ~15 KB WebP | वही |
| जोख़िम | कोई नहीं | licensing, ख़राब चित्र, dedupe |

AI चित्र का ख़र्च (अक्टूबर 2026 के published rates):

| Model | Per image | 3000 covers |
| --- | --- | --- |
| Gemini 2.5 Flash Image (batch) | $0.0195 | ~$59 |
| xAI Grok Imagine Image 2.0 (1K low) | $0.04 | ~$120 |
| Gemini 3.1 Flash Image / Nano Banana 2 (1K) | $0.067 | ~$200 |
| Gemini 3 Pro Image / Nano Banana Pro (2K) | $0.134 | ~$400 |

(स्रोत: xAI की pricing page और Google के Gemini API pricing page — सितंबर 2026
के snapshots के आधार पर। Batch API आधी क़ीमत देता है, पर 24 घंटे तक लग सकते हैं।)

सुझाव: पहले 50 books पर रास्ता B आज़माओ, आँखों से देखो, तब 3000 पर जाओ।
रास्ता A हर हाल में चलता रहेगा — वही fallback है।

---

## 4. पाइपलाइन — पाँच क़दम

```sh
cd tools/cover-forge
npm install && node fetch-fonts.mjs        # एक बार

# क़दम 1 — जिन books पर cover नहीं है, उनकी सूची DB से (या content-drafts से)
# क़दम 2 — बनाओ (batch में, shards में बाँट सकते हैं)
node generate.mjs --from-db --all --out covers --concurrency 8

# क़दम 3 — जाँच (यह gate fail हुआ तो upload नहीं होगा)
node check.mjs --out covers --drafts ../../content-drafts --deep

# क़दम 4 — आँखों से देखो: contact sheet
node sheet.mjs covers preview/contact-sheet.jpg 6

# क़दम 5 — पहले dry run, फिर apply (service-role key पर्यावरण में रखो, कभी VITE_* में नहीं)
node upload.mjs --manifest covers/manifest.json
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node upload.mjs --manifest covers/manifest.json --apply --skip-existing
```

बड़े catalog को शार्ड में बाँटना (चार मशीनें, हर एक 750):

```sh
node generate.mjs --from-db --all --offset 0   --limit 750 --out covers
node generate.mjs --from-db --all --offset 750 --limit 750 --out covers
# ...और आगे
```

Template और palette cycles book की पूरी सूची में उसकी position से तय होती हैं,
इसलिए शार्ड वाले covers उसी डिज़ाइन पर बनते हैं जो पूरे run में बनते।

### 4.1 Theme engine — cover, book की कहानी सुनाए

`--from-db`/drafts से आने वाली **book की अपनी details** (title, श्रेणी, draft की
*प्रमुख विषय* सूची, शैली/टोन) को 17 "moods" से match किया जाता है — जैसे
`devotion`, `grief`, `rebellion`, `love`, `social`, `nature`, `travel`,
`adventure`, `family`, `myth`… जो mood जीतता है वही palette, motif और layout
तय करता है। तो गोदान भूरा-मिट्टी (किसान/कर्ज़) जैसा लगता है, भगवद् गीता
सुनहरा-कमल, चंद्रकांता रहस्य-भरा, और कफ़न-जैसी किताब स्याही-सी मलाल भरी।

Har cover ka फैसला manifest me likha rehta hai (`themeId`, `themeLabel`,
`themeMatched`), और `--explain` se terminal me, `sheet.mjs` se picture ke
neeche — taki aap turant dekh sako ki *kisi cover ko woh look kyun mila*.

---

## 5. गुणवत्ता गेट (`check.mjs`)

Fail (batch रुक जाता है):

- 800×1200 JPEG नहीं, या 300 KB से बड़ा
- ख़ाली/सपाट तस्वीर (grey stdev < 8)
- title SVG में नहीं है, या catalog के title से मेल नहीं खाता
- font में ग़ायब अक्षर (tofu box)
- `--deep` के साथ: render किए गए असली ink की चौड़ाई उसके text box से बाहर

Warning (batch चलता रहता है):

- एक जैसे दिखने वाले covers (16×16 perceptual fingerprint, mean diff ≤ 1.5)
- title minimum size तक छोटा हुआ और फिर भी wrap हुआ
- source list के मुक़ाबले coverage कम

यह gate जान-बूझकर कड़ा है: पहली version ने text node ख़ाली छोड़ दिया था और
450 covers बिना title के बन गए थे — वह bug अब `check.mjs` पकड़ लेता है।

---

## 6. अपलोड के बाद

- File `book-covers/covers/<slug>.jpg` पर जाती है, `books.cover_url` उसी public URL पर सेट होता है।
- App उस URL को `/render/image/public/...?width=200..520&height=…&format=webp`
  में बदल देता है, इसलिए card पर ~15 KB ही जाता है। यानी 3000 covers का असली
  page-weight ~45 MB का होता है — बुरा नहीं।
- `image-sitemap.xml` में हर cover दर्ज है, तो alt text सही रखो
  (`BookCard.tsx` पहले से `${title} book summary cover by ${author} - Booknomics` भेजता है)।
- जो books अभी भी बिना cover हैं, उन पर app का लोकल fallback card चलता रहेगा —
  कोई टूटी तस्वीर नहीं दिखेगी।

---

## 7. क्रम (rollout)

1. **आज** — `--drafts` से 450 covers बनाओ, contact sheet देखो, 10–15 पसंद करो। `.gitignore` में output पहले से है।
2. **इस हफ़्ते** — n8n workflow (`tools/cover-forge/n8n/`) import करो, Monday top-up चालू करो।
3. **इसके बाद** — 3000 की DB list पर `--from-db --all`, शार्ड में बाँटो, `check --deep` चलाओ।
4. **आख़िर में** — जिन 15 covers का स्रोत Google/OpenLibrary है, उन्हें भी बदल दो (एक ही run में हो जाएगा)।
5. **वैकल्पिक** — top 100 books के लिए रास्ता B: AI चित्र + वही lettering, बाक़ी procedural।

---

## 8. जोख़िम और सावधानियाँ

- **AI चित्र का license** — popular book cover की नक़ल बनवाना मत; "original
  editorial illustration" ही माँगो। Model के terms (Gemini/xAI) अपने आप लागू होते हैं।
- **अक्षर AI से कभी न लिखवाओ** — Devanagari में matras और conjuncts टूटते हैं।
  चित्र AI से, अक्षर tool से।
- **`--skip-existing`** — जो cover किसी इंसान ने approve किया है, उसे top-up
  workflow कभी नहीं बदलेगा।
- **पुराने generators** — `scripts/generate-batch*.cjs` अभी भी disabled हैं
  (`scripts/LEGACY_BATCH_GENERATORS_DISABLED.txt`)। Cover Forge उस policy का
  उल्लंघन नहीं करता: यह कोई literary दावा नहीं लिखता, सिर्फ़ title/author/category
  छापता है जो DB में पहले से verified हैं।
- **Fonts** — आठों fonts Google Fonts (SIL OFL 1.1) हैं, `fonts/LICENSES.md` में दर्ज।
- **3,000 vs 3,600** — अगर catalog 3000 से ऊपर गया तो कुछ नहीं बदलता; क़दम वही
  रहेंगे, बस एक और shard जुड़ेगा।

---

## 9. फ़ाइल नक़्शा

```
tools/cover-forge/
├── generate.mjs      batch renderer → covers/<slug>.jpg + manifest.json
├── check.mjs         quality gate (--deep = असली ink नाप)
├── upload.mjs        Supabase storage + books.cover_url (डिफ़ॉल्ट dry run)
├── fetch-fonts.mjs   node_modules से आठ OFL fonts ./fonts में
├── sheet.mjs         contact sheet (देखने के लिए)
├── src/              templates, motifs, palettes, text fitting, renderer
├── n8n/              importable workflow + नोट्स
├── fonts/            committed TTFs (offline काम करता है)
└── covers/           output (git-ignored)
```
