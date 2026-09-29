import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Row = {
  id: string;
  book_id: string | null;
  book_title: string | null;
  platforms: string[];
  status: string;
  http_status: number | null;
  response: string | null;
  created_at: string;
};

export function PromotionHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("promotion_logs")
      .select("id,book_id,book_title,platforms,status,http_status,response,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Promotion History</h3>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No dispatches yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border rounded p-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-medium truncate">{r.book_title ?? "(deleted book)"}</div>
                <Badge
                  variant={r.status === "success" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}
                  className="text-[10px]"
                >
                  {r.status}{r.http_status ? ` · ${r.http_status}` : ""}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(r.created_at).toLocaleString()} · {r.platforms.join(", ") || "no platforms"}
              </div>
              {r.response && (
                <pre className="text-[10px] text-muted-foreground/80 mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                  {r.response}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default PromotionHistory;
