import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
// Keep REST pages small and avoid selecting the very large deep_analysis column.
// The prerender only needs enough indexable text for crawlers; the full article
// continues to hydrate from Supabase in the client.
const PAGE_SIZE = 200;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("prerender-all-books: missing Supabase env");
const template = readFileSync(INDEX, "utf8");

const esc = (v="") => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
const strip = (v="") => String(v).replace(/```[\s\S]*?```/g," ").replace(/^#{1,6}\s+/gm,"").replace(/^[-*•]+\s+/gm,"").replace(/\*\*|__|\*|_/g,"").replace(/`([^`]+)`/g,"$1").replace(/\[([^\]]+)\]\([^\)]+\)/g,"$1").replace(/\s+/g," ").trim();
const clamp = (v,max) => { const t=strip(v); return t.length<=max?t:`${t.slice(0,max-1).trim()}…`; };
const hashHue=(s)=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h%360;};
const wrap=(text,max=24)=>{const words=String(text).trim().split(/\s+/);const out=[];let line="";for(const w of words){const n=(line?line+" ":"")+w;if(n.length>max&&line){out.push(line);line=w}else line=n}if(line)out.push(line);return out.slice(0,5)};

function replaceMeta(html, attr, key, value){const tag=`<meta ${attr}="${key}" content="${esc(value)}" />`;const re=new RegExp(`<meta\\s+${attr}=[\"']${key}[\"'][^>]*>`,`i`);return re.test(html)?html.replace(re,tag):html.replace("</head>",`  ${tag}\n</head>`)}
function head(html,{lang,title,description,canonical,image,jsonLd}){let out=html.replace(/<html\s+lang=[\"'][^\"']+[\"']>/i,`<html lang="${lang}">`).replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(title)}</title>`);out=replaceMeta(out,"name","description",description);out=replaceMeta(out,"name","robots","index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");out=replaceMeta(out,"name","googlebot","index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");out=replaceMeta(out,"property","og:title",title);out=replaceMeta(out,"property","og:description",description);out=replaceMeta(out,"property","og:url",canonical);if(image){out=replaceMeta(out,"property","og:image",image);out=replaceMeta(out,"name","twitter:image",image)}out=out.replace(/<link\s+rel=[\"']canonical[\"'][^>]*>/gi,"");return out.replace("</head>",`  <link rel="canonical" href="${esc(canonical)}" />\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,"\\u003c")}</script>\n</head>`)}
function writeRoute(pathname,html){const file=resolve(DIST,pathname.replace(/^\//,""),"index.html");mkdirSync(dirname(file),{recursive:true});writeFileSync(file,html)}
function writeFallbackCover(book){const dir=resolve(DIST,"seo-cover");mkdirSync(dir,{recursive:true});const hue=hashHue(book.id);const hue2=(hue+42)%360;const lines=wrap(book.title,26);const start=300-(lines.length-1)*30;const title=lines.map((l,i)=>`<text x="300" y="${start+i*60}" text-anchor="middle" font-family="Georgia,serif" font-size="42" font-weight="700" fill="#fff">${esc(l)}</text>`).join("");const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 54% 26%)"/><stop offset="1" stop-color="hsl(${hue2} 62% 14%)"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><path d="M90 180h420M90 720h420" stroke="rgba(255,255,255,.3)" stroke-width="2"/><text x="300" y="125" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" letter-spacing="4" fill="rgba(255,255,255,.78)">${esc((book.category||"Book Summary").toUpperCase())}</text>${title}<text x="300" y="640" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="rgba(255,255,255,.9)">${esc(book.author||"Booknomics")}</text><text x="300" y="820" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="5" fill="rgba(255,255,255,.72)">BOOKNOMICS</text></svg>`;writeFileSync(resolve(dir,`${book.id}.svg`),svg)}

async function api(path){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Accept:"application/json"},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Supabase ${r.status}: ${await r.text()}`);return r.json()}

const books=[];
for(let offset=0;;offset+=PAGE_SIZE){
  const select="id,slug,seo_slug,title,author,category,cover_url,og_image,tagline,overview,key_ideas,daily_application,meta_title,meta_description,reading_time,year,language";
  const page=await api(`books?select=${select}&is_draft=eq.false&status=eq.published&order=id&limit=${PAGE_SIZE}&offset=${offset}`);
  books.push(...page);
  if(page.length<PAGE_SIZE)break;
}
if(books.length<100)throw new Error(`prerender-all-books: suspicious published count ${books.length}`);

let covers=0,pages=0;
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
  const overview=clamp(book.overview||book.tagline||"",1800);
  const ideas=clamp(book.key_ideas||"",1700);
  const application=clamp(book.daily_application||"",900);
  const lang=isHi?"hi":"en";
  const hub=isHi?"/hindi":"/english";
  const jsonLd={"@context":"https://schema.org","@graph":[{"@type":"Book","@id":`${canonical}#book`,name:book.title,author:{"@type":"Person",name:book.author||"Unknown"},inLanguage:lang,genre:book.category||undefined,image:absImage,...(book.year?{datePublished:String(book.year)}:{})},{"@type":"Article","@id":`${canonical}#article`,headline:title,description,inLanguage:lang,mainEntityOfPage:{"@type":"WebPage","@id":canonical},publisher:{"@type":"Organization",name:"Booknomics",url:BASE},about:{"@id":`${canonical}#book`},image:[absImage]}]};
  const root=`<main lang="${lang}" style="font-family:system-ui,-apple-system,sans-serif;max-width:1040px;margin:0 auto;padding:32px 20px;line-height:1.68"><nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${hub}">${isHi?"हिंदी":"English"}</a> › ${esc(book.title)}</nav><article><header><p>${esc(book.category||"Book summary")}</p><h1>${esc(book.title)}</h1><p>${isHi?"लेखक":"by"} ${esc(book.author||"Unknown author")}</p><img src="${esc(absImage)}" alt="${esc(`${book.title} book cover`)}" width="280" loading="eager" /></header>${overview?`<section><h2>${isHi?"सारांश":`${esc(book.title)} summary`}</h2><p>${esc(overview)}</p></section>`:""}${ideas?`<section><h2>${isHi?"मुख्य विचार":"Key ideas"}</h2><p>${esc(ideas)}</p></section>`:""}${application?`<section><h2>${isHi?"व्यावहारिक उपयोग":"Practical application"}</h2><p>${esc(application)}</p></section>`:""}<section><h2>${isHi?"और पढ़ें":"Continue exploring"}</h2><p><a href="${hub}">${isHi?"और हिंदी पुस्तकें":"More English books"}</a> · <a href="/browse">Browse library</a></p></section></article></main>`;
  let html=head(template,{lang,title,description,canonical,image:absImage,jsonLd});
  html=html.replace('<div id="root"></div>',`<div id="root">${root}</div>`);
  writeRoute(`/books/${slug}`,html);
  pages++;
}
console.log(`[prerender-all-books] ✅ ${pages} book pages + ${covers} fallback covers`);
