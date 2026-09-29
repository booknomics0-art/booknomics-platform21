/** Only same-origin absolute paths are accepted after login. */
export function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    const base = 'https://booknomics.com';
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
}
