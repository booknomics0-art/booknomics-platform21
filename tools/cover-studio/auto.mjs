#!/usr/bin/env node
// The cover loop: makes every remaining Hindi cover in one unattended run.
//
//   plan    For every published Hindi book that still has no cover (read live from Supabase), a text
//           model writes ONE realistic scene from that book's own story (its characters, place, era)
//           and picks a colour theme that suits it, never repeating the themes just used. Books whose
//           DB title is in Latin script also get their Devanagari title and author.
//   render  For every planned book: AI artwork (OpenAI Images, i.e. "ChatGPT images") → the approved
//           foil layout via compose.mjs → <slug>.jpg next to the manifest. The manifest is saved after
//           every cover, so a run that stops halfway simply continues next time.
//   all     plan, then render.
//
// USAGE
//   OPENAI_API_KEY=… node auto.mjs all
//   node auto.mjs render --limit 50 --concurrency 4 --minutes 300 --commit-every 20
//   node auto.mjs plan --dry                 # print what would be planned, write nothing
//   node auto.mjs render --only key1,slug2   # just these books
//
// ENV (shell or the repo-root .env)
//   Images need ONE key:  OPENAI_API_KEY (gpt-image-1)  or  GEMINI_API_KEY (Google AI Studio, gemini-2.5-flash-image)
//   Scenes use OpenAI when OPENAI_API_KEY is set, otherwise GitHub Models with GH_MODELS_TOKEN
//   (in Actions: the built-in GITHUB_TOKEN with `permissions: models: read`, no secret needed).
//   IMAGE_PROVIDER        openai | gemini (default: whichever key is present, OpenAI first)
//   IMAGE_MODEL           default gpt-image-1 / gemini-2.5-flash-image   IMAGE_QUALITY default medium (OpenAI only)
//   TEXT_MODEL            default gpt-4.1-mini (OpenAI) / openai/gpt-4.1-mini (GitHub Models)
//   OPENAI_BASE_URL, GEMINI_BASE_URL, GH_MODELS_URL   endpoint overrides (tests)
//   SUPABASE_URL or VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY   (read-only list of books)
//   COVER_ART_DIR         where the raw artwork is kept (default ~/cover-art-raw)
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) {
      a._.push(argv[i]);
      continue;
    }
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) a[k] = true;
    else (a[k] = next), i++;
  }
  return a;
}

async function loadDotEnv(file) {
  try {
    for (const line of (await fs.readFile(file, "utf8")).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — fine */
  }
}

const args = parseArgs(process.argv.slice(2));
const STEP = args._[0] || "all";
if (!["plan", "render", "all"].includes(STEP)) {
  console.error("Usage: node auto.mjs plan|render|all [--limit N] [--concurrency N] [--minutes N] [--commit-every N] [--only keys] [--dry]");
  process.exit(2);
}
await loadDotEnv(path.join(REPO, ".env"));
// Imported after .env is read: prompts.mjs picks up COVER_ART_DIR when it loads.
const { buildPrompt, DEFAULT_MANIFEST, ART_DIR } = await import("./prompts.mjs");
const { composeCover, writeCover } = await import("./compose.mjs");

const OPENAI = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const GEMINI = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GH_MODELS_URL = process.env.GH_MODELS_URL || "https://models.github.ai/inference/chat/completions";
const GH_MODELS_TOKEN = process.env.GH_MODELS_TOKEN || "";
const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER || (OPENAI_KEY ? "openai" : GEMINI_KEY ? "gemini" : "openai")).toLowerCase();
const IMAGE_MODEL = process.env.IMAGE_MODEL || (IMAGE_PROVIDER === "gemini" ? "gemini-2.5-flash-image" : "gpt-image-1");
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "medium";
const TEXT_PROVIDER = OPENAI_KEY ? "openai" : GH_MODELS_TOKEN ? "github" : "openai";
const TEXT_MODEL = process.env.TEXT_MODEL || (TEXT_PROVIDER === "github" ? "openai/gpt-4.1-mini" : "gpt-4.1-mini");
const SB = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const manifestPath = path.resolve(typeof args.manifest === "string" ? args.manifest : DEFAULT_MANIFEST);
const outDir = path.dirname(manifestPath);
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : Infinity;
const CONCURRENCY = Math.max(1, Number(args.concurrency) || 3);
const MINUTES = Number(args.minutes) > 0 ? Number(args.minutes) : Infinity;
const COMMIT_EVERY = Number(args["commit-every"]) || 0;
const DRY = Boolean(args.dry);
const only = args.only ? new Set(String(args.only).split(",").map((s) => s.trim())) : null;
const started = Date.now();
const inTime = () => (Date.now() - started) / 60000 < MINUTES;
const DEVA = /[\u0900-\u097F]/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const picked = (b) => !only || only.has(b.key) || only.has(b.slug);
// Entries without a status are pending (older manifest entries never got one).
const isOpen = (b) => !b.status || b.status === "pending" || b.status === "redo";

