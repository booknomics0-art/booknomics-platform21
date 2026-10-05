import { Link, useLocation } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { SOCIAL_LINKS, SOCIAL_REL, withUtm } from "@/config/social";
import { SocialIcon } from "./SocialIcon";

const DISCLAIMER_EN =
  "Booknomics provides educational summaries, key insights, and commentary on published books. Book titles, author names, and cover images are property of their respective publishers and copyright holders, used here under fair use principles for editorial and educational purposes. We do not reproduce copyrighted book content. We encourage readers to purchase original books from authors and publishers.";

const DISCLAIMER_HI =
  "Booknomics प्रकाशित पुस्तकों पर शैक्षिक सारांश, मुख्य विचार और टिप्पणी प्रदान करता है। पुस्तक के शीर्षक, लेखक के नाम और कवर चित्र उनके संबंधित प्रकाशकों और कॉपीराइट धारकों की संपत्ति हैं, जिनका उपयोग यहाँ संपादकीय और शैक्षिक उद्देश्यों के लिए उचित उपयोग सिद्धांतों के तहत किया गया है। हम कॉपीराइट सामग्री का पुनरुत्पादन नहीं करते। हम पाठकों को मूल पुस्तकें खरीदने के लिए प्रोत्साहित करते हैं।";

const footerLinkClass = "inline-flex min-h-11 md:min-h-0 items-center hover:text-foreground";

export const Footer = () => {
  const { pathname } = useLocation();
  const isHindi = pathname.startsWith("/hindi");
  return (
  <footer className="border-t border-border mt-12 md:mt-24">
    {/* Mobile: compact 3-col grid + branding row */}
    <div className="container py-6 md:py-12">
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-8">
        <div className="hidden md:block">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-gold h-8 w-8 rounded-md grid place-items-center">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg font-bold">Booknomics</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            A life-improvement system disguised as a library. Read → Apply → Transform.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-xs md:text-sm font-semibold mb-2 md:mb-3">Books</h2>
          <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-muted-foreground">
            <li><Link to="/browse" className={footerLinkClass}>Browse</Link></li>
            <li><Link to="/hindi" className={footerLinkClass}>हिंदी</Link></li>
            <li><Link to="/library" className={footerLinkClass}>Library</Link></li>
            <li><Link to="/request-book" className={footerLinkClass}>Request a book</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-xs md:text-sm font-semibold mb-2 md:mb-3">Community</h2>
          <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-muted-foreground">
            <li><Link to="/community" className={footerLinkClass}>Discussions</Link></li>
            <li><Link to="/blog" className={footerLinkClass}>Blog</Link></li>
            <li><Link to="/resources" className={footerLinkClass}>Free resources</Link></li>
            <li><Link to="/dashboard" className={footerLinkClass}>Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-xs md:text-sm font-semibold mb-2 md:mb-3">Legal</h2>
          <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-muted-foreground">
            <li><Link to="/about" className={footerLinkClass}>About</Link></li>
            <li><Link to="/contact" className={footerLinkClass}>Contact</Link></li>
            <li><Link to="/press" className={footerLinkClass}>Press &amp; Media</Link></li>
            <li><Link to="/privacy" className={footerLinkClass}>Privacy</Link></li>
            <li><Link to="/terms" className={footerLinkClass}>Terms</Link></li>
            <li><Link to="/disclaimer" className={footerLinkClass}>Disclaimer</Link></li>
            <li><Link to="/copyright" className={footerLinkClass}>Copyright / DMCA</Link></li>
          </ul>
        </div>
      </div>
      {/* Connect with Booknomics */}
      <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <span className="text-xs md:text-sm font-serif font-semibold text-foreground/80">
            Follow Booknomics
          </span>
          <ul className="flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.platform}>
                <a
                  href={withUtm(s.url, "footer_social")}
                  target="_blank"
                  rel={SOCIAL_REL}
                  aria-label={s.ariaLabel}
                  title={s.name}
                  className="grid place-items-center h-11 w-11 rounded-full border border-border bg-card text-foreground/70 hover:text-primary hover:border-primary transition-colors"
                >
                  <SocialIcon platform={s.platform} className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p
        className="mt-6 md:mt-8 text-[10px] md:text-xs text-muted-foreground leading-relaxed max-w-4xl"
        lang={isHindi ? "hi" : "en"}
      >
        {isHindi ? DISCLAIMER_HI : DISCLAIMER_EN}
      </p>
      {/* Mobile branding row */}
      <div className="flex md:hidden items-center justify-between mt-6 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="bg-gold h-6 w-6 rounded-md grid place-items-center">
            <BookOpen className="h-3 w-3 text-primary-foreground" />
          </div>
          <span className="font-serif text-sm font-bold">Booknomics</span>
        </div>
        <span className="text-[10px] text-muted-foreground">© {new Date().getFullYear()}</span>
      </div>
    </div>
    {/* Desktop copyright */}
    <div className="hidden md:block border-t border-border py-6 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} Booknomics. Summaries are original analyses for educational purposes.
    </div>
  </footer>
  );
};
