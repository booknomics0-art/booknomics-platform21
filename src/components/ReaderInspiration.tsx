import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type Quote = {
  quote: string;
  author: string;
  role: string;
  eyebrow: string;
  imageSrc: string;
  imageAlt: string;
  credit: string;
  creditHref: string;
  lang?: "hi" | "en";
};

const QUOTES: Record<string, Quote> = {
  home: {
    quote: "Dream transforms into thoughts and thoughts result into actions.",
    author: "Dr. A. P. J. Abdul Kalam",
    role: "Scientist · Former President of India",
    eyebrow: "A thought for readers",
    imageSrc: "https://commons.wikimedia.org/wiki/Special:Redirect/file/A._P._J._Abdul_Kalam.jpg?width=420",
    imageAlt: "Dr. A. P. J. Abdul Kalam",
    credit: "Government of India · Wikimedia Commons",
    creditHref: "https://commons.wikimedia.org/wiki/File:A._P._J._Abdul_Kalam.jpg",
    lang: "en",
  },
  browse: {
    quote: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.",
    author: "Albert Einstein",
    role: "Physicist · Nobel laureate",
    eyebrow: "Keep discovering",
    imageSrc: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Albert_Einstein_Head.jpg?width=420",
    imageAlt: "Albert Einstein in 1947",
    credit: "Orren Jack Turner · Library of Congress",
    creditHref: "https://commons.wikimedia.org/wiki/File:Albert_Einstein_Head.jpg",
    lang: "en",
  },
  paths: {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
    role: "Statesman · Nobel Peace Prize laureate",
    eyebrow: "Why learning matters",
    imageSrc: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Nelson_Mandela_1994.jpg?width=420",
    imageAlt: "Nelson Mandela in 1994",
    credit: "John Mathew Smith · CC BY-SA 2.0",
    creditHref: "https://commons.wikimedia.org/wiki/File:Nelson_Mandela_1994.jpg",
    lang: "en",
  },
  hindi: {
    quote: "शिक्षा मनुष्य में निहित पूर्णता की अभिव्यक्ति है।",
    author: "स्वामी विवेकानंद",
    role: "चिंतक · संन्यासी · प्रेरक वक्ता",
    eyebrow: "पढ़ते रहिए · बढ़ते रहिए",
    imageSrc: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Vivekananda.png?width=420",
    imageAlt: "स्वामी विवेकानंद का 1896 का चित्र",
    credit: "सार्वजनिक डोमेन · Wikimedia Commons",
    creditHref: "https://commons.wikimedia.org/wiki/File:Vivekananda.png",
    lang: "hi",
  },
};

function QuoteCard({ data, variant }: { data: Quote; variant: "home" | "hero" }) {
  return (
    <aside
      lang={data.lang}
      className={cn("bn-reader-quote group", variant === "home" && "bn-reader-quote--home")}
      aria-label={`${data.author} — प्रेरक विचार`}
    >
      <span className="bn-reader-quote__mark" aria-hidden="true">“</span>
      <div className="bn-reader-quote__portrait-wrap">
        <img
          src={data.imageSrc}
          alt={data.imageAlt}
          width={420}
          height={525}
          loading="lazy"
          decoding="async"
          className="bn-reader-quote__portrait"
        />
      </div>
      <div className="bn-reader-quote__copy">
        <div className="bn-reader-quote__eyebrow">
          <span aria-hidden="true" />
          {data.eyebrow}
        </div>
        <blockquote>“{data.quote}”</blockquote>
        <div className="bn-reader-quote__author">{data.author}</div>
        <div className="bn-reader-quote__role">{data.role}</div>
        <a href={data.creditHref} target="_blank" rel="noreferrer" className="bn-reader-quote__credit">
          Portrait: {data.credit}
        </a>
      </div>
    </aside>
  );
}

function getTarget(pathname: string): { el: Element | null; key: keyof typeof QUOTES | null; variant: "home" | "hero" } {
  if (pathname === "/") {
    return { el: document.querySelector(".bn-search-box"), key: "home", variant: "home" };
  }
  if (pathname === "/browse") {
    return { el: document.querySelector("main section.bg-hero.border-b > .container"), key: "browse", variant: "hero" };
  }
  if (pathname === "/paths") {
    return { el: document.querySelector("main section.bg-hero.border-b > .container"), key: "paths", variant: "hero" };
  }
  if (pathname === "/hindi") {
    return { el: document.querySelector(".bn-hindi-page > section.bg-hero > .container"), key: "hindi", variant: "hero" };
  }
  return { el: null, key: null, variant: "hero" };
}

export function ReaderInspiration() {
  const { pathname } = useLocation();
  const [mount, setMount] = useState<{ el: Element; key: keyof typeof QUOTES; variant: "home" | "hero" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer = 0;
    let activeHost: Element | null = null;

    const find = () => {
      if (cancelled) return;
      const found = getTarget(pathname);
      if (found.el && found.key) {
        activeHost = found.el;
        if (found.variant === "hero") activeHost.classList.add("bn-reader-quote-host");
        setMount({ el: found.el, key: found.key, variant: found.variant });
        return;
      }
      attempts += 1;
      if (attempts < 30) timer = window.setTimeout(find, 80);
    };

    setMount(null);
    find();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (activeHost) activeHost.classList.remove("bn-reader-quote-host");
    };
  }, [pathname]);

  if (!mount) return null;
  return createPortal(<QuoteCard data={QUOTES[mount.key]} variant={mount.variant} />, mount.el);
}
