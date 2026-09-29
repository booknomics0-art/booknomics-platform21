// Long-form editorial intros for clean /category/* pages.
// Written for humans first: context, how to choose, and how to apply.
// Keyed by the URL slug produced by slugify(category).

export interface CategorySection {
  h2: string;
  body: string[];
}

export interface CategoryPick {
  slug: string;
  label: string;
  note: string;
}

export interface CategoryContent {
  h1: string;
  title: string;
  description: string;
  lead: string;
  sections: CategorySection[];
  picks: CategoryPick[];
  faqs: { q: string; a: string }[];
  related: { path: string; label: string }[];
}

const RESOURCES = [
  { path: "/resources/7-day-reading-action-tracker", label: "Free 7-day reading action tracker" },
  { path: "/resources/book-summary-template", label: "Free book summary template" },
  { path: "/resources", label: "All free reading resources" },
];

export const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  "self-help": {
    h1: "Self-Help Book Summaries",
    title: "Self-Help Book Summaries — Habits, Discipline & Growth",
    description:
      "Practical self-help book summaries with key lessons, a 7-day action plan and reflection prompts. Start with Atomic Habits, The 7 Habits and The Subtle Art.",
    lead:
      "Self-help works when it stops being motivation and starts being method. These summaries pull out the mechanism behind each book — the habit loop, the decision rule, the daily practice — so you can test it in your own life within a week.",
    sections: [
      {
        h2: "What self-help books actually teach",
        body: [
          "The best self-help writing is not cheerleading. It is applied psychology, behavioural science and hard-won personal experience compressed into rules you can follow on an ordinary Tuesday. James Clear explains why identity precedes behaviour. Stephen Covey explains why principles outlast tactics. Mark Manson argues that choosing better problems matters more than avoiding problems altogether. Read together, these books describe one process: notice what you repeatedly do, change the environment around it, and let the new behaviour redefine who you believe you are.",
          "That is also why self-help fails so often. Readers finish a book feeling energised, close it, and change nothing structural — no cue, no calendar, no measurement. Our summaries are deliberately built to prevent that. Each one ends with a concrete action system rather than a closing quote.",
        ],
      },
      {
        h2: "How to choose your first self-help book",
        body: [
          "If your problem is consistency, start with habit formation. If your problem is direction, start with principles and long-term thinking. If your problem is emotional overload — comparison, anxiety, the pressure to be extraordinary — start with the books about acceptance and prioritisation instead of the ones about output. Reading the right book at the wrong moment is one of the quietest reasons people give up on personal growth.",
          "A useful sequence for most readers: one habits book, one thinking book, one meaning book. Three summaries, roughly forty minutes of reading, and you will have a working map of the field rather than a pile of disconnected advice.",
        ],
      },
      {
        h2: "How to apply what you read",
        body: [
          "Pick a single behaviour, not a life overhaul. Write it as a sentence with a time and a place. Track it for seven days using the free tracker below, and note what got in the way each evening — the obstacle is almost always environmental rather than motivational. At the end of the week, keep the behaviour, shrink it, or replace it. Repeat.",
          "Every summary in this category includes reflection prompts for exactly this loop, plus a 7-day plan you can print or copy into a notebook.",
        ],
      },
    ],
    picks: [
      { slug: "atomic-habits", label: "Atomic Habits", note: "The clearest model of how small behaviours compound into identity." },
      { slug: "the-7-habits", label: "The 7 Habits of Highly Effective People", note: "Principles for character, priorities and long-term effectiveness." },
      { slug: "the-subtle-art", label: "The Subtle Art of Not Giving a F*ck", note: "Choosing better problems instead of chasing constant positivity." },
      { slug: "think-and-grow-rich-en", label: "Think and Grow Rich", note: "The classic on desire, persistence and the psychology of achievement." },
      { slug: "the-richest-man-in-babylon-en", label: "The Richest Man in Babylon", note: "Timeless money habits told as parables." },
    ],
    faqs: [
      { q: "Which self-help book should a beginner read first?", a: "Atomic Habits is the most practical starting point because it gives you a repeatable system rather than general advice. Follow it with The 7 Habits of Highly Effective People for the longer-term principles." },
      { q: "Are self-help summaries enough, or should I read the full book?", a: "A summary is enough to decide whether an idea fits your life and to start applying it this week. If a book changes how you think, buy the full edition — the stories and evidence are worth the extra hours." },
      { q: "How long does each Booknomics self-help summary take to read?", a: "Around 12–15 minutes, plus a 7-day action plan and reflection prompts you can work through afterwards." },
    ],
    related: [
      { path: "/category/productivity", label: "Productivity book summaries" },
      { path: "/category/psychology", label: "Psychology book summaries" },
      ...RESOURCES,
    ],
  },

  philosophy: {
    h1: "Philosophy Book Summaries",
    title: "Philosophy Book Summaries — Stoicism, Ethics & Meaning",
    description:
      "Philosophy book summaries made practical: Meditations, Man's Search for Meaning, Chanakya Niti and the Upanishads, with modern applications and reflection prompts.",
    lead:
      "Philosophy is the oldest form of self-help, and still the most durable. These summaries translate Stoic, Indian and existential thought into decisions you can actually make — about work, loss, ambition and attention.",
    sections: [
      {
        h2: "Why philosophy still works",
        body: [
          "Marcus Aurelius wrote Meditations as a private notebook while running an empire and burying children. Viktor Frankl wrote about meaning after surviving the camps. Chanakya wrote about strategy while building a state. None of these were academic exercises; they were field notes from people under pressure. That is exactly why they hold up two thousand years later, while most productivity advice expires in a decade.",
          "The core claim across traditions is surprisingly consistent: you do not control outcomes, you control judgement and response. Everything practical follows from that — how you handle criticism, how you plan, how you grieve, how you decide what is worth wanting.",
        ],
      },
      {
        h2: "Western and Indian traditions side by side",
        body: [
          "Reading Stoicism next to the Upanishads and the Bhagavad Gita is unusually clarifying. The Stoics separate what is 'up to us' from what is not; the Gita separates action from attachment to its fruit. The Upanishads push further, asking who the observer behind the thought actually is. Ryan Holiday's modern Stoic books and Chanakya Niti then bring both back down to strategy, reputation and daily conduct.",
          "You do not need to accept a metaphysics to use the psychology. Most readers find that these texts reduce reactivity long before they resolve any big questions.",
        ],
      },
      {
        h2: "How to read philosophy without stalling",
        body: [
          "Read slowly, in short sessions, and keep a pen. Philosophy resists speed-reading because the sentences are compressed. Take one passage per day, write what it would change if you believed it fully, and act on that for a week.",
          "Each summary here gives you the argument, the historical context, the honest counter-arguments, and a daily practice — so the ideas leave the page.",
        ],
      },
    ],
    picks: [
      { slug: "meditations", label: "Meditations", note: "Marcus Aurelius on judgement, duty and self-control." },
      { slug: "man-search-meaning", label: "Man's Search for Meaning", note: "Frankl on suffering, purpose and the last human freedom." },
      { slug: "chanakya-niti", label: "Chanakya Niti", note: "Ancient Indian strategy, ethics and practical statecraft." },
      { slug: "upanishads", label: "Upanishads", note: "The foundational inquiry into self, consciousness and reality." },
      { slug: "the-obstacle-is-the-way", label: "The Obstacle Is the Way", note: "Modern Stoicism applied to setbacks and constraints." },
    ],
    faqs: [
      { q: "Is philosophy useful for everyday life?", a: "Yes. Stoic and Vedantic texts are mostly about attention, judgement and response — the three things you use every hour. Most readers notice less reactivity within a week of practising one idea deliberately." },
      { q: "Where should I start with philosophy?", a: "Start with Meditations if you want practical Stoicism, Man's Search for Meaning if you are dealing with loss or purpose, and Chanakya Niti or the Upanishads for the Indian tradition." },
    ],
    related: [
      { path: "/category/spirituality", label: "Spirituality book summaries" },
      { path: "/best-hindi-book-summaries", label: "Best Hindi book summaries" },
      ...RESOURCES,
    ],
  },

  business: {
    h1: "Business Book Summaries",
    title: "Business Book Summaries — Startups, Strategy & Leadership",
    description:
      "Business book summaries covering startups, strategy, systems and leadership — Zero to One, The Lean Startup, Good to Great and Principles, with action plans.",
    lead:
      "Business books are most useful when you are holding a live decision. These summaries organise the field by problem: finding a market, building a system, leading people, and surviving the hard part.",
    sections: [
      {
        h2: "Four problems every business book answers",
        body: [
          "First, what to build. Peter Thiel argues for monopolies of usefulness rather than incremental competition; Eric Ries argues for validated learning before scale. Second, how to build it repeatably — Michael Gerber's central insight in The E-Myth is that most founders work in the business instead of on the system that runs it. Third, how to lead when the plan breaks: Ben Horowitz's The Hard Thing About Hard Things is honest about layoffs, doubt and decisions with no good option. Fourth, how to make good decisions under uncertainty, which is Ray Dalio's territory in Principles.",
          "Read one book from each group and you have a working operating model rather than a shelf of slogans.",
        ],
      },
      {
        h2: "Founders, operators and employees read differently",
        body: [
          "If you are pre-launch, prioritise customer discovery and positioning. If you are running something that already works, prioritise systems, hiring and retention. If you are an employee learning the craft, start with the behavioural books — Influence, Good to Great, Hooked — because they explain the environment you operate inside.",
          "Small business owners in India and other emerging markets often get more from The E-Myth and The $100 Startup than from venture-scale narratives, simply because the constraints match.",
        ],
      },
      {
        h2: "Turning business reading into action",
        body: [
          "Every summary here ends with a 7-day plan. For business books that usually means: define one metric, run one customer conversation per day, and write down what surprised you. A week of that beats a month of highlighting.",
        ],
      },
    ],
    picks: [
      { slug: "zero-to-one", label: "Zero to One", note: "Thiel on building something genuinely new rather than competing." },
      { slug: "the-lean-startup", label: "The Lean Startup", note: "Validated learning, MVPs and avoiding expensive guesses." },
      { slug: "good-to-great", label: "Good to Great", note: "What separates durable companies from merely good ones." },
      { slug: "principles", label: "Principles", note: "Dalio's decision-making system and radical transparency." },
      { slug: "the-e-myth", label: "The E-Myth Revisited", note: "Why small businesses fail and how systems fix that." },
    ],
    faqs: [
      { q: "Which business book is best for a first-time founder?", a: "The Lean Startup for process and Zero to One for positioning. Read both before spending significant money on building." },
      { q: "Do these summaries work for small offline businesses?", a: "Yes. The E-Myth Revisited and The $100 Startup are written for owner-operated businesses rather than venture-funded startups." },
    ],
    related: [
      { path: "/category/finance", label: "Finance book summaries" },
      { path: "/category/psychology", label: "Psychology book summaries" },
      ...RESOURCES,
    ],
  },

  psychology: {
    h1: "Psychology Book Summaries",
    title: "Psychology Book Summaries — Behaviour, Bias & the Mind",
    description:
      "Psychology book summaries on bias, motivation, trauma and performance — Thinking Fast and Slow, Mindset, Grit, Influence and The Body Keeps the Score.",
    lead:
      "Psychology explains the machinery underneath every other category. Learn how attention, memory, bias and emotion actually work, and most self-improvement advice suddenly makes sense — or stops being convincing.",
    sections: [
      {
        h2: "The three big threads",
        body: [
          "The first thread is judgement and bias. Kahneman's two-system model, Ariely's experiments on irrationality and Thaler's work on nudges all describe the same uncomfortable finding: we are predictably wrong in specific, mappable ways. The second thread is motivation and performance — Dweck on mindset, Duckworth on grit, Csikszentmihalyi on flow, Gladwell on practice and outliers. The third is emotion and the body, where van der Kolk's The Body Keeps the Score changed how a generation of clinicians thinks about trauma.",
          "Together they give you a realistic model of a human being: reactive, pattern-hungry, deeply social, capable of change under the right conditions.",
        ],
      },
      {
        h2: "Reading psychology critically",
        body: [
          "Popular psychology has a replication problem, and we say so inside the summaries where it matters. Some famous findings have weakened under scrutiny; the underlying ideas often survive in reduced form. Our approach is to give you the claim, the strongest version of the evidence, and the honest caveat — not a confident sound bite.",
          "That scepticism is itself the most useful thing psychology teaches. Ask what would have to be true for the claim to be false, and check whether the study population looks anything like your life.",
        ],
      },
      {
        h2: "Everyday applications",
        body: [
          "Use bias research for decisions with money and hiring. Use motivation research for skill-building and parenting. Use influence research defensively, to notice when it is being used on you. Each summary includes a 7-day experiment so you can test one mechanism directly.",
        ],
      },
    ],
    picks: [
      { slug: "thinking-fast-and-slow", label: "Thinking, Fast and Slow", note: "Kahneman's two systems and the biases that follow." },
      { slug: "mindset", label: "Mindset", note: "Fixed versus growth beliefs and how they shape effort." },
      { slug: "grit", label: "Grit", note: "Passion, perseverance and the limits of talent." },
      { slug: "influence", label: "Influence", note: "The six levers of persuasion — and how to resist them." },
      { slug: "the-body-keeps-score", label: "The Body Keeps the Score", note: "How trauma lives in the body and what helps." },
    ],
    faqs: [
      { q: "Do I need a background in psychology to read these?", a: "No. Every summary defines the terms it uses and explains the experiment before the conclusion." },
      { q: "Which psychology book helps most with decision-making?", a: "Thinking, Fast and Slow, followed by Predictably Irrational and Nudge for applied behavioural economics." },
    ],
    related: [
      { path: "/category/self-help", label: "Self-help book summaries" },
      { path: "/category/business", label: "Business book summaries" },
      ...RESOURCES,
    ],
  },

  spirituality: {
    h1: "Spirituality Book Summaries",
    title: "Spirituality Book Summaries — Presence, Peace & Practice",
    description:
      "Spirituality book summaries in English and Hindi — the Bhagavad Gita, The Power of Now, The Four Agreements and Upanishadic texts, with daily practices.",
    lead:
      "Spiritual books are practice manuals more than belief systems. These summaries keep the practice and explain the philosophy plainly, whether you come to it as a seeker, a sceptic, or somewhere in between.",
    sections: [
      {
        h2: "Ancient and modern, side by side",
        body: [
          "The Bhagavad Gita frames action without attachment to results — arguably the most useful psychological instruction ever written for people with responsibilities. Eckhart Tolle's The Power of Now approaches the same ground through attention: most suffering is a story about past or future running in the mind right now. Don Miguel Ruiz's The Four Agreements reduces a Toltec tradition to four sentences you can remember under stress.",
          "Read across traditions and the overlap is striking: watch the mind, loosen identification with it, act anyway, and be gentler with people than you feel like being.",
        ],
      },
      {
        h2: "Practice over belief",
        body: [
          "You can benefit from these texts without adopting any doctrine. Ten minutes of watching the breath, one honest reflection question at night, and one small act of restraint during the day will do more than a month of reading. Every summary in this category includes exactly that: a minimal daily practice plus the reflection prompts that go with it.",
          "For Hindi readers we also publish the Bhagavad Gita, Ramcharitmanas, Ashtavakra Gita and Vairagya Shatak in Hindi, written for a Hindi sensibility rather than translated mechanically.",
        ],
      },
      {
        h2: "A gentle starting sequence",
        body: [
          "Begin with The Power of Now for attention, move to the Bhagavad Gita for action and duty, then to the Upanishads if the deeper questions stay with you. Give each a week of practice before moving on — spiritual reading rewards repetition far more than volume.",
        ],
      },
    ],
    picks: [
      { slug: "bhagavad-gita", label: "Bhagavad Gita", note: "Duty, detachment and action without anxiety about outcomes." },
      { slug: "the-power-of-now", label: "The Power of Now", note: "Attention as the practical route out of mental suffering." },
      { slug: "the-four-agreements", label: "The Four Agreements", note: "Four simple rules for speech, assumption and effort." },
      { slug: "bhagavad-gita-hi", label: "भगवद् गीता (Hindi)", note: "The Gita summarised in Hindi with daily practice." },
      { slug: "ashtavakra-gita", label: "अष्टावक्र गीता", note: "Non-dual wisdom in its most uncompromising form." },
    ],
    faqs: [
      { q: "Are these summaries religious?", a: "No. We explain the text, its context and its practices without asking you to adopt any belief system." },
      { q: "Which spiritual book is best to start with?", a: "The Power of Now for attention practice, or the Bhagavad Gita if you want a framework for acting well under pressure." },
    ],
    related: [
      { path: "/category/philosophy", label: "Philosophy book summaries" },
      { path: "/hindi", label: "हिंदी लाइब्रेरी" },
      ...RESOURCES,
    ],
  },

  history: {
    h1: "History Book Summaries",
    title: "History Book Summaries — Big Ideas Across Human Time",
    description:
      "History book summaries that explain how societies, money, work and belief evolved — starting with Sapiens — plus the classics that shaped how we tell those stories.",
    lead:
      "History books are the long view of everything the other categories argue about. They show which parts of modern life are permanent features of being human and which are recent, fragile inventions.",
    sections: [
      {
        h2: "Why big-picture history matters now",
        body: [
          "Yuval Noah Harari's Sapiens made one argument unavoidable: large-scale cooperation runs on shared fictions — money, nations, companies, rights. Once you can see that, current events read differently. You stop asking only what happened and start asking what story made it possible for millions of strangers to act together.",
          "History also functions as a correction to self-help optimism. Progress is real but uneven, and most gains were structural rather than personal. Holding both ideas at once — agency and structure — makes for far better thinking about your own life.",
        ],
      },
      {
        h2: "Reading history alongside literature",
        body: [
          "Great fiction records what official history omits: what it felt like. Reading Sapiens next to classics such as 1984, Animal Farm or Premchand's Godan gives you both the map and the texture. Our classic literature and Hindi literature collections are built for exactly that pairing.",
        ],
      },
      {
        h2: "How to use these summaries",
        body: [
          "Take one claim per reading session and test it against something you already know well — your industry, your city, your family history. The reflection prompts in each summary are designed to force that comparison rather than let the ideas stay abstract.",
        ],
      },
    ],
    picks: [
      { slug: "sapiens", label: "Sapiens", note: "How shared fictions let strangers cooperate at scale." },
      { slug: "1984-orwell-en", label: "1984", note: "Language, surveillance and the mechanics of political control." },
      { slug: "animal-farm-orwell-en", label: "Animal Farm", note: "How revolutions turn into the thing they replaced." },
      { slug: "godan", label: "गोदान", note: "Rural India, debt and dignity in Premchand's masterwork." },
    ],
    faqs: [
      { q: "Is Sapiens a good introduction to history?", a: "It is a good introduction to thinking about history at scale. Pair it with more specialised books and with fiction from the periods you care about." },
    ],
    related: [
      { path: "/category/classic-literature", label: "Classic literature summaries" },
      { path: "/category/philosophy", label: "Philosophy book summaries" },
      ...RESOURCES,
    ],
  },

  productivity: {
    h1: "Productivity Book Summaries",
    title: "Productivity Book Summaries — Focus, Systems & Deep Work",
    description:
      "Productivity book summaries on focus, prioritisation and systems — Deep Work, Essentialism, Getting Things Done and The ONE Thing, with 7-day action plans.",
    lead:
      "Productivity is not about doing more. Every serious book in this category argues the opposite: protect attention, remove obligations, and finish fewer things properly.",
    sections: [
      {
        h2: "Attention is the real constraint",
        body: [
          "Cal Newport's Deep Work makes the strongest version of the argument — the ability to concentrate without distraction is becoming rare at exactly the moment it becomes most valuable. Greg McKeown's Essentialism attacks the same problem from the other side, by removing commitments rather than adding discipline. Gary Keller's The ONE Thing narrows the day to a single question worth answering.",
          "David Allen's Getting Things Done is the odd one out and still the most operationally useful: capture everything, clarify the next physical action, review weekly. Most people who feel overwhelmed do not need motivation; they need a trusted list.",
        ],
      },
      {
        h2: "Building a system that survives a bad week",
        body: [
          "A productivity system is only real if it works when you are tired, ill or travelling. That means fewer moving parts: one capture inbox, one calendar, one weekly review, and a defined shutdown at the end of the day. Anything more elaborate becomes another job.",
          "Start with the shutdown routine and the weekly review. They are unglamorous and they produce most of the benefit.",
        ],
      },
      {
        h2: "A practical seven-day experiment",
        body: [
          "Block ninety minutes of deep work each morning, phone in another room. Write the single most important task the night before. Review your list once, on Sunday. Track it with the free 7-day tracker and note where the block broke. Almost everyone finds the same culprit twice — that is your real productivity problem.",
        ],
      },
    ],
    picks: [
      { slug: "deep-work", label: "Deep Work", note: "Why concentrated effort is now a competitive advantage." },
      { slug: "essentialism", label: "Essentialism", note: "The disciplined pursuit of less, but better." },
      { slug: "getting-things-done", label: "Getting Things Done", note: "Capture, clarify, review — the classic operating system." },
      { slug: "the-one-thing", label: "The ONE Thing", note: "The focusing question that orders an entire day." },
      { slug: "atomic-habits", label: "Atomic Habits", note: "The habit layer that keeps any system running." },
    ],
    faqs: [
      { q: "Which productivity book should I read first?", a: "Deep Work if focus is your problem, Getting Things Done if overwhelm is, and Essentialism if you simply have too many commitments." },
      { q: "Do I need an app to apply these?", a: "No. A notebook and a calendar are enough for every system described in these books." },
    ],
    related: [
      { path: "/category/self-help", label: "Self-help book summaries" },
      { path: "/english", label: "English book summaries hub" },
      ...RESOURCES,
    ],
  },

  finance: {
    h1: "Finance Book Summaries",
    title: "Finance Book Summaries — Money, Investing & Wealth Habits",
    description:
      "Personal finance book summaries on money mindset, saving, investing and financial independence — including Rich Dad Poor Dad and The Richest Man in Babylon.",
    lead:
      "Money books argue about strategy but agree on the boring part: spend less than you earn, protect the gap, and let time do the compounding. These summaries keep the useful mechanics and flag the hype.",
    sections: [
      {
        h2: "Mindset first, mechanics second",
        body: [
          "Robert Kiyosaki's Rich Dad Poor Dad is popular because it reframes assets and liabilities in language anyone can act on, and it is criticised because its specifics are thin. Both things are true, and we say so. The Richest Man in Babylon covers the same fundamentals through parables — pay yourself first, guard your capital, seek advice from people who actually do the thing.",
          "What survives from every serious finance book: an emergency fund, low-cost diversified investing, insurance before speculation, and patience measured in decades.",
        ],
      },
      {
        h2: "Reading finance books in an Indian context",
        body: [
          "Most bestsellers assume a US tax and retirement system. The principles transfer; the instruments do not. When you read about index funds, retirement accounts or property leverage, translate the vehicle into its local equivalent and check current rules before acting. Our summaries flag where a book's advice is context-specific rather than universal.",
          "Nothing here is financial advice. It is a map of what the books argue, so you can ask better questions of a qualified adviser.",
        ],
      },
      {
        h2: "A first month of action",
        body: [
          "Track every rupee or dollar for thirty days, automate one transfer to savings on payday, and write down your actual monthly number for essentials. Almost every reader is surprised by that figure — and it is the foundation for everything else these books recommend.",
        ],
      },
    ],
    picks: [
      { slug: "rich-dad-poor-dad", label: "Rich Dad Poor Dad", note: "Assets, liabilities and financial literacy — with honest caveats." },
      { slug: "the-richest-man-in-babylon-en", label: "The Richest Man in Babylon", note: "Pay yourself first, and other durable money habits." },
      { slug: "the-science-of-getting-rich-en", label: "The Science of Getting Rich", note: "The classic that shaped modern prosperity writing." },
      { slug: "freakonomics", label: "Freakonomics", note: "Incentives as the hidden engine behind economic behaviour." },
    ],
    faqs: [
      { q: "Is Rich Dad Poor Dad still worth reading?", a: "As a mindset primer, yes — it changes how many people see assets and income. Treat the specific investment advice with caution and verify anything against local rules." },
      { q: "Do these summaries give investment advice?", a: "No. They explain what each author argues. Financial decisions should be checked with a qualified adviser in your own country." },
    ],
    related: [
      { path: "/category/business", label: "Business book summaries" },
      { path: "/category/psychology", label: "Psychology book summaries" },
      ...RESOURCES,
    ],
  },

  "hindi-literature": {
    h1: "हिंदी साहित्य के सारांश — Hindi Literature Book Summaries",
    title: "Hindi Literature Summaries — Premchand, Kamayani & More",
    description:
      "हिंदी साहित्य की श्रेष्ठ कृतियों के सारांश — गोदान, गबन, निर्मला, कामायनी और मैला आँचल — मुख्य विचार, विश्लेषण और चिंतन प्रश्नों के साथ।",
    lead:
      "हिंदी साहित्य केवल कहानियाँ नहीं है — यह भारतीय समाज का सबसे ईमानदार रिकॉर्ड है। इन सारांशों में कथानक, पात्र, सामाजिक संदर्भ और आज के जीवन से जुड़ी सीख — सब एक जगह।",
    sections: [
      {
        h2: "प्रेमचंद और यथार्थवाद की परंपरा",
        body: [
          "गोदान में होरी का क़र्ज़, गबन में मध्यवर्गीय दिखावे का दबाव और निर्मला में स्त्री की परतंत्रता — प्रेमचंद ने भारतीय समाज की उन परतों को खोला जिन्हें आज भी देखना असहज लगता है। इनका महत्व केवल ऐतिहासिक नहीं है; क़र्ज़, सामाजिक दिखावा और असमान विवाह आज भी उतने ही जीवित प्रश्न हैं।",
          "हमारे सारांश कथानक को संक्षेप में रखते हैं और विश्लेषण पर ज़ोर देते हैं — पात्रों की प्रेरणा, सामाजिक संरचना, और लेखक की दृष्टि।",
        ],
      },
      {
        h2: "काव्य और आँचलिक उपन्यास",
        body: [
          "जयशंकर प्रसाद की कामायनी मानव मन की यात्रा को मिथक के रूप में कहती है — श्रद्धा, इड़ा और मनु के प्रतीकों के साथ। फणीश्वरनाथ रेणु का मैला आँचल आँचलिक उपन्यास की शुरुआत है, जिसमें एक गाँव ही मुख्य पात्र बन जाता है।",
          "ये कृतियाँ विद्यार्थियों के लिए परीक्षा-उपयोगी हैं और सामान्य पाठक के लिए भी — क्योंकि इनमें भाषा, समाज और मनोविज्ञान एक साथ चलते हैं।",
        ],
      },
      {
        h2: "पढ़ने का सही तरीक़ा",
        body: [
          "पहले सारांश पढ़िए, फिर मूल पुस्तक के दो-तीन अध्याय — इससे भाषा का स्वाद भी मिलेगा और संदर्भ भी स्पष्ट रहेगा। हर सारांश के साथ चिंतन प्रश्न दिए गए हैं जो कक्षा-चर्चा या व्यक्तिगत नोट्स के लिए उपयोगी हैं।",
        ],
      },
    ],
    picks: [
      { slug: "godan", label: "गोदान", note: "प्रेमचंद का महाकाव्यात्मक उपन्यास — किसान, क़र्ज़ और सम्मान।" },
      { slug: "gaban", label: "गबन", note: "मध्यवर्गीय दिखावे और नैतिक फिसलन की कहानी।" },
      { slug: "nirmala", label: "निर्मला", note: "अनमेल विवाह और स्त्री-जीवन का मार्मिक चित्रण।" },
      { slug: "kamayani", label: "कामायनी", note: "जयशंकर प्रसाद का दार्शनिक महाकाव्य।" },
      { slug: "maila-anchal", label: "मैला आँचल", note: "रेणु का आँचलिक उपन्यास — गाँव ही नायक।" },
    ],
    faqs: [
      { q: "क्या ये सारांश विद्यार्थियों के लिए उपयोगी हैं?", a: "हाँ। हर सारांश में कथानक, पात्र-विश्लेषण, विषयवस्तु और चिंतन प्रश्न शामिल हैं, जो कक्षा और परीक्षा दोनों में सहायक हैं।" },
      { q: "क्या मूल पुस्तक पढ़ना ज़रूरी है?", a: "सारांश समझ के लिए पर्याप्त है, लेकिन भाषा और शैली का असली आनंद मूल पुस्तक में ही है — हम मूल संस्करण पढ़ने की सलाह देते हैं।" },
    ],
    related: [
      { path: "/best-hindi-book-summaries", label: "Best Hindi book summaries" },
      { path: "/hindi", label: "हिंदी लाइब्रेरी" },
      { path: "/resources/best-hindi-book-summaries-guide", label: "Hindi summaries guide" },
    ],
  },

  "classic-literature": {
    h1: "Classic Literature Summaries",
    title: "Classic Literature Summaries — Orwell, Shakespeare & More",
    description:
      "Classic literature summaries with themes, characters and analysis — 1984, Animal Farm, Hamlet, Macbeth and Romeo and Juliet, written for students and readers.",
    lead:
      "Classics survive because they keep answering new questions. These summaries give you plot, characters, themes and critical context — enough to think and write about the work, not just recognise it.",
    sections: [
      {
        h2: "Why the classics still get assigned",
        body: [
          "Orwell's 1984 gave us a vocabulary for surveillance and political language that journalists still reach for every week. Animal Farm compresses the logic of revolution and betrayal into a fable short enough to read in an evening. Shakespeare's tragedies remain the sharpest studies of ambition, indecision and self-deception in English.",
          "Each of these works rewards a second pass. A summary is a good first pass: it fixes the structure in your mind so the language can do its work when you read the original.",
        ],
      },
      {
        h2: "For students and self-directed readers",
        body: [
          "Our classic summaries follow a consistent shape — context, plot in brief, principal characters, major themes, key passages and critical perspectives. That structure is deliberately close to what an essay or exam answer needs, without writing the essay for you.",
          "We also flag the honest difficulties: archaic language, uncomfortable politics, and the parts modern readers usually find slow.",
        ],
      },
      {
        h2: "Pair classics with history",
        body: [
          "Reading 1984 alongside a big-picture history such as Sapiens is unusually productive: one shows the mechanism of collective belief, the other shows what happens when it is captured. Our history collection is a natural next stop.",
        ],
      },
    ],
    picks: [
      { slug: "1984-orwell-en", label: "1984", note: "Surveillance, language and the architecture of control." },
      { slug: "animal-farm-orwell-en", label: "Animal Farm", note: "A fable about power and the corruption of ideals." },
      { slug: "hamlet-shakespeare-en", label: "Hamlet", note: "Indecision, grief and moral paralysis." },
      { slug: "macbeth-shakespeare-en", label: "Macbeth", note: "Ambition, guilt and self-destruction." },
      { slug: "romeo-and-juliet-en", label: "Romeo and Juliet", note: "Love, feud and the speed of tragedy." },
    ],
    faqs: [
      { q: "Are these summaries suitable for exam preparation?", a: "Yes. Each includes plot, characters, themes and critical perspectives, structured close to what essay questions ask for." },
      { q: "Should I still read the original text?", a: "Yes, wherever you can. Use the summary to hold the structure in mind, then read the original for language and detail." },
    ],
    related: [
      { path: "/category/history", label: "History book summaries" },
      { path: "/english", label: "English book summaries hub" },
      ...RESOURCES,
    ],
  },
};

/** Aliases: URL slug → content key, for DB categories that differ in wording. */
export const CATEGORY_ALIASES: Record<string, string> = {
  spiritual: "spirituality",
  "classic-novel": "classic-literature",
  classic: "classic-literature",
  economics: "finance",
};

export const getCategoryContent = (slug: string): CategoryContent | undefined =>
  CATEGORY_CONTENT[slug] ?? CATEGORY_CONTENT[CATEGORY_ALIASES[slug] ?? ""];
