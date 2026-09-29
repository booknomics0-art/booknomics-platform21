import { Card, CardContent } from "@/components/ui/card";
import { Map } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, PolarRadiusAxis } from "recharts";

export function KnowledgeMap({ data }: { data: { category: string; count: number }[] }) {
  const chart = data.slice(0, 8);
  const total = chart.reduce((s, d) => s + d.count, 0);
  const top = [...chart].sort((a, b) => b.count - a.count)[0];
  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                <Map className="h-4 w-4" />
              </span>
              Knowledge Map
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Categories you've explored</p>
          </div>
          {total > 0 && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Top interest</div>
              <div className="text-sm font-semibold text-primary">{top.category}</div>
            </div>
          )}
        </div>
        {chart.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20">
            Save books to start mapping your interests.
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chart}>
                  <defs>
                    <radialGradient id="km-fill" cx="50%" cy="50%" r="65%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    </radialGradient>
                  </defs>
                  <PolarGrid stroke="hsl(var(--border))" strokeDasharray="2 3" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 500 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#km-fill)" fillOpacity={1} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chart.slice(0, 5).map(c => (
                <span key={c.category} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {c.category} · {c.count}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
