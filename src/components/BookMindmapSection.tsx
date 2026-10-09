import { useEffect, useMemo, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Brain, BookOpen, Download, Expand, Eye, Lightbulb, RefreshCw, Sparkles, Target, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  title: string;
  mindmapUrl?: string | null;
  loading?: boolean;
  isHindi?: boolean;
};

type Kind = "core" | "ideas" | "analysis" | "apply" | "context";
type Branch = { id: Kind; label: string; kicker: string; detail: string; items: string[]; x: number; y: number };
type Copy = {
  author: string | null;
  category: string | null;
  tagline: string | null;
  overview: string | null;
  key_ideas: string | null;
  deep_analysis: string | null;
  daily_application: string | null;
};

const W = 1420;
const H = 900;

const clean = (value = "") => value
  .replace(/\\n/g, "\n")
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[*_~`>|]/g, "")
  .replace(/\s+/g, " ")
  .trim();

function points(value?: string | null, max = 5) {
  if (!value?.trim()) return [];
  const lines = value.replace(/\\n/g, "\n").split(/\n+/).map((line) =>
    clean(line.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "")),
  );
  const sentences = clean(value).split(/(?<=[.!?।])\s+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...lines, ...sentences]) {
    if (raw.length < 18) continue;
    const text = raw.length > 175 ? `${raw.slice(0, 172).trimEnd()}…` : raw;
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === max) break;
  }
  return out;
}

function icon(kind: Kind) {
  if (kind === "core") return <Brain className="h-4 w-4" />;
  if (kind === "ideas") return <Lightbulb className="h-4 w-4" />;
  if (kind === "analysis") return <BookOpen className="h-4 w-4" />;
  if (kind === "apply") return <Target className="h-4 w-4" />;
  return <Eye className="h-4 w-4" />;
}

function makeBranches(title: string, copy: Copy | null, hi: boolean): Branch[] {
  const core = points(copy?.overview, 4);
  const ideas = points(copy?.key_ideas, 5);
  const analysis = points(copy?.deep_analysis, 5);
  const apply = points(copy?.daily_application, 5);
  const context = [
    copy?.category ? `${hi ? "श्रेणी" : "Category"}: ${copy.category}` : "",
    copy?.author ? `${hi ? "लेखक" : "Author"}: ${copy.author}` : "",
    copy?.tagline ? clean(copy.tagline).slice(0, 150) : "",
  ].filter(Boolean);

  return [
    { id: "core", label: hi ? "मुख्य विचार" : "Core Idea", kicker: hi ? "किताब का केंद्र" : "The centre of the book", detail: clean(copy?.tagline || core[0] || title), items: core.length ? core : [hi ? "किताब के केंद्रीय तर्क को यहाँ देखें।" : "See the book's central argument here."], x: 70, y: 95 },
    { id: "ideas", label: hi ? "प्रमुख विचार" : "Key Ideas", kicker: hi ? "याद रखने योग्य" : "Ideas worth keeping", detail: ideas[0] || core[0] || title, items: ideas.length ? ideas : core, x: 70, y: 535 },
    { id: "analysis", label: hi ? "गहन विश्लेषण" : "Deep Dive", kicker: hi ? "तर्क और सीमाएँ" : "Reasoning & nuance", detail: analysis[0] || core[0] || title, items: analysis.length ? analysis : ideas, x: 1010, y: 95 },
    { id: "apply", label: hi ? "लागू करें" : "Apply It", kicker: hi ? "विचार से व्यवहार" : "From insight to action", detail: apply[0] || (hi ? "एक विचार को छोटे प्रयोग में बदलें।" : "Turn one insight into a small experiment."), items: apply.length ? apply : [hi ? "एक विचार चुनें।" : "Choose one idea.", hi ? "आज एक छोटा कदम लें।" : "Take one small action today.", hi ? "सप्ताह के अंत में परिणाम देखें।" : "Review the result at the end of the week."], x: 1010, y: 535 },
    { id: "context", label: hi ? "संदर्भ" : "Book Context", kicker: hi ? "इसे कहाँ रखें" : "Where it fits", detail: copy?.category ? `${title} · ${copy.category}` : title, items: context.length ? context : [title], x: 545, y: 690 },
  ];
}

function InteractiveMap({ title, copy, branches, selected, onSelect, full = false }: { title: string; copy: Copy | null; branches: Branch[]; selected: Kind; onSelect: (id: Kind) => void; full?: boolean }) {
  const active = branches.find((b) => b.id === selected) || branches[0];

  const download = () => {
    const text = [`${title}${copy?.author ? ` — ${copy.author}` : ""}`, "", ...branches.flatMap((b) => [b.label, b.detail, ...b.items.map((item) => `- ${item}`), ""])].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "book"}-mindmap.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`grid gap-4 ${full ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"}`}>
      <TransformWrapper minScale={0.38} maxScale={2.4} initialScale={full ? 0.8 : 0.62} centerOnInit limitToBounds={false} wheel={{ step: 0.08 }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="relative overflow-hidden rounded-[30px] border border-border/80 bg-card shadow-sm">
            <div className="absolute left-3 top-3 z-20 flex gap-1 rounded-full border border-border/70 bg-background/90 p-1.5 shadow-sm backdrop-blur">
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => zoomIn()}><ZoomIn className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => zoomOut()}><ZoomOut className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => resetTransform()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <TransformComponent wrapperClass={`!w-full ${full ? "!h-[76vh]" : "!h-[36rem] sm:!h-[40rem]"}`} contentClass="!w-full !h-full">
              <div className="relative" style={{ width: W, height: H, backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0), radial-gradient(circle at 50% 42%, hsl(var(--primary) / 0.10), transparent 34%)", backgroundSize: "28px 28px,100% 100%" }}>
                <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
                  <g fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.42" strokeWidth="3">
                    <path d="M 565 405 C 490 405, 470 210, 400 210" />
                    <path d="M 565 455 C 490 455, 470 650, 400 650" />
                    <path d="M 855 405 C 930 405, 950 210, 1010 210" />
                    <path d="M 855 455 C 930 455, 950 650, 1010 650" />
                    <path d="M 710 520 C 710 605, 710 650, 710 690" />
                  </g>
                </svg>

                <div className="absolute w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-[34px] border border-primary/35 bg-background/95 p-7 text-center shadow-2xl backdrop-blur" style={{ left: 710, top: 430 }}>
                  <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><Brain className="h-3.5 w-3.5" /> Booknomics map</div>
                  <h3 className="font-serif text-3xl font-bold leading-tight tracking-tight">{title}</h3>
                  {copy?.author && <p className="mt-2 text-sm text-muted-foreground">{copy.author}</p>}
                  <div className="mt-5 flex justify-center gap-2 text-[11px] text-muted-foreground"><span className="rounded-full bg-muted px-2.5 py-1">5 layers</span><span className="rounded-full bg-muted px-2.5 py-1">click to explore</span></div>
                </div>

                {branches.map((b) => {
                  const on = b.id === selected;
                  return <button key={b.id} type="button" onClick={() => onSelect(b.id)} className={`absolute w-[340px] rounded-[28px] border p-5 text-left shadow-lg transition duration-300 ${on ? "-translate-y-1 border-primary/70 bg-background ring-4 ring-primary/10 shadow-2xl" : "border-border/90 bg-card/95 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"}`} style={{ left: b.x, top: b.y }}>
                    <div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{icon(b.id)}</span><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{b.kicker}</div><h4 className="font-serif text-xl font-bold">{b.label}</h4></div></div>
                    <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-foreground/75">{b.detail}</p>
                    <div className="mt-3 space-y-2">{b.items.slice(0, 3).map((item, i) => <div key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" /><span className="line-clamp-2">{item}</span></div>)}</div>
                  </button>;
                })}
              </div>
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>

      <Card className="rounded-[28px] p-5 md:p-6 xl:sticky xl:top-24 xl:self-start">
        <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon(active.id)}</span><Button size="icon" variant="ghost" className="rounded-full" onClick={download}><Download className="h-4 w-4" /></Button></div>
        <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Selected branch</div>
        <h3 className="mt-2 font-serif text-2xl font-bold">{active.label}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{active.detail}</p>
        <div className="mt-5 space-y-3">{active.items.slice(0, 6).map((item, i) => <div key={i} className="flex gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span><p className="text-sm leading-relaxed text-foreground/80">{item}</p></div>)}</div>
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">Built from this Booknomics guide — not a generic book-title template.</div>
      </Card>
    </div>
  );
}

export function BookMindmapSection({ title, mindmapUrl, isHindi = false }: Props) {
  const [copy, setCopy] = useState<Copy | null>(null);
  const [selected, setSelected] = useState<Kind>("core");
  const [full, setFull] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "");
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const fields = "author,category,tagline,overview,key_ideas,deep_analysis,daily_application,slug,seo_slug";
      const primary = await supabase.from("books").select(fields).eq("slug", slug).maybeSingle();
      let data = primary.data as Copy | null;
      if (!data) data = (await supabase.from("books").select(fields).eq("seo_slug", slug).maybeSingle()).data as Copy | null;
      if (!cancelled && data) setCopy(data);
    })().catch((error) => console.warn("[BookMindmapSection] content lookup failed", error));
    return () => { cancelled = true; };
  }, [title]);

  const branches = useMemo(() => makeBranches(title, copy, isHindi), [title, copy, isHindi]);

  const body = showImage && mindmapUrl
    ? <div className={`${full ? "h-[78vh]" : "h-[40rem]"} overflow-auto rounded-[30px] border border-border bg-muted/20 p-4`}><img src={mindmapUrl} alt={`${title} mindmap`} className="mx-auto max-w-none w-full h-auto object-contain" /></div>
    : <InteractiveMap title={title} copy={copy} branches={branches} selected={selected} onSelect={setSelected} full={full} />;

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="book-mindmap-title">
      <div className="overflow-hidden rounded-[34px] border border-border/80 bg-gradient-to-b from-primary/5 via-background to-background shadow-sm">
        <div className="border-b border-border/70 px-5 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="h-3.5 w-3.5" /> {isHindi ? "Booknomics विज़ुअल लर्निंग" : "Booknomics Visual Learning"}</div>
              <h2 id="book-mindmap-title" className="font-serif text-3xl font-bold tracking-tight md:text-4xl">{isHindi ? "पूरी किताब को एक नज़र में समझें" : "See the whole book at once."}</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">{isHindi ? "मुख्य विचार, गहन विश्लेषण और उपयोगी कदम एक इंटरैक्टिव मैप में जुड़े हैं। किसी भी शाखा पर क्लिक करें।" : "Core ideas, deeper analysis, and practical actions are connected in one interactive map. Click any branch without losing the big picture."}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-full border border-border/70 bg-background px-3 py-1.5">Interactive</span><span className="rounded-full border border-border/70 bg-background px-3 py-1.5">Pan & zoom</span><span className="rounded-full border border-border/70 bg-background px-3 py-1.5">Built from this guide</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mindmapUrl && <Button variant="outline" className="rounded-full" onClick={() => setShowImage((v) => !v)}>{showImage ? "Interactive map" : "Original visual"}</Button>}
              <Button variant="outline" className="rounded-full gap-2" onClick={() => setFull(true)}><Expand className="h-4 w-4" /> {isHindi ? "फुल स्क्रीन" : "Fullscreen"}</Button>
            </div>
          </div>
        </div>
        <div className="p-3 md:p-5">{body}</div>
      </div>

      {full && <div className="fixed inset-0 z-[90] bg-background/95 p-2 backdrop-blur-xl md:p-5"><div className="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden rounded-[30px] border border-border bg-background shadow-2xl"><div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6"><div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Booknomics mind map</div><h3 className="font-serif text-xl font-bold">{title}</h3></div><Button size="icon" variant="outline" className="rounded-full" onClick={() => setFull(false)}><X className="h-4 w-4" /></Button></div><div className="min-h-0 flex-1 overflow-auto p-3 md:p-5">{body}</div></div></div>}
    </section>
  );
}

export default BookMindmapSection;
