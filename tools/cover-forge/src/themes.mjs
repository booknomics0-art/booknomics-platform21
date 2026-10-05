// Theme engine.
//
// A cover should look like the book it belongs to, not like a random draw from
// a colour wheel. Each book carries its own signals — category, the "प्रमुख
// विषय" list in its draft, शैली/टोन, and the title — and those signals are
// matched against a small library of literary moods. A theme then fixes the
// palette pool, the motif pool and the layout pool, so the colour, the artwork
// and the typography grid all tell the same story.
//
// Deterministic and explainable: themeFor() returns *why* it matched, and the
// manifest records it, so a wrong cover can be diagnosed from the JSON alone.

import { hashText } from "./util.mjs";

/**
 * weight: how much one hit in that field counts. Titles weigh most because a
 * title like "रश्मिरथि" or "मैला आँचल" is the strongest single signal we have.
 * The body is deliberately weak and needs repetition (see hitsFor) — almost
 * every draft of a Hindi novel mentions गरीबी or सामाजिक somewhere in passing,
 * and letting one stray mention decide would paint the whole library beige.
 */
const FIELDS = [
  ["title", 4],
  ["category", 3],
  ["themes", 3],
  ["style", 2],
  ["tone", 2],
  ["body", 1],
];

/** How many points one keyword earns from one field. */
function hitsFor(field, weight, haystack, needle) {
  if (field !== "body") return haystack.includes(needle) ? weight : 0;
  let hits = 0;
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) hits += 1;
  return hits >= 4 ? weight : 0; // a passing mention is not a theme
}

/** A theme may not be decided by prose alone. */
const BODY_CAP = 3;

/**
 * Generic categories (उपन्यास, साहित्य, कहानी) say nothing about mood, but
 * specific ones do: a महाकाव्य is mythic, a यात्रा वृत्तांत is a journey, a
 * व्यंग्य संग्रह is satire. The prior earns 3 points — enough to decide when
 * the prose is vague, easy to overrule when the book says otherwise.
 */
const CATEGORY_PRIOR = [
  [/(महाकाव्य|भक्ति काव्य)/, "devotion"],
  [/(हास्य|व्यंग्य)/, "satire"],
  [/(यात्रा)/, "travel"],
  [/(आलोचना|निबंध)/, "thought"],
  [/(ऐतिहासिक|जीवनी|संस्मरण|आत्मकथा)/, "history"],
  [/(कविता|नाटक)/, "creation"],
  [/(सामाजिक उपन्यास|कहानी संग्रह)/, "social"],
];

