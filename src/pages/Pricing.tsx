import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Crown, Headphones, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { FEATURES, PLANS, type SellablePlan, SELLABLE_PLANS } from "@/lib/plans";
import { useTier } from "@/hooks/useTier";

// Production main still uses Supabase sessions. Recurring mandates are on the
// separate Cloudflare migration branch; do not open the legacy Razorpay Orders
// checkout or collect money before session + entitlement parity is verified.
export default function Pricing() {
  const [selected, setSelected] = useState<SellablePlan>("monthly");
  const { isPremium } = useTier();
  const plan = PLANS[selected];

  useEffect(() => { document.title = "Booknomics Premium Plans | Weekly ₹19 & Monthly ₹49"; }, []);

  return (
    <Layout>
      <div className="container max-w-6xl py-10 md:py-16">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.12em] text-primary">
            <Crown className="h-4 w-4" /> BOOKNOMICS PREMIUM
          </span>
          <h1 className="mt-6 font-serif text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
            Read deeper. Build better habits.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Choose a simple membership for book insights, reading routines and learning tools.
            Switch between the weekly and monthly plans below.
          </p>
        </div>

        <div className="mx-auto mb-8 flex w-fit flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/70">Select subscription</span>
          <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-muted/50 p-1.5 shadow-sm"
            role="tablist" aria-label="Premium billing cycle">
            {SELLABLE_PLANS.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={selected === key}
                onClick={() => setSelected(key)}
                className={"min-w-36 rounded-full px-5 py-3 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-w-44 " + (
                  selected === key ? "bg-primary text-primary-foreground shadow-md" : "text-foreground/80 hover:bg-card"
                )}>
                {key === "weekly" ? "Weekly · ₹19" : "Monthly · ₹49"}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">Compare the plans. No charge is made when changing this selection.</p>
        </div>

        <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-lg" aria-live="polite">
          <div className="border-b border-border bg-primary/5 px-7 py-7 sm:px-10 sm:py-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-bold text-primary"><Crown className="h-4 w-4" /> {plan.label} Premium</p>
              {selected === "monthly" && <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Most popular</span>}
            </div>
            <div className="mt-5 flex items-end gap-3">
              <strong className="text-6xl font-extrabold tracking-tight text-foreground sm:text-7xl">₹{plan.price}</strong>
              <span className="pb-2 text-base font-semibold text-foreground/70">/ {selected === "weekly" ? "week" : "month"}</span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/80">
              {selected === "weekly"
                ? "A flexible seven-day membership with the Weekly Premium learning tools."
                : "A full month of advanced reading, tracking and supported audio experiences."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Planned automatic renewal: ₹{plan.price} per {selected === "weekly" ? "week" : "month"}, until cancelled.</p>
          </div>
          <div className="px-7 py-7 sm:px-10 sm:py-9">
            <h2 className="text-lg font-bold text-foreground">What's included</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {FEATURES.filter((item) => item[selected]).map((item) => (
                <li key={item.label} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 rounded-2xl border border-border bg-muted/30 p-5">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" /> Secure subscriptions are being enabled
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                We are completing Cloudflare billing activation. Enrollment is temporarily unavailable, so
                no payment will be collected from this page until secure checkout is verified.
              </p>
              <button type="button" disabled
                className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-primary/60 px-5 py-3.5 text-base font-bold text-primary-foreground"
                aria-label="Subscription checkout is not active yet">
                {isPremium ? "Your existing Premium stays active" : "Subscription checkout opening soon"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                For billing questions, <Link className="font-medium text-primary underline" to="/contact">contact Booknomics</Link>.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="flex items-start gap-3"><BookOpen className="mt-1 h-5 w-5 shrink-0 text-primary"/>
            <div><h2 className="font-bold text-foreground">Reading made practical</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">Understand ideas and put them into daily action through supported summaries and trackers.</p>
            </div>
          </div>
          <div className="flex items-start gap-3"><Headphones className="mt-1 h-5 w-5 shrink-0 text-primary"/>
            <div><h2 className="font-bold text-foreground">Audio when available</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">Audio and interactive experiences depend on the particular title and plan.</p>
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Existing purchased memberships keep their original validity. View <Link className="underline" to="/terms">Terms</Link> and <Link className="underline" to="/privacy">Privacy</Link>.
        </p>
      </div>
    </Layout>
  );
}