// Colour themes. Dark themes get the gold-foil title, light themes a deep ink title (ink = its colour).
export const THEMES = [
  { name: "crimson", mode: "dark", palette: "royal crimson, deep shadow, warm gold light" },
  { name: "purple", mode: "dark", palette: "deep royal purple, tarnished bronze, lamp amber" },
  { name: "slate teal", mode: "dark", palette: "slate grey, deep teal, one small warm light" },
  { name: "saffron", mode: "dark", palette: "saffron firelight, indigo night" },
  { name: "fiery orange", mode: "dark", palette: "fiery orange sky, black smoke, dusty ochre" },
  { name: "lavender", mode: "dark", palette: "smoky lavender dusk, ash grey" },
  { name: "storm blue", mode: "dark", palette: "storm steel blue, black clouds, gold firelight" },
  { name: "coral", mode: "dark", palette: "coral sunrise, deep blue dawn sky" },
  { name: "emerald", mode: "dark", palette: "deep emerald, moonlit white" },
  { name: "ink black", mode: "dark", palette: "ink-black night, ember orange glow" },
  { name: "amethyst", mode: "dark", palette: "amethyst violet shadows, antique gold" },
  { name: "charcoal", mode: "dark", palette: "charcoal, smoky grey, lantern amber" },
  { name: "copper", mode: "dark", palette: "burnished copper sunset, deep shadow" },
  { name: "turquoise", mode: "dark", palette: "turquoise, pomegranate red, dusk indigo" },
  { name: "firefly green", mode: "dark", palette: "night blue-black, firefly yellow-green" },
  { name: "midnight blue", mode: "dark", palette: "midnight blue, silver moonlight" },
  { name: "maroon", mode: "dark", palette: "deep maroon, old gold" },
  { name: "neon red", mode: "dark", palette: "wet night street, neon red, cyan reflections" },
  { name: "sodium yellow", mode: "dark", palette: "sodium-yellow streetlight, black night, haze" },
  { name: "rust", mode: "dark", palette: "rust red, dusty brown, low sun" },
  { name: "bottle green", mode: "dark", palette: "bottle green, brass, lamplight" },
  { name: "plum", mode: "dark", palette: "plum, rose gold, candlelight" },
  { name: "smoky grey", mode: "dark", palette: "smoky grey, cold blue, a single warm light" },
  { name: "yellow", mode: "light", palette: "mustard yellow, warm morning haze", ink: "#5A1C12" },
  { name: "pearl white", mode: "light", palette: "pearl-white mist, pale gold", ink: "#1F3448" },
  { name: "green", mode: "light", palette: "fresh leaf green, sunlight", ink: "#173D22" },
  { name: "rose pink", mode: "light", palette: "rose-pink sandstone, ivory light", ink: "#5E1B2E" },
  { name: "sapphire", mode: "light", palette: "sapphire blue, white marble, morning light", ink: "#132C5C" },
  { name: "olive", mode: "light", palette: "olive green, amber afternoon light", ink: "#33300F" },
  { name: "silver grey", mode: "light", palette: "silvery white, soft grey, almost black-and-white", ink: "#262626" },
  { name: "icy white", mode: "light", palette: "icy blue-white, pale grey", ink: "#1C3346" },
  { name: "marigold", mode: "light", palette: "warm cream, marigold orange", ink: "#6A2E0A" },
  { name: "peach", mode: "light", palette: "soft peach, rose, pearl", ink: "#5A2318" },
  { name: "bronze", mode: "light", palette: "dusty bronze, pale sky blue", ink: "#3E2A12" },
  { name: "glacier blue", mode: "light", palette: "glacial blue, snow white", ink: "#16324A" },
  { name: "terracotta", mode: "light", palette: "terracotta, ochre, olive", ink: "#4A1F12" },
  { name: "sky blue", mode: "light", palette: "clear sky blue, white clouds", ink: "#123A5A" },
  { name: "mint", mode: "light", palette: "mint green, white, soft daylight", ink: "#14403A" },
  { name: "lilac", mode: "light", palette: "lilac, lavender, soft white", ink: "#3D2350" },
  { name: "sand", mode: "light", palette: "desert sand, pale gold, hazy sky", ink: "#4A3315" },
  { name: "lemon", mode: "light", palette: "lemon yellow, fresh white", ink: "#4A4210" },
  { name: "blush", mode: "light", palette: "blush pink, cream", ink: "#5A1F33" },
  { name: "powder blue", mode: "light", palette: "powder blue, white, morning light", ink: "#1B3550" },
  { name: "indigo", mode: "dark", palette: "deep indigo night, lamp amber" },
  { name: "teal", mode: "dark", palette: "deep teal, brass, lantern amber" },
  { name: "sepia", mode: "dark", palette: "sepia brown, old gold, gaslight" },
  { name: "wine", mode: "dark", palette: "wine red, candle gold, deep shadow" },
  { name: "aubergine", mode: "dark", palette: "aubergine purple, dull gold, dusk" },
  { name: "petrol blue", mode: "dark", palette: "petrol blue, amber window light" },
  { name: "oxblood", mode: "dark", palette: "oxblood red, black, tarnished brass" },
  { name: "ivory", mode: "light", palette: "ivory, warm beige, soft daylight", ink: "#3B2A1A" },
  { name: "apricot", mode: "light", palette: "apricot dawn, cream, soft haze", ink: "#5A2A10" },
  { name: "sage", mode: "light", palette: "sage green, linen white, pale sky", ink: "#2F3F2A" },
  { name: "aqua", mode: "light", palette: "aqua, white, bright water light", ink: "#0F3D44" },
  { name: "seafoam", mode: "light", palette: "seafoam green, pale sand", ink: "#1D3F3A" },
  { name: "khaki", mode: "light", palette: "khaki, dust, pale sky", ink: "#3F3418" },
  { name: "baize green", mode: "dark", palette: "card-table baize green, cigarette smoke, one amber bulb" },
  { name: "gunmetal", mode: "dark", palette: "gunmetal grey, cold steel, one yellow work-lamp" },
  { name: "scarlet", mode: "dark", palette: "scarlet red, black shadow, candle gold" },
  { name: "absinthe", mode: "dark", palette: "sickly absinthe green, flickering tube-light, deep shadow" },
  { name: "ultramarine", mode: "dark", palette: "ultramarine sea at dusk, white deck lamps, storm clouds" },
  { name: "moonstone", mode: "dark", palette: "moonstone blue-grey night, white torch beams" },
  { name: "ochre", mode: "light", palette: "ochre earth, dusty gold evening sky", ink: "#4A2E0A" },
  { name: "eucalyptus", mode: "light", palette: "eucalyptus grey-green, misty white morning", ink: "#23382F" },
  { name: "jade", mode: "light", palette: "jade-green harbour water, hazy morning sky", ink: "#0F3A2E" },
  { name: "champagne", mode: "light", palette: "champagne gold, cream marble, morning light", ink: "#4A3A1A" },
  { name: "cobalt", mode: "dark", palette: "cobalt-blue night, wet reflections, one red neon glow" },
  { name: "walnut", mode: "dark", palette: "polished walnut wood, brass lamp, deep brown shadow" },
  { name: "rani pink", mode: "dark", palette: "rani-pink and magenta festival lights, black night" },
  { name: "violet dusk", mode: "dark", palette: "violet dusk sky, sodium lamps, smoke" },
  { name: "tobacco", mode: "dark", palette: "tobacco brown, gold rings, tungsten light" },
  { name: "dawn mauve", mode: "light", palette: "pale mauve dawn, soft grey, washed walls", ink: "#3E2A40" },
  { name: "buttercream", mode: "light", palette: "buttercream walls, warm morning sun, khaki", ink: "#4A3B12" },
  { name: "parchment", mode: "light", palette: "parchment cream, warm wood, daylight", ink: "#3D2B16" },
  { name: "pewter", mode: "light", palette: "pewter grey, hazy daylight, steam", ink: "#2E3540" },
  { name: "tangerine", mode: "light", palette: "tangerine and lemon street colours, bright noon", ink: "#5A2A08" },
  { name: "graphite", mode: "dark", palette: "graphite grey, cold moonlight, rope brown" },
  { name: "mustard", mode: "light", palette: "mustard yellow, khaki, hot white noon", ink: "#4A3A08" },
  { name: "electric blue", mode: "dark", palette: "electric-blue night, city lights below" },
  { name: "mahogany", mode: "dark", palette: "mahogany wood, crystal sparkle, flashbulb white" },
  { name: "alpenglow", mode: "light", palette: "pink-gold dawn on snow, deep blue shadows", ink: "#3A2A3E" },
  { name: "ash", mode: "light", palette: "ash grey dust, white cloth, overcast light", ink: "#2F2F33" },
  { name: "quicksilver", mode: "dark", palette: "quicksilver mirror reflections, cold cyan light" },
  { name: "sulphur", mode: "dark", palette: "sulphur-yellow torchlight, black rock" },
  { name: "verdigris", mode: "dark", palette: "verdigris green-blue, white projector beam" },
  { name: "fog white", mode: "light", palette: "white fog lit by a headlight, cold blue edges", ink: "#22303A" },
];
const FONT_ROTATION = ["vesper", "sahitya", "kadwa", "vesper", "sura", "martel", "vesper", "rozha"];

