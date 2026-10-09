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
//   merge   Fold the per-cover result files of a sharded run (--results DIR) into the manifest, refresh the
//           README progress rows and the preview sheet, and remove DIR.
//
// KEYLESS ENGINE (workflow .github/workflows/cover-engine.yml, started by editing engine/run.json):
//   scenes come from GitHub Models with the built-in GITHUB_TOKEN, the art from FLUX.1-schnell run on the
//   Actions runners' own CPUs with stable-diffusion.cpp (IMAGE_PROVIDER=local). The plan step freezes the
//   work list (--queue FILE); many runners then render it in parallel (--shard i/n), each pushing its covers
//   plus one small result file per cover as it goes, and a final merge step updates the manifest.
//
// USAGE
//   OPENAI_API_KEY=… node auto.mjs all
//   node auto.mjs render --limit 50 --concurrency 4 --minutes 300 --commit-every 20
//   node auto.mjs plan --dry                 # print what would be planned, write nothing
//   node auto.mjs render --only key1,slug2   # just these books
//   node auto.mjs plan --plan-per 6 --queue q.json             # plan, then freeze the render list
//   node auto.mjs render --queue q.json --shard 3/40 --results DIR --commit-every 1   # one engine runner
//   node auto.mjs merge --results DIR --commit-every 1
//
// ENV (shell or the repo-root .env)
//   Images need ONE key:  OPENAI_API_KEY (gpt-image-1)  or  GEMINI_API_KEY (Google AI Studio, gemini-2.5-flash-image)
//   Scenes use OpenAI when OPENAI_API_KEY is set, otherwise GitHub Models with GH_MODELS_TOKEN
//   (in Actions: the built-in GITHUB_TOKEN with `permissions: models: read`, no secret needed).
//   IMAGE_PROVIDER        openai | gemini | local (default: whichever key is present, OpenAI first; local when
//                         only SD_BIN is set)
//   SD_BIN, SD_MODELS     local: the stable-diffusion.cpp binary and the folder with the FLUX files
//   SD_FLUX, SD_T5, SD_CLIP, SD_VAE   file names (default flux1-schnell-Q4_0.gguf, t5xxl-Q8_0.gguf, clip_l.safetensors, ae.safetensors)
//   SD_W, SD_H, SD_STEPS, SD_THREADS, SD_FLAGS, SD_TIMEOUT_MIN   size (640x960), steps (4), threads, extra flags, timeout
//   IMAGE_MODEL           default gpt-image-1 / gemini-2.5-flash-image   IMAGE_QUALITY default medium (OpenAI only)
//   TEXT_MODEL            default gpt-4.1-mini (OpenAI) / openai/gpt-4.1-mini (GitHub Models)
//   OPENAI_BASE_URL, GEMINI_BASE_URL, GH_MODELS_URL   endpoint overrides (tests)
//   SUPABASE_URL or VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY   (read-only list of books)
//   COVER_ART_DIR         where the raw artwork is kept (default ~/cover-art-raw)
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
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
if (!["plan", "render", "all", "merge"].includes(STEP)) {
  console.error("Usage: node auto.mjs plan|render|all|merge [--limit N] [--concurrency N] [--minutes N] [--commit-every N] [--only keys] [--dry] [--plan-per N] [--queue FILE] [--shard i/n] [--results DIR]");
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
const SD_BIN = process.env.SD_BIN || "";
const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER || (OPENAI_KEY ? "openai" : GEMINI_KEY ? "gemini" : SD_BIN ? "local" : "openai")).toLowerCase();
const IMAGE_MODEL = process.env.IMAGE_MODEL || (IMAGE_PROVIDER === "gemini" ? "gemini-2.5-flash-image" : IMAGE_PROVIDER === "local" ? "flux.1-schnell" : "gpt-image-1");
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
// Engine: a frozen render list, this runner's share of it, and where per-cover results go.
const QUEUE = typeof args.queue === "string" ? path.resolve(args.queue) : "";
const SHARD = /^\d+\/\d+$/.test(String(args.shard || "")) ? String(args.shard).split("/").map(Number) : null; // [i, n]
const RESULTS = typeof args.results === "string" ? path.resolve(args.results) : "";
const SHARDED = STEP === "render" && Boolean(RESULTS); // render runners never write the manifest
const PLAN_PER = Number(args["plan-per"]) || 0;
const started = Date.now();
const inTime = () => (Date.now() - started) / 60000 < MINUTES;
const DEVA = /[\u0900-\u097F]/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const picked = (b) => !only || only.has(b.key) || only.has(b.slug);
// Entries without a status are pending (older manifest entries never got one).
const isOpen = (b) => !b.status || b.status === "pending" || b.status === "redo";
const renderable = (b) => isOpen(b) && b.theme && b.concept && DEVA.test(b.titleDisplay || b.title) && picked(b);

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
  { name: "tempest", mode: "dark", palette: "tempest grey-green, lightning white, lantern amber" },
  { name: "rose gold", mode: "dark", palette: "rose-gold spotlight, smoky black club" },
  { name: "moss", mode: "dark", palette: "moss-green stone, lantern gold, midnight" },
  { name: "kesari night", mode: "dark", palette: "saffron sandstone, black moonless sky, torch fire" },
  { name: "nightshade", mode: "dark", palette: "nightshade purple, emerald silk, candlelight" },
  { name: "frost", mode: "light", palette: "frosted window white, pale lilac, cold daylight", ink: "#2E2A48" },
  { name: "monsoon", mode: "light", palette: "wet monsoon green, soft grey sky", ink: "#1F3A2A" },
  { name: "phosphor", mode: "dark", palette: "green-blue monitor glow, dark room" },
  { name: "flamingo", mode: "light", palette: "flamingo-pink dusk sky, sea grey", ink: "#5A2236" },
  { name: "honey", mode: "light", palette: "honey-gold dawn, whitewashed verandah", ink: "#4A3410" },
  { name: "vermilion", mode: "dark", palette: "vermilion silk, sacred-fire glow, night" },
  { name: "cerulean", mode: "light", palette: "wide cerulean sky, white cotton, morning", ink: "#133A5C" },
  { name: "comet blue", mode: "dark", palette: "deep twilight blue, pale comet trail, lamp gold" },
  { name: "laterite", mode: "light", palette: "laterite red earth, white mundu, overcast monsoon light", ink: "#5A2414" },
  { name: "concrete", mode: "light", palette: "concrete grey, white shirts, flat daylight", ink: "#2B2F33" },
  { name: "amber", mode: "dark", palette: "amber lamplight, dark teak, evening" },
  { name: "areca", mode: "dark", palette: "areca-palm green, blue moonlight" },
  { name: "marble", mode: "light", palette: "white marble, gilt, soft daylight", ink: "#3A3226" },
  { name: "haldi", mode: "light", palette: "turmeric yellow, marigold, white rangoli, morning", ink: "#4A3608" },
  { name: "first light", mode: "light", palette: "peach-gold first light, misty valley grey", ink: "#4A2A1C" },
  { name: "malnad green", mode: "light", palette: "wet areca-palm green, whitewashed verandah, pale monsoon sky", ink: "#1E3A24" },
  { name: "camp smoke", mode: "dark", palette: "slate monsoon sky, cooking-fire smoke, mud brown, faded tarpaulin blue" },
  { name: "after-rain silver", mode: "light", palette: "rain-washed silver grey, white cotton, wet leaf green", ink: "#24323C" },
  { name: "courtroom teak", mode: "dark", palette: "dark teak benches, black gowns, white shafts of noon light" },
  { name: "footlight gold", mode: "dark", palette: "warm mirror-bulb gold, crimson silk, deep backstage shadow" },
  { name: "lantern ochre", mode: "dark", palette: "hurricane-lantern ochre, banyan-night green, white cotton" },
  { name: "limewash", mode: "light", palette: "lime-washed white walls, faded indigo doors, harsh noon glare", ink: "#262C48" },
  { name: "monsoon violet", mode: "dark", palette: "violet monsoon dusk, sodium-orange streetlight, wet asphalt" },
  { name: "pastel flat", mode: "light", palette: "pastel-pink new walls, white mosaic floor, bright afternoon sun", ink: "#4A2438" },
  { name: "swing brass", mode: "light", palette: "ivory walls, polished brass swing, soft evening daylight, a touch of saffron", ink: "#3E2C10" },
];
const FONT_ROTATION = ["vesper", "sahitya", "kadwa", "vesper", "sura", "martel", "vesper", "rozha"];

