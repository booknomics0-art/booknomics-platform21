const BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI = process.env.GEMINI_API_KEY;
const MODEL = process.env.GROUNDED_REPAIR_MODEL || "gemini-3.8-flash";
const APPLY = process.argv.includes("--apply");
const PILOT = process.argv.includes("--pilot");
const limitArg = process.argv.find((x) => x.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 4;

if (!BASE || !SERVICE || !GEMINI) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE/GEMINI_API_KEY");

const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const db = async (path, init = {}) => {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,600)}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};

const pilotTitles = ["Nemesis Games", "A Handbook of Scientific & Technical Writing", "Aahuti", "अंतःपुर"];
const banned = [
  "timeless masterpiece", "every page teaches", "rich experience", "one of the most important works",
  "हिंदी साहित्य की एक अनमोल धरोहर", "हर अध्याय, हर पृष्ठ", "समृद्ध अनुभव", "भूरि-भूरि प्रशंसा",
  "कई भाषाओं में अनूदित", "नई दिशा दी", "सदैव ऋणी रहेगा"
];
const clean = (s) => String(s || "").trim();
const countWords = (s) => clean(s).split(/\s+/).filter(Boolean).length;

function prompt(book) {
  const lang = book.language === "hi" ? "Natural Hindi in Devanagari" : "Clear modern English";
  return `You are a rigorous Booknomics research editor. You MUST use Google Search to verify this exact work before writing.\n\nTitle: ${book.title}\nAuthor: ${book.author || "Unknown"}\nCategory: ${book.category || "Unknown"}\nFinal language: ${lang}\n\nResearch rules:\n- Verify exact title + author identity and disambiguate similarly named works.\n- Prefer publisher/library/catalog/Google Books/Internet Archive/university/reputable review sources.\n- Do not rely on Booknomics or generic SEO summary sites as factual authority.\n- Never invent quotes, page numbers, characters, scenes, dates, awards, translations, reception, influence, symbolism, or author intent.\n- If evidence is sparse or identity is ambiguous, return evidence_status=insufficient. Do not guess.\n- Paraphrase; do not copy source wording.\n- Avoid generic praise and filler. Every paragraph must be recognizably specific to this book.\n\nIf evidence is sufficient, produce:\n1 overview: 180-300 words.\n2 key_ideas: 6-10 substantial Markdown bullets.\n3 deep_summary: 800-1200 words, evidence-grounded. Fiction: verified arc/characters/turning points. Nonfiction/reference: thesis/structure/arguments/examples.\n4 deep_analysis: 450-700 words, clearly distinguish evidence from interpretation and include limits/ambiguities.\n5 daily_application: fiction/literature = reading/reflection practices; nonfiction = 4-6 realistic actions. Do not force productivity advice.\n6 reflection_questions: 5-8 book-specific questions.\n7 action_system: compact 5-7 step reading/study plan.\n8 evidence_note: state what identity/context you verified and what remains uncertain.\n\nReturn strict JSON only with keys: evidence_status, identity_confidence (0..1), overview, key_ideas, deep_summary, deep_analysis, daily_application, reflection_questions, action_system, evidence_note.`;
}

async function generate(book) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt(book) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 12000 }
    })
  });
  const raw = await r.json();
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${JSON.stringify(raw).slice(0,900)}`);
  const c = raw?.candidates?.[0];
  const text = (c?.content?.parts || []).map((p) => p.text || "").join("");
  let out;
  try { out = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.slice(0,500)}`); }
  const gm = c?.groundingMetadata || {};
  const chunks = (gm.groundingChunks || []).map((x) => x?.web).filter((x) => x?.uri);
  const uniq = new Map();
  for (const x of chunks) if (!uniq.has(x.uri)) uniq.set(x.uri, x.title || x.uri);
  return { out, urls: [...uniq.keys()], titles: [...uniq.values()], queries: gm.webSearchQueries || [] };
}

