import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookmarkPlus, BookmarkCheck, Clock, Star, Calendar, Sparkles, Loader2, Download, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { BookCover } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { toast } from "sonner";
import { downloadTrackerPdf } from "@/lib/trackerPdf";
import { PremiumLock } from "@/components/PremiumLock";
import { LockedPreview } from "@/components/LockedPreview";
import { HabitTracker, BookNotes } from "@/components/HabitTracker";
import { AffiliateCTA } from "@/components/AffiliateCTA";
import { AdBanner } from "@/components/AdBanner";
import { AudioInsightButton } from "@/components/AudioInsight";
import { ShareInsight } from "@/components/ShareInsight";
import { AuthorBio } from "@/components/AuthorBio";
import { trackAddToLibrary } from "@/lib/analytics";
import { SEO } from "@/components/SEO";
import { Helmet } from "react-helmet-async";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { slugifyCategory } from "@/lib/categorySlug";
import { Link } from "react-router-dom";

import { resolveCanonicalSlug } from "@/lib/slugRedirects";
import { linkifyMarkdown, linkifyText, type LinkTarget } from "@/lib/autoLink";

import { useBookAssets } from "@/hooks/useBookAssets";
const ReadingView = lazy(() => import("@/components/ReadingView"));
import { Headphones } from "lucide-react";
import { BookMindmapSection } from "@/components/BookMindmapSection";
import { BookFAQ, buildBookFaqs } from "@/components/BookFAQ";
import { BookShareBar } from "@/components/BookShareBar";
import { useTier } from "@/hooks/useTier";
import { PaywallOverlay } from "@/components/PaywallOverlay";


// Lazy-load heavy community widgets — below-the-fold, not needed for LCP
const BookReviews = lazy(() => import("@/components/BookReviews").then(m => ({ default: m.BookReviews })));
const BookComments = lazy(() => import("@/components/BookComments").then(m => ({ default: m.BookComments })));
const CommunitySidebar = lazy(() => import("@/components/CommunitySidebar").then(m => ({ default: m.CommunitySidebar })));
const MasteryTab = lazy(() => import("@/components/MasteryTab"));
const StickyAudioPlayer = lazy(() => import("@/components/StickyAudioPlayer").then(m => ({ default: m.StickyAudioPlayer })));
const CommunityFallback = () => <div className="h-32 rounded-xl bg-muted/40 animate-pulse" />;

interface Book {
  id: string; slug: string; title: string; author: string; category: string;
  cover_color: string; cover_url: string | null; tagline: string | null; overview: string | null;
  deep_summary: string | null; key_ideas: string | null; deep_analysis: string | null; daily_application: string | null;
  action_system: string | null; practice_tracker: string | null; reflection_questions: string | null;
  real_life_example: string | null;
  rating: number | null; reading_time: number | null; year: number | null; language: string;
  affiliate_link: string | null;
  alternate_book_id: string | null;
}

const Section = ({ title, eyebrow, children, level = 2 }: { title: string; eyebrow: string; children: React.ReactNode; level?: 2 | 3 }) => {
  const Heading: any = `h${level}`;
  return (
    <section className="py-8 border-t border-border first:border-t-0 first:pt-2">
      <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">{eyebrow}</div>
      <Heading className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">{title}</Heading>
      <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed whitespace-pre-line">
        {children}
      </div>
    </section>
  );
};

const AutoLinkedText = ({ text, targets }: { text: string; targets: LinkTarget[] }) => {
  const segs = linkifyText(text || "", targets);
  return <>{segs.map((s, i) => s.type === "link"
    ? <Link key={i} to={`/books/${s.slug}`} className="text-primary underline-offset-2 hover:underline">{s.value}</Link>
    : <span key={i}>{s.value}</span>)}</>;
};

const MD = ({ children }: { children: string }) => (
  <div className="prose prose-lg dark:prose-invert max-w-none
    prose-headings:font-serif prose-headings:tracking-tight
    prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3
    prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2
    prose-p:leading-relaxed prose-li:my-1
    prose-strong:text-foreground
    prose-table:text-sm prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border prose-th:border">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
);

const EmptyState = ({ onGenerate, loading, label }: { onGenerate: () => void; loading: boolean; label: string }) => (
  <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/30">
    <Sparkles className="h-10 w-10 mx-auto text-primary mb-4" />
    <h3 className="font-serif text-2xl font-semibold mb-2">{label}</h3>
    <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
      Generate a personalised, genre-aware action system, weekly tracker, and reflection prompts — built from this book.
    </p>
    <Button onClick={onGenerate} disabled={loading} size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2">
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate Action Plan</>}
    </Button>
  </div>
);

