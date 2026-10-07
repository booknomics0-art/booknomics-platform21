import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Sparkles, Languages, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

// Curated priority order. Keep this list limited to the current published/indexable Hindi set.
const FEATURED_SLUGS = [
  "रक्तकरबी",
  "अर्थशास्त्र-hindi-summary",
  "ताओ-ते-चिंग-hindi-summary",
  "मेडिटेशन्स-hindi-summary",
  "रिपब्लिक-hindi-summary",
  "मृगनयनी-वृंदावनलाल-वरमा-सारांश",
  "वोलगा-से-गंगा-राहुल-सांकृतयायन-सारांश",
  "अभयुदय-नरेनदर-कोहली-सारांश",
  "ढाई-घर-गिरिराज-किशोर-saransh",
  "आइने-अकबरी-hindi-summary",
];

const FAQS = [
  {
    q: "हिंदी पुस्तक सारांश क्या होते हैं?",
    a: "हिंदी पुस्तक सारांश किसी किताब के मुख्य विचार, संदर्भ, सीख और उपयोगी विश्लेषण का संरचित रूप होते हैं — ताकि पाठक कम समय में किताब की दिशा समझ सके और फिर तय कर सके कि उसे मूल पुस्तक पढ़नी है या नहीं।",
  },
  {
    q: "क्या ये पूरी किताबें हैं या केवल सारांश?",
    a: "Booknomics पूरी किताब का पाठ नहीं देता। यहाँ स्वतंत्र अध्ययन-सारांश, मुख्य विचार, गहन विश्लेषण, दैनिक प्रयोग, एक्शन सिस्टम और रिफ्लेक्शन प्रश्न दिए जाते हैं।",
  },
  {
    q: "मुझे किस किताब से शुरू करना चाहिए?",
    a: "साहित्य के लिए रक्तकरबी या ढाई घर, इतिहास के लिए आइने-अकबरी, भारतीय विचार के लिए अर्थशास्त्र, और दर्शन के लिए ताओ ते चिंग, मेडिटेशन्स या रिपब्लिक से शुरुआत कर सकते हैं।",
  },
  {
    q: "क्या ये सारांश प्रयोगात्मक हैं या केवल अकादमिक?",
    a: "Indexable Hindi summaries में व्यावहारिक सीख, एक्शन सिस्टम, अभ्यास ट्रैकर और रिफ्लेक्शन प्रश्न शामिल किए जाते हैं ताकि पढ़ाई केवल जानकारी तक सीमित न रहे।",
  },
  {
    q: "क्या मैं किताबों को अपनी लाइब्रेरी में सेव कर सकता हूँ?",
    a: "हाँ। अकाउंट बनाकर आप पसंदीदा हिंदी किताबों को My Library में सेव कर सकते हैं और बाद में वापस आकर पढ़ सकते हैं।",
  },
];

const PAGE_URL = "https://www.booknomics.com/best-hindi-book-summaries";