const SYSTEM = `You plan photorealistic book-cover scenes for Booknomics, a site of Hindi book summaries.
For every book you get (title, author, category, and "about" = the site's own overview), return one plan.

STORY ACCURACY (most important): use a book's real plot and characters ONLY when you truly know them. The "about"
text is often a generic study-guide template with no plot; never treat it as the story. If you do not reliably know
the story, build the scene from the title's meaning plus the book's language region, period and genre, with
unnamed, ordinary people. Never invent character names or plot events, and never mention a name you are unsure of.

concept: ONE specific, vivid moment — the people (rough ages, period-accurate clothing, what they are doing, their
  expressions) and the setting with its light. Format: "<place, era>, from <author>'s <work>: <the scene>".
  45–80 words, plain English. Non-fiction, poetry, spirituality, history or criticism: a real-life scene that
  embodies the book's subject (real people, place, era), never abstract symbols. Crime thrillers: a tense noir
  moment in 1970s–90s Indian cities; danger implied, never shown.
Hard rules for the concept:
  - It must work as a real photograph from a film: no fantasy glow, no CGI creatures, no floating objects.
  - Gods and epic heroes in their traditional look (e.g. Krishna youthful, dark-skinned and clean-shaven,
    with a peacock feather).
  - Period-accurate costume, arms and architecture for the place and era (Kerala, Bengal, Odisha, Tamil Nadu,
    Karnataka, Andhra, Gujarat and Maharashtra each look different; nothing modern in old stories).
  - No gore, blood, corpses, nudity or weapons aimed at the viewer.
  - No readable text anywhere: no signs, newspapers, inscriptions, letters or posters.
  - People in the lower two-thirds; the top third stays open (sky, ceiling, wall, dark background).
theme: INVENT a short, evocative English name (1–3 words) for this cover's own colour theme, taken from the
  scene's light and colours (e.g. "monsoon jade", "sodium noir", "chalk noon", "lantern ochre"). It must be NEW:
  not in RECENT and not shared with another book in this request. Vary the hue from book to book — red, blue,
  green, yellow, violet, teal, ochre, white, black — and mix light and dark across the request.
mode: "light" when the top third is bright (day sky, pale wall), "dark" when it is night, shadow or low-key.
palette: 3–5 colour words that match the theme and the scene.
title_hi: the title in Devanagari. If the given title is already Devanagari, copy it exactly. If it is in
  Latin script, give the established Hindi/Devanagari form of the work's title (transliterate the original
  title, e.g. "Aranyak" → "आरण्यक"); do not translate into English.
author_hi: the author's name in standard Hindi Devanagari spelling.

Answer with JSON only: {"books":[{"id","title_hi","author_hi","concept","theme","mode","palette"}]}`;

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

