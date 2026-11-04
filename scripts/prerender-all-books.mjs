import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cloudflarePrerender, fetchCloudflarePrerenderBooks } from "./lib/cloudflare-prerender-catalog.mjs";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const ORG_ID = `${BASE}/#organization`;
const ORG_LOGO = `${BASE}/og-default.svg`;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// The static HTML now carries the full public article (overview, detailed
// summary, key ideas, deep analysis, practical application) so crawlers that
// do not execute JavaScript index the same content readers see. Premium-only
// fields (practice tracker, action system, reflections, real-life example)
// stay client-side by design. Pages are fetched in small batches because the
// deep text columns make each row much larger than plain metadata.
const PAGE_SIZE = 50;

const esc = (v="") => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const strip = (v="") => String(v).replace(/```[\s\S]*?```/g," ").replace(/^#{1,6}\s+/gm,"").replace(/^[-*•]+\s+/gm,"").replace(/\*\*|__|\*|_/g,"").replace(/`([^`]+)`/g,"$1").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/\s+/g," ").trim();
const clamp = (v,max) => { const t=strip(v); return t.length<=max?t:`${t.slice(0,max-1).trim()}…`; };
const hashHue=(s)=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h%360;};
const wrap=(text,max=24)=>{const words=String(text).trim().split(/\s+/);const out=[];let line="";for(const w of words){const n=(line?line+" ":"")+w;if(n.length>max&&line){out.push(line);line=w}else line=n}if(line)out.push(line);return out.slice(0,5)};

// ---------------------------------------------------------------------------
// Minimal, safe Markdown -> HTML rendering for prerendered article bodies.
// The client renders the same fields with react-markdown; this keeps the
// crawler-visible HTML close to the reader-visible article. Everything is
// HTML-escaped before any tag is emitted, so stored content can never
// inject raw HTML into the static pages.
// ---------------------------------------------------------------------------
const inlineMd = (text = "") => {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
};

export function mdToHtml(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];
  let listType = null;
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inlineMd(para.join(" "))}</p>`); para = []; }
  };
  const flushList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); flushList();
      // One level below the section H2: content #/## becomes H3, ###/#### H4.
      const level = Math.max(3, Math.min(heading[1].length + 1, 4));
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); flushList(); out.push("<hr />"); continue; }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushPara(); flushList(); out.push(`<blockquote><p>${inlineMd(quote[1])}</p></blockquote>`); continue; }
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      flushPara();
      const want = bullet ? "ul" : "ol";
      if (listType !== want) { flushList(); out.push(`<${want}>`); listType = want; }
      out.push(`<li>${inlineMd((bullet || ordered)[1])}</li>`);
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join("\n");
}

// Collapse the raw text for a hard character cap, then drop any region that
// leaves an unbalanced inline marker at the truncation point.
const capMarkdown = (text, max) => {
  let t = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (t.length <= max) return t;
  t = t.slice(0, max);
  const boldRuns = (t.match(/\*\*/g) || []).length;
  if (boldRuns % 2 === 1) t = t.slice(0, t.lastIndexOf("**"));
  const ticks = (t.match(/`/g) || []).length;
  if (ticks % 2 === 1) t = t.slice(0, t.lastIndexOf("`"));
  return t.trim();
};

export function richSection(markdown = "", max = 20000) {
  const capped = capMarkdown(markdown, max);
  if (!capped) return "";
  return mdToHtml(capped);
}

const normWs = (v = "") => String(v).replace(/\s+/g, " ").trim();

/**
 * Some books repeat the overview verbatim at the start of their detailed
 * summary. The prerender shows both sections, so drop the duplicated prefix
 * from the detailed summary to keep the static article clean.
 */