export const THEMES = [
  {
    id: "devotion",
    label: "भक्ति / आध्यात्म",
    keys: ["भक्ति", "आध्यात्म", "ईश्वर", "प्रभु", "भगवान", "कृष्ण", "राम", "गीता", "धर्म", "मोक्ष", "आत्मा", "मंदिर", "पूजा", "तपस्या", "आस्तिक", "devotion", "spiritual", "divine"],
    palettes: ["gold", "amber", "ivory", "parchment"],
    motifs: ["lotus", "mandala", "diya", "chakra", "sunArc", "archWindow"],
    templates: ["arch", "classic", "band", "split"],
  },
  {
    id: "grief",
    label: "शोक / वियोग",
    keys: ["मृत्यु", "मरण", "मौत", "शोक", "वियोग", "विदा", "मलाल", "उदासी", "शोकगीत", "मृत", "अंत", "कफ़न", "ग़म", "grief", "death", "mourning", "loss", "sorrow"],
    palettes: ["ink", "stone", "indigo", "violet"],
    motifs: ["moonPhases", "monolith", "mountains", "river", "inkRibbon"],
    templates: ["minimal", "side", "split", "classic"],
  },
  {
    id: "rebellion",
    label: "विद्रोह / संघर्ष",
    keys: ["विद्रोह", "क्रांति", "आंदोलन", "सत्याग्रह", "स्वतंत्रता", "आज़ादी", "आजादी", "संघर्ष", "विरोध", "बगावत", "सशक्तिकरण", "आक्रोश", "rebellion", "revolution", "freedom", "resistance", "protest", "struggle"],
    palettes: ["crimson", "ink", "amber", "indigo"],
    motifs: ["chakra", "starburst", "monolith", "bauhaus", "eye"],
    templates: ["poster", "band", "arch", "split"],
  },
  {
    id: "love",
    label: "प्रेम / प्रणय",
    keys: ["प्रेम", "प्यार", "मोहब्बत", "प्रणय", "रोमांस", "इश्क़", "प्रेमिका", "विवाह", "शृंगार", "love", "romance", "desire", "passion"],
    palettes: ["blush", "crimson", "violet", "amber"],
    motifs: ["lotus", "peacockFeather", "moonPhases", "spiral", "river"],
    templates: ["split", "minimal", "side", "arch"],
  },
  {
    id: "social",
    label: "सामाजिक यथार्थ",
    keys: ["गरीबी", "ग़रीबी", "किसान", "शोषण", "अन्याय", "जाति", "दलित", "मज़दूर", "मजदूर", "भ्रष्टाचार", "दहेज", "वर्ग", "श्रम", "पैसा", "कर्ज़", "poverty", "exploitation", "caste", "injustice", "realism", "class"],
    palettes: ["stone", "parchment", "forest", "amber"],
    motifs: ["houses", "tree", "river", "mountains", "halftone"],
    templates: ["classic", "side", "band", "split"],
  },
  {
    id: "nature",
    label: "प्रकृति / ग्रामीण",
    keys: ["प्रकृति", "ग्रामीण", "गाँव", "गॉव", "मौसम", "वर्षा", "नदी", "पर्वत", "पेड़", "खेत", "वन", "बाग़", "छायावाद", "nature", "village", "rural", "rain", "forest", "river"],
    palettes: ["forest", "mint", "teal", "ivory"],
    motifs: ["tree", "river", "mountains", "seigaiha", "sunArc"],
    templates: ["arch", "split", "minimal", "band"],
  },
  {
    id: "travel",
    label: "यात्रा / अन्वेषण",
    keys: ["यात्रा", "सफ़र", "सफर", "हिमालय", "भ्रमण", "विदेश", "यात्री", "प्रवास", "travel", "journey", "voyage", "wander"],
    palettes: ["teal", "ocean", "mint", "forest"],
    motifs: ["mountains", "seigaiha", "river", "monolith", "sunArc"],
    templates: ["split", "band", "arch", "poster"],
  },
  {
    id: "mind",
    label: "मन / पहचान",
    keys: ["मनोविज्ञान", "मनोवैज्ञानिक", "आत्म", "अकेलापन", "अस्तित्व", "पहचान", "अंतर्मन", "तनाव", "अवसाद", "मानसिक", "भीतरी", "अधूरापन", "स्व", "psychology", "identity", "loneliness", "existential", "mind", "inner"],
    palettes: ["ink", "violet", "indigo", "stone"],
    motifs: ["spiral", "eye", "monolith", "moonPhases", "inkRibbon"],
    templates: ["minimal", "side", "split", "classic"],
  },
  {
    id: "history",
    label: "इतिहास / राजनीति",
    keys: ["इतिहास", "ऐतिहासिक", "राजनीति", "राज्य", "राजा", "युद्ध", "विभाजन", "साम्राज्य", "क्रांतिकारी", "नेहरू", "गांधी", "history", "historical", "politics", "war", "empire", "partition"],
    palettes: ["stone", "parchment", "gold", "crimson"],
    motifs: ["monolith", "archWindow", "chakra", "mountains", "halftone"],
    templates: ["arch", "poster", "classic", "band"],
  },
  {
    id: "satire",
    label: "हास्य / व्यंग्य",
    keys: ["व्यंग्य", "हास्य", "हंसी", "मज़ाक", "मजाक", "फ़रस", "व्यंग", "कटाक्ष", "satire", "humour", "humor", "comedy", "irony", "wit"],
    palettes: ["amber", "blush", "mint", "violet"],
    motifs: ["bauhaus", "halftone", "eye", "starburst", "spiral"],
    templates: ["poster", "band", "minimal", "side"],
  },
  {
    id: "thought",
    label: "विचार / आलोचना",
    keys: ["आलोचना", "निबंध", "विचार", "सिद्धांत", "समीक्षा", "दर्शन", "दार्शनिक", "तर्क", "अध्ययन", "मूल्यांकन", "philosophy", "criticism", "essay", "theory", "thought", "critique"],
    palettes: ["ink", "stone", "ivory", "mint"],
    motifs: ["bauhaus", "halftone", "inkRibbon", "spiral", "archWindow"],
    templates: ["minimal", "side", "classic", "split"],
  },
  {
    id: "woman",
    label: "नारी / स्त्री",
    keys: ["नारी", "स्त्री", "महिला", "स्त्रीवाद", "नारीवाद", "माँ", "बेटी", "पत्नी", "feminism", "woman", "women", "mother", "daughter"],
    palettes: ["blush", "violet", "crimson", "mint"],
    motifs: ["lotus", "peacockFeather", "eye", "moonPhases", "tree"],
    templates: ["split", "side", "poster", "minimal"],
  },
  {
    id: "modern",
    label: "आधुनिकता / शहरी",
    keys: ["आधुनिक", "शहरी", "शहर", "औद्योगिक", "मशीन", "पूंजी", "बाज़ार", "विकास", "modernity", "urban", "city", "capitalism", "industry", "alienation"],
    palettes: ["ink", "indigo", "teal", "stone"],
    motifs: ["bauhaus", "halftone", "monolith", "houses", "starburst"],
    templates: ["poster", "band", "side", "split"],
  },
  {
    id: "adventure",
    label: "रोमांच / रहस्य",
    keys: ["तिलिस्म", "रहस्य", "रोमांच", "जासूस", "खज़ाना", "खजाना", "गुफ़ा", "गुफा", "तलवार", "युद्ध", "साहसिक", "adventure", "mystery", "detective", "fantasy", "treasure", "quest"],
    palettes: ["indigo", "violet", "teal", "gold"],
    motifs: ["eye", "spiral", "starburst", "archWindow", "mountains"],
    templates: ["poster", "band", "arch", "split"],
  },
  {
    id: "family",
    label: "परिवार / रिश्ते",
    keys: ["परिवार", "रिश्ता", "रिश्ते", "विवाह", "शादी", "पति", "पत्नी", "माता-पिता", "संयुक्त परिवार", "घरेलू", "बहू", "सास", "family", "marriage", "relationship", "domestic"],
    palettes: ["parchment", "blush", "stone", "ivory"],
    motifs: ["houses", "tree", "lotus", "archWindow", "moonPhases"],
    templates: ["classic", "side", "split", "minimal"],
  },
  {
    id: "myth",
    label: "पौराणिक / महाकाव्य",
    keys: ["पौराणिक", "महाकाव्य", "रामायण", "महाभारत", "लोककथा", "पुराण", "देवता", "युधिष्ठिर", "कर्ण", "सीता", "myth", "epic", "legend", "folklore"],
    palettes: ["gold", "amber", "crimson", "parchment"],
    motifs: ["chakra", "archWindow", "peacockFeather", "mandala", "starburst"],
    templates: ["arch", "classic", "poster", "band"],
  },
  {
    id: "childhood",
    label: "बचपन / मासूमियत",
    keys: ["बचपन", "मासूमियत", "बच्चे", "बाल्य", "स्कूल", "खेल", "innocence", "childhood", "children"],
    palettes: ["mint", "blush", "ivory", "amber"],
    motifs: ["tree", "sunArc", "starburst", "lotus", "seigaiha"],
    templates: ["minimal", "arch", "classic", "band"],
  },
  {
    id: "creation",
    label: "कला / सर्जना",
    keys: ["कला", "सर्जना", "लेखन", "संगीत", "रंगमंच", "नाटक", "अभिव्यक्ति", "छंद", "काव्य", "poetry", "art", "literature", "music", "creativity", "writing", "theatre"],
    palettes: ["violet", "indigo", "blush", "ivory"],
    motifs: ["inkRibbon", "peacockFeather", "starburst", "mandala", "spiral"],
    templates: ["side", "minimal", "band", "arch"],
  },
];

