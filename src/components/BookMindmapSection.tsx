import { useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Brain, Download, Expand, Image as ImageIcon, Loader2, Map as MapIcon, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumMindmap } from "@/components/PremiumMindmap";
import type { MindmapBookInput } from "@/lib/mindmap/buildMindmap";

type BookMindmapSectionProps = {
  title: string;
  mindmapUrl?: string | null;
  loading?: boolean;
  isHindi?: boolean;
  /** Full book content — enables the interactive premium map (English v1). */
  book?: MindmapBookInput | null;
};

function MindmapCanvas({
  url,
  title,
  fullscreen = false,
}: {
  url: string;
  title: string;
  fullscreen?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <TransformWrapper minScale={0.7} maxScale={5} centerOnInit initialScale={1} limitToBounds={false}>
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => zoomIn()} className="gap-1">
              <ZoomIn className="h-3.5 w-3.5" />
              <span className="sr-only">Zoom in</span>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => zoomOut()} className="gap-1">
              <ZoomOut className="h-3.5 w-3.5" />
              <span className="sr-only">Zoom out</span>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => resetTransform()} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              {fullscreen ? "Fit" : "Fit to screen"}
            </Button>
            <Button asChild type="button" size="sm" variant="outline" className="gap-1 ml-auto">
              <a href={url} download aria-label={`Download ${title} mindmap`}>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          </div>

          <div className={`relative overflow-hidden rounded-md border border-border bg-muted/20 ${fullscreen ? "h-[72vh]" : "h-[22rem] sm:h-[28rem] lg:h-[34rem]"}`}>
            {!imageLoaded && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground bg-background/70">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading mindmap…
              </div>
            )}
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center p-4">
              <img
                src={url}
                alt={`${title} mindmap`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                className="block max-w-none w-full h-auto select-none object-contain"
              />
            </TransformComponent>
          </div>
        </div>
      )}
    </TransformWrapper>
  );
}

/** Legacy image-only flow (Hindi v1 + fallback). Untouched behaviour. */
function LegacyMindmapSection({
  title,
  mindmapUrl,
  loading = false,
  isHindi = false,
}: Omit<BookMindmapSectionProps, "book">) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const hasMindmap = !!mindmapUrl;

  return (
    <section className="mt-10 pt-8 border-t border-border" aria-labelledby="book-mindmap">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Mindmap</div>
            <h2 id="book-mindmap" className="font-serif text-2xl md:text-3xl font-bold tracking-tight">
              {isHindi ? "विज़ुअल माइंडमैप" : "Visual Mindmap"}
            </h2>
          </div>
          {loading ? (
            <Button size="lg" variant="outline" disabled className="w-full sm:w-auto rounded-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {isHindi ? "माइंडमैप लोड हो रहा है" : "Loading mindmap"}
            </Button>
          ) : hasMindmap ? (
            <Button
              size="lg"
              onClick={() => setOpen((v) => !v)}
              variant={open ? "outline" : "default"}
              className="w-full sm:w-auto rounded-full gap-2"
              aria-expanded={open}
              aria-controls="book-mindmap-panel"
            >
              <Brain className="h-4 w-4" />
              {open ? (isHindi ? "माइंडमैप छुपाएँ" : "Hide Mindmap") : (isHindi ? "माइंडमैप देखें" : "View Mindmap")}
            </Button>
          ) : (
            <Button size="lg" variant="outline" disabled className="w-full sm:w-auto rounded-full gap-2">
              <Brain className="h-4 w-4" />
              {isHindi ? "माइंडमैप जल्द आ रहा है" : "Mindmap coming soon"}
            </Button>
          )}
        </div>

        {open && hasMindmap && (
          <Card id="book-mindmap-panel" className="p-4 md:p-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-sm text-muted-foreground">
                {isHindi ? "पिंच, ड्रैग और ज़ूम सपोर्ट" : "Pan, pinch, and zoom supported"}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setFullscreen(true)} className="gap-1">
                <Expand className="h-3.5 w-3.5" />
                {isHindi ? "फुल स्क्रीन" : "Fullscreen"}
              </Button>
            </div>
            <MindmapCanvas url={mindmapUrl!} title={title} />
          </Card>
        )}
      </div>

      {fullscreen && hasMindmap && (
        <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-sm p-3 md:p-6">
          <div className="mx-auto h-full max-w-7xl">
            <Card className="h-full p-4 md:p-5 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-1">Mindmap</div>
                  <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight">{title}</h3>
                </div>
                <Button type="button" size="icon" variant="outline" onClick={() => setFullscreen(false)} aria-label="Close fullscreen mindmap">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <MindmapCanvas url={mindmapUrl!} title={title} fullscreen />
              </div>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}

export function BookMindmapSection({ title, mindmapUrl, loading = false, isHindi = false, book = null }: BookMindmapSectionProps) {
  const [fullscreen, setFullscreen] = useState(false);

  // Hindi keeps the legacy image-only flow for now (English-first rollout).
  if (isHindi || !book) {
    return <LegacyMindmapSection title={title} mindmapUrl={mindmapUrl} loading={loading} isHindi={isHindi} />;
  }

  const hasImage = !!mindmapUrl;

  const imagePanel = hasImage ? (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-sm text-muted-foreground">Pan, pinch, and zoom supported</div>
        <Button type="button" size="sm" variant="outline" onClick={() => setFullscreen(true)} className="gap-1">
          <Expand className="h-3.5 w-3.5" />
          Fullscreen
        </Button>
      </div>
      <MindmapCanvas url={mindmapUrl!} title={title} />
    </Card>
  ) : null;

  return (
    <section className="mt-10 pt-8 border-t border-border" aria-labelledby="book-mindmap">
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Mindmap</div>
          <h2 id="book-mindmap" className="font-serif text-2xl md:text-3xl font-bold tracking-tight scroll-mt-24">
            Visual Mindmap
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            The entire book as an interactive knowledge map — core idea, key concepts, lessons, and a 60-second
            recall. Built from this summary, sharp on every screen.
          </p>
        </div>

        {loading && !hasImage ? (
          <div className="rounded-3xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground" role="status">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking for an illustrated map…
            </span>
          </div>
        ) : null}

        {hasImage ? (
          <Tabs defaultValue="interactive" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="interactive" className="gap-1.5 text-[13px] sm:text-sm">
                <MapIcon className="h-4 w-4" /> Interactive Map
              </TabsTrigger>
              <TabsTrigger value="image" className="gap-1.5 text-[13px] sm:text-sm">
                <ImageIcon className="h-4 w-4" /> Illustrated
              </TabsTrigger>
            </TabsList>
            <TabsContent value="interactive" className="mt-4">
              <PremiumMindmap book={book} />
            </TabsContent>
            <TabsContent value="image" className="mt-4">
              {imagePanel}
            </TabsContent>
          </Tabs>
        ) : (
          <PremiumMindmap book={book} />
        )}

        {!hasImage && !loading && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Brain className="h-4 w-4 shrink-0" />
            Every English book gets this interactive map automatically — no waiting, no downloads needed.
          </p>
        )}
      </div>

      {fullscreen && hasImage && (
        <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-sm p-3 md:p-6">
          <div className="mx-auto h-full max-w-7xl">
            <Card className="h-full p-4 md:p-5 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-1">Mindmap</div>
                  <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight">{title}</h3>
                </div>
                <Button type="button" size="icon" variant="outline" onClick={() => setFullscreen(false)} aria-label="Close fullscreen mindmap">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <MindmapCanvas url={mindmapUrl!} title={title} fullscreen />
              </div>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}

export default BookMindmapSection;
