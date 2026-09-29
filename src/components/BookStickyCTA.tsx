import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

interface Props {
  bookSlug: string;
  language?: string;
  category?: string;
  inLibrary: boolean;
  onSaveClick: () => void;
  userLoggedIn: boolean;
}

export const BookStickyCTA = ({
  bookSlug,
  language,
  category,
  inLibrary,
  onSaveClick,
  userLoggedIn,
}: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const baseProps = {
    book_slug: bookSlug,
    language,
    category,
    page_url: typeof window !== "undefined" ? window.location.pathname : "",
  };

  const handleStart = () => {
    trackEvent("book_cta_start_free_click", { ...baseProps, destination_url: "/auth" });
  };
  const handleSave = () => {
    trackEvent("book_cta_save_click", { ...baseProps, user_logged_in: userLoggedIn });
    onSaveClick();
  };

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 md:bottom-4 md:inset-x-auto md:right-4 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="mx-auto md:mx-0 max-w-2xl md:max-w-none border-t md:border md:rounded-2xl border-border bg-background/95 backdrop-blur shadow-cover px-3 py-2.5 md:p-3 flex items-center gap-2 mb-16 md:mb-0">
        <Button
          asChild
          size="sm"
          className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-1.5 flex-1 md:flex-none md:px-5"
          onClick={handleStart}
        >
          <Link to="/auth">
            Start Free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full gap-1.5 flex-1 md:flex-none md:px-5"
          onClick={handleSave}
        >
          {inLibrary ? (
            <><BookmarkCheck className="h-3.5 w-3.5" /> Saved</>
          ) : (
            <><BookmarkPlus className="h-3.5 w-3.5" /> Save to Library</>
          )}
        </Button>
      </div>
    </div>
  );
};
