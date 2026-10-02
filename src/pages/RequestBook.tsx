import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookPlus, Clock3, Lightbulb, LogIn } from "lucide-react";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

type RequestRow = {
  id: string;
  title: string;
  author: string | null;
  language: string;
  reason: string | null;
  status: string;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  new: "Received",
  planned: "Planned",
  in_progress: "In progress",
  published: "Published",
  rejected: "Not planned",
};

export default function RequestBook() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "other">("en");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const loadMine = async () => {
    if (!user) return setRequests([]);
    const { data } = await supabase
      .from("book_requests")
      .select("id,title,author,language,reason,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRequests((data ?? []) as RequestRow[]);
  };

  useEffect(() => { void loadMine(); }, [user?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();
    if (cleanTitle.length < 2) return toast.error("Please enter the book title.");

    setBusy(true);
    const { error } = await supabase.from("book_requests").insert({
      user_id: user.id,
      title: cleanTitle,
      author: cleanAuthor || null,
      language,
      reason: reason.trim() || null,
    });
    setBusy(false);

    if (error) {
      if (error.code === "23505") return toast.info("You already requested this book.");
      if (/Daily book request limit/i.test(error.message)) return toast.error("Daily request limit reached. Try again tomorrow.");
      return toast.error(error.message);
    }

    trackEvent("book_request_submitted", { requested_language: language, has_author: !!cleanAuthor });
    toast.success("Request received. We'll use reader demand to prioritise the catalog.");
    setTitle("");
    setAuthor("");
    setReason("");
    await loadMine();
  };

  return (
    <Layout>
      <SEO
        title="Request a Book Summary | Booknomics"
        description="Tell Booknomics which book you want next. Reader demand helps us prioritise new English and Hindi summaries."
        path="/request-book"
        noindex
      />

      <section className="border-b border-border bg-hero">
        <div className="container py-10 md:py-16 max-w-5xl">
          <div className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-2">Reader demand</div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight">What should Booknomics add next?</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Request the book you actually want to read or listen to. Repeated requests rise in the admin demand board, so the catalog follows readers instead of guesswork.
          </p>
        </div>
      </section>

      <div className="container py-8 md:py-12 max-w-5xl grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
        <Card className="p-5 md:p-7">
          {loading ? (
            <div className="text-sm text-muted-foreground">Checking your account…</div>
          ) : !user ? (
            <div className="py-8 text-center">
              <LogIn className="h-9 w-9 mx-auto mb-3 text-primary" />
              <h2 className="font-serif text-2xl font-semibold">Sign in to request a book</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-5">
                Sign-in keeps requests genuine and prevents spam. It also lets you see the status of your requests.
              </p>
              <Button asChild><Link to="/auth">Sign in / Create account</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="request-title" className="text-sm font-medium">Book title *</label>
                <Input id="request-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="e.g. The Psychology of Money" className="mt-1.5" required />
              </div>
              <div>
                <label htmlFor="request-author" className="text-sm font-medium">Author</label>
                <Input id="request-author" value={author} onChange={e => setAuthor(e.target.value)} maxLength={160} placeholder="e.g. Morgan Housel" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">Summary language</label>
                <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "hi" | "other")}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिंदी</SelectItem>
                    <SelectItem value="other">Other / Either</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="request-reason" className="text-sm font-medium">What do you want from this book? <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea id="request-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={4} className="mt-1.5" placeholder="The problem, goal or topic you want the summary to help with…" />
                <div className="text-[11px] text-muted-foreground mt-1 text-right">{reason.length}/500</div>
              </div>
              <Button type="submit" disabled={busy || title.trim().length < 2} className="w-full sm:w-auto gap-2">
                <BookPlus className="h-4 w-4" /> {busy ? "Submitting…" : "Request this book"}
              </Button>
            </form>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <Lightbulb className="h-6 w-6 text-primary mb-3" />
            <h2 className="font-serif text-xl font-semibold">How prioritisation works</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              We combine repeated reader requests, internal search demand, content quality readiness and language demand. A popular request still has to pass our quality and publishing checks before it becomes indexable.
            </p>
          </Card>

          {user && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="h-5 w-5 text-primary" />
                <h2 className="font-serif text-xl font-semibold">Your requests</h2>
              </div>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map(r => (
                    <div key={r.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex gap-2 items-start justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{r.title}</div>
                          <div className="text-xs text-muted-foreground">{r.author || "Author not specified"} · {r.language === "hi" ? "हिंदी" : r.language === "en" ? "English" : "Either"}</div>
                        </div>
                        <Badge variant={r.status === "published" ? "default" : "secondary"}>{statusLabel[r.status] ?? r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
