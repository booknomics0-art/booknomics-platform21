import { render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it } from "vitest";
import { SEO } from "./SEO";

describe("SEO canonical host invariants", () => {
  it("normalizes legacy apex canonicals, hreflang and JSON-LD to the production www host", async () => {
    render(
      <HelmetProvider>
        <SEO
          title="Test Book Summary"
          description="A useful summary description for SEO testing."
          canonical="https://booknomics.com/books/test-book?utm_source=test#chapter"
          ogImage="https://booknomics.com/covers/test-book.webp"
          alternates={{
            en: "https://booknomics.com/books/test-book",
            hi: "https://www.booknomics.com/books/test-book-hi",
          }}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "Book",
            url: "https://booknomics.com/books/test-book",
            image: "https://booknomics.com/covers/test-book.webp",
          }}
        />
      </HelmetProvider>,
    );

    await waitFor(() => {
      expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
        "https://www.booknomics.com/books/test-book",
      );
    });

    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(
      "https://www.booknomics.com/books/test-book",
    );
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content).toBe(
      "https://www.booknomics.com/covers/test-book.webp",
    );
    expect(document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="en"]')?.href).toBe(
      "https://www.booknomics.com/books/test-book",
    );
    expect(document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="hi"]')?.href).toBe(
      "https://www.booknomics.com/books/test-book-hi",
    );

    const jsonLd = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))
      .map((script) => script.textContent ?? "")
      .join("\n");
    expect(jsonLd).toContain("https://www.booknomics.com/books/test-book");
    expect(jsonLd).not.toContain('"https://booknomics.com/books/test-book"');
  });

  it("keeps third-party images unchanged and emits rich crawl directives", async () => {
    const externalCover = "https://example.supabase.co/storage/v1/object/public/covers/test.webp";

    render(
      <HelmetProvider>
        <SEO
          title="External Cover Test"
          description="Testing that external asset hosts are preserved."
          path="/books/external-cover-test"
          ogImage={externalCover}
        />
      </HelmetProvider>,
    );

    await waitFor(() => {
      expect(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content).toBe(externalCover);
    });

    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toContain("max-image-preview:large");
    expect(document.querySelector<HTMLMetaElement>('meta[name="googlebot"]')?.content).toContain("max-snippet:-1");
  });
});
