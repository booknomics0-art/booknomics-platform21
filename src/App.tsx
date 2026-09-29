import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate, useParams } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/LoadingSpinner";
import Index from "./pages/Index.tsx";
import { PricingModalProvider } from "@/components/PricingModal";

const Browse = lazy(() => import("./pages/Browse.tsx"));
const BookDetail = lazy(() => import("./pages/BookDetail.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Library = lazy(() => import("./pages/Library.tsx"));
const Hindi = lazy(() => import("./pages/Hindi.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Community = lazy(() => import("./pages/Community.tsx"));
const Category = lazy(() => import("./pages/Category.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Privacy = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.Terms })));
const Disclaimer = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.Disclaimer })));
const Copyright = lazy(() => import("./pages/Legal.tsx").then(m => ({ default: m.Copyright })));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const BestHindiBookSummaries = lazy(() => import("./pages/BestHindiBookSummaries.tsx"));
const English = lazy(() => import("./pages/English.tsx"));
const Referrals = lazy(() => import("./pages/Referrals.tsx"));
const Paths = lazy(() => import("./pages/Paths.tsx"));
const PathDetail = lazy(() => import("./pages/PathDetail.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const Press = lazy(() => import("./pages/Press.tsx"));
const Blog = lazy(() => import("./pages/Blog.tsx"));
const BlogPost = lazy(() => import("./pages/BlogPost.tsx"));
const SeoDashboard = lazy(() => import("./pages/admin/SeoDashboard.tsx"));
const SeoPageDetail = lazy(() => import("./pages/admin/SeoPageDetail.tsx"));
const SeoManager = lazy(() => import("./pages/admin/SeoManager.tsx"));
const SlugOptimizer = lazy(() => import("./pages/admin/SlugOptimizer.tsx"));
const SocialPublisher = lazy(() => import("./pages/admin/SocialPublisher.tsx"));
const ContentPolish = lazy(() => import("./pages/admin/ContentPolish.tsx"));
const GscDashboard = lazy(() => import("./pages/admin/GscDashboard.tsx"));
const IndexingQueue = lazy(() => import("./pages/admin/IndexingQueue.tsx"));
const Resources = lazy(() => import("./pages/Resources.tsx"));
const ReadingTracker = lazy(() => import("./pages/resources/ReadingTracker.tsx"));
const SummaryTemplate = lazy(() => import("./pages/resources/SummaryTemplate.tsx"));
const BestSummaryWebsites = lazy(() => import("./pages/resources/BestSummaryWebsites.tsx"));
const HindiGuide = lazy(() => import("./pages/resources/HindiGuide.tsx"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent.tsx"));
import { capturePendingReferral } from "@/lib/referrals";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const GA_ID = "G-029CF4KFMM";

function PageTracker() {
  const loc = useLocation();
  useEffect(() => {
    capturePendingReferral();
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    if ((window as any).__IS_BOT__) return;
    if (loc.pathname.startsWith("/admin")) return;
    const w = window as any;
    if (typeof w.gtag === "function") {
      w.gtag("config", GA_ID, { page_path: loc.pathname + loc.search });
    }
  }, [loc]);
  return null;
}

function BookRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/books/${slug}`} replace />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PricingModalProvider>
          <PageTracker />
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/books/:slug" element={<BookDetail />} />
                <Route path="/book/:slug" element={<BookRedirect />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/library" element={<Library />} />
                <Route path="/hindi" element={<Hindi />} />
                <Route path="/about" element={<About />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/community" element={<Community />} />
                <Route path="/category/:category" element={<Category />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/seo" element={<SeoDashboard />} />
                <Route path="/admin/seo/page/:pageId" element={<SeoPageDetail />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/resources/7-day-reading-action-tracker" element={<ReadingTracker />} />
                <Route path="/resources/book-summary-template" element={<SummaryTemplate />} />
                <Route path="/resources/best-book-summary-websites" element={<BestSummaryWebsites />} />
                <Route path="/resources/best-hindi-book-summaries-guide" element={<HindiGuide />} />
                <Route path="/admin/seo-manager" element={<SeoManager />} />
                <Route path="/admin/slug-optimizer" element={<SlugOptimizer />} />
                <Route path="/admin/social" element={<SocialPublisher />} />
                <Route path="/admin/polish" element={<ContentPolish />} />
                <Route path="/admin/gsc" element={<GscDashboard />} />
                <Route path="/admin/indexing-queue" element={<IndexingQueue />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/privacy-policy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route path="/copyright" element={<Copyright />} />
                <Route path="/dmca" element={<Copyright />} />
                <Route path="/best-hindi-book-summaries" element={<BestHindiBookSummaries />} />
                <Route path="/english" element={<English />} />
                <Route path="/referrals" element={<Referrals />} />
                <Route path="/paths" element={<Paths />} />
                <Route path="/paths/:slug" element={<PathDetail />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/press" element={<Press />} />
                <Route path="/blog" element={<Blog />} />

                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </PricingModalProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
