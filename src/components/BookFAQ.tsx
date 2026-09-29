import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
}

/** Auto-build 4 generic FAQ items from book data — used both for visible UI and FAQPage JSON-LD. */
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
          ? `${title} (${author}) — ${hook}. यह ${category} श्रेणी की एक लोकप्रिय किताब है, और Booknomics पर आप इसका हिंदी सारांश, मुख्य विचार, गहन विश्लेषण और 7-दिन एक्शन प्लान मुफ़्त में पढ़ सकते हैं।`
          : `${title} ${author} द्वारा लिखी गई एक ${category} किताब है। Booknomics पर इसका मुफ़्त हिंदी सारांश, मुख्य विचार, गहन विश्लेषण और 7-दिन एक्शन प्लान उपलब्ध है।`,
      },
      {
        q: `${title} का सारांश पढ़ने में कितना समय लगता है?`,
        a: `Booknomics पर ${title} का हिंदी सारांश लगभग ${readingTime} मिनट में पढ़ा जा सकता है, जिसमें मुख्य अंश, गहन विश्लेषण और एक्शन प्लान शामिल हैं।`,
      },
      {
        q: `${title} के मुख्य सबक क्या हैं?`,
        a: `${title} के मुख्य सबक "मुख्य अवधारणाएँ" अनुभाग में दिए गए हैं — इनमें ${author} के सबसे शक्तिशाली विचार, उनके पीछे का तर्क, और रोज़मर्रा की ज़िंदगी में उनका उपयोग कैसे करें, शामिल है।`,
      },
      {
        q: `क्या ${title} का सारांश Booknomics पर मुफ़्त है?`,
        a: `हाँ — ${title} का पूरा सारांश, मुख्य विचार, reflection questions और 7-दिन एक्शन प्लान Booknomics पर पूरी तरह मुफ़्त है। पढ़ने के लिए किसी सब्सक्रिप्शन की ज़रूरत नहीं है।`,
      },
    ];
  }
  return [
    {
      q: `What is ${title} about?`,
      a: hook
        ? `${title} by ${author} — ${hook}. It's a popular ${category} book, and on Booknomics you can read a free summary with key ideas, deep analysis, and a 7-day action plan.`
        : `${title} is a ${category} book by ${author}. On Booknomics you'll find a free summary with the key ideas, deep analysis, reflection prompts and a 7-day action plan.`,
    },
    {
      q: `How long does it take to read the ${title} summary on Booknomics?`,
      a: `The ${title} summary on Booknomics takes about ${readingTime} minutes to read, including key insights, deep analysis and the action plan.`,
    },
    {
      q: `What are the main lessons of ${title}?`,
      a: `The main lessons are organised in the "Core concepts" section of the summary — the most actionable ideas from ${author}, the reasoning behind them, and how to apply them in daily life.`,
    },
    {
      q: `Is the ${title} summary on Booknomics free?`,
      a: `Yes — the full ${title} summary, key ideas, reflection prompts and 7-day action plan are completely free on Booknomics. No subscription needed.`,
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
