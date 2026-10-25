import { stripMarkdown } from "@/lib/stripMarkdown";

export type ReaderLanguage = "en" | "hi";

export type ReaderSummaryFields = {
  overview?: string | null;
  key_ideas?: string | null;
  deep_summary?: string | null;
  deep_analysis?: string | null;
  daily_application?: string | null;
};

export const isLowSignalHindiText = (text: string) => {
  const normalized = (text || "").toLowerCase();
  if (!normalized) return false;
  const boilerplate = [
    "particular way of seeing",
    "essay केवल information नहीं देता",
    "की जाँच करते समय claim, example और tone",
    "दूसरा प्रश्न audience का है",
    "तीसरा स्तर modern application का है",
  ];
  const repeated = (normalized.match(/यह दिखाता है कि/g) || []).length;
  return boilerplate.some((marker) => normalized.includes(marker)) || repeated >= 4;
};

// Only explicitly edited key_ideas can become reader takeaways.
export const extractReaderTakeaways = (primary: string, max = 5): string[] => {
  if (!primary.trim() || isLowSignalHindiText(primary)) return [];
  const blocks = primary.replace(/\\n/g, "\n").split(/\n\s*(?=[-*•]\s)|\n{2,}/g);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const candidate = block.trim().replace(/^[-*•]\s+/, "").trim();
    const plain = stripMarkdown(candidate).replace(/\s+/g, " ").trim();
    if (plain.length < 32 || isLowSignalHindiText(plain)) continue;
    const key = plain.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
    if (result.length >= max) break;
  }
  return result;
};

export function buildReaderSections(src: ReaderSummaryFields, language: ReaderLanguage) {
  const readerIsHi = language === "hi";
  const labels = readerIsHi
    ? ["किताब एक नज़र में", "5 मुख्य सीख", "विस्तृत सारांश", "मुख्य विचार", "गहन विश्लेषण", "जीवन में कैसे लागू करें"]
    : ["The book at a glance", "5 key takeaways", "Detailed summary", "The core concepts", "Deeper analysis", "Living with the ideas"];
  const rawAnalysis = (src.deep_analysis || "").trim();
  const analysisSections = rawAnalysis
    ? rawAnalysis.split(/(?=^###\s+)/m).map((part) => part.trim()).filter(Boolean)
    : [];
  const splitAt = analysisSections.length > 1
    ? Math.max(1, Math.min(3, Math.ceil(analysisSections.length * 0.35)))
    : 0;
  const derivedSummary = !src.deep_summary && rawAnalysis
    ? (analysisSections.length > 1
        ? analysisSections.slice(0, splitAt).join("\n\n")
        : rawAnalysis.split(/\n\n+/).slice(0, 4).join("\n\n"))
    : "";
  const derivedAnalysis = !src.deep_summary && analysisSections.length > 1
    ? analysisSections.slice(splitAt).join("\n\n")
    : rawAnalysis;
  const effectiveKeyIdeas = readerIsHi && isLowSignalHindiText(src.key_ideas || "") ? "" : (src.key_ideas || "");
  const takeaways = extractReaderTakeaways(effectiveKeyIdeas, 5);
  const takeawayMarkdown = takeaways.map((takeaway) => `★ ${takeaway}`).join("\n\n");
  const derivedApplication = !src.daily_application
    ? [
        `1. ${readerIsHi ? "इस पुस्तक के एक मुख्य विचार को अपने शब्दों में लिखें।" : "Write one core idea from this book in your own words."}`,
        `2. ${readerIsHi ? "ऊपर के किसी एक भाग से एक ठोस उदाहरण चुनें।" : "Choose one concrete example from a section above."}`,
        `3. ${readerIsHi ? "लेखक के तर्क की एक सीमा या असहमति नोट करें।" : "Note one disagreement, limitation, or boundary condition."}`,
        `4. ${readerIsHi ? "आज के जीवन में एक छोटा, मापने योग्य प्रयोग तय करें।" : "Define one small real-world experiment for today."}`,
        `5. ${readerIsHi ? "सप्ताह के अंत में लिखें कि आपकी समझ या व्यवहार में क्या बदला।" : "Review at the end of the week whether your understanding changed."}`,
      ].join("\n")
    : "";

  return [
    { label: labels[0], field: "overview", text: src.overview || "" },
    { label: takeaways.length === 5 ? labels[1] : (readerIsHi ? `${takeaways.length} मुख्य सीख` : `${takeaways.length} key takeaways`), field: "key_ideas", text: takeawayMarkdown },
    { label: labels[2], field: "deep_summary", text: src.deep_summary || derivedSummary },
    { label: labels[3], field: "key_ideas", text: effectiveKeyIdeas },
    { label: labels[4], field: "deep_analysis", text: src.deep_summary ? rawAnalysis : derivedAnalysis },
    { label: labels[5], field: "daily_application", text: src.daily_application || derivedApplication },
  ].filter((section) => Boolean(section.text.trim()));
}

export const buildReaderMarkdown = (src: ReaderSummaryFields, language: ReaderLanguage) =>
  buildReaderSections(src, language).map(({ label, text }) => `## ${label}\n\n${text}`).join("\n\n---\n\n");