export function stripSharedPrefix(aRaw, bRaw) {
  const a = normWs(aRaw);
  const b = normWs(bRaw);
  if (a.length < 120 || b.length <= a.length + 10) return bRaw;
  if (!b.startsWith(a.slice(0, 240))) return bRaw;
  // Longest common prefix in normalized space.
  let lo = 0, hi = Math.min(a.length, b.length);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (a.slice(0, mid) === b.slice(0, mid)) lo = mid; else hi = mid - 1;
  }
  if (lo < 120) return bRaw;
  // Walk the raw string counting normalized characters: every non-whitespace
  // char counts once, every internal whitespace run counts once.
  let counted = 0, i = 0;
  while (i < bRaw.length && counted < lo) {
    if (!/\s/.test(bRaw[i])) { counted++; i++; continue; }
    let j = i;
    while (j < bRaw.length && /\s/.test(bRaw[j])) j++;
    if (i > 0 && !/\s/.test(bRaw[i - 1])) counted++;
    i = j;
  }
  // Cut at the next line break so the remainder starts on a clean line. Only
  // leading whitespace is dropped so a heading that follows the duplicated
  // overview keeps its markdown markers.
  const nextBreak = bRaw.indexOf("\n", i);
  const cut = nextBreak !== -1 && nextBreak - i < 80 ? nextBreak + 1 : i;
  const rest = bRaw.slice(cut).replace(/^\s+/, "");
  return rest.length > 60 ? rest : bRaw;
}

function replaceMeta(html, attr, key, value){const tag=`<meta ${attr}="${key}" content="${esc(value)}" />`;const re=new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`,"i");return re.test(html)?html.replace(re,tag):html.replace("</head>",`  ${tag}\n</head>`)}
function head(html,{lang,title,description,canonical,image,jsonLd}){let out=html.replace(/<html\s+lang=["'][^"']+["']>/i,`<html lang="${lang}">`).replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(title)}</title>`);out=replaceMeta(out,"name","description",description);out=replaceMeta(out,"name","robots","index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");out=replaceMeta(out,"name","googlebot","index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");out=replaceMeta(out,"property","og:title",title);out=replaceMeta(out,"property","og:description",description);out=replaceMeta(out,"property","og:url",canonical);if(image){out=replaceMeta(out,"property","og:image",image);out=replaceMeta(out,"name","twitter:image",image)}out=out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi,"");return out.replace("</head>",`  <link rel="canonical" href="${esc(canonical)}" />\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,"\\u003c")}</script>\n</head>`)}
function writeRoute(pathname,html){const file=resolve(DIST,pathname.replace(/^\//,""),"index.html");mkdirSync(dirname(file),{recursive:true});writeFileSync(file,html)}
function writeFallbackCover(book){const dir=resolve(DIST,"seo-cover");mkdirSync(dir,{recursive:true});const hue=hashHue(book.id);const hue2=(hue+42)%360;const lines=wrap(book.title,26);const start=300-(lines.length-1)*30;const title=lines.map((l,i)=>`<text x="300" y="${start+i*60}" text-anchor="middle" font-family="Georgia,serif" font-size="42" font-weight="700" fill="#fff">${esc(l)}</text>`).join("");const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 54% 26%)"/><stop offset="1" stop-color="hsl(${hue2} 62% 14%)"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><path d="M90 180h420M90 720h420" stroke="rgba(255,255,255,.3)" stroke-width="2"/><text x="300" y="125" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" letter-spacing="4" fill="rgba(255,255,255,.78)">${esc((book.category||"Book Summary").toUpperCase())}</text>${title}<text x="300" y="640" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#fff">${esc(book.author||"Booknomics")}</text><text x="300" y="820" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="5" fill="rgba(255,255,255,.72)">BOOKNOMICS</text></svg>`;writeFileSync(resolve(dir,`${book.id}.svg`),svg)}

// An occasional PostgREST statement timeout (57014) must not invalidate all 5k+
 // already-indexable book pages. Retry only transient failures; never mask 4xx
 // authentication errors or silently accept an incomplete catalogue.
const RETRY_ATTEMPTS = 4;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(path) {
  if (cloudflarePrerender) return fetchCloudflarePrerenderBooks(path);
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) return r.json();
      const body = (await r.text()).slice(0, 300);
      const retryable = [408, 429, 502, 503, 504].includes(r.status) ||
        (r.status === 500 && /57014|statement timeout/i.test(body));
      if (!retryable || attempt === RETRY_ATTEMPTS - 1) {
        throw new Error(`Supabase ${r.status}: ${body}`);
      }
      console.warn(`[prerender-all-books] transient Supabase ${r.status}; retry ${attempt + 1}/${RETRY_ATTEMPTS - 1}`);
    } catch (err) {
      const transient = /TimeoutError|AbortError|fetch failed|network error/i.test(String(err?.name) + " " + String(err?.message));
      if (!transient || attempt === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`[prerender-all-books] transient fetch timeout; retry ${attempt + 1}/${RETRY_ATTEMPTS - 1}`);
    }
    await pause(750 * (2 ** attempt));
  }
  throw new Error("prerender-all-books: retry attempts exhausted");
}