const isLowSignalHindiText = (text: string) => {
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

const extractReaderTakeaways = (
  primary: string,
  overview: string,
  analysis: string,
  max = 5,
) => {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const clean = stripMarkdown(raw)
      .replace(/\\n/g, " ")
      .replace(/^[-*•\d.)\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length < 28 || isLowSignalHindiText(clean)) return;
    const first = clean.split(/(?<=[.!?।])\s+/)[0]?.trim() || clean;
    const takeaway = first.length > 210 ? `${first.slice(0, 207).trimEnd()}…` : first;
    const key = takeaway.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(takeaway);
  };

  const addBlocks = (text: string) => {
    text
      .replace(/\\n/g, "\n")
      .split(/\n{2,}|(?=^###\s+)/m)
      .map((block) => block.replace(/^#{1,6}\s+.*$/m, "").trim())
      .filter(Boolean)
      .forEach(add);
  };

  if (primary && !isLowSignalHindiText(primary)) addBlocks(primary);
  if (result.length < max && overview) addBlocks(overview);
  if (result.length < max && analysis) addBlocks(analysis);

  return result.slice(0, max);
};

const BookDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useTier();
  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [sameLang, setSameLang] = useState<any[]>([]);
  const [inLibrary, setInLibrary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [hiContent, setHiContent] = useState<Partial<Book> | null>(null);
  const [translating, setTranslating] = useState(false);
  const [reviewStats, setReviewStats] = useState<{ count: number; avg: number; top: { rating: number; content: string; created_at: string } | null }>({ count: 0, avg: 0, top: null });
  const [linkTargets, setLinkTargets] = useState<LinkTarget[]>([]);
  const [podcastOpen, setPodcastOpen] = useState(false);
  const [counterpart, setCounterpart] = useState<{ slug: string; language: string } | null>(null);
  const { assets, loading: assetsLoading } = useBookAssets(book?.id);

  useEffect(() => {
    if (!slug) return;
    // Client-side 301 fallback: if this slug is a known hardcoded alias, redirect immediately.
    const aliasTarget = resolveCanonicalSlug(slug);
    if (aliasTarget && aliasTarget !== slug) {
      navigate(`/books/${aliasTarget}`, { replace: true });
      return;
    }
    setBook(null);
    setBookLoading(true);
    setBookError(null);
    (async () => {
      try {
        const fields = "id,slug,title,author,category,cover_color,tagline,overview,deep_summary,key_ideas,deep_analysis,daily_application,reading_time,rating,year,created_at,cover_url,language,affiliate_link,is_draft,status,meta_title,meta_description,og_image,seo_slug,seo_keywords,old_slugs,alternate_book_id";
        // Try canonical slug first, then seo_slug (keyword URL), then any book
        // that has this slug in old_slugs.
        const primary = await supabase.from("books").select(fields).eq("slug", slug).eq("is_draft", false).in("status", ["published", "published_noindex"]).maybeSingle();
        if (primary.error) throw primary.error;
        let data = primary.data;

        if (!data) {
          const bySeo = await supabase.from("books").select(fields).eq("seo_slug", slug).eq("is_draft", false).in("status", ["published", "published_noindex"]).maybeSingle();
          if (bySeo.error) throw bySeo.error;
          data = bySeo.data;
        }
        if (!data) {
          const byOld = await supabase.from("books").select(fields).contains("old_slugs", [slug]).eq("is_draft", false).in("status", ["published", "published_noindex"]).limit(1).maybeSingle();
          if (byOld.error) throw byOld.error;
          if (byOld.data) {
            const target = (byOld.data as any).seo_slug || (byOld.data as any).slug;
            if (target && target !== slug) {
              navigate(`/books/${target}`, { replace: true });
              return;
            }
            data = byOld.data;
          }
        }

        if (!data) {
          setBookError("not-found");
          return;
        }

        setBook(data as unknown as Book);
        // Public summary sections are fetched above for every visible book.
        // Premium-only interactive/action fields may still be merged below.
        const { data: prem, error: premError } = await supabase.rpc("get_premium_summary", { p_book_id: (data as any).id });
        if (!premError) {
          const row = Array.isArray(prem) ? prem[0] : prem;
          if (row) setBook((prev) => (prev ? ({ ...prev, ...row } as Book) : prev));
        }
      } catch (error) {
        console.error("[BookDetail] load failed", error);
        setBookError(error instanceof Error ? error.message : "Unable to load this book");
      } finally {
        setBookLoading(false);
      }
    })();
  }, [slug, navigate]);

  useEffect(() => {
    if (!book) return;
    supabase.from("books")
      .select("id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
      .eq("is_draft", false)
      .eq("status", "published")
      .eq("category", book.category)
      .neq("id", book.id)
      .limit(6)
      .then(({ data }) => setRelated((data ?? []).map((row: any) => ({ ...row, slug: row.seo_slug || row.slug }))));
    supabase.from("books")
      .select("id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
      .eq("is_draft", false)
      .eq("status", "published")
      .eq("language", book.language)
      .neq("id", book.id)
      .neq("category", book.category)
      .limit(4)
      .then(({ data }) => setSameLang((data ?? []).map((row: any) => ({ ...row, slug: row.seo_slug || row.slug }))));
  }, [book]);

  useEffect(() => {
    if (!book) return;
    supabase.from("book_reviews")
      .select("rating,content,created_at")
      .eq("book_id", book.id)
      .order("upvote_count", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = data ?? [];
        if (!rows.length) { setReviewStats({ count: 0, avg: 0, top: null }); return; }
        const avg = rows.reduce((a: number, r: any) => a + (r.rating ?? 0), 0) / rows.length;
        const top = rows.find((r: any) => r.content && r.content.trim().length > 20) ?? null;
        setReviewStats({ count: rows.length, avg: Math.round(avg * 10) / 10, top });
      });
  }, [book]);

  useEffect(() => {
    if (!book) return;
    supabase.from("books")
      .select("title,slug,seo_slug")
      .eq("is_draft", false)
      .eq("status", "published")
      .eq("language", book.language)
      .neq("id", book.id)
      .limit(120)
      .then(({ data }) => setLinkTargets((data ?? []).map((row: any) => ({ title: row.title, slug: row.seo_slug || row.slug })) as LinkTarget[]));
  }, [book]);

  // Only explicit database relationships may create language alternates.
  // Slug guessing can pair unrelated Hindi/English books and produce invalid hreflang.
  useEffect(() => {
    setCounterpart(null);
    if (!book?.alternate_book_id) return;
    supabase.from("books")
      .select("slug,seo_slug,language")
      .eq("id", book.alternate_book_id)
      .eq("is_draft", false)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCounterpart({
          slug: (data as any).seo_slug || data.slug,
          language: data.language,
        });
      });
  }, [book]);


  const switchLang = async (next: "en" | "hi") => {
    setLang(next);
    if (next === "hi" && !hiContent && book) {
      setTranslating(true);
      try {
        const { data, error } = await supabase.functions.invoke("translate-to-hindi", {
          body: { sections: {
            overview: book.overview, key_ideas: book.key_ideas,
            deep_analysis: book.deep_analysis, daily_application: book.daily_application,
          }},
        });
        if (error || data?.error) throw new Error(data?.error ?? error?.message);
        setHiContent(data);
      } catch (e: any) {
        toast.error(e.message ?? "Translation failed");
        setLang("en");
      } finally { setTranslating(false); }
    }
  };


  useEffect(() => {
    if (!user || !book) return;
    supabase.from("library").select("id").eq("user_id", user.id).eq("book_id", book.id).maybeSingle()
      .then(({ data }) => setInLibrary(!!data));
  }, [user, book]);

  const toggleLibrary = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!book) return;
    if (inLibrary) {
      await supabase.from("library").delete().eq("user_id", user.id).eq("book_id", book.id);
      setInLibrary(false);
      toast.success("Removed from library");
    } else {
      await supabase.from("library").insert({ user_id: user.id, book_id: book.id });
      setInLibrary(true);
      trackAddToLibrary(
        { title: book.title, slug: book.slug, category: (book as any).category, language: (book as any).language },
        !!user
      );
      toast.success("Added to library");
    }
  };

  const generateActionPlan = async () => {
    if (!book) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Please log in to generate your action plan.");
      navigate("/auth");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-action-plan", {
        body: { book_id: book.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBook({
        ...book,
        action_system: data.action_system,
        practice_tracker: data.practice_tracker,
        reflection_questions: data.reflection_questions,
        real_life_example: data.real_life_example ?? book.real_life_example,
      });
      toast.success(data.cached ? "Loaded from cache" : "Action plan ready!");
    } catch (e: any) {
      const msg = e?.message || "";
      if (/401|auth|session/i.test(msg)) toast.error("Your session has expired. Please log in again.");
      else toast.error(msg || "Unable to generate action plan right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (bookLoading) {
    return <Layout><div className="container py-20 text-center text-muted-foreground">Loading book…</div></Layout>;
  }

  if (!book) {
    const notFound = bookError === "not-found";
    return (
      <Layout>
        <SEO
          title={notFound ? "Book not found | Booknomics" : "Unable to load book | Booknomics"}
          description={notFound ? "This Booknomics book page could not be found." : "This book could not be loaded right now."}
          path={slug ? `/books/${slug}` : "/books"}
          noindex
        />
        <div className="container py-20 text-center">
          <h1 className="font-serif text-3xl font-bold">{notFound ? "Book not found" : "Unable to load this book"}</h1>
          <p className="text-muted-foreground mt-3">{notFound ? "The link may be old or the book is no longer public." : "Please retry. Your connection or the database may have been temporarily unavailable."}</p>
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" onClick={() => navigate("/browse")}>Browse books</Button>
            {!notFound && <Button onClick={() => window.location.reload()}>Retry</Button>}
          </div>
        </div>
      </Layout>
    );
  }

  const isHi = book.language === "hi";
  const bookAny = book as any;
  const rawDesc = stripMarkdown(book.tagline || book.overview || "");
  const fallbackDesc = isHi
    ? `${book.title} का सारांश हिंदी में पढ़ें — प्रमुख विचार, गहरा विश्लेषण और 7-दिन की व्यावहारिक कार्ययोजना के साथ।`
    : `${book.title} by ${book.author}: key insights, practical lessons, reflection questions, and an actionable plan you can use today.`;
  const seoTitle = bookAny.meta_title || (isHi
    ? `${book.title} का सारांश हिंदी में — ${book.author} | Booknomics`
    : `${book.title} Summary: Key Lessons & Analysis | Booknomics`);
  const seoDesc = bookAny.meta_description || (isHi ? fallbackDesc.slice(0, 158) : (rawDesc ? rawDesc.slice(0, 155) : fallbackDesc));
  const canonicalSlug = (bookAny.seo_slug as string | null) || book.slug;
  const seoPath = `/books/${canonicalSlug}`;
  const canonical = `https://www.booknomics.com${seoPath}`;
  const ogImg = bookAny.og_image || book.cover_url || undefined;
  const readMins = book.reading_time ?? 12;
  const absImage = book.cover_url
    ? (book.cover_url.startsWith("http") ? book.cover_url : `https://www.booknomics.com${book.cover_url.startsWith("/") ? "" : "/"}${book.cover_url}`)
    : undefined;
  const bookLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    inLanguage: isHi ? "hi" : "en",
    genre: book.category,
    ...(book.year ? { datePublished: String(book.year) } : {}),
    ...(absImage ? { image: absImage } : {}),
  };
  const articleLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seoTitle,
    description: seoDesc,
    inLanguage: isHi ? "hi" : "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: "Booknomics", url: "https://www.booknomics.com" },
    publisher: { "@type": "Organization", name: "Booknomics", url: "https://www.booknomics.com" },
    about: {
      "@type": "Book",
      name: book.title,
      author: { "@type": "Person", name: book.author },
    },
    timeRequired: `PT${readMins}M`,
    ...(absImage ? { image: [absImage] } : {}),
  };
  const categoryCrumb = `https://www.booknomics.com/category/${slugifyCategory(book.category)}`;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.booknomics.com/" },
      { "@type": "ListItem", position: 2, name: isHi ? "Hindi" : "Browse", item: isHi ? "https://www.booknomics.com/hindi" : "https://www.booknomics.com/browse" },
      { "@type": "ListItem", position: 3, name: book.category, item: categoryCrumb },
      { "@type": "ListItem", position: 4, name: book.title, item: canonical },
    ],
  };

  // hreflang pairs: when a counterpart edition exists, pair EN ⇄ HI; x-default = English version.
  const counterpartUrl = counterpart ? `https://www.booknomics.com/books/${counterpart.slug}` : null;
  const hreflangAlternates = counterpartUrl
    ? {
        en: isHi ? counterpartUrl : canonical,
        hi: isHi ? canonical : counterpartUrl,
        xDefault: isHi ? counterpartUrl : canonical,
      }
    : undefined;

  // FAQs remain visible for readers; search engines no longer depend on FAQ rich-result markup.
  const faqs = buildBookFaqs({
    title: book.title,
    author: book.author,
    category: book.category,
    readingTime: readMins,
    isHindi: isHi,
    tagline: book.tagline,
  });


  return (
    <Layout>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={canonical}
        ogType="article"
        lang={isHi ? "hi" : "en"}
        ogImage={ogImg}
        alternates={hreflangAlternates}
        jsonLd={[articleLd, bookLd, breadcrumbLd]}
        noindex={bookAny.status === "published_noindex"}
      />
      {book.cover_url && (
        <Helmet>
          <link rel="preload" as="image" href={book.cover_url} {...({ fetchpriority: "high" } as any)} />
        </Helmet>
      )}
      <BookShareBar url={canonical} title={book.title} isHindi={isHi} />

      <div className="bg-hero border-b border-border">
        <div className="container py-6 md:py-12">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-2">
            <ArrowLeft className="h-4 w-4" /> {isHi ? "वापस" : "Back"}
          </Button>
          <nav aria-label="Breadcrumb" className="mb-4 md:mb-6 text-xs md:text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link to="/" className="hover:text-primary">Home</Link></li>
              <li aria-hidden>›</li>
              <li>
                <Link to={isHi ? "/hindi" : "/browse"} className="hover:text-primary">
                  {isHi ? "Hindi" : "English"}
                </Link>
              </li>
              <li aria-hidden>›</li>
              <li>
                <Link to={`/category/${slugifyCategory(book.category)}`} className="hover:text-primary">
                  {book.category}
                </Link>
              </li>
              <li aria-hidden>›</li>
              <li className="text-foreground line-clamp-1">{book.title}</li>
            </ol>
          </nav>
          <div className="grid md:grid-cols-[280px,1fr] gap-6 md:gap-12 items-start">
            <div className="mx-auto md:mx-0 w-40 md:w-full md:max-w-[280px]">
              <BookCover book={book} size="lg" />
            </div>
            <div>
              <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2 md:mb-3">{book.category}</div>
              <h1
                className={`font-serif text-2xl md:text-6xl font-bold leading-[1.1] ${isHi ? "tracking-normal" : "tracking-tight"}`}
                style={isHi ? { fontFamily: "'Noto Sans Devanagari', system-ui, sans-serif" } : undefined}
              >
                {book.title}
              </h1>
              <p className="text-base md:text-xl text-muted-foreground mt-2 md:mt-3">{isHi ? "लेखक: " : "by "}{book.author}</p>
              {book.tagline && (
                <p
                  className={`font-serif text-base md:text-2xl mt-4 md:mt-6 text-foreground/80 ${isHi ? "not-italic" : "italic"}`}
                  style={isHi ? { fontFamily: "'Noto Serif Devanagari', serif" } : undefined}
                >
                  "{book.tagline}"
                </p>
              )}

              <div className="flex flex-wrap items-center gap-5 mt-6 text-sm text-muted-foreground">
                {reviewStats.count > 0 && (
                  <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-primary text-primary" />{reviewStats.avg} ({reviewStats.count})</span>
                )}
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{book.reading_time} min read</span>
                {book.year && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{book.year}</span>}
              </div>

              {!isHi && (
                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  <div className="inline-flex rounded-full border border-border p-1 bg-background/60 backdrop-blur">
                    <button onClick={() => switchLang("en")} className={`px-4 py-1.5 text-sm rounded-full transition ${lang === "en" ? "bg-gold text-primary-foreground font-semibold" : "text-muted-foreground"}`}>EN</button>
                    <button onClick={() => switchLang("hi")} disabled={translating} className={`px-4 py-1.5 text-sm rounded-full transition ${lang === "hi" ? "bg-gold text-primary-foreground font-semibold" : "text-muted-foreground"}`}>
                      {translating ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "हिंदी"}
                    </button>
                  </div>
                  <AudioInsightButton bookId={book.id} lang={lang} />
                </div>
              )}
              {isHi && (
                <div className="mt-6">
                  <AudioInsightButton bookId={book.id} lang="hi" />
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={toggleLibrary} size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2">
                  {inLibrary ? <><BookmarkCheck className="h-4 w-4" /> In your library</> : <><BookmarkPlus className="h-4 w-4" /> Add to library</>}
                </Button>
                {assets?.audio_url && (
                  <Button onClick={() => setPodcastOpen(true)} variant="outline" size="lg" className="rounded-full gap-2 border-gold/40">
                    <Headphones className="h-4 w-4" /> {isHi ? "पॉडकास्ट सुनें" : "Listen to podcast"}
                  </Button>
                )}
                {!book.action_system && (
                  <Button variant="outline" size="lg" onClick={generateActionPlan} disabled={generating} className="rounded-full gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isHi ? "एक्शन प्लान बनाएँ" : "Generate Action Plan"}
                  </Button>
                )}
                {counterpart && (
                  <Button asChild variant="outline" size="lg" className="rounded-full gap-2 border-gold/40">
                    <Link to={`/books/${counterpart.slug}`}>
                      {isHi ? "Read in English →" : "हिंदी में पढ़ें →"}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 md:py-10 grid lg:grid-cols-[1fr,320px] gap-10 items-start">
        <article className="max-w-4xl w-full min-w-0">
          <Tabs defaultValue="summary" className="w-full" id="book-tabs">
            <div className="-mx-4 md:mx-0 mb-6 md:mb-8 overflow-x-auto scrollbar-none">
              <TabsList className={`inline-flex w-max lg:flex lg:w-full px-4 md:px-0 gap-1`}>
                <TabsTrigger value="summary" className="flex-1 text-xs md:text-sm">{isHi ? "सार" : "Summary"}</TabsTrigger>
                <TabsTrigger value="action" className="flex-1 gap-1 text-xs md:text-sm">{!user && <Lock className="h-3 w-3" />}{isHi ? "अभ्यास" : "Action"}</TabsTrigger>
                <TabsTrigger value="tracker" className="flex-1 gap-1 text-xs md:text-sm">{!user && <Lock className="h-3 w-3" />}{isHi ? "ट्रैकर" : "Tracker"}</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1 gap-1 text-xs md:text-sm">{!user && <Lock className="h-3 w-3" />}{isHi ? "नोट्स" : "Notes"}</TabsTrigger>
                <TabsTrigger value="mastery" className="flex-1 gap-1 text-xs md:text-sm">{isHi ? "महारत" : "Mastery"}</TabsTrigger>
                <TabsTrigger value="community" className="lg:hidden text-xs md:text-sm">{isHi ? "चर्चा" : "Community"}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary">
              {(() => {
                const src = lang === "hi" && hiContent ? hiContent : book;
                const readerIsHi = isHi || lang === "hi";
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
                const derivedIdeas = !src.key_ideas && analysisSections.length
                  ? analysisSections.slice(0, 8).map((section) => {
                      const heading = section.match(/^###\s+(.+)$/m)?.[1]?.trim();
                      const body = section.replace(/^###\s+.+$/m, "").trim();
                      const firstSentence = body
                        .split(/(?<=[.!?।])\s+/)
                        .find((sentence) => !isLowSignalHindiText(sentence))
                        ?.trim();
                      return heading ? `- **${heading}**${firstSentence ? ` — ${firstSentence}` : ""}` : "";
                    }).filter(Boolean).join("\n")
                  : "";
                const keyIdeasAreLowSignal = readerIsHi && isLowSignalHindiText(src.key_ideas || "");
                const effectiveKeyIdeas = keyIdeasAreLowSignal ? "" : (src.key_ideas || derivedIdeas);
                const takeaways = extractReaderTakeaways(
                  effectiveKeyIdeas,
                  src.overview || "",
                  rawAnalysis,
                  5,
                );
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

                const sections = [
                  { label: labels[0], text: src.overview },
                  { label: labels[1], text: takeawayMarkdown },
                  { label: labels[2], text: src.deep_summary || derivedSummary },
                  { label: labels[3], text: effectiveKeyIdeas },
                  { label: labels[4], text: src.deep_summary ? rawAnalysis : derivedAnalysis },
                  { label: labels[5], text: src.daily_application || derivedApplication },
                ].filter((section) => Boolean(section.text?.trim()));
                const parts = sections.map(({ label, text }) => `## ${label}\n\n${text}`);
                const merged = linkifyMarkdown(parts.join("\n\n---\n\n"), linkTargets, 1);
                return <>
                  <section className="py-4">
                    <Suspense fallback={<div className="text-center py-16 text-muted-foreground">Loading reader…</div>}>
                      <ReadingView
                        content={merged}
                        title={book.title}
                        author={book.author}
                        category={(book as any).category || undefined}
                        language={(isHi || lang === "hi") ? "hi" : "en"}
                      />
                    </Suspense>
                  </section>
                  <ShareInsight quotesSource={(src.key_ideas as string) || (src.overview as string)} bookTitle={book.title} bookAuthor={book.author} bookSlug={book.slug} />
                  <AffiliateCTA bookId={book.id} link={book.affiliate_link} title={`${book.title} ${book.author}`} placement="summary-end" />
                </>;
              })()}
            </TabsContent>






            <TabsContent value="action">
              {!user ? (
                <LockedPreview
                  eyebrow="Action System"
                  title={isHi ? "इस किताब के लिए कदम-दर-कदम योजना" : "Your step-by-step plan"}
                  ctaLabel={isHi ? "पूरा एक्शन प्लान खोलें" : "Unlock Full Action Plan"}
                  modalTitle={isHi ? "अपना पूरा एक्शन प्लान खोलें" : "Unlock your full Action Plan"}
                  sample={
                    <>
                      <h3>Week 1 — Identity shift</h3>
                      <p>Start with a 2-minute version of the habit. Stack it after an existing routine (coffee, brushing teeth) so the cue is unmissable. The goal this week isn't performance — it's <strong>showing up</strong>.</p>
                      <ol>
                        <li>Pick one keystone behaviour from {book.title}.</li>
                        <li>Define the smallest possible version (under 2 minutes).</li>
                        <li>Attach it to a cue you already do daily.</li>
                        <li>Log it in your tracker — even a checkmark counts…</li>
                      </ol>
                      <h3>Week 2 — Environment design</h3>
                      <p>Make the good choice the obvious one. Move friction toward the behaviours you want to avoid, and remove friction from…</p>
                    </>
                  }
                />
              ) : book.action_system ? (
                <section className="py-4">
                  <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Action System</div>
                  <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">Step-by-step plan</h2>
                  <MD>{linkifyMarkdown(book.action_system, linkTargets, 1)}</MD>
                  <AffiliateCTA bookId={book.id} link={book.affiliate_link} title={`${book.title} ${book.author}`} placement="action-end" label="Get the full book" />
                </section>
              ) : <EmptyState onGenerate={generateActionPlan} loading={generating} label="Build your Action System" />}
            </TabsContent>

            <TabsContent value="tracker">
              {!user ? (
                <LockedPreview
                  eyebrow="7-day Tracker"
                  title={isHi ? "अपनी 7-दिन की प्रैक्टिस" : "Your 7-day practice"}
                  ctaLabel={isHi ? "ट्रैकर अनलॉक करें" : "Unlock 7-day Tracker"}
                  modalTitle="Unlock your 7-day Tracker"
                  modalDescription="Build streaks, log daily wins, and download a printable PDF — free with your account."
                  sample={
                    <>
                      <h3>Daily check-in</h3>
                      <ul>
                        <li><strong>Day 1</strong> — 2-min habit done ✓ · Mood 7/10 · Note: easier than expected.</li>
                        <li><strong>Day 2</strong> — Done ✓ · Mood 8/10 · Note: stacked after coffee, smooth.</li>
                        <li><strong>Day 3</strong> — Missed cue · Will move tracker to phone home-screen.</li>
                        <li><strong>Day 4</strong> — Done ✓ · Streak rebuilt…</li>
                      </ul>
                      <p>At the end of the week you'll get a one-page printable PDF summarising your streak, reflection notes, and the single habit to carry into next week.</p>
                    </>
                  }
                />
              ) : (
                <section className="py-4 space-y-10">
                  <div>
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                      <div>
                        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Live Tracker</div>
                        <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Your 7-day practice</h2>
                      </div>
                      <Button onClick={() => downloadTrackerPdf(book)} className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2">
                        <Download className="h-4 w-4" /> Download PDF
                      </Button>
                    </div>
                    {isPremium ? (
                      <HabitTracker bookId={book.id} />
                    ) : (
                      <PaywallOverlay
                        title="Unlock Action Trackers & Interactive Checklists"
                        description="Transform what you read into daily habits. Premium members get full access to interactive execution boards, audio summaries, and AI assistants."
                      >
                        <div className="p-8 space-y-3 min-h-[260px]">
                          <div className="h-4 w-2/3 bg-muted rounded" />
                          <div className="h-4 w-1/2 bg-muted rounded" />
                          <div className="h-4 w-3/4 bg-muted rounded" />
                          <div className="h-4 w-1/3 bg-muted rounded" />
                          <div className="h-4 w-2/3 bg-muted rounded" />
                        </div>
                      </PaywallOverlay>
                    )}
                  </div>
                  {book.practice_tracker ? (
                    <div>
                      <h3 className="font-serif text-2xl font-bold mb-4">Suggested weekly plan</h3>
                      <MD>{book.practice_tracker}</MD>
                    </div>
                  ) : <EmptyState onGenerate={generateActionPlan} loading={generating} label="Generate suggested plan" />}
                </section>
              )}
            </TabsContent>

            <TabsContent value="notes">
              {!user ? (
                <LockedPreview
                  eyebrow="Personal notes"
                  title={isHi ? "अपने हाइलाइट्स सहेजें" : "Save your highlights"}
                  ctaLabel="Unlock Notes"
                  modalTitle="Save private notes & highlights"
                  modalDescription="Capture the lines that move you and revisit them across every book — free with your account."
                  sample={
                    <>
                      <blockquote>"Small habits, repeated daily, become identity."</blockquote>
                      <p>Your private notes appear here — searchable, organised by book, and synced to your account…</p>
                    </>
                  }
                />
              ) : (
                <section className="py-4">
                  <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Notes</div>
                  <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">Your highlights</h2>
                  <BookNotes bookId={book.id} />
                </section>
              )}
            </TabsContent>

            <TabsContent value="mastery">
              <Suspense fallback={<CommunityFallback />}>
                <MasteryTab bookId={book.id} quiz={assets?.quiz_data ?? []} flashcards={assets?.flashcard_data ?? []} />
              </Suspense>
            </TabsContent>

            <TabsContent value="community" className="lg:hidden">
              <Suspense fallback={<CommunityFallback />}>
                <CommunitySidebar bookId={book.id} />
                <div className="mt-6"><BookReviews bookId={book.id} /></div>
                <div className="mt-6 pt-6 border-t border-border"><BookComments bookId={book.id} /></div>
              </Suspense>
            </TabsContent>
          </Tabs>

          <div id="book-mindmap">
            <BookMindmapSection
              title={book.title}
              mindmapUrl={assets?.mindmap_url}
              loading={assetsLoading}
              isHindi={isHi}
            />
          </div>


          <Suspense fallback={<CommunityFallback />}>
            <div className="hidden lg:block mt-12 pt-12 border-t border-border">
              <BookReviews bookId={book.id} />
            </div>
            <div className="hidden lg:block mt-12 pt-12 border-t border-border">
              <BookComments bookId={book.id} />
            </div>
          </Suspense>

          <AuthorBio author={book.author} category={book.category} />

          {/* AI/LLM-friendly summary text */}
          <section className="mt-12 pt-8 border-t border-border" aria-labelledby="ai-summary">
            <h2 id="ai-summary" className="sr-only">About this page</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This page summarizes <strong>{book.title}</strong> by {book.author}, including the main idea,
              key lessons, practical applications, reflection questions, and an actionable plan readers can apply.
              Category: {book.category}. Language: {book.language === "hi" ? "Hindi" : "English"}.
            </p>
          </section>

          {/* Related books */}
          {related.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border" aria-labelledby="related-books">
              <h2 id="related-books" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-6">
                Related books in {book.category}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                {related.map((b) => (
                  <Link key={b.id} to={`/books/${b.slug}`} className="group block">
                    <div className="bg-card rounded-xl shadow-paper overflow-hidden border border-border/50 transition hover:-translate-y-1 hover:shadow-cover">
                      <div className="p-3">
                        <BookCover book={b} size="md" />
                      </div>
                      <div className="px-3 pb-3">
                        <h3 className="font-serif text-sm md:text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary">{b.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.author}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* More in same language */}
          {sameLang.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border" aria-labelledby="same-lang-books">
              <h2 id="same-lang-books" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-6">
                {isHi ? "और हिंदी किताबें" : "More books in English"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {sameLang.map((b) => (
                  <Link key={b.id} to={`/books/${b.slug}`} className="group block">
                    <div className="bg-card rounded-xl shadow-paper overflow-hidden border border-border/50 transition hover:-translate-y-1 hover:shadow-cover">
                      <div className="p-3"><BookCover book={b} size="md" /></div>
                      <div className="px-3 pb-3">
                        <h3 className="font-serif text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary">{b.title}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{b.author}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {isHi && (
                <div className="mt-6">
                  <Link to="/best-hindi-book-summaries" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                    सभी best Hindi book summaries देखें →
                  </Link>
                </div>
              )}
            </section>
          )}

          <BookFAQ faqs={faqs} isHindi={isHi} />
        </article>

        <div className="hidden lg:block sticky top-20 space-y-6">
          <Suspense fallback={<CommunityFallback />}>
            <CommunitySidebar bookId={book.id} />
          </Suspense>
          {/* Sidebar ad on book detail */}
          {bookAny.status !== "published_noindex" && <AdBanner slot="auto" format="vertical" />}
        </div>
      </div>

      {/* Ad between content and podcast */}
      {bookAny.status !== "published_noindex" && (
        <div className="container py-4">
          <AdBanner slot="auto" format="horizontal" className="w-full max-w-4xl mx-auto" />
        </div>
      )}

      {podcastOpen && assets?.audio_url && (
        <Suspense fallback={null}>
          <StickyAudioPlayer
            src={assets.audio_url}
            title={`${book.title} — Podcast`}
            chapters={assets.chapter_markers ?? []}
            artwork={book.cover_url ?? undefined}
            onClose={() => setPodcastOpen(false)}
          />
        </Suspense>
      )}
    </Layout>
  );
};

export default BookDetail;
