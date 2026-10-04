import { useState } from "react";
import { Link2, Check, MessageCircle, Twitter, Facebook, Linkedin, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  url: string;
  title: string;
  isHindi: boolean;
}

/** Share bar — floating pill unless the viewport has room for an outside rail. */
export function BookShareBar({ url, title, isHindi }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const enc = encodeURIComponent;
  const shareText = isHindi
    ? `${title} का मुफ्त सारांश — Booknomics पर पढ़ें:`
    : `${title} — read the free summary on Booknomics:`;

  const links = [
    {
      name: "WhatsApp",
      href: `https://api.whatsapp.com/send?text=${enc(`${shareText} ${url}`)}`,
      Icon: MessageCircle,
      color: "bg-[#25D366] text-white hover:brightness-110",
    },
    {
      name: "Twitter",
      href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`,
      Icon: Twitter,
      color: "bg-foreground text-background hover:opacity-90",
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      Icon: Facebook,
      color: "bg-[#1877F2] text-white hover:brightness-110",
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      Icon: Linkedin,
      color: "bg-[#0A66C2] text-white hover:brightness-110",
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(isHindi ? "लिंक कॉपी हो गया" : "Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(isHindi ? "कॉपी नहीं हो सका" : "Copy failed");
    }
  };

  const label = isHindi ? "शेयर करें" : "Share";

  return (
    <>
      {/* A 1400px content container needs a clear side gutter for this fixed rail. */}
      <aside
        className="hidden min-[1600px]:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-2 rounded-2xl border border-border bg-background/90 px-2 py-3 shadow-paper backdrop-blur"
        aria-label={label}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </span>
        {links.map(({ name, href, Icon, color }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} ${name}`}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 ${color}`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          aria-label={isHindi ? "लिंक कॉपी करें" : "Copy link"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/70 transition"
        >
          {copied ? <Check className="h-[18px] w-[18px] text-green-600" /> : <Link2 className="h-[18px] w-[18px]" />}
        </button>
      </aside>

      {/* Compact viewports: existing FAB, above the MobileNav (h≈56px + safe area). */}
      <div
        className="min-[1600px]:hidden fixed right-4 z-40 flex flex-col items-end gap-2"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        {open && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {links.map(({ name, href, Icon, color }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} ${name}`}
                onClick={() => setOpen(false)}
                className={`flex h-11 w-11 items-center justify-center rounded-full shadow-paper transition-transform active:scale-95 ${color}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </a>
            ))}
            <button
              type="button"
              onClick={copy}
              aria-label={isHindi ? "लिंक कॉपी करें" : "Copy link"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-background border border-border shadow-paper text-foreground active:scale-95 transition"
            >
              {copied ? <Check className="h-5 w-5 text-green-600" /> : <Link2 className="h-5 w-5" />}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={label}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-cover active:scale-95 transition-transform"
        >
          <Share2 className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>
    </>
  );
}
