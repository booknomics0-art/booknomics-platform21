import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

const LEGACY_SITE = "https://booknomics.com";
const CANONICAL_SITE = "https://www.booknomics.com";

/**
 * The sitemap generator predates the current Vercel primary domain and still
 * emits apex URLs. Normalize all built SEO artifacts after Vite copies public/
 * into dist/ so canonicals, robots, sitemaps and static JSON-LD cannot disagree
 * with the production host.
 */
const normalizeSeoArtifacts = () => ({
  name: "booknomics-normalize-seo-artifacts",
  apply: "build" as const,
  closeBundle() {
    const artifactNames = [
      "index.html",
      "robots.txt",
      "sitemap.xml",
      "books-sitemap.xml",
      "image-sitemap.xml",
    ];

    for (const artifactName of artifactNames) {
      const file = path.resolve(__dirname, "dist", artifactName);
      if (!existsSync(file)) continue;
      const original = readFileSync(file, "utf8");
      const normalized = original.split(LEGACY_SITE).join(CANONICAL_SITE);
      writeFileSync(file, normalized);
      if (normalized.includes(LEGACY_SITE)) {
        throw new Error(`[seo] ${artifactName} still contains legacy canonical host ${LEGACY_SITE}`);
      }
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger(), normalizeSeoArtifacts()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    cssCodeSplit: true,
    minify: "esbuild",
    target: "es2020",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "helmet": ["react-helmet-async"],
          "query": ["@tanstack/react-query"],
          "markdown": ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
}));