const SYSTEM = `You plan photorealistic book-cover scenes for Booknomics, a site of Hindi book summaries.
For every book you get (title, author, category, and "about" = the site's own overview), return one plan.

concept: ONE specific, vivid moment from THIS book's story with its real characters — names, rough ages,
  period-accurate clothing, what they are doing, their expressions — and the setting with its light.
  Format: "<place, era>, from <author>'s <work>: <the scene>". 60–110 words, plain English.
  Non-fiction, poetry or criticism: show a real-life scene that embodies the book's subject (real people,
  place, era) — never abstract symbols. Crime thrillers: a tense noir moment with the story's own people
  (detective, reporter, suspect…) in 1970s–90s Indian cities; danger implied, never shown.
Hard rules for the concept:
  - It must work as a real photograph from a film: no fantasy glow, no CGI creatures, no floating objects.
  - Gods and epic heroes in their traditional look (e.g. Krishna youthful, dark-skinned and clean-shaven,
    with a peacock feather).
  - Period-accurate costume, arms and architecture for the place and era (no Roman or Greek armour in ancient
    India; nothing modern in old stories).
  - No gore, blood, corpses, nudity or weapons aimed at the viewer.
  - No readable text anywhere: no signs, newspapers, inscriptions, letters or posters.
  - People in the lower two-thirds; the top third stays open (sky, ceiling, dark background).
theme: one name from THEMES that fits the story's mood and place; never one of RECENT; mix light and dark.
  Thrillers too should vary their colour (neon red, sodium-yellow streetlight, teal rain, purple club light,
  harsh noon sun…), not always black.
palette: 3–5 colour words that match the theme and the scene.
title_hi: the title in Devanagari. If the given title is already Devanagari, copy it exactly. If it is in
  Latin script, give the established Hindi/Devanagari form of the work's title (transliterate the original
  title, e.g. "Aranyak" → "आरण्यक"); do not translate into English.
author_hi: the author's name in standard Hindi Devanagari spelling.

Answer with JSON only: {"books":[{"id","title_hi","author_hi","concept","theme","palette"}]}`;

