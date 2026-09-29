// Auto-link helper: given a list of {title, slug} pairs and a text/markdown
// string, wrap the first 1-2 occurrences of each title in an internal link.
// Skips matches already inside markdown links to avoid double-wrapping.

export interface LinkTarget { title: string; slug: string; }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Inject markdown links into a markdown string. Used before <ReactMarkdown />. */
export function linkifyMarkdown(text: string, targets: LinkTarget[], maxPerTitle = 1): string {
  if (!text || !targets.length) return text;
  // Skip if string contains the title already inside an existing [..](...) link
  const sorted = [...targets].sort((a, b) => b.title.length - a.title.length);
  let out = text;
  for (const t of sorted) {
    if (t.title.length < 4) continue;
    const re = new RegExp(`(?<!\\[)\\b(${escapeRe(t.title)})\\b(?!\\])`, "gi");
    let count = 0;
    out = out.replace(re, (match, _g, offset: number) => {
      if (count >= maxPerTitle) return match;
      // Avoid replacing inside a markdown link target ](...) or inside code fences
      const before = out.slice(Math.max(0, offset - 80), offset);
      if (/\]\([^)]*$/.test(before)) return match;
      if (/`[^`]*$/.test(before)) return match;
      count++;
      return `[${match}](/books/${t.slug})`;
    });
  }
  return out;
}

/** Split plain text into segments for JSX rendering with internal Links. */
export interface Segment { type: "text" | "link"; value: string; slug?: string; }
export function linkifyText(text: string, targets: LinkTarget[], maxPerTitle = 1): Segment[] {
  if (!text) return [{ type: "text", value: "" }];
  const matches: { start: number; end: number; slug: string; value: string }[] = [];
  const used: Record<string, number> = {};
  const sorted = [...targets].sort((a, b) => b.title.length - a.title.length);
  for (const t of sorted) {
    if (t.title.length < 4) continue;
    const re = new RegExp(`\\b${escapeRe(t.title)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = t.slug;
      if ((used[key] ?? 0) >= maxPerTitle) break;
      // skip overlap with existing match
      if (matches.some(x => m!.index < x.end && m!.index + m![0].length > x.start)) continue;
      matches.push({ start: m.index, end: m.index + m[0].length, slug: t.slug, value: m[0] });
      used[key] = (used[key] ?? 0) + 1;
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const segs: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) segs.push({ type: "text", value: text.slice(cursor, m.start) });
    segs.push({ type: "link", value: m.value, slug: m.slug });
    cursor = m.end;
  }
  if (cursor < text.length) segs.push({ type: "text", value: text.slice(cursor) });
  return segs;
}
