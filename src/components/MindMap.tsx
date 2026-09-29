import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Maximize2, Network } from "lucide-react";

export function MindMap({ url, title }: { url: string | null | undefined; title: string }) {
  const [err, setErr] = useState(false);
  if (!url || err) return null;
  return (
    <div className="my-8 rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-muted/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-xs tracking-[0.2em] uppercase text-primary font-semibold">Visual Mind Map</span>
        </div>
        <Dialog>
          <DialogTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <Maximize2 className="h-3 w-3" /> Expand
          </DialogTrigger>
          <DialogContent className="max-w-5xl p-2">
            <img src={url} alt={`${title} mind map`} className="w-full h-auto rounded-lg" loading="lazy" />
          </DialogContent>
        </Dialog>
      </div>
      <img
        src={url}
        alt={`${title} mind map overview`}
        loading="lazy"
        decoding="async"
        onError={() => setErr(true)}
        className="w-full h-auto"
      />
    </div>
  );
}
