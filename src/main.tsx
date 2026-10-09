import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./pagespeed.css";
import "./fonts.css";
import "./editorial.css";
import "./homepage-refinements.css";
import "./homepage-desktop-contrast.css";
import { clearStaleChunkRefreshParam, recoverFromStaleChunk } from "@/lib/chunkRecovery";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleChunk();
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