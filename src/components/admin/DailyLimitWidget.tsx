import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Gauge, AlertCircle, CheckCircle2 } from "lucide-react";

export const DAILY_PUBLISH_CAP = 10;

export function useDailyPublishCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("published_today_count_ist");
    setCount(typeof data === "number" ? data : 0);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, []);

  return { count, remaining: Math.max(0, DAILY_PUBLISH_CAP - count), atLimit: count >= DAILY_PUBLISH_CAP, loading, refresh };
}

export function DailyLimitWidget({ count, atLimit }: { count: number; atLimit: boolean }) {
  const pct = Math.min(100, (count / DAILY_PUBLISH_CAP) * 100);
  const remaining = Math.max(0, DAILY_PUBLISH_CAP - count);
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={`h-10 w-10 rounded-full grid place-items-center ${atLimit ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
        {atLimit ? <AlertCircle className="h-5 w-5" /> : count > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Gauge className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Daily publish limit</span>
          <span className="tabular-nums text-muted-foreground">{count}/{DAILY_PUBLISH_CAP}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full transition-all ${atLimit ? "bg-destructive" : pct > 70 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {atLimit
            ? "Cap reached. Publish unlocks at midnight IST (Google sandbox safety)."
            : `${remaining} more ${remaining === 1 ? "book" : "books"} can be published today.`}
        </div>
      </div>
    </Card>
  );
}