// ---------------------------------------------------------------- helpers

/** POST JSON with retries; errors carry .blocked (moderation) and .fatal (stop the run). */
async function postJSON(url, headers, body, { tries = 6 } = {}) {
  for (let attempt = 1; ; attempt++) {
    let res;
    let text;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      text = await res.text();
    } catch (e) {
      if (attempt >= tries) throw e;
      await sleep(2000 * attempt);
      continue;
    }
    if (res.ok) return JSON.parse(text);
    let err = {};
    try {
      err = JSON.parse(text).error || {};
    } catch {
      /* not JSON */
    }
    const code = String(err.code || err.status || err.type || "");
    const msg = String(err.message || text).slice(0, 400);
    const quota = /insufficient_quota|billing/i.test(code + " " + msg);
    if ((res.status === 429 || res.status >= 500) && !quota && attempt < tries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(60000, 3000 * 2 ** (attempt - 1)));
      continue;
    }
    const e = new Error(`${res.status} ${code} ${msg}`.replace(/\s+/g, " ").trim());
    e.blocked = res.status === 400 && /moderation|safety|content.?policy|blocked/i.test(`${code} ${msg}`);
    e.fatal =
      res.status === 401 || res.status === 403 || res.status === 429 || quota ||
      /api key not valid|model.*(not found|does not exist)|must be verified|not supported for generatecontent/i.test(msg);
    throw e;
  }
}

