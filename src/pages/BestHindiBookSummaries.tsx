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

// Curated priority order — these get featured first if present.
const FEATURED_SLUGS = [
  "bhagavad-gita-hi",
  "chanakya-niti",
  "godan",
  "gaban",
  "ramcharitmanas",
  "upanishads",
  "wings-of-fire",
  "ashtavakra-gita",
  "karmabhoomi",
  "tamas",
];

const FAQS = [
  {
    q: "हिंदी पुस्तक सारांश क्या होते हैं?",
    a: "हिंदी पुस्तक सारांश किसी किताब के मुख्य विचार, सीख और प्रयोगात्मक पाठों का संक्षिप्त रूप होते हैं — जिन्हें पढ़कर आप कम समय में पूरी किताब का सार समझ सकते हैं।",
  },
  {
    q: "क्या ये पूरी किताबें हैं या केवल सारांश?",
    a: "Booknomics पर हम पूरी किताब नहीं देते — हम क्यूरेटेड सारांश, मुख्य विचार, गहन विश्लेषण, दैनिक प्रयोग और एक 7-दिन का एक्शन प्लान देते हैं ताकि आप किताब को सीख कर अपने जीवन में लागू कर सकें।",
  },
  {
    q: "मुझे किस किताब से शुरू करना चाहिए?",
    a: "अगर आप अध्यात्म पसंद करते हैं तो भगवद् गीता या उपनिषद से शुरू करें। अगर रणनीति और जीवन-दर्शन पसंद है तो चाणक्य नीति, और साहित्य के लिए प्रेमचंद की गोदान या गबन एक बेहतरीन शुरुआत है।",
  },
  {
    q: "क्या ये सारांश प्रयोगात्मक हैं या केवल अकादमिक?",
    a: "हर सारांश के साथ हम 'दैनिक प्रयोग', 'एक्शन सिस्टम' और 'रिफ्लेक्शन प्रश्न' जोड़ते हैं — ताकि किताब केवल पढ़ी न जाए, बल्कि जीवन में उतारी जाए।",
  },
  {
    q: "क्या मैं किताबों को अपनी लाइब्रेरी में सेव कर सकता हूँ?",
    a: "हाँ। मुफ़्त अकाउंट बनाकर आप अपनी पसंदीदा हिंदी किताबों को 'My Library' में सेव कर सकते हैं और कभी भी वापस आकर पढ़ सकते हैं।",
  },
];