const BestHindiBookSummaries = () => {
  const [books, setBooks] = useState<BookCardData[]>([]);

  useEffect(() => {
    if (!document.getElementById("noto-hindi-font")) {
      const link = document.createElement("link");
      link.id = "noto-hindi-font";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    supabase
      .from("books")
      .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
      .eq("language", "hi")
      .eq("is_draft", false)
      .eq("status", "published")
      .then(({ data }) => {
        const all = (data ?? []) as BookCardData[];
        const featured = FEATURED_SLUGS
          .map((s) => all.find((b) => b.slug === s))
          .filter(Boolean) as BookCardData[];
        const rest = all.filter((b) => !FEATURED_SLUGS.includes(b.slug));
        setBooks([...featured, ...rest]);
      });
  }, []);

  const onCtaClick = (cta: string, dest: string) => {
    trackEvent("collection_page_cta_click", {
      source_page: "/best-hindi-book-summaries",
      destination_url: dest,
      cta,
    });
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.booknomics.com/" },
      { "@type": "ListItem", position: 2, name: "Hindi", item: "https://www.booknomics.com/hindi" },
      { "@type": "ListItem", position: 3, name: "Best Hindi Book Summaries", item: PAGE_URL },
    ],
  };
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Best Hindi Book Summaries",
    url: PAGE_URL,
    inLanguage: "hi-IN",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: books.slice(0, 20).map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.booknomics.com/books/${b.slug}`,
        name: b.title,
      })),
    },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Layout>
      <SEO
        title="Best Hindi Book Summaries | Booknomics"
        description="Booknomics पर चुने हुए हिंदी पुस्तक सारांश पढ़ें — साहित्य, इतिहास और दर्शन की किताबों के मुख्य विचार, गहन विश्लेषण, अभ्यास और रिफ्लेक्शन के साथ।"
        canonical={PAGE_URL}
        lang="hi"
        jsonLd={[collectionLd, breadcrumbLd, faqLd]}
      />

      <div style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}>
        <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/hindi" className="hover:text-primary">Hindi</Link></li>
            <li aria-hidden>›</li>
            <li className="text-foreground">Best Hindi Book Summaries</li>
          </ol>
        </nav>

        <section className="bg-hero border-b border-border">
          <div className="container py-12 md:py-20 max-w-4xl">
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">
              हिंदी पाठकों के लिए
            </div>
            <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              Best Hindi Book Summaries
            </h1>
            <p className="text-base md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              साहित्य, इतिहास और दर्शन की चुनी हुई हिंदी अध्ययन-मार्गदर्शिकाएँ — मुख्य विचार, गहन विश्लेषण, व्यावहारिक सीख और रिफ्लेक्शन के साथ।
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2 px-7"
                onClick={() => onCtaClick("start_free_hero", "/auth")}
              >
                <Link to="/auth">Start Free <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full px-7"
                onClick={() => onCtaClick("explore_hindi_library_hero", "/hindi")}
              >
                <Link to="/hindi">Explore Hindi Library</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container py-12 md:py-16 max-w-3xl">
          <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed">
            <p>
              हिंदी में अच्छी किताबों की कोई कमी नहीं है — कमी अक्सर समय की होती है। Booknomics का हिंदी सारांश किसी किताब का विकल्प नहीं, बल्कि उसका अध्ययन-नक्शा है: पुस्तक किस बारे में है, उसके मुख्य विचार क्या हैं, और आगे मूल पुस्तक पढ़ना आपके लिए उपयोगी होगा या नहीं।
            </p>
            <p>
              हमारी indexable Hindi library में वही पृष्ठ मुख्य catalog में रखे जाते हैं जिनमें पुस्तक-विशिष्ट सारांश, विश्लेषण, व्यावहारिक सीख और आवश्यक SEO जानकारी मौजूद हो। अधूरे या कम-भरोसे वाले पृष्ठ अलग noindex backlog में रहते हैं और quality review के बाद ही मुख्य catalog में लौटते हैं।
            </p>
            <p>
              वर्तमान curated set साहित्य, इतिहास और दर्शन पर मजबूत है। रवींद्रनाथ ठाकुर की रक्तकरबी सत्ता, श्रम और मानवीय स्वतंत्रता पर सवाल उठाती है; गिरिराज किशोर की ढाई घर सामाजिक जीवन की परतें खोलती है; मृगनयनी और वोल्गा से गंगा इतिहास तथा कल्पना को अलग-अलग तरीके से जोड़ती हैं।
            </p>
            <p>
              दर्शन और विचार की तरफ़ अर्थशास्त्र, ताओ ते चिंग, मेडिटेशन्स और रिपब्लिक जैसे ग्रंथ अलग-अलग सभ्यताओं के शासन, नैतिकता, आत्म-अनुशासन और अच्छे जीवन के प्रश्न सामने रखते हैं। इतिहास में आइने-अकबरी जैसे स्रोत-मूलक ग्रंथों के लिए संदर्भ और स्रोत-सावधानी को विशेष महत्व दिया जाता है।
            </p>
            <p>
              नीचे की सूची केवल वर्तमान published/indexable Hindi catalog से बनती है। कोई पृष्ठ quality review के दौरान noindex होता है तो वह इस featured list में अपने-आप शामिल नहीं रहता।
            </p>
          </div>
        </section>

        <section className="container py-6 md:py-10" aria-labelledby="featured-hindi-books">
          <div className="flex items-end justify-between mb-6 md:mb-8">
            <div>
              <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Featured</div>
              <h2 id="featured-hindi-books" className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
                जिन हिंदी किताबों से शुरुआत करें
              </h2>
            </div>
            <Link
              to="/hindi"
              className="text-xs md:text-sm font-medium text-foreground/70 hover:text-primary inline-flex items-center gap-1.5"
            >
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {books.slice(0, 12).map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </section>

        <section className="container py-12 md:py-16 max-w-4xl">
          <h2 className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
            यहाँ हिंदी सारांश क्यों पढ़ें?
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: Sparkles, title: "त्वरित समझ", desc: "पुस्तक का संदर्भ, मुख्य विचार और पढ़ने की दिशा एक जगह।" },
              { icon: BookOpen, title: "प्रयोगात्मक पाठ", desc: "जहाँ उपयुक्त हो वहाँ एक्शन सिस्टम, अभ्यास ट्रैकर और रिफ्लेक्शन प्रश्न।" },
              { icon: Languages, title: "हिंदी-प्रथम अनुभव", desc: "हिंदी पाठक के लिए स्पष्ट भाषा और संदर्भ के साथ लिखा गया।" },
              { icon: Check, title: "Quality gate", desc: "अधूरे या कम-भरोसे वाले पृष्ठ मुख्य indexable catalog से बाहर रखे जाते हैं।" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-border rounded-2xl p-5 bg-card">
                <Icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-serif text-lg font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="hindi-guide">
          <h2 id="hindi-guide" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-6">
            हिंदी पुस्तक सारांश: एक पूरा गाइड
          </h2>
          <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed space-y-8">
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">1. हिंदी पुस्तक सारांश क्या होते हैं?</h3>
              <p>
                हिंदी पुस्तक सारांश किसी किताब का संपादित, संरचित अध्ययन रूप है — जिसमें पुस्तक का संदर्भ, मुख्य विचार, विश्लेषण और उपयोगी सीख शामिल होती है। यह किताब का विकल्प नहीं, उसका नक्शा है।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">2. सही सारांश कैसे चुनें?</h3>
              <p>
                ऐसा सारांश चुनें जिसमें लेखक और पुस्तक की पहचान साफ़ हो, generic filler की जगह पुस्तक-विशिष्ट सामग्री हो, और स्रोत या editorial process समझ में आए। पूरी published सूची{" "}
                <Link to="/hindi" className="text-primary hover:underline">हिंदी लाइब्रेरी</Link> में देखें।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">3. भारतीय विचार और नीति</h3>
              <p>
                <Link to="/books/अर्थशास्त्र-hindi-summary" className="text-primary hover:underline">अर्थशास्त्र</Link>{" "}
                राज्य, नीति और शक्ति के प्रश्नों पर पढ़ने की शुरुआत देता है। इसके साथ{" "}
                <Link to="/books/अभयुदय-नरेनदर-कोहली-सारांश" className="text-primary hover:underline">अभ्युदय</Link>{" "}
                जैसे आधुनिक पुनर्पाठ को अलग साहित्यिक संदर्भ में पढ़ा जा सकता है।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">4. दर्शन के लिए अच्छी शुरुआत</h3>
              <p>
                <Link to="/books/ताओ-ते-चिंग-hindi-summary" className="text-primary hover:underline">ताओ ते चिंग</Link>,{" "}
                <Link to="/books/मेडिटेशन्स-hindi-summary" className="text-primary hover:underline">मेडिटेशन्स</Link> और{" "}
                <Link to="/books/रिपब्लिक-hindi-summary" className="text-primary hover:underline">रिपब्लिक</Link>{" "}
                अलग परंपराओं से आत्म-अनुशासन, शासन और अच्छे जीवन पर विचार करने का अवसर देते हैं।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">5. साहित्य और कथा</h3>
              <p>
                <Link to="/books/रक्तकरबी" className="text-primary hover:underline">रक्तकरबी</Link>,{" "}
                <Link to="/books/ढाई-घर-गिरिराज-किशोर-saransh" className="text-primary hover:underline">ढाई घर</Link> और{" "}
                <Link to="/books/मृगनयनी-वृंदावनलाल-वरमा-सारांश" className="text-primary hover:underline">मृगनयनी</Link>{" "}
                साहित्यिक, सामाजिक और ऐतिहासिक पढ़ाई के तीन अलग प्रवेश-बिंदु देते हैं।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">6. इतिहास और संदर्भ</h3>
              <p>
                <Link to="/books/आइने-अकबरी-hindi-summary" className="text-primary hover:underline">आइने-अकबरी</Link> जैसे ऐतिहासिक ग्रंथ और{" "}
                <Link to="/books/वोलगा-से-गंगा-राहुल-सांकृतयायन-सारांश" className="text-primary hover:underline">वोल्गा से गंगा</Link>{" "}
                जैसी साहित्यिक ऐतिहासिक रचना को एक ही तरह नहीं पढ़ना चाहिए। Booknomics genre और source-context का फर्क स्पष्ट रखने की कोशिश करता है।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">7. सारांश का सही उपयोग कैसे करें?</h3>
              <p>
                पहले सारांश से पुस्तक की दिशा समझें, फिर एक विचार चुनकर उसे नोट करें और मूल पुस्तक या भरोसेमंद स्रोत से आगे पढ़ें। अभ्यास के लिए{" "}
                <Link to="/resources/7-day-reading-action-tracker" className="text-primary hover:underline">
                  7-दिन रीडिंग एक्शन ट्रैकर
                </Link>{" "}
                और{" "}
                <Link to="/resources/book-summary-template" className="text-primary hover:underline">
                  बुक समरी टेम्पलेट
                </Link>{" "}
                उपयोग कर सकते हैं।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">8. सारांश या पूरी किताब — क्या चुनें?</h3>
              <p>
                सारांश निर्णय लेने और पुनरावृत्ति के लिए उपयोगी है; पूरी किताब संदर्भ और गहराई देती है। जो पुस्तक आपके सवाल से सीधे जुड़ती हो, उसका मूल या अधिकृत संस्करण पढ़ना बेहतर अगला कदम है।
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full px-7">
              <Link to="/hindi" onClick={() => onCtaClick("explore_hindi_library_guide", "/hindi")}>Explore Hindi Library</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/auth" onClick={() => onCtaClick("start_free_guide", "/auth")}>Start Free</Link>
            </Button>
          </div>
        </section>

        <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="faq-heading">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">FAQ</div>
          <h2 id="faq-heading" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
            अक्सर पूछे जाने वाले प्रश्न
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-serif text-base md:text-lg">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="container py-12 md:py-20">
          <div className="bg-gold rounded-3xl p-10 md:p-16 text-center shadow-cover">
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-3">
              अपनी पढ़ाई शुरू करें
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-7 text-sm md:text-base">
              अकाउंट बनाएँ और पसंदीदा हिंदी किताबों को अपनी लाइब्रेरी में सेव करें।
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-full px-8"
                onClick={() => onCtaClick("start_free_footer", "/auth")}
              >
                <Link to="/auth">Start Free</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full px-8 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => onCtaClick("explore_hindi_library_footer", "/hindi")}
              >
                <Link to="/hindi">Explore Hindi Library</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default BestHindiBookSummaries;
