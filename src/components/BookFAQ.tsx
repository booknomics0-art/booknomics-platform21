import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Build visible, reader-first FAQ items from verified book metadata.
 *
 * Keep these answers intentionally conservative: some Booknomics pages are
 * published_noindex while their long-form editorial review is still in
 * progress. The FAQ must never promise sections or facts that are not yet
 * present on the page.
 */
export function buildBookFaqs(args: {
  title: string;
  author: string;
  category: string;
  readingTime: number;
  isHindi: boolean;
  tagline?: string | null;
}): FaqItem[] {
  const { title, author, category, readingTime, isHindi, tagline } = args;
  const hook = (tagline || "").trim().replace(/\s+/g, " ").slice(0, 220);

  if (isHindi) {
    return [
      {
        q: `${title} किताब किस बारे में है?`,
        a: hook
          ? `${title} (${author}) — ${hook}. यह ${category} श्रेणी की कृति है। इस पेज पर Booknomics इसका हिंदी सारांश और विश्लेषण प्रस्तुत करता है; जहाँ संपादकीय सत्यापन जारी है, सामग्री को उसी के अनुसार अपडेट किया जाता है।`
          : `${title} ${author} की ${category} श्रेणी की कृति है। इस पेज पर Booknomics इसका हिंदी सारांश, संदर्भ और विश्लेषण प्रस्तुत करता है।`,
      },
      {
        q: `${title} का Booknomics पेज पढ़ने में कितना समय लगता है?`,
        a: `इस पेज का वर्तमान अनुमानित पढ़ने का समय लगभग ${readingTime} मिनट है। सामग्री के विस्तार और संपादकीय अपडेट के साथ यह समय बदल सकता है।`,
      },
      {
        q: `${title} के बारे में इस पेज पर क्या मिलेगा?`,
        a: `Booknomics का लक्ष्य ${title} के बारे में कृति-विशिष्ट हिंदी सारांश, प्रमुख विचार या पात्र, थीम, संदर्भ और विश्लेषण देना है। केवल वही विवरण रखा जाता है जिसे उपलब्ध स्रोतों और संपादकीय जाँच से समर्थित किया जा सके।`,
      },
      {
        q: `क्या यह ${title} का पूरा हिंदी अनुवाद है?`,
        a: `नहीं। यह मूल पुस्तक का पूरा अनुवाद या प्रतिस्थापन नहीं है। Booknomics स्वतंत्र, शोध-आधारित हिंदी सारांश और विश्लेषण देता है और कॉपीराइटेड मूल पाठ को पूर्ण रूप से पुनर्प्रकाशित नहीं करता।`,
      },
    ];
  }

  return [
    {
      q: `What is ${title} about?`,
      a: hook
        ? `${title} by ${author} — ${hook}. It is a ${category} work. This Booknomics page provides a summary and analysis, with content updated as editorial verification is completed.`
        : `${title} is a ${category} work by ${author}. This Booknomics page provides a summary, context, and analysis.`,
    },
    {
      q: `How long does this ${title} page take to read?`,
      a: `The current estimated reading time is about ${readingTime} minutes. It may change as the page is expanded or editorially updated.`,
    },
    {
      q: `What does the Booknomics page for ${title} include?`,
      a: `Booknomics aims to provide a work-specific summary, key ideas or characters, themes, context, and analysis. Details are kept only when they can be supported by available sources and editorial review.`,
    },
    {
      q: `Is this a full copy or translation of ${title}?`,
      a: `No. Booknomics provides an independent research-based summary and analysis, not a substitute for the complete copyrighted book or an authorised full translation.`,
    },
  ];
}

export function BookFAQ({ faqs, isHindi }: { faqs: FaqItem[]; isHindi: boolean }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!faqs.length) return null;
  return (
    <section className="mt-12 pt-8 border-t border-border" aria-labelledby="faq" id="faq">
      <h2 id="faq" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-6">
        {isHindi ? "अक्सर पूछे जाने वाले प्रश्न" : "Frequently asked questions"}
      </h2>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-serif font-semibold text-base md:text-lg hover:text-primary transition"
              >
                <span>{f.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm md:text-base text-foreground/80 leading-relaxed">{f.a}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