const execFileP = promisify(execFile);
const SD = {
  models: process.env.SD_MODELS || path.join(REPO, "models"),
  flux: process.env.SD_FLUX || "flux1-schnell-Q4_0.gguf",
  t5: process.env.SD_T5 || "t5xxl-Q8_0.gguf",
  clip: process.env.SD_CLIP || "clip_l.safetensors",
  vae: process.env.SD_VAE || "ae.safetensors",
  w: Number(process.env.SD_W) || 640,
  h: Number(process.env.SD_H) || 960,
  steps: Number(process.env.SD_STEPS) || 4,
  threads: Number(process.env.SD_THREADS) || 0,
  flags: String(process.env.SD_FLAGS || "").split(/\s+/).filter(Boolean),
  timeoutMin: Number(process.env.SD_TIMEOUT_MIN) || 45,
};
/** Stable per-book seed, so a re-run of the same book gives the same picture. */
function seedOf(key) {
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 2147483647;
}
/** One picture from FLUX.1-schnell on this machine's CPU (stable-diffusion.cpp). No key, no network. */
async function localImage(b) {
  if (!SD_BIN) throw Object.assign(new Error("SD_BIN is not set"), { fatal: true });
  const { fluxPrompt } = await import("./engine/flux-prompt.mjs");
  await fs.mkdir(ART_DIR, { recursive: true });
  const out = path.join(ART_DIR, `${b.key}.flux.png`);
  const m = (f) => (path.isAbsolute(f) ? f : path.join(SD.models, f));
  const argv = [
    "--diffusion-model", m(SD.flux), "--vae", m(SD.vae), "--clip_l", m(SD.clip), "--t5xxl", m(SD.t5),
    "-p", fluxPrompt(b), "--cfg-scale", "1.0", "--sampling-method", "euler", "--steps", String(SD.steps),
    "-W", String(SD.w), "-H", String(SD.h), "-s", String(seedOf(b.key) + (Number(b.seedBump) || 0)), "-o", out, ...SD.flags,
  ];
  if (SD.threads) argv.push("-t", String(SD.threads));
  const t0 = Date.now();
  try {
    await execFileP(SD_BIN, argv, { maxBuffer: 256 * 1024 * 1024, timeout: SD.timeoutMin * 60000, killSignal: "SIGKILL" });
  } catch (e) {
    const tail = String(e.stderr || e.stdout || e.message).trim().split("\n").slice(-4).join(" | ");
    throw new Error(`stable-diffusion.cpp failed${e.killed ? " (timeout)" : ""}: ${tail.slice(0, 300)}`);
  }
  console.log(`  art ${b.key}: ${Math.round((Date.now() - t0) / 1000)}s`);
  return fs.readFile(out);
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
  if (DRY || SHARDED) return Promise.resolve();
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
      git("add", "-A", "--", ...(SHARDED ? [] : [path.relative(REPO, manifestPath)]), ...files.map((f) => path.relative(REPO, f)));
      git("commit", "-q", "-m", message);
    } catch (e) {
      console.warn(`! commit skipped: ${String(e.stderr || e.message).trim().slice(0, 200)}`);
      return;
    }
    const branch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
    for (let i = 1; i <= 10; i++) {
      try {
        git("pull", "-q", "--rebase", "--autostash", "origin", branch);
        git("push", "-q", "origin", `HEAD:${branch}`);
        console.log(`↑ pushed: ${message}`);
        return;
      } catch (e) {
        console.warn(`! push attempt ${i} failed: ${String(e.stderr || e.message).trim().slice(0, 200)}`);
        await sleep(3000 * i + Math.random() * 4000);
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

/** The planner invents the theme name; make sure no other cover has used it. */
function uniqueTheme(p, used) {
  const clean = (x) => String(x || "").toLowerCase().replace(/[^a-z' -]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  const words = String(p.palette || "").toLowerCase().match(/[a-z]+/g) || [];
  let name = clean(p.theme) || words.slice(0, 2).join(" ") || "untitled";
  const known = THEMES.find((t) => t.name === name);
  let mode = p.mode === "light" || p.mode === "dark" ? p.mode : known?.mode;
  if (!mode) mode = /night|dark|noir|shadow|dusk|midnight|lamp|lantern|ember|smoke|ink|coal|storm/.test(`${name} ${words.join(" ")}`) ? "dark" : "light";
  if (used.has(name)) {
    const alt = words.map((w) => `${name} ${w}`).find((c) => !used.has(c) && c.split(" ").length <= 4 && !name.split(" ").includes(c.split(" ").pop()));
    if (alt) name = alt;
    else for (let i = 2; used.has(name); i++) name = `${clean(p.theme) || "untitled"} ${["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][i - 2] || i}`;
  }
  used.add(name);
  return { name, mode };
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

  const used = new Set();
  const recent = [];
  for (const b of manifest.books) {
    const name = b.theme ? b.theme.split(" · ")[0] : null;
    if (name) used.add(name), recent.push(b.theme);
  }
  const todo = manifest.books.filter((b) => isOpen(b) && !b.theme && live.has(b.id) && picked(b)).slice(0, LIMIT);
  console.log(`${added} new book(s) added, ${gone} skipped, ${todo.length} to plan.`);

  let planned = 0;
  const problems = [];
  const PER = PLAN_PER || (TEXT_PROVIDER === "github" ? 4 : 6); // GitHub Models free tier: ~8k input tokens per request
  let rateLimited = 0;
  for (let i = 0; i < todo.length && inTime(); i += PER) {
    const chunk = todo.slice(i, i + PER);
    const payload = {
      RECENT: recent.slice(-24),
      books: chunk.map((b) => {
        const r = live.get(b.id);
        return { id: b.id, title: r.title, author: r.author, category: r.category, about: String(r.overview || "").replace(/\s+/g, " ").slice(0, TEXT_PROVIDER === "github" ? 600 : 1400) };
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
      rateLimited = 0;
    } catch (e) {
      if (/^429\b/.test(e.message)) {
        problems.push(`rate limit reached after ${planned} plan(s); the rest is planned on the next run`);
        break;
      }
      if (e.fatal) throw e;
      problems.push(`${chunk.map((b) => b.title).join(", ")}: ${e.message}`);
      // The free tier has a daily request cap: stop planning after repeated 429s, render what is planned.
      if (/^429\b/.test(e.message) && ++rateLimited >= 3) {
        problems.push("rate limit reached; the rest is planned on the next run");
        break;
      }
      continue;
    }
    for (const b of chunk) {
      const p = plans.find((x) => x.id === b.id);
      if (!p?.concept) {
        problems.push(`${b.title}: no plan returned`);
        continue;
      }
      const t = uniqueTheme(p, used);
      b.concept = String(p.concept).trim();
      b.palette = String(p.palette || t.name).trim();
      b.theme = `${t.name} · ${t.mode}`;
      b.mode = t.mode;
      delete b.ink; // compose takes the title ink from the art itself
      if (!DEVA.test(b.title)) {
        if (p.title_hi && DEVA.test(p.title_hi)) b.titleDisplay = String(p.title_hi).trim();
        else problems.push(`${b.title}: no Devanagari title`);
      }
      if (!DEVA.test(b.authorDisplay || b.author) && p.author_hi && DEVA.test(p.author_hi)) b.authorDisplay = String(p.author_hi).trim();
      b.font = b.font || FONT_ROTATION[manifest.books.indexOf(b) % FONT_ROTATION.length];
      b.plannedBy = TEXT_MODEL;
      recent.push(b.theme);
      planned++;
      if (DRY) console.log(`• ${b.titleDisplay || b.title} — ${b.theme}\n  ${b.concept}`);
    }
    await saveManifest(manifest);
    console.log(`planned ${planned}/${todo.length}`);
  }
  await saveManifest(manifest);
  if (QUEUE && !DRY) {
    const keys = manifest.books.filter(renderable).map((b) => b.key);
    await fs.mkdir(path.dirname(QUEUE), { recursive: true });
    await fs.writeFile(QUEUE, JSON.stringify(keys, null, 0) + "\n");
    console.log(`queue: ${keys.length} cover(s) ready to render → ${path.relative(REPO, QUEUE)}`);
  }
  await summary([`### Plan: ${planned} scene(s) written, ${added} new book(s), ${gone} skipped`, ...problems.map((p) => `- ${p}`)]);
}

// ---------------------------------------------------------------- render

async function renderOne(b) {
  const prompt = buildPrompt(b);
  let bytes;
  if (IMAGE_PROVIDER === "local") {
    bytes = await localImage(b);
  } else if (IMAGE_PROVIDER === "gemini") {
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
  // Engine runners share a frozen list: runner i of n takes every n-th entry, so the split never shifts.
  let list;
  if (QUEUE) {
    const byKey = new Map(manifest.books.map((b) => [b.key, b]));
    list = JSON.parse(await fs.readFile(QUEUE, "utf8")).map((k, i) => ({ b: byKey.get(k), i })).filter((x) => x.b);
  } else list = manifest.books.filter(renderable).map((b, i) => ({ b, i }));
  if (SHARD) list = list.filter((x) => x.i % SHARD[1] === SHARD[0]);
  let queue = list.map((x) => x.b).filter(renderable);
  if (RESULTS) queue = queue.filter((b) => !existsSync(path.join(RESULTS, `${b.key}.json`)));
  queue = queue.slice(0, LIMIT);
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
        if (RESULTS) {
          const j = path.join(RESULTS, `${b.key}.json`);
          await fs.mkdir(RESULTS, { recursive: true });
          await fs.writeFile(j, JSON.stringify(b, null, 2) + "\n");
          pendingFiles.push(j);
        }
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
        await commit(files, `Hindi covers (${SHARD ? `engine ${SHARD.join("/")}` : "auto"}): ${made.length} of ${queue.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
  await saveManifest(manifest);

  // A contact sheet of this run's newest covers, for a quick look.
  const sheetFiles = SHARDED ? [] : made.slice(-40);
  if (sheetFiles.length) {
    try {
      execFileSync("node", [path.join(HERE, "sheet.mjs"), path.join(outDir, "_preview-latest.jpg"), ...sheetFiles, "--cols", "8", "--w", "240"], { stdio: "ignore" });
      pendingFiles.push(path.join(outDir, "_preview-latest.jpg"));
    } catch {
      /* the sheet is optional */
    }
  }
  await commit(pendingFiles, `Hindi covers (${SHARD ? `engine ${SHARD.join("/")}` : "auto"}): ${made.length} made this run`);
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

// ---------------------------------------------------------------- merge

/** Rewrites the README progress rows of every batch that is not finished yet (finished rows stay as they are). */
async function updateReadme(manifest) {
  const P = path.join(outDir, "README.md");
  let s;
  try {
    s = await fs.readFile(P, "utf8");
  } catch {
    return null;
  }
  const lines = s.split("\n");
  const isRow = (l) => l.startsWith("| **50-book batch ") || /^\| Batches \d+–\d+ /.test(l);
  const first = lines.findIndex(isRow);
  if (first < 0) return null;
  const rowOf = (n) => lines.find((l) => l.startsWith(`| **50-book batch ${n}** `));
  const restLabel = (lines.find((l) => /^\| Batches \d+–\d+ /.test(l)) || "").match(/^\| Batches \d+–\d+ \((.*)\) \| \d+ \| pending \|$/)?.[1] || "pending";
  const batches = [...new Set(manifest.books.map((b) => b.batch).filter(Boolean))].sort((a, b) => a - b);
  const rows = [];
  const untouched = [];
  for (const n of batches) {
    const bs = manifest.books.filter((b) => b.batch === n);
    const done = bs.filter((b) => b.status === "done");
    const open = bs.filter(isOpen).length;
    const old = rowOf(n);
    if (!done.length) {
      untouched.push(n);
      continue;
    }
    if (old && !open && new RegExp(`\\| ${done.length} done: `).test(old)) {
      rows.push(old);
      continue;
    }
    const label = old?.match(/^\| \*\*50-book batch \d+\*\* \(([^|]*)\) \|/)?.[1] || `\`"batch": ${n}\``;
    const list = done.map((b) => `${b.titleDisplay || b.title} (${b.theme})`).join(", ");
    rows.push(`| **50-book batch ${n}** (${label}) | ${bs.length} | ${done.length} done: ${list}.${open ? ` ${open} pending` : ""} |`);
  }
  if (untouched.length) {
    const count = manifest.books.filter((b) => untouched.includes(b.batch)).length;
    const span = untouched.length > 1 ? `Batches ${untouched[0]}–${untouched.at(-1)}` : `Batches ${untouched[0]}–${untouched[0]}`;
    rows.push(`| ${span} (${restLabel}) | ${count} | pending |`);
  }
  const kept = lines.filter((l) => !isRow(l));
  kept.splice(first, 0, ...rows);
  await fs.writeFile(P, kept.join("\n"));
  return P;
}

async function merge(manifest) {
  const dir = RESULTS || path.join(outDir, "_engine");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json") && f !== "queue.json");
  } catch {
    /* nothing to merge */
  }
  const merged = [];
  for (const f of files) {
    let r;
    try {
      r = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    const b = manifest.books.find((x) => x.key === r.key);
    if (!b || r.status !== "done" || b.status === "done") continue; // a cover made by hand in the meantime wins
    Object.assign(b, r);
    merged.push(b);
  }
  await saveManifest(manifest);
  const readme = await updateReadme(manifest);
  let tracked = false;
  try {
    tracked = git("ls-files", "--", path.relative(REPO, dir)).trim().length > 0;
  } catch {
    /* not a git checkout */
  }
  const touched = [manifestPath];
  if (tracked) touched.push(dir);
  if (readme) touched.push(readme);
  const newest = merged.slice().sort((a, b) => String(b.renderedAt).localeCompare(String(a.renderedAt))).slice(0, 40);
  if (newest.length) {
    try {
      execFileSync("node", [path.join(HERE, "sheet.mjs"), path.join(outDir, "_preview-latest.png"), ...newest.map((b) => path.join(outDir, b.file)), "--cols", "8", "--w", "240"], { stdio: "ignore" });
      const sharp = (await import("sharp")).default;
      await sharp(path.join(outDir, "_preview-latest.png")).jpeg({ quality: 84 }).toFile(path.join(outDir, "_preview-latest.jpg"));
      await fs.unlink(path.join(outDir, "_preview-latest.png"));
      touched.push(path.join(outDir, "_preview-latest.jpg"));
    } catch {
      /* the sheet is optional */
    }
  }
  if (!DRY) await fs.rm(dir, { recursive: true, force: true });
  const done = manifest.books.filter((b) => b.status === "done").length;
  const left = manifest.books.filter(isOpen).length;
  await commit(touched, `Hindi covers (engine): ${merged.length} merged, ${done} done in total, ${left} to go`);
  await committing;
  await summary([`### Merge: ${merged.length} engine cover(s) added to the manifest — ${done} done, ${left} still to do`]);
}

// ---------------------------------------------------------------- main

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
try {
  if (STEP === "merge") await merge(manifest);
  if (STEP === "plan" || STEP === "all") await plan(manifest);
  if ((STEP === "render" || STEP === "all") && inTime()) await render(manifest);
} catch (e) {
  await saveManifest(manifest);
  await summary([`**Stopped:** ${e.message}`]);
  process.exitCode = 1;
}
