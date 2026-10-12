import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { CookieConsent } from "./CookieConsent";
import { AdSenseInit } from "./AdSenseInit";
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

export const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isHindi = pathname.startsWith("/hindi") || pathname.startsWith("/best-hindi");

  return (
    <div className="booknomics-site min-h-screen flex flex-col" lang={isHindi ? "hi" : undefined}>
      <Navbar />
      <main className="site-main flex-1 pb-20 md:pb-0">{children}</main>
      <div className="container px-4 md:px-6 pt-6">
        <p className="text-center text-[10px] md:text-xs text-muted-foreground">
          As an Amazon Associate I earn from qualifying purchases.
        </p>
      </div>
      <Footer />
      <MobileNav />
      <CookieConsent />
      <AdSenseInit />
    </div>
  );
};
