import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SITE = "https://booknomics.com/";

export default function GscDashboardPage() {
  return (
    <AdminGuard>
      <AdminShell title="Google Search Console">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [sites, setSites] = useState<any[] | null>(null);
  const [site, setSite] = useState<string>(localStorage.getItem("gsc_site") || DEFAULT_SITE);
  const [days, setDays] = useState<7 | 28 | 90 | 180>(28);
  const [siteData, setSiteData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [inspectUrl, setInspectUrl] = useState("");
  const [inspectResult, setInspectResult] = useState<any>(null);

  const ctrOpportunities = buildCtrOpportunities(siteData?.pages || []);

  useEffect(() => { localStorage.setItem("gsc_site", site); }, [site]);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-gsc", { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const loadSites = async () => {
    try { const d: any = await call({ action: "list_sites" }); setSites(d.siteEntry || []); }
    catch (e: any) { toast.error(e.message); }
  };

  const loadSite = async () => {
    setLoading(true);
    try {
      const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days);
      const d: any = await call({
        action: "site_data", siteUrl: site,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
      setSiteData(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const inspect = async () => {
    if (!inspectUrl) return;
    try {
      const d = await call({ action: "inspect_url", siteUrl: site, pageUrl: inspectUrl });
      setInspectResult(d);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadSites}><Globe className="h-3 w-3 mr-1" /> List verified properties</Button>
          {sites && <div className="text-xs text-muted-foreground">{sites.length} properties</div>}
        </div>
        {sites && (
          <div className="flex flex-wrap gap-2">
            {sites.map((s: any) => (
              <Badge key={s.siteUrl} variant={site === s.siteUrl ? "default" : "outline"}
                     className="cursor-pointer" onClick={() => setSite(s.siteUrl)}>
                {s.siteUrl}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input value={site} onChange={e => setSite(e.target.value)} placeholder="https://booknomics.com/" className="max-w-md" />
          {([7, 28, 90, 180] as const).map(d => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d}d</Button>
          ))}
          <Button size="sm" onClick={loadSite} disabled={loading}>{loading ? "Loading…" : "Fetch site data"}</Button>
        </div>
      </Card>

      {siteData && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Mini label="Clicks" value={siteData.totals?.clicks ?? 0} />
            <Mini label="Impressions" value={siteData.totals?.impressions ?? 0} />
            <Mini label="CTR" value={`${((siteData.totals?.ctr ?? 0) * 100).toFixed(2)}%`} />
            <Mini label="Avg position" value={(siteData.totals?.position ?? 0).toFixed(1)} />
          </div>
          {ctrOpportunities.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">High-impression CTR opportunities</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Pages are compared only with Booknomics pages in the same average-position band, then filtered to high-impression pages below that band's median CTR.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr><th className="text-left p-2">URL</th><th>Impr.</th><th>CTR</th><th>Band median</th><th>Pos.</th></tr>
                  </thead>
                  <tbody>
                    {ctrOpportunities.slice(0, 25).map((p: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 truncate max-w-[420px]"><a className="text-primary hover:underline" href={p.url} target="_blank" rel="noreferrer">{p.url}</a></td>
                        <td className="text-center tabular-nums">{p.impressions}</td>
                        <td className="text-center tabular-nums">{(p.ctr * 100).toFixed(1)}%</td>
                        <td className="text-center tabular-nums">{(p.bandMedian * 100).toFixed(1)}%</td>
                        <td className="text-center tabular-nums">{p.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <h3 className="font-semibold mb-2">Top pages</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-2">URL</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th></tr>
              </thead>
              <tbody>
                {(siteData.pages || []).slice(0, 50).map((p: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 truncate max-w-[420px]"><a className="text-primary hover:underline" href={p.keys?.[0]} target="_blank" rel="noreferrer">{p.keys?.[0]}</a></td>
                    <td className="text-center tabular-nums">{p.clicks}</td>
                    <td className="text-center tabular-nums">{p.impressions}</td>
                    <td className="text-center tabular-nums">{(p.ctr * 100).toFixed(1)}%</td>
                    <td className="text-center tabular-nums">{p.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">URL Inspection</h3>
        <div className="flex gap-2">
          <Input value={inspectUrl} onChange={e => setInspectUrl(e.target.value)} placeholder="https://booknomics.com/books/..." />
          <Button onClick={inspect}>Inspect</Button>
        </div>
        {inspectResult && (
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-72">{JSON.stringify(inspectResult, null, 2)}</pre>
        )}
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}


function buildCtrOpportunities(rows: any[]) {
  const normalized = rows
    .filter((r) => r?.keys?.[0] && Number(r.impressions || 0) > 0)
    .map((r) => ({
      url: r.keys[0],
      clicks: Number(r.clicks || 0),
      impressions: Number(r.impressions || 0),
      ctr: Number(r.ctr || 0),
      position: Number(r.position || 0),
    }));

  const bandFor = (position: number) =>
    position <= 3 ? "1-3" : position <= 7 ? "4-7" : position <= 15 ? "8-15" : "16+";

  const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const impressionValues = normalized.map((r) => r.impressions).sort((a, b) => a - b);
  const q3Index = Math.max(0, Math.floor((impressionValues.length - 1) * 0.75));
  const highImpressionCutoff = impressionValues[q3Index] || 0;

  const medians = new Map<string, number>();
  for (const band of ["1-3", "4-7", "8-15"]) {
    medians.set(band, median(normalized.filter((r) => bandFor(r.position) === band).map((r) => r.ctr)));
  }

  return normalized
    .filter((r) => r.position > 0 && r.position <= 15 && r.impressions >= highImpressionCutoff)
    .map((r) => ({ ...r, bandMedian: medians.get(bandFor(r.position)) || 0 }))
    .filter((r) => r.ctr < r.bandMedian)
    .sort((a, b) => b.impressions - a.impressions);
}