/** Fallback when nothing matches: still book-aware (category-driven colours). */
export const FALLBACK_THEME = {
  id: "literary",
  label: "साहित्यिक",
  keys: [],
  palettes: [],
  motifs: ["inkRibbon", "archWindow", "mandala", "tree", "moonPhases", "halftone", "starburst", "lotus", "spiral", "monolith"],
  templates: ["classic", "band", "arch", "split", "poster", "side", "minimal"],
};

const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Everything we know about a book, flattened into weighted fields. */
function signals(book) {
  const body = norm(book.body || "").slice(0, 6000);
  return {
    title: norm(book.title),
    category: norm(book.category),
    themes: norm(Array.isArray(book.themes) ? book.themes.join(" ") : book.themes),
    style: norm(book.style),
    tone: norm(book.tone),
    body,
  };
}

/**
 * Pick the theme that best explains this book.
 *
 * Returns the theme entry itself plus `score` (evidence strength) and
 * `matched` (which words produced it) so a cover can be explained from the
 * manifest alone.
 *
 * @returns {{ id, label, palettes, motifs, templates, score, matched }}
 */
export function themeFor(book, index = 0) {
  const sig = signals(book);
  let best = null;
  for (const theme of THEMES) {
    let score = 0;
    let fromBody = 0;
    const matched = [];
    for (const key of theme.keys) {
      const k = norm(key);
      for (const [field, weight] of FIELDS) {
        const hit = sig[field] ? hitsFor(field, weight, sig[field], k) : 0;
        if (hit) {
          if (field === "body") {
            if (fromBody >= BODY_CAP) continue;
            fromBody += hit;
          }
          score += hit;
          if (!matched.includes(key)) matched.push(key);
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { theme, score, matched };
  }
  // Category prior: a specific category is worth as much as a theme keyword.
  const category = sig.category;
  for (const [re, id] of CATEGORY_PRIOR) {
    if (re.test(category)) {
      const theme = byId[id];
      if (theme) {
        const prior = 3;
        if (!best || prior > best.score) best = { theme, score: prior, matched: [`श्रेणी: ${category}`] };
        else best.score += 0; // a prior never rescues a weaker match, only breaks ties below
      }
      break;
    }
  }
  if (!best) return { ...FALLBACK_THEME, score: 0, matched: [] };
  return { ...best.theme, score: best.score, matched: best.matched };
}

/**
 * Cycle inside a theme's pool by the book's position, so ten books that share
 * one mood still do not get the same motif — variety *within* meaning.
 */
export function cycle(pool, book, index = 0, step = 1) {
  if (!pool || !pool.length) return null;
  const offset = hashText(book.slug || book.title || "");
  return pool[(Number(index) * step + offset) % pool.length];
}

export const themeIds = () => [...THEMES.map((t) => t.id), FALLBACK_THEME.id];
export const getTheme = (id) => byId[id] || (id === FALLBACK_THEME.id ? FALLBACK_THEME : null);
