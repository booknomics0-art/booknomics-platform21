import { DocPage } from "@/components/DocPage";
import { Sparkles, BookOpen, Compass, Heart, Target, AlertTriangle, Layers, Globe } from "lucide-react";

const values = [
  { icon: BookOpen, title: "Quality over quantity", body: "A focused library, chosen with care. Every public title should earn its place through usefulness and quality." },
  { icon: Globe, title: "Bilingual accessibility", body: "Every summary in English & Hindi — ideas should travel across languages." },
  { icon: Target, title: "Practical growth", body: "Every book ships with an action plan, habit tracker, and reflection prompts." },
  { icon: Heart, title: "Read with reverence", body: "A great book deserves a quiet room. We try to provide one." },
];

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Booknomics",
  url: "https://booknomics.com",
  logo: "https://booknomics.com/placeholder.svg",
  description: "Booknomics turns the world's best non-fiction into structured, bilingual action plans.",
};

const About = () => (
  <DocPage
    eyebrow="Our story"
    title="A quiet library for restless minds."
    intro="Booknomics is a deliberate project: a small library of the world's most transformative non-fiction books — structured for action, not just consumption."
    sections={[
      {
        id: "mission",
        title: "Our Mission",
        body: (
          <>
            <p>
              We exist to turn <strong>reading into life-transformation</strong>. Most people finish a great book and forget 90% within a week. We believe that's a failure of <em>format</em>, not memory.
            </p>
            <p>
              Booknomics rebuilds the book as a system: the core ideas, the deep analysis, the daily application, and the reflection prompts — all in one quiet, beautiful place. In English and in Hindi.
            </p>
          </>
        ),
      },
      {
        id: "problem",
        title: "The Problem",
        body: (
          <>
            <p>Most book summaries fail because they are <strong>passive consumption disguised as learning</strong>:</p>
            <ul>
              <li>Bullet-point dumps with no narrative</li>
              <li>No connection between idea and daily action</li>
              <li>No structure — every summary feels different</li>
              <li>Only available in English, leaving billions behind</li>
              <li>No reflection layer, so insights never compound</li>
            </ul>
            <p>You read, you nod, you forget. Nothing actually changes.</p>
          </>
        ),
      },
      {
        id: "solution",
        title: "The Booknomics Solution",
        body: (
          <>
            <p>Every book follows the same three-stage rhythm — the <strong>Read → Apply → Transform</strong> framework:</p>
            <ol>
              <li><strong>Read</strong> — Overview, Key Ideas, and Deep Analysis written with editorial care.</li>
              <li><strong>Apply</strong> — A daily action plan, habit tracker, and one-page action system.</li>
              <li><strong>Transform</strong> — Reflection notes, milestones, and a personal growth dashboard.</li>
            </ol>
            <p>
              Same structure, every book. The shape of the experience is the promise. Open any summary and you'll know exactly where to find what you came for — and what to do with it tomorrow morning.
            </p>
          </>
        ),
      },
      {
        id: "values",
        title: "Our Values",
        body: (
          <div className="not-prose grid sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.title} className="bg-card border border-border rounded-xl p-5 shadow-paper">
                <div className="bg-gold h-10 w-10 rounded-lg grid place-items-center mb-3">
                  <v.icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <h3 className="font-serif text-lg font-bold mb-1">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "promise",
        title: "Our Promise",
        body: (
          <>
            <p>
              No intrusive pop-ups or social bars. No infinite scroll. No noise. Every summary is built to be applied — not just read.
            </p>
            <p>
              If you finish a book on Booknomics and your week looks the same, we've failed at our job.
            </p>
          </>
        ),
      },
    ]}
    seo={{
      title: "About Booknomics — Turning reading into transformation",
      description: "Booknomics curates structured, bilingual book summaries with action plans, habit trackers, and reflection prompts. Read → Apply → Transform.",
      path: "/about",
      jsonLd: orgLd,
    }}
  />
);

export default About;
