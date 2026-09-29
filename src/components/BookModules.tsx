import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lock, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Module {
  id: string;
  part_number: number;
  part_key: string;
  title: string;
  content: string;
  is_premium: boolean;
}

export function BookModules({ bookId, language }: { bookId: string; language: "en" | "hi" }) {
  const { isPremium } = usePremium();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("book_modules")
      .select("id,part_number,part_key,title,content,is_premium")
      .eq("book_id", bookId)
      .eq("language", language)
      .order("part_number");
    setModules((data ?? []) as Module[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId, language]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-book-modules", { body: { book_id: bookId } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      toast.success(language === "hi" ? "सारे भाग तैयार हैं!" : "All 10 parts ready!");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  if (modules.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/30">
        <Sparkles className="h-10 w-10 mx-auto text-primary mb-4" />
        <h3 className="font-serif text-2xl font-semibold mb-2">
          {language === "hi" ? "10 भाग में सीखें" : "Learn in 10 modular parts"}
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
          {language === "hi" ? "हुक, मूल विचार, गहन अंतर्दृष्टि, एक्शन सिस्टम — सब कुछ छोटे, स्कैनेबल भागों में।" : "Hook, ideas, insights, action — broken into 10 short, scannable parts."}
        </p>
        <Button onClick={generate} disabled={generating} size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> {language === "hi" ? "बन रहा है…" : "Generating…"}</> : <><Sparkles className="h-4 w-4" /> {language === "hi" ? "10 भाग बनाएँ" : "Generate 10 parts"}</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={[`p-${modules[0].part_number}`]} className="w-full">
        {modules.map((m) => {
          const locked = m.is_premium && !isPremium;
          return (
            <AccordionItem key={m.id} value={`p-${m.part_number}`} className="border border-border rounded-2xl px-5 mb-3 bg-card/50">
              <AccordionTrigger className="hover:no-underline py-5">
                <div className="flex items-center gap-4 text-left">
                  <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold tabular-nums w-14">PART {String(m.part_number).padStart(2, "0")}</div>
                  <div className="font-serif text-lg md:text-xl font-semibold">{m.title}</div>
                  {locked && <Lock className="h-4 w-4 text-muted-foreground ml-2" />}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                {locked ? (
                  <div className="rounded-xl bg-gradient-to-b from-muted/50 to-muted/20 border border-dashed border-primary/30 p-6 text-center">
                    <Lock className="h-6 w-6 mx-auto text-primary mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {language === "hi" ? "यह भाग प्रीमियम सदस्यों के लिए है।" : "This part is for premium members."}
                    </p>
                    <Button asChild size="sm" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full">
                      <Link to="/pricing">{language === "hi" ? "अनलॉक करें" : "Unlock"}</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-serif prose-p:leading-relaxed prose-strong:text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
