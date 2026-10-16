import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./pagespeed.css";
import "./fonts.css";
import "./editorial.css";
import "./homepage-refinements.css";
import { clearStaleChunkRefreshParam, recoverFromStaleChunk } from "@/lib/chunkRecovery";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleChunk();
});

// Build-time prerendering intentionally places one canonical in the static HTML so
// crawlers that do not execute JavaScript still receive the preferred URL. Helmet
// also owns canonicals after React mounts. Mark the prerendered tag as Helmet-owned
// (and discard any accidental extras) so the client reconciles it instead of adding
// a second canonical beside an unmanaged static tag.
const prerenderedCanonicals = Array.from(
  document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
);
prerenderedCanonicals.forEach((link, index) => {
  if (index === 0) link.setAttribute("data-rh", "true");
  else link.remove();
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
} else {
  const div = document.createElement("div");
  div.id = "root";
  document.body.appendChild(div);
  createRoot(div).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}

clearStaleChunkRefreshParam();