function gate(result) {
  const o = result.out;
  const overview = clean(o.overview), keys = clean(o.key_ideas), summary = clean(o.deep_summary), analysis = clean(o.deep_analysis);
  const all = [overview, keys, summary, analysis, o.daily_application, o.reflection_questions, o.action_system].map(clean).join("\n").toLowerCase();
  const bannedHit = banned.find((x) => all.includes(x.toLowerCase())) || null;
  const g = {
    evidence_sufficient: o.evidence_status === "sufficient",
    identity_confidence: Number(o.identity_confidence || 0),
    source_count: result.urls.length,
    search_query_count: result.queries.length,
    overview_chars: overview.length,
    key_ideas_chars: keys.length,
    summary_words: countWords(summary),
    analysis_words: countWords(analysis),
    banned_phrase: bannedHit
  };
  g.pass = g.evidence_sufficient && g.identity_confidence >= 0.75 && g.source_count >= 2 && g.overview_chars >= 650 && g.key_ideas_chars >= 700 && g.summary_words >= 650 && g.analysis_words >= 350 && !g.banned_phrase;
  return g;
}

async function evidence(book, result, g) {
  const payload = {
    book_id: book.id, language: book.language, title: book.title, author: book.author, model: MODEL,
    evidence_status: g.pass ? "pass" : (result.out.evidence_status || "insufficient"),
    source_urls: result.urls, source_titles: result.titles, search_queries: result.queries,
    quality_gate: { ...g, evidence_note: clean(result.out.evidence_note).slice(0,2000) }, generated_at: new Date().toISOString()
  };
  await db("book_quality_evidence?on_conflict=book_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(payload) });
}

async function apply(book, out) {
  const patch = {
    overview: clean(out.overview), key_ideas: clean(out.key_ideas), deep_summary: clean(out.deep_summary), deep_analysis: clean(out.deep_analysis),
    daily_application: clean(out.daily_application) || null, reflection_questions: clean(out.reflection_questions) || null,
    action_system: clean(out.action_system) || null, reading_time: Math.max(8, Math.round((countWords(out.deep_summary) + countWords(out.deep_analysis) + countWords(out.overview)) / 220)),
    status: "published", is_draft: false
  };
  await db(`books?id=eq.${book.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
}

let books = [];
if (PILOT) {
  for (const title of pilotTitles) {
    const q = encodeURIComponent(title);
    const rows = await db(`books?select=id,title,author,category,language,status&status=eq.published_noindex&title=eq.${q}&limit=1`);
    if (rows?.[0]) books.push(rows[0]);
  }
} else {
  books = await db(`books?select=id,title,author,category,language,status&status=eq.published_noindex&is_draft=eq.false&order=language.asc,title.asc&limit=${LIMIT}`);
}
books = books.slice(0, LIMIT);
console.log(`Grounded quality repair: model=${MODEL} books=${books.length} apply=${APPLY}`);

const report = [];
for (const book of books) {
  try {
    console.log(`Researching ${book.language}: ${book.title} — ${book.author}`);
    const result = await generate(book);
    const g = gate(result);
    await evidence(book, result, g);
    if (APPLY && g.pass) await apply(book, result.out);
    report.push({ title: book.title, language: book.language, pass: g.pass, sources: g.source_count, queries: g.search_query_count, confidence: g.identity_confidence, summary_words: g.summary_words, analysis_words: g.analysis_words, applied: APPLY && g.pass, evidence_note: clean(result.out.evidence_note).slice(0,260) });
    console.log(JSON.stringify(report.at(-1)));
  } catch (e) {
    report.push({ title: book.title, language: book.language, pass: false, error: String(e).slice(0,500) });
    console.error(JSON.stringify(report.at(-1)));
  }
}
console.log("QUALITY_REPAIR_REPORT=" + JSON.stringify(report));
if (!report.length) process.exitCode = 2;