// Cloudflare D1 occasionally rejects a heavy read (query timeout / transient
// capacity) with an opaque HTTP 500. The Supabase path above already retries
// transient errors; wrap the Cloudflare bridge the same way. Field
// rejections (HTTP 400) are never retried here so the caller can degrade the
// field list immediately.
async function apiWithRetry(path) {
  if (!cloudflarePrerender) return api(path);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetchCloudflarePrerenderBooks(path);
    } catch (err) {
      lastError = err;
      const message = String(err?.message || err);
      const retryable = /^Cloudflare prerender catalog HTTP (429|5\d\d)/.test(message) ||
        /TimeoutError|AbortError|fetch failed|network error/i.test(message);
      if (!retryable || attempt === 2) throw err;
      console.warn(`[prerender-all-books] transient catalog failure; retry ${attempt + 1}/2 (${message.slice(0, 120)})`);
      await pause(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

function articleBody(book) {
  const isHi = book.language === "hi";
  const lang = isHi ? "hi" : "en";
  const overviewRaw = String(book.overview || book.tagline || "").trim();
  const deepSummaryRaw = stripSharedPrefix(overviewRaw, String(book.deep_summary || "").trim());
  const sections = [
    overviewRaw ? `<section><h2>${isHi ? "सारांश" : `${esc(book.title)} summary`}</h2>${richSection(overviewRaw, 2200)}</section>` : "",
    deepSummaryRaw ? `<section><h2>${isHi ? "विस्तृत सारांश" : "Detailed summary"}</h2>${richSection(deepSummaryRaw, 20000)}</section>` : "",
    book.key_ideas ? `<section><h2>${isHi ? "मुख्य विचार" : "Key ideas"}</h2>${richSection(book.key_ideas, 3000)}</section>` : "",
    book.deep_analysis ? `<section><h2>${isHi ? "गहरा विश्लेषण" : "Deep analysis"}</h2>${richSection(book.deep_analysis, 20000)}</section>` : "",
    book.daily_application ? `<section><h2>${isHi ? "व्यावहारिक उपयोग" : "Practical application"}</h2>${richSection(book.daily_application, 1500)}</section>` : "",
  ].filter(Boolean);
  const hub = isHi ? "/hindi" : "/english";
  return {
    lang,
    root: `<main lang="${lang}" style="font-family:system-ui,-apple-system,sans-serif;max-width:1040px;margin:0 auto;padding:32px 20px;line-height:1.68"><nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${hub}">${isHi ? "हिंदी" : "English"}</a> › ${esc(book.title)}</nav><article><header><p>${esc(book.category || "Book summary")}</p><h1>${esc(book.title)}</h1><p>${isHi ? "लेखक" : "by"} ${esc(book.author || "Unknown author")}</p></header>${sections.join("")}<section><h2>${isHi ? "और पढ़ें" : "Continue exploring"}</h2><p><a href="${hub}">${isHi ? "और हिंदी पुस्तकें" : "More English books"}</a> · <a href="/browse">Browse library</a></p></section></article></main>`,
  };
}

// deep_summary was added to the worker's prerender column allowlist after the
// current production worker was deployed. If the catalog bridge is rejected
// with HTTP 400 (unknown field), degrade to the older field list instead of
// failing the whole build; deep_summary is simply omitted from the static
// article until the upgraded worker is live. The downgrade is only allowed
// before any row has been served: with the upgraded worker every page uses
// the same field list, so a mid-build 400 is unexpected and must fail the
// build instead of silently dropping a content section.
const SELECT_FIELDS = (withDeepSummary) => `id,slug,seo_slug,title,author,category,cover_url,og_image,tagline,overview${withDeepSummary ? ",deep_summary" : ""},key_ideas,deep_analysis,daily_application,meta_title,meta_description,reading_time,year,language,created_at`;

async function fetchCatalog() {
  let withDeepSummary = true;
  for (;;) {
    const books = [];
    try {
      // UUID keyset pagination (same pattern as prerender-en-crawl): each
      // query scans exactly one page of rows. OFFSET pagination re-scanned up
      // to 5,000 rows per page and the D1 read was rejected (HTTP 500) once
      // the pages carried the large deep text columns.
      let lastId = "";
      for (;;) {
        const page = await apiWithRetry(
          `books?select=${SELECT_FIELDS(withDeepSummary)}&is_draft=eq.false&status=eq.published&order=id&limit=${PAGE_SIZE}` +
          (lastId ? `&id=gt.${lastId}` : "")
        );
        if (!Array.isArray(page)) throw new Error("prerender-all-books: catalog response is not an array");
        books.push(...page);
        if (page.length < PAGE_SIZE) break;
        lastId = page[page.length - 1]?.id;
        if (!lastId) throw new Error("prerender-all-books: missing ID in paginated catalog");
      }
      return books;
    } catch (err) {
      const message = String(err?.message || err);
      const rejectedFields = /HTTP 400/i.test(message) && /field|prerender/i.test(message);
      if (cloudflarePrerender && withDeepSummary && books.length === 0 && rejectedFields) {
        withDeepSummary = false;
        console.warn("[prerender-all-books] catalog rejected the deep_summary field (older worker); retrying without it");
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  if (!cloudflarePrerender && (!SUPABASE_URL || !SUPABASE_KEY)) throw new Error("prerender-all-books: missing Supabase rollback env");
  const template = readFileSync(INDEX, "utf8");

  const books = await fetchCatalog();
  if(books.length<100)throw new Error(`prerender-all-books: suspicious published count ${books.length}`);

  let covers=0,pages=0,totalBodyChars=0;
  for(const book of books){
    const slug=(book.seo_slug||book.slug||"").trim();
    if(!slug||!book.title)continue;
    const isHi=book.language==="hi";
    const fallbackPath=`/seo-cover/${book.id}.svg`;
    const usesFallback=!book.cover_url||String(book.cover_url).includes(`/seo-cover/${book.id}.svg`);
    if(usesFallback){writeFallbackCover(book);covers++}
    const image=book.og_image||book.cover_url||fallbackPath;
    const absImage=image.startsWith("http")?image:`${BASE}${image.startsWith("/")?"":"/"}${image}`;
    const canonical=`${BASE}/books/${encodeURI(slug)}`;
    const title=book.meta_title||(isHi?`${book.title} का सारांश — ${book.author} | Booknomics`:`${book.title} Summary — Key Ideas & Analysis | Booknomics`);
    const description=book.meta_description||clamp(`${book.title} by ${book.author}. ${book.overview||book.tagline||"Key ideas, analysis and practical lessons."}`,180);
    const { root } = articleBody(book);
    totalBodyChars += root.length;
    const lang=book.language==="hi"?"hi":"en";
    const publishedAt=book.created_at ? new Date(book.created_at).toISOString() : null;
    const organization={"@type":"Organization","@id":ORG_ID,name:"Booknomics",url:`${BASE}/`,logo:{"@type":"ImageObject",url:ORG_LOGO}};
    const graph=[
      organization,
      {"@type":"Book","@id":`${canonical}#book`,name:book.title,author:{"@type":"Person",name:book.author||"Unknown"},inLanguage:lang,genre:book.category||undefined,image:absImage,...(book.year?{datePublished:String(book.year)}:{})},
      {"@type":"Article","@id":`${canonical}#article`,headline:title,description,inLanguage:lang,mainEntityOfPage:{"@type":"WebPage","@id":canonical},publisher:{"@id":ORG_ID},author:{"@id":ORG_ID},about:{"@id":`${canonical}#book`},image:[absImage],...(publishedAt?{datePublished:publishedAt}:{})},
    ];
    const jsonLd={"@context":"https://schema.org","@graph":graph};
    let html=head(template,{lang,title,description,canonical,image:absImage,jsonLd});
    html=html.replace('<div id="root"></div>',`<div id="root">${root}</div>`);
    writeRoute(`/books/${slug}`,html);
    pages++;
  }
  console.log(`[prerender-all-books] ✅ ${pages} book pages + ${covers} fallback covers (avg article ${(totalBodyChars/Math.max(pages,1)/1024).toFixed(1)} KB)`);
}

// Only run the full catalogue generation when executed directly (`node
// scripts/prerender-all-books.mjs`), not when imported by unit tests.
const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isDirectRun) {
  main().catch((err) => {
    console.error("[prerender-all-books] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
