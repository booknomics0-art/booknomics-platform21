import { useMemo, useState } from "react";
import {
  Target,
  Lightbulb,
  BookOpen,
  Users,
  Layers,
  GraduationCap,
  Rocket,
  Zap,
  Sparkles,
  Compass,
  CheckCircle2,
  Bookmark,
  Quote,
  Link2,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Map as MapIcon,
} from "lucide-react";
import { buildMindmapFromBook, type MindmapBookInput, type MindmapBranch, type MindmapCalloutKind } from "@/lib/mindmap/buildMindmap";
import { hexToRgba, resolveGenreTheme } from "@/lib/mindmap/genreThemes";
import "./premium-mindmap.css";

const BRANCH_ICONS: Record<string, typeof Target> = {
  target: Target,
  lightbulb: Lightbulb,
  bookOpen: BookOpen,
  users: Users,
  layers: Layers,
  graduationCap: GraduationCap,
  rocket: Rocket,
  zap: Zap,
};

const CALLOUT_ICONS: Record<MindmapCalloutKind, typeof Sparkles> = {
  why: Compass,
  insight: Sparkles,
  action: CheckCircle2,
  remember: Bookmark,
  example: Quote,
  connection: Link2,
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function BranchCard({
  branch,
  index,
  color,
  collapsed,
  onToggle,
  anchorId,
}: {
  branch: MindmapBranch;
  index: number;
  color: string;
  collapsed: boolean;
  onToggle: () => void;
  anchorId: string;
}) {
  const Icon = BRANCH_ICONS[branch.icon] ?? Lightbulb;
  const CalloutIcon = branch.callout ? CALLOUT_ICONS[branch.callout.kind] : null;
  const visibleNodes = collapsed ? branch.nodes.slice(0, 3) : branch.nodes;
  const canCollapse = branch.nodes.length > 4;
  const soft = hexToRgba(color, 0.09);
  const softer = hexToRgba(color, 0.05);
  const line = hexToRgba(color, 0.35);

  return (
    <article
      id={anchorId}
      aria-labelledby={`${anchorId}-title`}
      className="pmm-card pmm-rise relative flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_10px_30px_-18px_rgba(20,16,8,0.35)] dark:border-white/10 dark:bg-[#211d15]"
      style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
    >
      {/* color-coded top bar */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${hexToRgba(color, 0.35)})` }} aria-hidden />

      {/* mobile spine dot */}
      <span
        aria-hidden
        className="absolute left-[-23px] top-7 hidden h-3 w-3 rounded-full ring-4 ring-white dark:ring-[#211d15] max-sm:block"
        style={{ background: color }}
      />

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: soft, color }}
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={{ background: color, color: "#fff" }}
                aria-hidden
              >
                {index + 1}
              </span>
              <h3 id={`${anchorId}-title`} className="truncate text-[17px] font-bold tracking-tight text-[#241f14] dark:text-[#f0e9d8]">
                {branch.title}
              </h3>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-[#8a7d63] dark:text-[#a89a7d]">{branch.question}</p>
          </div>
        </header>

        <ul className="flex flex-col gap-2.5" aria-label={`${branch.title} points`}>
          {visibleNodes.map((node, i) => (
            <li
              key={i}
              className="rounded-xl border px-3.5 py-2.5 text-[14.5px] leading-relaxed"
              style={{ borderColor: line, background: softer }}
            >
              {node.step && (
                <span
                  className="mb-1 inline-block rounded-full px-2 py-px text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: soft, color }}
                >
                  {node.step}
                </span>
              )}
              <div className="flex items-start gap-2">
                {!node.step && (
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-[#33302a] dark:text-[#e8e0cd]">{node.label}</span>
                  {node.detail && (
                    <span className="mt-0.5 block text-[13.5px] font-normal leading-relaxed text-[#6d6452] dark:text-[#b3a78c]">
                      {node.detail}
                    </span>
                  )}
                  {node.cause && node.effect && (
                    <span className="mt-1 block text-[13px] font-normal text-[#6d6452] dark:text-[#b3a78c]">
                      <span className="font-semibold" style={{ color }}>{node.cause}</span>
                      <span aria-hidden> → </span>
                      <span>{node.effect}</span>
                    </span>
                  )}
                  {node.tag && (
                    <span
                      className="mt-1.5 inline-block rounded-md px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: soft, color }}
                    >
                      {node.tag}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {branch.callout && CalloutIcon && (
          <aside
            className="rounded-xl border-l-[3px] px-3.5 py-3"
            style={{ borderLeftColor: color, background: soft }}
            aria-label={branch.callout.title}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider" style={{ color }}>
              <CalloutIcon className="h-3.5 w-3.5" aria-hidden />
              {branch.callout.title}
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-[#4a4436] dark:text-[#d8cfb8]">{branch.callout.text}</p>
          </aside>
        )}

        {canCollapse && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-black/10 text-[13.5px] font-semibold text-[#6d6452] transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:text-[#b3a78c] dark:hover:bg-white/5"
          >
            {collapsed ? `Show all ${branch.nodes.length} points` : "Show fewer"}
            <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

export function PremiumMindmap({ book }: { book: MindmapBookInput }) {
  const theme = useMemo(() => resolveGenreTheme(book.category), [book.category]);
  const map = useMemo(() => buildMindmapFromBook(book), [book]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const allCollapsed = map.branches.every((b) => collapsed[b.id]);
  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed({});
    } else {
      const next: Record<string, boolean> = {};
      for (const b of map.branches) next[b.id] = true;
      setCollapsed(next);
    }
  };

  const mins = typeof book.reading_time === "number" && book.reading_time > 0 ? book.reading_time : null;

  return (
    <div
      className="overflow-hidden rounded-3xl border border-black/[0.07] dark:border-white/10"
      style={{ background: `linear-gradient(180deg, ${theme.canvasFrom}, ${theme.canvasTo})` }}
    >
      {/* ---------- Center / hero ---------- */}
      <div
        className="relative px-5 pb-8 pt-8 text-center sm:px-8 sm:pb-10 sm:pt-10"
        style={{ background: `linear-gradient(135deg, ${theme.heroFrom}, ${theme.heroVia} 55%, ${theme.heroTo})` }}
      >
        <div
          aria-hidden
          className={`pmm-pattern-${theme.motif} pointer-events-none absolute inset-0 opacity-100`}
          style={{ ["--pmm-veil" as string]: "rgba(255,255,255,0.10)" }}
        />
        <div className="relative mx-auto max-w-3xl">
          <p
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] sm:text-xs"
            style={{ borderColor: "rgba(255,255,255,0.35)", color: theme.heroMuted }}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden />
            Visual Knowledge Map
          </p>
          <h3 className="mt-4 break-words font-serif text-[26px] font-bold leading-tight tracking-tight sm:text-4xl" style={{ color: theme.heroInk }}>
            {map.title}
          </h3>
          <p className="mt-2 text-[14px] sm:text-[15px]" style={{ color: theme.heroMuted }}>
            by {map.author}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12.5px] font-semibold">
            <span
              className="rounded-full px-3 py-1"
              style={{ background: "rgba(255,255,255,0.16)", color: theme.heroInk }}
            >
              {theme.label}
            </span>
            <span
              className="rounded-full px-3 py-1"
              style={{ background: "rgba(255,255,255,0.16)", color: theme.heroInk }}
            >
              {map.isFiction ? "Story map" : "Ideas map"}
            </span>
            {mins && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1"
                style={{ background: "rgba(255,255,255,0.16)", color: theme.heroInk }}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {mins} min summary
              </span>
            )}
            <span
              className="rounded-full px-3 py-1"
              style={{ background: "rgba(255,255,255,0.16)", color: theme.heroInk }}
            >
              8 branches · 60-sec recall
            </span>
          </div>
          <p
            className="mx-auto mt-5 max-w-2xl font-serif text-[16px] italic leading-relaxed sm:text-lg"
            style={{ color: theme.heroInk }}
          >
            “{map.oneLiner}”
          </p>
          <aside
            className="mx-auto mt-5 max-w-2xl rounded-2xl border px-4 py-3 text-left sm:px-5"
            style={{ borderColor: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.10)" }}
            aria-label="Why it matters"
          >
            <div
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] sm:text-xs"
              style={{ color: theme.heroMuted }}
            >
              <Compass className="h-3.5 w-3.5" aria-hidden />
              Why It Matters
            </div>
            <p className="mt-1 text-[14px] leading-relaxed sm:text-[15px]" style={{ color: theme.heroInk }}>
              {map.whyItMatters}
            </p>
          </aside>
        </div>
      </div>

      {/* ---------- Branch quick-jump ---------- */}
      <nav aria-label="Mind map branches" className="pmm-no-print border-b border-black/[0.06] bg-white/60 px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-black/20 sm:px-5">
        <div className="pmm-pills flex items-center gap-2 overflow-x-auto px-4 py-1">
          {map.branches.map((branch, i) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => scrollToId(`pmm-${branch.id}`)}
              className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[13px] font-semibold text-[#4a4436] transition-colors hover:bg-black/[0.03] dark:border-white/15 dark:bg-white/5 dark:text-[#d8cfb8]"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.branches[i] }} aria-hidden />
              {branch.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => scrollToId("pmm-recall")}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold text-white"
            style={{ background: theme.accent }}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Quick Recall
          </button>
        </div>
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-[#6d6452] hover:bg-black/[0.04] dark:text-[#b3a78c] dark:hover:bg-white/5"
          >
            <ChevronsUpDown className="h-4 w-4" aria-hidden />
            {allCollapsed ? "Expand all branches" : "Collapse all branches"}
          </button>
        </div>
      </nav>

      {/* ---------- Branches ---------- */}
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative">
          {/* mobile spine */}
          <div
            aria-hidden
            className="absolute bottom-6 left-[10px] top-6 w-[2px] rounded-full sm:hidden"
            style={{ background: `linear-gradient(180deg, ${theme.spineFrom}, ${theme.spineTo})` }}
          />
          <div className="grid grid-cols-1 gap-4 pl-7 sm:gap-5 sm:pl-0 md:grid-cols-2">
            {map.branches.map((branch, i) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                index={i}
                color={theme.branches[i]}
                anchorId={`pmm-${branch.id}`}
                collapsed={!!collapsed[branch.id]}
                onToggle={() => setCollapsed((prev) => ({ ...prev, [branch.id]: !prev[branch.id] }))}
              />
            ))}
          </div>
        </div>

        {/* ---------- Quick Recall banner ---------- */}
        <section
          id="pmm-recall"
          aria-labelledby="pmm-recall-title"
          className="relative mt-6 scroll-mt-24 overflow-hidden rounded-2xl px-5 py-7 sm:px-8 sm:py-8"
          style={{ background: `linear-gradient(135deg, ${theme.heroFrom}, ${theme.heroVia} 55%, ${theme.heroTo})` }}
        >
          <div
            aria-hidden
            className={`pmm-pattern-${theme.motif} pointer-events-none absolute inset-0`}
            style={{ ["--pmm-veil" as string]: "rgba(255,255,255,0.08)" }}
          />
          <div className="relative">
            <p
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] sm:text-xs"
              style={{ borderColor: "rgba(255,255,255,0.35)", color: theme.heroMuted }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Quick Recall · 60 seconds
            </p>
            <h3 id="pmm-recall-title" className="mt-3 font-serif text-xl font-bold sm:text-2xl" style={{ color: theme.heroInk }}>
              Remember this
            </h3>
            <ol className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {map.recall.takeaways.map((takeaway, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[14px] leading-relaxed"
                  style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: theme.heroInk }}
                >
                  <span
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: "rgba(255,255,255,0.2)", color: theme.heroInk }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  {takeaway}
                </li>
              ))}
            </ol>
            <div
              className="mt-4 rounded-xl border px-4 py-3.5"
              style={{ borderColor: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)" }}
            >
              <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.heroMuted }}>
                One-line summary
              </p>
              <p className="mt-1 font-serif text-[16px] italic leading-relaxed sm:text-lg" style={{ color: theme.heroInk }}>
                “{map.recall.oneLine}”
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Brand footer ---------- */}
        <footer className="flex flex-col items-center gap-1.5 px-4 pb-2 pt-6 text-center">
          <p className="text-[13px] font-semibold lowercase tracking-[0.3em] text-[#a89a7d] dark:text-[#8a7d63]">
            booknomics
          </p>
          <p className="max-w-md text-[12.5px] leading-relaxed text-[#8a7d63] dark:text-[#8a7d63]">
            A text-based knowledge map — always sharp on any screen. Read the branches in order and you’ll hold the
            entire structure of this book in about 3–5 minutes.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default PremiumMindmap;
