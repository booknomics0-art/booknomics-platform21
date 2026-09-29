import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Trophy, Sparkles, RotateCcw, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_option: number;
  explanation?: string;
};
export type Flashcard = { id: string; front: string; back: string };

interface Props {
  bookId: string;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
}

function FlipCard({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="group relative w-full aspect-[4/3] [perspective:1000px] focus:outline-none"
      aria-label="Flip card"
    >
      <div
        className={cn(
          "absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-muted/40 p-5 flex flex-col justify-between shadow-paper">
          <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold">Concept</div>
          <div className="font-serif text-lg md:text-xl leading-snug text-foreground">{card.front}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Tap to reveal</div>
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-gold/10 to-card p-5 flex flex-col justify-between shadow-cover">
          <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold">Insight</div>
          <div className="font-serif text-base md:text-lg leading-snug text-foreground/90">{card.back}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Tap to flip back</div>
        </div>
      </div>
    </button>
  );
}

export function MasteryTab({ bookId, quiz, flashcards }: Props) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const total = quiz.length;
  const score = useMemo(
    () => quiz.reduce((acc, q) => acc + (answers[q.id] === q.correct_option ? 1 : 0), 0),
    [answers, quiz]
  );
  const pct = total ? Math.round((score / total) * 100) : 0;
  const allAnswered = total > 0 && quiz.every((q) => answers[q.id] !== undefined);

  useEffect(() => {
    if (!submitted || !user) return;
    (async () => {
      const badge = pct === 100;
      const { error } = await supabase.from("user_book_mastery").upsert(
        {
          user_id: user.id,
          book_id: bookId,
          quiz_score: score,
          quiz_total: total,
          flashcards_reviewed: reviewed.size,
          badge_awarded: badge,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      );
      if (!error && badge) toast.success("🏆 Book Master badge awarded!");
    })();
  }, [submitted]); // eslint-disable-line

  const reset = () => { setAnswers({}); setSubmitted(false); };

  if (!quiz.length && !flashcards.length) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/30">
        <Brain className="h-10 w-10 mx-auto text-primary mb-4" />
        <h3 className="font-serif text-2xl font-semibold mb-1">Mastery content coming soon</h3>
        <p className="text-muted-foreground text-sm">An interactive quiz and flashcards will appear here once published.</p>
      </div>
    );
  }

  return (
    <section className="py-4 space-y-12">
      {quiz.length > 0 && (
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Interactive Quiz</div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">Test your mastery</h2>

          {submitted && (
            <div className={cn(
              "mb-8 rounded-2xl p-6 border",
              pct === 100 ? "bg-gold/15 border-gold/40" : "bg-muted/40 border-border"
            )}>
              <div className="flex items-center gap-3 mb-2">
                <Trophy className={cn("h-6 w-6", pct === 100 ? "text-gold" : "text-primary")} />
                <h3 className="font-serif text-2xl font-bold">Mastery Score: {pct}%</h3>
              </div>
              <Progress value={pct} className="h-2 mb-3" />
              <p className="text-sm text-muted-foreground">
                {pct === 100 ? "Perfect — Book Master badge unlocked!" : `${score} of ${total} correct. Review the explanations and try again.`}
              </p>
              <Button onClick={reset} variant="outline" size="sm" className="mt-4 rounded-full gap-2">
                <RotateCcw className="h-3 w-3" /> Retake
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {quiz.map((q, qi) => {
              const sel = answers[q.id];
              return (
                <div key={q.id} className="rounded-2xl border border-border p-5 bg-card">
                  <div className="text-xs text-primary font-semibold mb-2">Question {qi + 1} / {total}</div>
                  <div className="font-serif text-lg md:text-xl mb-4">{q.question}</div>
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const chosen = sel === oi;
                      const isCorrect = oi === q.correct_option;
                      const showState = submitted && (chosen || isCorrect);
                      return (
                        <button
                          key={oi}
                          disabled={submitted}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                          className={cn(
                            "text-left px-4 py-3 rounded-xl border transition flex items-center gap-3",
                            !submitted && chosen && "border-primary bg-primary/5",
                            !submitted && !chosen && "border-border hover:border-primary/50",
                            showState && isCorrect && "border-emerald-500 bg-emerald-500/10",
                            showState && chosen && !isCorrect && "border-destructive bg-destructive/10",
                            submitted && !chosen && !isCorrect && "border-border opacity-60",
                          )}
                        >
                          <span className="text-xs font-semibold w-5">{String.fromCharCode(65 + oi)}</span>
                          <span className="flex-1 text-sm">{opt}</span>
                          {showState && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {showState && chosen && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && q.explanation && (
                    <div className="mt-3 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                      <span className="font-semibold text-foreground">Why: </span>{q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!submitted && (
            <Button
              onClick={() => {
                if (!user) { toast.error("Sign in to save your mastery score"); }
                setSubmitted(true);
              }}
              disabled={!allAnswered}
              size="lg"
              className="mt-6 bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2"
            >
              <Sparkles className="h-4 w-4" /> Submit & see score
            </Button>
          )}
        </div>
      )}

      {flashcards.length > 0 && (
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Active Recall</div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">Insight flashcards</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flashcards.map((c) => (
              <div key={c.id} onClick={() => setReviewed((s) => new Set(s).add(c.id))}>
                <FlipCard card={c} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Reviewed {reviewed.size} / {flashcards.length}</p>
        </div>
      )}
    </section>
  );
}

export default MasteryTab;