async function openai(pathname, body, opts) {
  if (!OPENAI_KEY) throw Object.assign(new Error("OPENAI_API_KEY is not set"), { fatal: true });
  return postJSON(`${OPENAI}${pathname}`, { Authorization: `Bearer ${OPENAI_KEY}` }, body, opts);
}

/** Chat completion for scene planning: OpenAI if keyed, else GitHub Models (free with GITHUB_TOKEN). */
async function textChat(body) {
  if (TEXT_PROVIDER === "github") return postJSON(GH_MODELS_URL, { Authorization: `Bearer ${GH_MODELS_TOKEN}` }, { ...body, model: TEXT_MODEL });
  return openai("/chat/completions", body);
}

/** One image from Gemini (2:3). Retries a reply that carries no image; safety stops become .blocked. */
async function geminiImage(prompt) {
  if (!GEMINI_KEY) throw Object.assign(new Error("GEMINI_API_KEY is not set"), { fatal: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await postJSON(
      `${GEMINI}/models/${IMAGE_MODEL}:generateContent`,
      { "x-goog-api-key": GEMINI_KEY },
      { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "2:3" } } },
    );
    const cand = res?.candidates?.[0];
    const part = (cand?.content?.parts || []).find((x) => x.inlineData?.data || x.inline_data?.data);
    if (part) return Buffer.from((part.inlineData || part.inline_data).data, "base64");
    const blockReason = res?.promptFeedback?.blockReason;
    const why = blockReason || cand?.finishReason || "no image";
    if (blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/i.test(why)) {
      throw Object.assign(new Error(`gemini: ${why}`), { blocked: true });
    }
    if (attempt === 3) throw new Error(`gemini returned no image (${why})`);
    await sleep(3000 * attempt);
  }
}

