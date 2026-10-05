import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./pagespeed.css";

const PRELOAD_RELOAD_KEY = "booknomics-vite-preload-reload";
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) || "0");
  if (now - lastReload > 10_000) {
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now));
    window.location.reload();
  }
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