const PAGE_URL = "https://booknomics.com/best-hindi-book-summaries";

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
      { "@type": "ListItem", position: 1, name: "Home", item: "https://booknomics.com/" },
      { "@type": "ListItem", position: 2, name: "Hindi", item: "https://booknomics.com/hindi" },
      { "@type": "ListItem", position: 3, name: "Best Hindi Book Summaries", item: PAGE_URL },
    ],
  };
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Best Hindi Book Summaries",
    url: PAGE_URL,
    inLanguage: "hi",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: books.slice(0, 20).map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://booknomics.com/books/${b.slug}`,
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
        description="Explore the best Hindi book summaries on Booknomics with practical lessons, timeless ideas, and clear insights from classics, philosophy, spirituality, and self-growth books."
        canonical={PAGE_URL}
        lang="hi"
        jsonLd={[collectionLd, breadcrumbLd, faqLd]}
      />

      <div style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}>
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/hindi" className="hover:text-primary">Hindi</Link></li>
            <li aria-hidden>›</li>
            <li className="text-foreground">Best Hindi Book Summaries</li>
          </ol>
        </nav>

        {/* Hero */}
        <section className="bg-hero border-b border-border">
          <div className="container py-12 md:py-20 max-w-4xl">
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">
              हिंदी पाठकों के लिए
            </div>
            <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              Best Hindi Book Summaries
            </h1>
            <p className="text-base md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              अध्यात्म, साहित्य, नीति और आत्म-विकास की सबसे ज़रूरी हिंदी किताबों के क्यूरेटेड सारांश — मुख्य विचार, गहन विश्लेषण और एक प्रयोगात्मक 7-दिन एक्शन प्लान के साथ।
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

        {/* Intro copy */}
        <section className="container py-12 md:py-16 max-w-3xl">
          <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed">
            <p>
              हिंदी में अच्छी किताबों की कोई कमी नहीं है — कमी है समय की। एक पाठक जिसके पास नौकरी, परिवार और रोज़मर्रा की ज़िम्मेदारियाँ हैं, उसके लिए हर महीने पाँच किताबें पढ़ना लगभग असंभव है। यहीं पर हिंदी पुस्तक सारांश का असली मूल्य है — वो आपको किताब के मूल विचार, ज़रूरी सीख और प्रयोगात्मक पाठ कम समय में देते हैं, बिना उस गहराई से समझौता किए जिसकी असली पाठक तलाश करता है।
            </p>
            <p>
              Booknomics पर हम पारंपरिक "summary apps" की तरह केवल bullet points नहीं बनाते। हर हिंदी किताब के लिए हम चार स्तरों पर काम करते हैं — एक संक्षिप्त परिचय जो आपको किताब का संदर्भ देता है, मुख्य विचार जो लेखक की मूल अवधारणाओं को स्पष्ट करते हैं, गहन विश्लेषण जो ये बताता है कि ये विचार आज भी क्यों मायने रखते हैं, और दैनिक प्रयोग जो दिखाता है कि इन्हें अपने जीवन में कैसे उतारा जाए। साथ ही एक 7-दिन का एक्शन ट्रैकर और रिफ्लेक्शन प्रश्न भी मिलते हैं — ताकि किताब केवल पढ़ी न जाए, जी जाए।
            </p>
            <p>
              हमारी हिंदी लाइब्रेरी जान-बूझकर विविध है। एक तरफ़ भगवद् गीता, उपनिषद और अष्टावक्र गीता जैसे आध्यात्मिक ग्रंथ हैं जो हज़ारों साल से मनुष्य के सबसे गहरे प्रश्नों के उत्तर देते आए हैं। दूसरी तरफ़ चाणक्य नीति है, जो आज के स्टार्टअप संस्थापक के लिए उतनी ही प्रासंगिक है जितनी एक प्राचीन राजा के लिए थी। प्रेमचंद की गोदान और गबन भारतीय समाज के उन सच्चाइयों को दिखाती हैं जिन्हें हम आज भी अनदेखा करना चाहते हैं — गरीबी, क़र्ज़, और मध्यवर्गीय नैतिक संघर्ष।
            </p>
            <p>
              आधुनिक हिंदी पाठक के लिए हमने APJ Abdul Kalam की Wings of Fire जैसी प्रेरणादायक आत्मकथाएँ भी शामिल की हैं, जो दिखाती हैं कि एक साधारण पृष्ठभूमि से उठकर भी कोई व्यक्ति राष्ट्रीय और वैज्ञानिक स्तर पर असाधारण योगदान दे सकता है। भीष्म साहनी की तमस जैसी कृतियाँ हमें इतिहास की उन परतों से जोड़ती हैं जो किताबों में कम और स्मृति में ज़्यादा बची हैं।
            </p>
            <p>
              हर सारांश का एक स्पष्ट उद्देश्य है — आपके सोचने का तरीक़ा बदलना, और छोटे-छोटे दैनिक कार्यों के ज़रिए उस बदलाव को टिकाऊ बनाना। यही कारण है कि हम केवल पढ़ने की नहीं, अभ्यास की संस्कृति बनाना चाहते हैं। नीचे दी गई किताबें शुरुआत के लिए सबसे अच्छी हैं — किसी भी एक से शुरू कीजिए, और सात दिन के अभ्यास के बाद ख़ुद ही फ़र्क़ महसूस होगा।
            </p>
          </div>
        </section>

        {/* Featured Hindi books */}
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

        {/* Why read here */}
        <section className="container py-12 md:py-16 max-w-4xl">
          <h2 className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
            यहाँ हिंदी सारांश क्यों पढ़ें?
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: Sparkles, title: "त्वरित समझ", desc: "मूल विचार 12–15 मिनट में, फ़ालतू भूमिका के बिना।" },
              { icon: BookOpen, title: "प्रयोगात्मक पाठ", desc: "हर किताब के साथ एक 7-दिन का एक्शन प्लान और रिफ्लेक्शन प्रश्न।" },
              { icon: Languages, title: "हिंदी-प्रथम अनुभव", desc: "अनुवाद नहीं — हिंदी पाठक की संवेदना के साथ लिखा गया।" },
              { icon: Check, title: "क्यूरेटेड गुणवत्ता", desc: "हर किताब चुनी हुई, स्पष्ट और ईमानदार — कोई फ़िलर नहीं।" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-border rounded-2xl p-5 bg-card">
                <Icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-serif text-lg font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Long-form guide */}
        <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="hindi-guide">
          <h2 id="hindi-guide" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-6">
            हिंदी पुस्तक सारांश: एक पूरा गाइड
          </h2>
          <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed space-y-8">
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">1. हिंदी पुस्तक सारांश क्या होते हैं?</h3>
              <p>
                हिंदी पुस्तक सारांश किसी किताब का संपादित, संरचित रूप है — जिसमें लेखक का मूल तर्क, उसके
                सबसे ज़रूरी विचार और उन विचारों को जीवन में उतारने के तरीके शामिल होते हैं। ये किताब का
                विकल्प नहीं, उसका नक्शा हैं: आप 15 मिनट में समझ जाते हैं कि किताब क्या कहती है, क्यों कहती
                है, और आपके लिए उसमें क्या काम का है।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">2. हिंदी पाठक सारांश क्यों पढ़ते हैं?</h3>
              <p>
                कई श्रेष्ठ किताबें केवल अंग्रेज़ी में उपलब्ध हैं, और अनुवाद अक्सर महँगे या कठिन भाषा में होते
                हैं। दूसरी ओर, नौकरी और परिवार के बीच 300 पेज पढ़ने का समय निकालना कठिन है। सारांश इन दोनों
                समस्याओं का समाधान देते हैं — अपनी भाषा में, अपने समय में, बिना गहराई खोए। पूरी लाइब्रेरी{" "}
                <Link to="/hindi" className="text-primary hover:underline">हिंदी लाइब्रेरी</Link> में देखें।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">3. आत्म-विकास के लिए सर्वश्रेष्ठ हिंदी सारांश</h3>
              <p>
                यदि आप आत्म-विकास से शुरुआत करना चाहते हैं, तो{" "}
                <Link to="/books/chanakya-niti" className="text-primary hover:underline">चाणक्य नीति</Link>{" "}
                पढ़ें — निर्णय, धन और लोगों को समझने की व्यावहारिक नीति। इसके बाद{" "}
                <Link to="/books/wings-of-fire" className="text-primary hover:underline">विंग्स ऑफ़ फ़ायर</Link>{" "}
                लें, जो अनुशासन और दीर्घकालिक लक्ष्य की सबसे प्रेरक भारतीय कहानी है।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">4. सर्वश्रेष्ठ हिंदी आध्यात्मिक सारांश</h3>
              <p>
                आध्यात्मिक पाठकों के लिए{" "}
                <Link to="/books/bhagavad-gita-hi" className="text-primary hover:underline">भगवद् गीता</Link>{" "}
                सबसे अच्छी शुरुआत है — कर्म, कर्तव्य और स्थिर मन का सार। इसके बाद{" "}
                <Link to="/books/upanishads" className="text-primary hover:underline">उपनिषद</Link>{" "}
                और{" "}
                <Link to="/books/ramcharitmanas" className="text-primary hover:underline">रामचरितमानस</Link>{" "}
                पढ़ें, जो चरित्र और मर्यादा को कथा के रूप में सिखाते हैं।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">5. सर्वश्रेष्ठ हिंदी साहित्य सारांश</h3>
              <p>
                हिंदी साहित्य समाज को समझने का सबसे ईमानदार दर्पण है।{" "}
                <Link to="/books/godan" className="text-primary hover:underline">गोदान</Link>,{" "}
                <Link to="/books/gaban" className="text-primary hover:underline">गबन</Link> और{" "}
                <Link to="/books/nirmala" className="text-primary hover:underline">निर्मला</Link> —
                प्रेमचंद की ये तीन रचनाएँ किसान, लोभ और स्त्री-जीवन के प्रश्नों को आज भी प्रासंगिक बनाए रखती हैं।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">6. वित्त और उत्पादकता के हिंदी सारांश</h3>
              <p>
                पैसा और समय — दोनों की समझ पढ़ने से बनती है। चाणक्य नीति का अर्थ-दर्शन, और हमारी लाइब्रेरी के
                वित्त व उत्पादकता सारांश आपको बचत, निवेश और दिनचर्या की स्पष्ट व्यवस्था देते हैं। शुरुआत के
                लिए <Link to="/category/finance" className="text-primary hover:underline">फ़ाइनेंस</Link> और{" "}
                <Link to="/category/productivity" className="text-primary hover:underline">प्रोडक्टिविटी</Link>{" "}
                श्रेणियाँ देखें।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">7. सारांश का सही उपयोग कैसे करें?</h3>
              <p>
                एक सप्ताह में एक ही किताब लें। पहले दिन सारांश पढ़ें, दूसरे दिन एक विचार चुनें, और अगले सात दिन
                उसे रोज़ आज़माएँ। इसके लिए हमारा मुफ़्त{" "}
                <Link to="/resources/7-day-reading-action-tracker" className="text-primary hover:underline">
                  7-दिन रीडिंग एक्शन ट्रैकर
                </Link>{" "}
                और{" "}
                <Link to="/resources/book-summary-template" className="text-primary hover:underline">
                  बुक समरी टेम्पलेट
                </Link>{" "}
                उपयोग करें — सभी संसाधन{" "}
                <Link to="/resources" className="text-primary hover:underline">Resources</Link> पेज पर हैं।
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">8. सारांश या पूरी किताब — क्या चुनें?</h3>
              <p>
                सारांश तय करने में मदद करता है; पूरी किताब गहराई देती है। नियम सरल रखें — सारांश पढ़कर परखें,
                और जो किताब आपके जीवन के किसी सवाल से सीधे जुड़ जाए, उसे मूल रूप में ख़रीदकर पढ़ें। हम हमेशा
                लेखकों और प्रकाशकों की मूल किताबें ख़रीदने का समर्थन करते हैं।
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full px-7">
              <Link to="/hindi" onClick={() => onCtaClick("explore_hindi_library_guide", "/hindi")}>
                Explore Hindi Library
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/auth" onClick={() => onCtaClick("start_free_guide", "/auth")}>Start Free</Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
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

        {/* Final CTA */}
        <section className="container py-12 md:py-20">
          <div className="bg-gold rounded-3xl p-10 md:p-16 text-center shadow-cover">
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-3">
              अपनी पढ़ाई शुरू करें
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-7 text-sm md:text-base">
              मुफ़्त अकाउंट बनाएँ और पसंदीदा हिंदी किताबों को अपनी लाइब्रेरी में सेव करें।
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