async function fetchCoverless() {
  if (!SB || !SB_KEY) throw new Error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and VITE_SUPABASE_PUBLISHABLE_KEY to read the book list.");
  const headers = SB_KEY.startsWith("sb_") ? { apikey: SB_KEY } : { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const url = `${SB}/rest/v1/books?select=id,slug,title,author,category,overview&language=eq.hi&is_draft=eq.false&status=eq.published&cover_url=is.null&order=title&limit=500&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

let saving = Promise.resolve();
function saveManifest(m) {
  if (DRY) return Promise.resolve();
  saving = saving.then(() => fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n"));
  return saving;
}

const git = (...a) => execFileSync("git", a, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] }).toString();
let committing = Promise.resolve();
function commit(files, message) {
  if (DRY || !COMMIT_EVERY || !files.length) return committing;
  committing = committing.then(async () => {
    await saving;
    try {
      git("add", "--", path.relative(REPO, manifestPath), ...files.map((f) => path.relative(REPO, f)));
      git("commit", "-q", "-m", message);
    } catch (e) {
      console.warn(`! commit skipped: ${String(e.stderr || e.message).trim().slice(0, 200)}`);
      return;
    }
    const branch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
    for (let i = 1; i <= 4; i++) {
      try {
        git("pull", "-q", "--rebase", "--autostash", "origin", branch);
        git("push", "-q", "origin", `HEAD:${branch}`);
        console.log(`↑ pushed: ${message}`);
        return;
      } catch (e) {
        console.warn(`! push attempt ${i} failed: ${String(e.stderr || e.message).trim().slice(0, 200)}`);
        await sleep(5000 * i);
      }
    }
  });
  return committing;
}

async function summary(lines) {
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n\n");
}

// ---------------------------------------------------------------- plan

function chooseTheme(name, recent, usage) {
  const wanted = THEMES.find((t) => t.name === String(name || "").toLowerCase().trim());
  if (wanted && !recent.slice(-6).includes(wanted.name)) return wanted;
  // Fallback: the least-used theme of the wanted mode (or the other mode than the last one) not used recently.
  const lastMode = THEMES.find((t) => t.name === recent.at(-1))?.mode;
  const mode = wanted?.mode || (lastMode === "dark" ? "light" : "dark");
  const pool = THEMES.filter((t) => t.mode === mode && !recent.slice(-10).includes(t.name));
  return (pool.length ? pool : THEMES).slice().sort((a, b) => (usage[a.name] || 0) - (usage[b.name] || 0))[0];
}

async function plan(manifest) {
  const live = new Map((await fetchCoverless()).map((r) => [r.id, r]));
  const byId = new Map(manifest.books.map((b) => [b.id, b]));
  console.log(`Supabase: ${live.size} published Hindi books without a cover.`);

  // Books that got a cover (or were unpublished) since they were added: leave them alone.
  let gone = 0;
  for (const b of manifest.books)
    if (isOpen(b) && !live.has(b.id)) {
      b.status = "skipped";
      b.note = "no longer in the cover-less list (has a cover now, or unpublished)";
      gone++;
    }

  // New books → new manifest entries, in 50-book batches.
  let batch = Math.max(0, ...manifest.books.map((b) => b.batch || 0));
  let inBatch = manifest.books.filter((b) => b.batch === batch).length;
  let added = 0;
  for (const r of live.values()) {
    if (byId.has(r.id)) continue;
    if (batch === 0 || inBatch >= 50) (batch += 1), (inBatch = 0);
    const e = { key: `b-${r.id.slice(0, 8)}`, id: r.id, slug: r.slug, title: r.title, author: r.author, category: r.category, file: `${r.slug}.jpg`, status: "pending", batch };
    manifest.books.push(e);
    byId.set(r.id, e);
    inBatch++;
    added++;
  }

  const usage = {};
  const recent = [];
  for (const b of manifest.books) {
    const name = b.theme ? b.theme.split(" · ")[0] : null;
    if (name) (usage[name] = (usage[name] || 0) + 1), recent.push(name);
  }
  const todo = manifest.books.filter((b) => isOpen(b) && !b.theme && live.has(b.id) && picked(b)).slice(0, LIMIT);
  console.log(`${added} new book(s) added, ${gone} skipped, ${todo.length} to plan.`);

  let planned = 0;
  const problems = [];
  const PER = TEXT_PROVIDER === "github" ? 4 : 6; // GitHub Models free tier: ~8k input tokens per request
  for (let i = 0; i < todo.length && inTime(); i += PER) {
    const chunk = todo.slice(i, i + PER);
    const payload = {
      THEMES: THEMES.map((t) => `${t.name} (${t.mode})`),
      RECENT: recent.slice(-6),
      books: chunk.map((b) => {
        const r = live.get(b.id);
        return { id: b.id, title: r.title, author: r.author, category: r.category, about: String(r.overview || "").replace(/\s+/g, " ").slice(0, TEXT_PROVIDER === "github" ? 1000 : 1400) };
      }),
    };
    let plans = [];
    try {
      const res = await textChat({
        model: TEXT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      plans = JSON.parse(res.choices?.[0]?.message?.content || "{}").books || [];
    } catch (e) {
      if (e.fatal) throw e;
      problems.push(`${chunk.map((b) => b.title).join(", ")}: ${e.message}`);
      continue;
    }
    for (const b of chunk) {
      const p = plans.find((x) => x.id === b.id);
      if (!p?.concept) {
        problems.push(`${b.title}: no plan returned`);
        continue;
      }
      const t = chooseTheme(p.theme, recent, usage);
      b.concept = String(p.concept).trim();
      b.palette = String(p.palette || t.palette).trim();
      b.theme = `${t.name} · ${t.mode}`;
      b.mode = t.mode;
      if (t.ink) b.ink = t.ink;
      else delete b.ink;
      if (!DEVA.test(b.title)) {
        if (p.title_hi && DEVA.test(p.title_hi)) b.titleDisplay = String(p.title_hi).trim();
        else problems.push(`${b.title}: no Devanagari title`);
      }
      if (!DEVA.test(b.authorDisplay || b.author) && p.author_hi && DEVA.test(p.author_hi)) b.authorDisplay = String(p.author_hi).trim();
      b.font = b.font || FONT_ROTATION[manifest.books.indexOf(b) % FONT_ROTATION.length];
      b.plannedBy = TEXT_MODEL;
      usage[t.name] = (usage[t.name] || 0) + 1;
      recent.push(t.name);
      planned++;
      if (DRY) console.log(`• ${b.titleDisplay || b.title} — ${b.theme}\n  ${b.concept}`);
    }
    await saveManifest(manifest);
    console.log(`planned ${planned}/${todo.length}`);
  }
  await saveManifest(manifest);
  await summary([`### Plan: ${planned} scene(s) written, ${added} new book(s), ${gone} skipped`, ...problems.map((p) => `- ${p}`)]);
}

// ---------------------------------------------------------------- render

async function renderOne(b) {
  const prompt = buildPrompt(b);
  let bytes;
  if (IMAGE_PROVIDER === "gemini") {
    bytes = await geminiImage(prompt);
  } else {
    const dalle = IMAGE_MODEL.startsWith("dall-e");
    const res = await openai(
      "/images/generations",
      dalle
        ? { model: IMAGE_MODEL, prompt, n: 1, size: "1024x1792", quality: IMAGE_QUALITY === "high" ? "hd" : "standard", response_format: "b64_json" }
        : { model: IMAGE_MODEL, prompt, n: 1, size: "1024x1536", quality: IMAGE_QUALITY },
    );
    const item = res?.data?.[0] || {};
    if (item.b64_json) bytes = Buffer.from(item.b64_json, "base64");
    else if (item.url) bytes = Buffer.from(await (await fetch(item.url)).arrayBuffer());
    else throw new Error("the image API returned no image");
  }
  await fs.mkdir(ART_DIR, { recursive: true });
  const artPath = path.join(ART_DIR, `${b.key}.png`);
  await fs.writeFile(artPath, bytes);
  const png = await composeCover({ ...b, art: artPath });
  b.file = (b.file || `${b.slug}.jpg`).replace(/\.webp$/i, ".jpg");
  const out = path.join(outDir, b.file);
  await writeCover(png, out);
  b.status = "done";
  b.imageModel = `${IMAGE_PROVIDER}/${IMAGE_MODEL}`;
  b.renderedAt = new Date().toISOString();
  delete b.renderError;
  delete b.note;
  return out;
}

async function render(manifest) {
  const queue = manifest.books
    .filter((b) => isOpen(b) && b.theme && b.concept && DEVA.test(b.titleDisplay || b.title) && picked(b))
    .slice(0, LIMIT);
  console.log(`${queue.length} cover(s) to render with ${IMAGE_PROVIDER}/${IMAGE_MODEL}${IMAGE_PROVIDER === "openai" ? ` (${IMAGE_QUALITY})` : ""}, ${CONCURRENCY} at a time; scenes by ${TEXT_PROVIDER}/${TEXT_MODEL}.`);
  if (DRY) {
    for (const b of queue) console.log(`• ${b.titleDisplay || b.title} — ${b.theme}`);
    return;
  }
  const made = [];
  const blocked = [];
  const failed = [];
  let pendingFiles = [];
  let next = 0;
  let fatal = null;

  async function worker() {
    while (next < queue.length && inTime() && !fatal) {
      const b = queue[next++];
      try {
        const out = await renderOne(b);
        made.push(out);
        pendingFiles.push(out);
        console.log(`✓ ${made.length}/${queue.length}  ${b.titleDisplay || b.title} — ${b.authorDisplay || b.author}  (${b.theme})`);
      } catch (e) {
        if (e.fatal) {
          fatal = e;
          break;
        }
        if (e.blocked) {
          b.status = "blocked";
          b.note = `image moderation: ${e.message.slice(0, 200)}`;
          blocked.push(b.titleDisplay || b.title);
        } else {
          b.renderError = e.message.slice(0, 300);
          failed.push(`${b.titleDisplay || b.title}: ${e.message.slice(0, 160)}`);
        }
        console.warn(`! ${b.titleDisplay || b.title}: ${e.message.slice(0, 200)}`);
      }
      await saveManifest(manifest);
      if (COMMIT_EVERY && pendingFiles.length >= COMMIT_EVERY) {
        const files = pendingFiles;
        pendingFiles = [];
        await commit(files, `Hindi covers (auto): ${made.length} of ${queue.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
  await saveManifest(manifest);

  // A contact sheet of this run's newest covers, for a quick look.
  const sheetFiles = made.slice(-40);
  if (sheetFiles.length) {
    try {
      execFileSync("node", [path.join(HERE, "sheet.mjs"), path.join(outDir, "_preview-latest.jpg"), ...sheetFiles, "--cols", "8", "--w", "240"], { stdio: "ignore" });
      pendingFiles.push(path.join(outDir, "_preview-latest.jpg"));
    } catch {
      /* the sheet is optional */
    }
  }
  await commit(pendingFiles, `Hindi covers (auto): ${made.length} made this run`);
  await committing;

  const left = manifest.books.filter((b) => isOpen(b) && picked(b)).length;
  await summary([
    `### Render: ${made.length} cover(s) made, ${blocked.length} blocked by moderation, ${failed.length} failed, ${left} still to do`,
    fatal ? `**Stopped:** ${fatal.message}` : !inTime() ? "Stopped at the time limit; run again to continue." : "",
    ...blocked.map((t) => `- blocked: ${t}`),
    ...failed.map((t) => `- failed: ${t}`),
  ].filter(Boolean));
  if (fatal) process.exitCode = 1;
}

// ---------------------------------------------------------------- main

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
try {
  if (STEP === "plan" || STEP === "all") await plan(manifest);
  if ((STEP === "render" || STEP === "all") && inTime()) await render(manifest);
} catch (e) {
  await saveManifest(manifest);
  await summary([`**Stopped:** ${e.message}`]);
  process.exitCode = 1;
}
