import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BOOKS_DIR = resolve("dist", "books");

const LOW_SIGNAL_MARKERS = [
  "particular way of seeing",
  "modern application",
  "hidden assumption",
  "आत्म-चिंतन का महत्व",
  "रिश्तों की कीमत",
  "सामाजिक जिम्मेदारी",
  "नैतिक मूल्यों का पालन",
  "परिवर्तन को स्वीकार करना",
  "सबसे महत्वपूर्ण कृतियों में से एक",
  "हिंदी साहित्य की एक अनमोल धरोहर",
  "कहानी की शुरुआत होती है एक साधारण से दृश्य से",
  "हर पात्र, हर घटना, हर संवाद",
  "एक अलग ही दुनिया में ले जाती है",
  "अपने समय के सामाजिक, सांस्कृतिक और राजनीतिक परिवेश",
  "अपने अनुभव और अवलोकन के माध्यम से प्रस्तुत किया है",
];

const decodeText = (value = "") => String(value)
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function isLowSignal(value = "") {
  const normalized = decodeText(value).toLowerCase();
  return LOW_SIGNAL_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}

function fallbackAnswer(html) {
  const title = decodeText(html.match(/<h1>([\s\S]*?)\s+—\s+हिंदी सारांश<\/h1>/i)?.[1] || "इस पुस्तक");
  const author = decodeText(html.match(/<strong>लेखक:<\/strong>\s*([^<]+)/i)?.[1] || "");
  const category = decodeText(html.match(/<strong>श्रेणी:<\/strong>\s*([^<]+)/i)?.[1] || "");
  const source = [title, author].filter(Boolean).join(" — ");
  return `${source} पर Booknomics का यह स्वतंत्र हिंदी अध्ययन-सारांश है${category ? `। श्रेणी: ${category}` : ""}।`;
}

function updateStructuredData(html, cleanAnswer, cleanTakeaways) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (full, raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return full;
    }

    const graph = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [];
    if (!graph.length) return full;

    for (const node of graph) {
      if (node?.["@type"] === "Article" && isLowSignal(node.abstract || "")) {
        node.abstract = cleanAnswer;
      }
      if (node?.["@type"] === "FAQPage" && Array.isArray(node.mainEntity)) {
        for (const entry of node.mainEntity) {
          const answer = entry?.acceptedAnswer?.text;
          if (!answer || !isLowSignal(answer)) continue;
          const question = String(entry?.name || "");
          if (question.includes("मुख्य बातें") && cleanTakeaways.length) {
            entry.acceptedAnswer.text = cleanTakeaways.slice(0, 3).join(" ");
          } else if (question.includes("संक्षिप्त सारांश")) {
            entry.acceptedAnswer.text = cleanAnswer;
          }
        }
      }
    }

    return `<script type="application/ld+json">${JSON.stringify(parsed).replace(/</g, "\\u003c")}</script>`;
  });
}

if (!existsSync(BOOKS_DIR)) {
  console.log("[guard-aeo-prerender] no dist/books directory; nothing to guard");
  process.exit(0);
}

let touched = 0;
let removedItems = 0;
let removedOverviewSections = 0;

for (const entry of readdirSync(BOOKS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = resolve(BOOKS_DIR, entry.name, "index.html");
  if (!existsSync(file)) continue;

  let html = readFileSync(file, "utf8");
  if (!/<html\s+lang="hi"/i.test(html)) continue;
  const original = html;

  const takeawayMatch = html.match(/<section><h2>([^<]*?) की 5 मुख्य बातें<\/h2><ul>([\s\S]*?)<\/ul><\/section>/i);
  const rawItems = takeawayMatch
    ? [...takeawayMatch[2].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => match[1])
    : [];
  const cleanItemHtml = rawItems.filter((item) => !isLowSignal(item));
  const cleanTakeaways = cleanItemHtml.map(decodeText).filter(Boolean);
  removedItems += Math.max(0, rawItems.length - cleanItemHtml.length);

  if (takeawayMatch && cleanItemHtml.length !== rawItems.length) {
    const title = takeawayMatch[1];
    const heading = cleanItemHtml.length === 5 ? `${title} की 5 मुख्य बातें` : `${title} की मुख्य बातें`;
    const replacement = cleanItemHtml.length
      ? `<section><h2>${heading}</h2><ul>${cleanItemHtml.map((item) => `<li>${item}</li>`).join("")}</ul></section>`
      : "";
    html = html.replace(takeawayMatch[0], replacement);
  }

  const directMatch = html.match(/(<section><h2>[^<]+ का संक्षिप्त उत्तर<\/h2><p>)([\s\S]*?)(<\/p><\/section>)/i);
  let cleanAnswer = directMatch ? decodeText(directMatch[2]) : "";
  if (!cleanAnswer || isLowSignal(cleanAnswer)) {
    cleanAnswer = cleanTakeaways.length ? cleanTakeaways.slice(0, 3).join(" ") : fallbackAnswer(html);
    if (directMatch) {
      html = html.replace(directMatch[0], `${directMatch[1]}${escapeHtml(cleanAnswer)}${directMatch[3]}`);
    }
  }

  const overviewMatch = html.match(/<section><h2>पुस्तक का परिचय और सारांश<\/h2><p>([\s\S]*?)<\/p><\/section>/i);
  if (overviewMatch && isLowSignal(overviewMatch[1])) {
    html = html.replace(overviewMatch[0], "");
    removedOverviewSections++;
  }

  html = updateStructuredData(html, cleanAnswer || fallbackAnswer(html), cleanTakeaways);

  if (html !== original) {
    writeFileSync(file, html);
    touched++;
  }
}

console.log(`[guard-aeo-prerender] guarded ${touched} Hindi snapshots; removed ${removedItems} low-signal takeaway items and ${removedOverviewSections} low-signal overview sections`);
