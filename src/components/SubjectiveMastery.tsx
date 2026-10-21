import { useState } from "react";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Feedback = {
  score: number;
  strengths: string[];
  mistakes: string[];
  improvements: string[];
  idealAnswer: string;
  sourceScope?: string;
};

export default function SubjectiveMastery({ bookId, language }: { bookId: string; language: "en" | "hi" }) {
  const { user } = useAuth();
  const hi = language === "hi";
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const label = (english: string, hindi: string) => hi ? hindi : english;

  const callAssessment = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("mastery-subjective", { body: { bookId, ...body } });
    if (error) {
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        const payload = await context.clone().json().catch(() => null);
        if (payload && typeof payload.error === "string") throw new Error(payload.error);
      }
      throw new Error(error.message || "Assessment unavailable");
    }
    if (data?.error) throw new Error(String(data.error));
    return data;
  };

  const loadQuestions = async () => {
    if (!user) { setErrorMessage(label("Please sign in to answer advanced questions.", "उन्नत प्रश्नों के लिए साइन इन करें।")); return; }
    setBusy("questions");
    setErrorMessage("");
    try {
      const data = await callAssessment({ action: "questions" });
      if (!Array.isArray(data.questions) || data.questions.length !== 2 || !data.questions.every((x: unknown) => typeof x === "string")) {
        throw new Error("Assessment returned invalid questions.");
      }
      setQuestions(data.questions as string[]);
      setAnswers(["", ""]);
      setFeedback({});
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : label("Cannot load questions", "प्रश्न नहीं खुल सके"));
    } finally { setBusy(null); }
  };

  const grade = async (index: number) => {
    if (!user) { setErrorMessage(label("Sign in before grading.", "जाँच से पहले साइन इन करें।")); return; }
    setBusy(String(index));
    setErrorMessage("");
    try {
      const result = await callAssessment({ action: "grade", question: questions[index], answer: answers[index] });
      if (!Number.isFinite(result?.score) || typeof result?.idealAnswer !== "string") throw new Error("Invalid grading result.");
      setFeedback((old) => ({ ...old, [index]: result as Feedback }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : label("Grading unavailable", "मूल्यांकन उपलब्ध नहीं"));
    } finally { setBusy(null); }
  };

  return (
    <section className="mt-10 rounded-2xl border border-gold/30 bg-card p-5 md:p-7 space-y-6" aria-labelledby="subjective-heading">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-widest uppercase"><Brain className="h-4 w-4" /> {label("Advanced written assessment", "उन्नत लिखित परीक्षा")}</div>
        <h2 id="subjective-heading" className="font-serif text-2xl md:text-3xl font-bold">{label("Two book-specific deep questions", "इस किताब के दो गहन प्रश्न")}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {label("Write your own analysis. AI assesses reasoning against this book's Booknomics summary, gives a score out of 100, identifies mistakes and shows a model answer. This is formative feedback, not a verified examination grade.",
            "अपने शब्दों में आलोचनात्मक उत्तर लिखें। AI इस किताब की Booknomics समरी के आधार पर तर्क जाँचेगा, 100 में अंक देगा, गलतियाँ बताएगा और आदर्श उत्तर दिखाएगा। ये अभ्यास का आकलन है, प्रमाणित परीक्षा का परिणाम नहीं।")}
        </p>
      </header>
      {questions.length === 0 ? (
        <Button type="button" disabled={busy !== null} onClick={loadQuestions} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {label("Prepare my two advanced questions", "मेरे दो उन्नत प्रश्न तैयार करें")}
        </Button>
      ) : (
        <div className="space-y-8">
          {questions.map((question, index) => (
            <div key={index} className="rounded-xl border border-border p-4 md:p-5 space-y-4">
              <p className="text-xs font-semibold text-primary">{label("Written question", "लिखित प्रश्न")} {index + 1} / 2</p>
              <h3 className="font-serif text-lg md:text-xl font-semibold leading-relaxed">{question}</h3>
              <Textarea
                aria-label={label("Your answer to question " + (index + 1), "प्रश्न " + (index + 1) + " का उत्तर")}
                value={answers[index]}
                onChange={(event) => { const value = event.target.value; setAnswers((a) => a.map((v, i) => i === index ? value : v)); setFeedback((old) => { const next = { ...old }; delete next[index]; return next; }); }}
                placeholder={label("Explain your reasoning using specific concepts or examples from the book...", "किताब के विचारों, उदाहरणों और अपने तर्क के साथ उत्तर लिखें...")}
                rows={7}
                disabled={busy !== null}
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">{answers[index].length}/6500</span>
                <Button type="button" disabled={busy !== null || answers[index].trim().length < 20 || answers[index].length > 6500} onClick={() => grade(index)}>
                  {busy === String(index) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {label("AI evaluate my answer", "AI से मेरा उत्तर जाँचें")}
                </Button>
              </div>
              {feedback[index] && (
                <div className="space-y-4 rounded-xl border border-primary/20 bg-muted/30 p-4" aria-live="polite">
                  <p className="text-2xl font-bold text-primary">{feedback[index].score}<span className="text-base text-muted-foreground"> / 100</span></p>
                  {([
                    ["strengths", label("What you did well", "अच्छे पक्ष")],
                    ["mistakes", label("Errors and missing points", "गलतियाँ और छूटे हुए बिंदु")],
                    ["improvements", label("How to improve", "कैसे सुधारें")],
                  ] as const).map(([key, heading]) => (
                    <div key={key}>
                      <h4 className="font-semibold mb-1">{heading}</h4>
                      {feedback[index][key]?.length ? <ul className="list-disc ps-5 text-sm leading-relaxed space-y-1">{feedback[index][key].map((point, i) => <li key={i}>{point}</li>)}</ul> : <p className="text-xs text-muted-foreground">—</p>}
                    </div>
                  ))}
                  <div><h4 className="font-semibold mb-2">{label("Model answer", "आदर्श उत्तर")}</h4><p className="text-sm whitespace-pre-wrap leading-relaxed">{feedback[index].idealAnswer}</p></div>
                  <p className="text-xs text-muted-foreground">{feedback[index].sourceScope}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
    </section>
  );
}
