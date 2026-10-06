// GA4 analytics helper. Safe no-op on localhost or if gtag is missing.
// Keep this ID aligned with index.html and App.tsx so page views and custom
// events land in the same GA4 property.
const GA_ID = "G-1MDPDTDYDQ";

function canTrack(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).__IS_BOT__) return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;
  return typeof (window as any).gtag === "function";
}

export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (!canTrack()) return;
  try {
    (window as any).gtag("event", eventName, { send_to: GA_ID, ...params });
  } catch {
    // swallow
  }
}

export function trackSearch(query: string, resultsCount: number, source: string) {
  const q = (query || "").trim();
  if (!q) return;
  trackEvent("search", {
    search_term: q,
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
    results_count: resultsCount,
    source,
  });
}

type BookLike = {
  title?: string;
  slug?: string;
  category?: string;
  language?: string;
};

export function trackAddToLibrary(book: BookLike, userLoggedIn: boolean) {
  trackEvent("add_to_library", {
    book_title: book.title,
    book_slug: book.slug,
    category: book.category,
    language: book.language,
    user_logged_in: userLoggedIn,
  });
}

export function trackLogin(method: "email" | "google") {
  trackEvent("login", { method });
}

export function trackSignup(method: "email" | "google") {
  trackEvent("sign_up", { method });
}

export function trackAdminAddBook(
  book: BookLike,
  method: "manual_upload" | "csv_import" | "supabase_import"
) {
  trackEvent("admin_add_book", {
    book_title: book.title,
    book_slug: book.slug,
    category: book.category,
    method,
  });
}
