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
