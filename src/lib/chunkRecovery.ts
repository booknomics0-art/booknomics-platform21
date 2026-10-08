const STALE_CHUNK_RE = /dynamically imported module|module script|chunkloaderror|loading chunk|failed to fetch/i;
const RECOVERY_KEY = "booknomics-stale-chunk-recovery";
const REFRESH_PARAM = "__bn_refresh";
const RETRY_WINDOW_MS = 15_000;

export const isStaleChunkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return STALE_CHUNK_RE.test(message);
};

/**
 * Recover from a stale HTML -> hashed asset mismatch after a deployment.
 *
 * A normal reload can reuse a stale document in some browser/CDN paths. Adding
 * a one-shot cache-busting query forces a fresh HTML navigation while the SEO
 * canonical remains query-free. The short session guard prevents reload loops.
 */
export const recoverFromStaleChunk = () => {
  if (typeof window === "undefined") return false;

  const now = Date.now();
  try {
    const last = Number(window.sessionStorage.getItem(RECOVERY_KEY) || "0");
    if (now - last < RETRY_WINDOW_MS) return false;
    window.sessionStorage.setItem(RECOVERY_KEY, String(now));
  } catch {
    // Storage can be unavailable in hardened/privacy contexts. Continue with
    // the URL marker as a second guard rather than leaving the app broken.
    const current = new URL(window.location.href);
    if (current.searchParams.has(REFRESH_PARAM)) return false;
  }

  const url = new URL(window.location.href);
  url.searchParams.set(REFRESH_PARAM, String(now));
  window.location.replace(url.toString());
  return true;
};

/** Remove the temporary cache-busting parameter after a successful boot. */
export const clearStaleChunkRefreshParam = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(REFRESH_PARAM)) return;

  url.searchParams.delete(REFRESH_PARAM);
  const clean = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", clean);
};
