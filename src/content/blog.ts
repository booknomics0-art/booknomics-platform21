// File-based blog: zero-DB, easy to extend. Each post can map to a book category
// so the Related Books widget pulls real summaries from Supabase.

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: string;       // matches book `category` for related lookup
  readingTime: number;    // minutes
  publishedAt: string;    // ISO date
  author: string;
  tags: string[];
  body: string;           // markdown
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "5-ways-to-build-a-morning-routine",
    title: "5 Ways to Build a Morning Routine That Actually Sticks",
    description: "A practical, science-backed framework for designing a morning routine you'll keep — drawn from the best habit and productivity books on Booknomics.",
    category: "Productivity",
    readingTime: 8,
    publishedAt: "2026-05-12",
    author: "Booknomics Editorial",
    tags: ["habits", "morning routine", "productivity"],
    body: `Most morning-routine advice fails because it copies someone else's day. Yours has to fit your life — your sleep, your work, your energy curve. Here are the 5 design rules that, applied honestly, make a routine outlast motivation.

## 1. Anchor the routine to something you already do
Habits don't form in a vacuum — they attach to existing cues. *Atomic Habits* calls this **habit stacking**: link the new behaviour to one you already do without thinking ("After I pour my coffee, I write three lines in my journal"). Start with one anchor, not five.

## 2. Make the first action 2 minutes long
The hardest part of any routine is starting it. So design the entry point to be almost trivially small — open the notebook, put on running shoes, fill the glass. Once you start, momentum does the rest. This is the "two-minute rule" in action.

## 3. Win the night before
A great morning is built the previous evening. Lay out your clothes, prep coffee, write tomorrow's top three priorities. *The 5 AM Club* hammers this point: discipline at night is freedom in the morning.

## 4. Track it — but lightly
A simple wall calendar with an X for each completed day works better than any app. Don't break the chain. When you do (and you will), use the **two-day rule**: never miss twice in a row.

## 5. Audit at week 4
Most routines die quietly around week 3–4 because they were too ambitious. Sit down at day 28, ask: *what worked, what felt like a chore, what's missing?* Cut the chore. Keep the rest. Then run another four weeks.

## The honest summary
A morning routine is not a personality transplant. It is one small set of decisions, pre-made the night before, that buys you back your first 60 minutes. Done daily, those 60 minutes compound into the life you wanted.

Read the books that shaped these ideas in the *Related books* section below — each summary includes a 7-day action tracker so you can apply the lesson tomorrow morning.`,
  },
  {
    slug: "how-to-read-more-books-without-burning-out",
    title: "How to Read More Books Without Burning Out",
    description: "Reading 30+ books a year doesn't require speed-reading tricks — it requires a system. Here's the one Booknomics readers use.",
    category: "Self Improvement",
    readingTime: 7,
    publishedAt: "2026-05-18",
    author: "Booknomics Editorial",
    tags: ["reading habits", "learning", "self improvement"],
    body: `Reading more isn't about reading faster. It's about removing friction.

## 1. Always have a book within arm's reach
Phones win because they're closer. Put a book on the bedside table, in your bag, next to the kettle. The book you finish is the one you can pick up in 30 seconds.

## 2. Use the 25-page rule
If a book hasn't earned your attention by page 25, put it down. Life is too short to finish bad books out of guilt. The best readers quit more, not less.

## 3. Read two books at once — one easy, one hard
Pair a dense non-fiction title with a lighter narrative or memoir. When focus drops on one, switch to the other. You'll keep momentum on both.

## 4. Take notes you'll actually re-read
Highlight less; summarise more. After each chapter, write one sentence: *what did this teach me?* That single sentence beats 40 highlights you'll never revisit.

## 5. Apply one idea per book
A book is only worth the change it produces. Pick one idea, test it for a week, decide if it stays. Then move on.

## The honest summary
Volume isn't the goal — retention and application are. Booknomics summaries give you the structure to skim quickly when needed and dive deep when a book deserves it. The related summaries below are the ones our readers re-read most.`,
  },
  {
    slug: "the-real-psychology-of-money",
    title: "The Real Psychology of Money: Why Smart People Make Dumb Financial Decisions",
    description: "Why intelligence doesn't protect you from money mistakes — and the behavioural rules that actually do, distilled from the best personal-finance books.",
    category: "Finance",
    readingTime: 9,
    publishedAt: "2026-05-22",
    author: "Booknomics Editorial",
    tags: ["money", "investing", "behavioural finance"],
    body: `Financial mistakes are rarely about math. They're about behaviour — fear, ego, and the stories we tell ourselves about money.

## 1. Your financial goals are emotional, not numerical
"Enough" is not a number — it is the absence of envy. Once you decide what *enough* looks like for you, most financial anxiety quietly disappears.

## 2. Time in the market beats timing the market
The single most reliable predictor of long-term returns is how long you stayed invested. Not which stock you picked. Not when you bought. **How long you held.**

## 3. Save like a pessimist, invest like an optimist
Build an emergency fund as if the worst will happen. Then invest the rest as if the future will look broadly like the past — better, on average, but messy in the middle.

## 4. The 1% rule for big decisions
Before a major purchase, wait 1% of your remaining lifespan — usually 24 to 48 hours. Most regret is impulsive. Most wisdom is delayed.

## 5. Compounding works in reverse too
Small recurring expenses (subscriptions, daily delivery, the third coffee) compound just like investments — quietly, against you. Audit them quarterly.

## The honest summary
You do not need to be brilliant to be wealthy. You need to be patient, honest about your fears, and willing to do boring things consistently. The summaries below break down the personal-finance classics that teach exactly that.`,
  },
  {
    slug: "stoicism-for-modern-anxiety",
    title: "Stoicism for Modern Anxiety: A Beginner's Playbook",
    description: "How a 2,000-year-old philosophy gives you practical tools for the anxiety, distraction and overwhelm of modern life.",
    category: "Mindset",
    readingTime: 7,
    publishedAt: "2026-05-26",
    author: "Booknomics Editorial",
    tags: ["stoicism", "mindset", "philosophy"],
    body: `Stoicism is not about suppressing emotion. It is about choosing which emotions deserve your attention.

## 1. The Dichotomy of Control
Every morning, list the things stressing you. Cross out everything you do not control. What remains is your real to-do list.

## 2. Negative Visualisation
Once a week, imagine briefly losing something you take for granted — your health, your job, a person you love. Done right, this doesn't depress you; it dissolves entitlement and restores gratitude.

## 3. The View From Above
When something feels catastrophic, zoom out. A year from now, will this still matter? Ten years? Most of what feels urgent is not important.

## 4. Voluntary Discomfort
A cold shower, a skipped meal, a long walk in the rain. Small chosen hardships build the muscle you need for the unchosen ones.

## 5. The Evening Review
Before bed, ask three questions: *What did I do well? What did I do badly? What can I do differently tomorrow?* Marcus Aurelius did this for 19 years. So can you.

## The honest summary
Stoicism is a tool for living, not a personality. Used daily, it lowers the volume of modern noise enough that you can actually hear yourself think. The Booknomics summaries below are the cleanest introductions to the ideas.`,
  },
  {
    slug: "build-deep-work-in-a-distracted-world",
    title: "How to Build Deep Work in a Distracted World",
    description: "A step-by-step playbook for protecting your attention and producing your best work — even when everything is designed to interrupt you.",
    category: "Productivity",
    readingTime: 8,
    publishedAt: "2026-05-30",
    author: "Booknomics Editorial",
    tags: ["deep work", "focus", "productivity"],
    body: `Deep work is the ability to focus without distraction on a cognitively demanding task. It's becoming both rarer *and* more valuable — which makes it one of the highest-leverage skills you can build this decade.

## 1. Schedule it, don't hope for it
Block 90 minutes on your calendar, the same time daily. Treat it like a meeting with your most important client — because it is.

## 2. Create a shutdown ritual
End each work day by writing tomorrow's top three priorities and closing your laptop. The brain only rests when it knows the work has a defined edge.

## 3. Embrace boredom
If you can't tolerate 5 minutes in line without checking your phone, you've trained your brain to need novelty. Reverse it: leave the phone in your pocket for one waiting moment a day. Build the muscle back.

## 4. Use the "30-day rule" for new tools
Before adopting a new app or service, ask: *does this directly help me do my best work?* If not, skip it. Attention is a finite resource — protect it like money.

## 5. Measure outputs, not hours
A 90-minute deep-work block beats 6 hours of shallow multitasking. Track what you finished, not what you logged.

## The honest summary
You do not need more time. You need fewer interruptions to the time you already have. The summaries below contain the action systems our readers credit most for getting their focus back.`,
  },
];

export const getBlogPost = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug);
