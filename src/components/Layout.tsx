import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { CookieConsent } from "./CookieConsent";
import { AdSenseInit } from "./AdSenseInit";
import { ReactNode } from "react";

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 pb-20 md:pb-0">{children}</main>
    <Footer />
    <MobileNav />
    <CookieConsent />
    <AdSenseInit />
  </div>
);
