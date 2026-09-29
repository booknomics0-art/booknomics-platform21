import type { Tier } from "@/hooks/useTier";

export type PaidPlan = Exclude<Tier, "free">;

export const PLANS: Record<PaidPlan, {
  label: string; price: number; amountPaise: number; durationDays: number; tagline: string; highlight?: "popular" | "best";
}> = {
  weekly:    { label: "Weekly",    price: 19,  amountPaise: 1900,  durationDays: 7,   tagline: "Perfect for a quick test drive" },
  monthly:   { label: "Monthly",   price: 69,  amountPaise: 6900,  durationDays: 30,  tagline: "Most popular among readers", highlight: "popular" },
  quarterly: { label: "Quarterly", price: 199, amountPaise: 19900, durationDays: 90,  tagline: "Best value — save 40%",       highlight: "best" },
};

export const FEATURES: { label: string; free: boolean; weekly: boolean; monthly: boolean; quarterly: boolean }[] = [
  { label: "Normal 4k book summaries",            free: true,  weekly: true, monthly: true, quarterly: true },
  { label: "Ad-free reading experience",          free: false, weekly: true, monthly: true, quarterly: true },
  { label: "Full in-depth detailed summaries",    free: false, weekly: true, monthly: true, quarterly: true },
  { label: "Basic action tracker (checklists)",   free: false, weekly: true, monthly: true, quarterly: true },
  { label: "Advanced habit trackers & analytics", free: false, weekly: false, monthly: true, quarterly: true },
  { label: "AI audio summaries",                  free: false, weekly: false, monthly: true, quarterly: true },
  { label: "Monthly growth challenges",           free: false, weekly: false, monthly: true, quarterly: true },
  { label: "AI Book Assistant (Q&A)",             free: false, weekly: false, monthly: false, quarterly: true },
  { label: "PDF & Notion export",                 free: false, weekly: false, monthly: false, quarterly: true },
  { label: "Priority summary requests",           free: false, weekly: false, monthly: false, quarterly: true },
];
