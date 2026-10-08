import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./pagespeed.css";
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
  // Fallback: if #root is missing, create it
  const div = document.createElement("div");
  div.id = "root";
  document.body.appendChild(div);
  createRoot(div).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}

// A successful boot means the cache-busting navigation did its job. Remove the
// temporary query parameter without another network request so public URLs stay clean.
clearStaleChunkRefreshParam();
