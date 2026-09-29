import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Job = {
  id: string; book_id: string | null; url: string; status: string;
  gsc_status: string | null; last_checked_at: string | null; attempts: number;
  error_message: string | null; created_at: string;
};

export default function IndexingQueuePage() {
  return (
    <AdminGuard>
      <AdminShell title="Indexing Queue">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("seo_indexing_jobs")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setJobs((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const recheck = async (job: Job) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-gsc", {
        body: { action: "inspect_url", siteUrl: "https://booknomics.com/", pageUrl: job.url },
      });
      if (error) throw error;
      const verdict = (data as any)?.inspectionResult?.indexStatusResult?.verdict || "UNKNOWN";
      const coverage = (data as any)?.inspectionResult?.indexStatusResult?.coverageState || null;
      await supabase.from("seo_indexing_jobs").update({
        gsc_status: coverage, status: verdict === "PASS" ? "indexed" : "not_indexed",
        last_checked_at: new Date().toISOString(), attempts: job.attempts + 1,
      }).eq("id", job.id);
      toast.success(`Status: ${verdict}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground bg-muted/40">
          <tr><th className="p-3 text-left">URL</th><th>Status</th><th>GSC Coverage</th><th>Attempts</th><th>Last checked</th><th></th></tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
          {!loading && jobs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No indexing jobs yet.</td></tr>}
          {jobs.map(j => (
            <tr key={j.id} className="border-t">
              <td className="p-3 max-w-[420px]"><a href={j.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block">{j.url}</a></td>
              <td className="text-center"><Badge variant={j.status === "indexed" ? "default" : "outline"} className={j.status === "indexed" ? "bg-emerald-600" : ""}>{j.status}</Badge></td>
              <td className="text-center text-xs">{j.gsc_status || "—"}</td>
              <td className="text-center tabular-nums">{j.attempts}</td>
              <td className="text-center text-xs text-muted-foreground">{j.last_checked_at ? new Date(j.last_checked_at).toLocaleString() : "—"}</td>
              <td className="text-right pr-3"><Button size="sm" variant="outline" onClick={() => recheck(j)}>Recheck</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
