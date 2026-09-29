import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookForAudit, bookUrl, auditOnPage, auditPolish, auditHumanized, auditSeoReadiness,
  generateRecommendations, scoreColor, scoreBg, Check, Recommendation,
} from "@/lib/seoScore";
import { ExternalLink, CheckCircle2, XCircle, AlertTriangle, Globe } from "lucide-react";
import { toast } from "sonner";

export default function SeoPageDetailPage() {
  return (
    <AdminGuard>
      <AdminShell title="Page SEO Audit">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const { pageId } = useParams();
  const [book, setBook] = useState<BookForAudit | null>(null);
  const [gsc, setGsc] = useState<any>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [range, setRange] = useState<"7d" | "28d" | "3mo" | "6mo">("28d");

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      const { data, error } = await supabase
        .from("books_admin").select("*").eq("id", pageId).maybeSingle();
      if (error || !data) { toast.error("Book not found"); return; }
      setBook(data as any);
    })();
  }, [pageId]);

  const fetchGsc = async () => {
    if (!book) return;
    setGscLoading(true);
    try {
      const days = range === "7d" ? 7 : range === "28d" ? 28 : range === "3mo" ? 90 : 180;
      const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days);
      const { data, error } = await supabase.functions.invoke("admin-gsc", {
        body: {
          action: "page_data",
          pageUrl: bookUrl(book.slug),
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setGsc(data);
    } catch (e: any) {
      toast.error(e.message || "GSC fetch failed");
    } finally {
      setGscLoading(false);
    }
  };

  if (!book) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const onPage = auditOnPage(book);
  const polish = auditPolish(book);
  const human = auditHumanized(book);
  const ready = auditSeoReadiness(book);
  const recs = generateRecommendations(book, {
    impressions: gsc?.totals?.impressions,
    ctr: gsc?.totals?.ctr,
    avgPosition: gsc?.totals?.position,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-muted-foreground">{book.author}</div>
          <h2 className="text-xl font-bold">{book.title}</h2>
          <a href={bookUrl(book.slug)} target="_blank" rel="noreferrer"
             className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            {bookUrl(book.slug)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/slug-optimizer?book=${book.id}`}><Button variant="outline" size="sm">Optimize Slug</Button></Link>
          <Link to={`/admin/social?book=${book.id}`}><Button variant="outline" size="sm">Social Posts</Button></Link>
          <Link to={`/admin/polish?book=${book.id}`}><Button variant="outline" size="sm">Polish Content</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="On-page SEO" score={onPage.score} />
        <ScoreCard label="Off-page (manual)" score={offPageEstimate(book)} />
        <ScoreCard label="Polishing" score={polish.score} />
        <ScoreCard label="Humanized" score={human.score} />
      </div>
      <ScoreCard label="SEO Readiness (composite)" score={ready.score} big />

      {/* GSC */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Globe className="h-4 w-4" /> Google Search Console</h3>
          <div className="flex gap-1">
            {(["7d","28d","3mo","6mo"] as const).map(r => (
              <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>{r}</Button>
            ))}
            <Button size="sm" onClick={fetchGsc} disabled={gscLoading}>{gscLoading ? "Fetching…" : "Fetch data"}</Button>
          </div>
        </div>
        {!gsc && <div className="text-sm text-muted-foreground">Click "Fetch data" to load clicks, impressions, CTR, position & top queries from Search Console.</div>}
        {gsc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Mini label="Clicks" value={gsc.totals?.clicks ?? 0} />
              <Mini label="Impressions" value={gsc.totals?.impressions ?? 0} />
              <Mini label="CTR" value={`${((gsc.totals?.ctr ?? 0) * 100).toFixed(2)}%`} />
              <Mini label="Avg position" value={(gsc.totals?.position ?? 0).toFixed(1)} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Top queries</div>
              {(gsc.queries || []).length === 0 && <div className="text-sm text-muted-foreground">No queries yet.</div>}
              <ul className="space-y-1">
                {(gsc.queries || []).slice(0, 15).map((q: any, i: number) => (
                  <li key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span className="truncate flex-1">{q.keys?.[0]}</span>
                    <span className="text-muted-foreground tabular-nums w-12 text-right">{q.clicks}</span>
                    <span className="text-muted-foreground tabular-nums w-16 text-right">{q.impressions}</span>
                    <span className="text-muted-foreground tabular-nums w-14 text-right">#{(q.position || 0).toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <ChecksCard title="On-page checks" data={onPage.checks} />
      <ChecksCard title="Polishing checks" data={polish.checks} />
      <ChecksCard title="Humanization checks" data={human.checks} />

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Recommendations ({recs.length})</h3>
        {recs.length === 0 && <div className="text-sm text-muted-foreground">All clear. 🎉</div>}
        <ul className="space-y-2">
          {recs.map(r => <RecRow key={r.id} r={r} />)}
        </ul>
      </Card>

      <BacklinkOpportunities book={book} />
    </div>
  );
}

function offPageEstimate(book: BookForAudit) {
  // Without a paid backlink API: rough composite of internal signals.
  let s = 30; // base
  if (book.affiliate_link) s += 10;
  if ((book.overview || "").length > 400) s += 10;
  if ((book.key_ideas || "").length > 200) s += 10;
  if (book.og_image || book.cover_url) s += 10;
  return Math.min(100, s);
}

function ScoreCard({ label, score, big }: { label: string; score: number; big?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${big ? "text-4xl" : "text-3xl"} font-bold tabular-nums ${scoreColor(score)}`}>{score}<span className="text-base text-muted-foreground">/100</span></div>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
      </div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ChecksCard({ title, data }: { title: string; data: Check[] }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {data.map(c => (
          <li key={c.id} className="flex items-start gap-2">
            {c.passed
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              : c.severity === "critical" || c.severity === "high"
                ? <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={c.passed ? "" : "font-medium"}>{c.label}</span>
                {c.detail && <span className="text-xs text-muted-foreground">({c.detail})</span>}
              </div>
              {!c.passed && c.fix && <div className="text-xs text-muted-foreground mt-0.5">→ {c.fix}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecRow({ r }: { r: Recommendation }) {
  const color = r.priority === "critical" ? "bg-red-500" : r.priority === "high" ? "bg-orange-500" : r.priority === "medium" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <li className="border rounded-md p-3 flex items-start gap-3">
      <span className={`inline-block w-2 h-2 rounded-full mt-1.5 ${color}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{r.title}</span>
          <Badge variant="outline" className="text-[10px]">{r.priority}</Badge>
          <Badge variant="secondary" className="text-[10px]">{r.module}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-1"><strong>Why:</strong> {r.why}</div>
        <div className="text-xs mt-1"><strong>Fix:</strong> {r.fix}</div>
      </div>
    </li>
  );
}

function BacklinkOpportunities({ book }: { book: BookForAudit }) {
  const ideas = [
    { type: "Quora answer", platform: "Quora", anchor: `${book.title} summary`, target: bookUrl(book.slug),
      note: `Find questions like "best summary of ${book.title}" and answer with 1 paragraph + link.` },
    { type: "Reddit comment", platform: "Reddit (r/books, r/selfimprovement)", anchor: `${book.title} key ideas`, target: bookUrl(book.slug),
      note: "Comment on relevant threads with value first, link last." },
    { type: "Medium article", platform: "Medium", anchor: `5 lessons from ${book.title}`, target: bookUrl(book.slug),
      note: "800-word listicle linking back to the full summary." },
    { type: "Pinterest pin", platform: "Pinterest", anchor: book.title, target: bookUrl(book.slug),
      note: "1080×1920 pin → repins drive long-tail referrals." },
    { type: "YouTube short", platform: "YouTube", anchor: book.title, target: bookUrl(book.slug),
      note: "60-second short with the single biggest idea + link in description." },
    { type: "Internal link", platform: "Booknomics", anchor: book.title, target: bookUrl(book.slug),
      note: `Link from 2–3 related books in /${book.category || "category"}/.` },
  ];
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">Backlink opportunities (manual)</h3>
      <div className="text-xs text-muted-foreground mb-3">No paid backlink API connected. Use these targeted opportunities and track them in the database when you place them.</div>
      <div className="grid md:grid-cols-2 gap-2">
        {ideas.map((i, idx) => (
          <div key={idx} className="border rounded p-3 text-sm">
            <div className="font-medium">{i.type} <span className="text-muted-foreground font-normal">— {i.platform}</span></div>
            <div className="text-xs text-muted-foreground mt-1">Anchor: <code>{i.anchor}</code></div>
            <div className="text-xs mt-1">{i.note}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
