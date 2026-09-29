import { useMemo, useState } from "react";
import { Share2, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { stripMarkdown } from "@/lib/stripMarkdown";

function extractQuotes(md: string | null | undefined, max = 8): string[] {
  if (!md) return [];
  const plain = stripMarkdown(md);
  const parts = plain
    .split(/\n+|(?<=[।.!?])\s+/g)
    .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 25 && s.length <= 220);
  // de-dup
  return Array.from(new Set(parts)).slice(0, max);
}

async function renderCard(quote: string, author: string, book: string): Promise<string> {
  const W = 1080, H = 1080;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  // background gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0e0b07");
  g.addColorStop(1, "#1a1208");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // subtle gold corner accents
  ctx.fillStyle = "rgba(201,168,76,0.25)";
  ctx.fillRect(60, 60, 120, 4);
  ctx.fillRect(60, 60, 4, 120);
  ctx.fillRect(W - 180, H - 64, 120, 4);
  ctx.fillRect(W - 64, H - 180, 4, 120);

  // brand
  ctx.fillStyle = "#c9a84c";
  ctx.font = "bold 36px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText("BOOKNOMICS", 80, 140);
  ctx.fillStyle = "rgba(245,233,200,0.7)";
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("Read smarter, apply faster", 80, 175);

  // quote
  ctx.fillStyle = "#f5e9c8";
  const fontSize = quote.length > 160 ? 44 : quote.length > 100 ? 52 : 60;
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  ctx.textAlign = "left";
  const maxW = W - 160;
  const words = quote.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW) {
      if (line) lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  const lh = fontSize * 1.35;
  const totalH = lines.length * lh;
  let y = (H - totalH) / 2 + fontSize;
  // opening quote
  ctx.fillStyle = "rgba(201,168,76,0.4)";
  ctx.font = "bold 180px Georgia, serif";
  ctx.fillText("\u201C", 60, y - 20);
  ctx.fillStyle = "#f5e9c8";
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  for (const l of lines) {
    ctx.fillText(l, 80, y);
    y += lh;
  }

  // footer
  ctx.fillStyle = "rgba(201,168,76,0.4)";
  ctx.fillRect(80, H - 180, W - 160, 1);
  ctx.fillStyle = "#c9a84c";
  ctx.font = "bold 28px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(book, 80, H - 130);
  ctx.fillStyle = "rgba(245,233,200,0.7)";
  ctx.font = "22px Inter, Arial, sans-serif";
  ctx.fillText(`— ${author}`, 80, H - 95);
  ctx.fillStyle = "rgba(245,233,200,0.5)";
  ctx.font = "20px Inter, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("booknomics.com", W - 80, H - 95);

  return c.toDataURL("image/png");
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function ShareInsight({
  quotesSource,
  bookTitle,
  bookAuthor,
  bookSlug,
}: {
  quotesSource: string | null | undefined;
  bookTitle: string;
  bookAuthor: string;
  bookSlug: string;
}) {
  const quotes = useMemo(() => extractQuotes(quotesSource), [quotesSource]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!quotes.length) return null;

  const current = quotes[idx] || quotes[0];

  const ensureImage = async (q: string) => {
    setBusy(true);
    try {
      const url = await renderCard(q, bookAuthor, bookTitle);
      setImage(url);
    } finally { setBusy(false); }
  };

  const openWith = async (i: number) => {
    setIdx(i);
    setOpen(true);
    await ensureImage(quotes[i]);
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `booknomics-${bookSlug}-insight.png`;
    a.click();
  };

  const shareNative = async () => {
    if (!image) return;
    const blob = dataUrlToBlob(image);
    const file = new File([blob], `${bookSlug}-insight.png`, { type: "image/png" });
    const shareUrl = `https://booknomics.com/books/${bookSlug}`;
    const text = `"${current}" — ${bookTitle}, ${bookAuthor}\n\n${shareUrl}`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: bookTitle, text });
      } else if (navigator.share) {
        await navigator.share({ title: bookTitle, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Caption copied — paste it with the downloaded image");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Share failed");
    }
  };

  const shareTo = (target: "whatsapp" | "twitter") => {
    const shareUrl = `https://booknomics.com/books/${bookSlug}`;
    const text = `"${current}" — ${bookTitle}, ${bookAuthor}\n${shareUrl}`;
    const enc = encodeURIComponent(text);
    const href = target === "whatsapp"
      ? `https://wa.me/?text=${enc}`
      : `https://twitter.com/intent/tweet?text=${enc}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Card className="p-4 md:p-5 border-border/60 bg-gradient-to-br from-primary/5 to-transparent my-6">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-4 h-4 text-primary" />
          <h3 className="font-serif text-lg font-semibold">Share an insight</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Tap a line to make a beautiful branded card for WhatsApp, Twitter or Instagram.</p>
        <div className="flex flex-wrap gap-2">
          {quotes.slice(0, 6).map((q, i) => (
            <button
              key={i}
              onClick={() => openWith(i)}
              className="text-left text-xs px-3 py-2 rounded-full border border-border/60 bg-background hover:bg-muted/50 transition max-w-full"
            >
              <span className="line-clamp-1 max-w-[42ch] inline-block align-middle">{q}</span>
            </button>
          ))}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setImage(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share insight</DialogTitle>
          </DialogHeader>
          <div className="aspect-square w-full rounded-lg overflow-hidden border border-border bg-muted/30 grid place-items-center">
            {busy || !image ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <img src={image} alt="Insight card preview" className="w-full h-full object-contain" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={download} variant="outline" className="gap-1.5" disabled={!image}>
              <Download className="w-4 h-4" /> Download
            </Button>
            <Button onClick={shareNative} className="gap-1.5" disabled={!image}>
              <Share2 className="w-4 h-4" /> Share
            </Button>
            <Button onClick={() => shareTo("whatsapp")} variant="ghost" size="sm" disabled={!image}>WhatsApp</Button>
            <Button onClick={() => shareTo("twitter")} variant="ghost" size="sm" disabled={!image}>Twitter / X</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
