"""Build 8-branch mind-map content from book fields. No invented plot facts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from genres import is_fiction, resolve_genre
import hindi_copy as hi

BOILERPLATE = re.compile(r"^(here (is|are)|in this (section|chapter|summary)|welcome|today we)", re.I)


def _text(value: object) -> str:
    return value.replace("\\n", "\n") if isinstance(value, str) else ""


def strip_md(s: str) -> str:
    s = _text(s)
    s = re.sub(r"```[\s\S]*?```", " ", s)
    s = re.sub(r"`([^`]*)`", r"\1", s)
    s = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.M)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"__([^_]+)__", r"\1", s)
    s = re.sub(r"\*([^*\n]+)\*", r"\1", s)
    s = re.sub(r"^>\s?", "", s, flags=re.M)
    return re.sub(r"[ \t]+", " ", s).strip()


def words(s: str) -> list[str]:
    return [w for w in s.split() if w]


def norm_key(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\u0900-\u097f ]+", " ", s.lower())).strip()


def shorten(s: str, max_words: int = 12) -> str:
    w = words(strip_md(s).rstrip(".:;"))
    if len(w) <= max_words:
        return " ".join(w)
    return " ".join(w[:max_words]) + "…"


def split_sentences(raw: str) -> list[str]:
    clean = re.sub(r"\s+", " ", strip_md(raw)).strip()
    if not clean:
        return []
    parts = re.split(r"(?<=[.!?।])\s+", clean)
    out = []
    for s in parts:
        s = re.sub(r"[.।]+$", "", s).strip()
        n = len(words(s))
        if 5 <= n <= 42 and not BOILERPLATE.search(s):
            out.append(s)
    return out


def bullets(raw: str) -> list[str]:
    out = []
    for line in _text(raw).splitlines():
        m = re.match(r"^\s*(?:[-*•◦▪]|(?:\d{1,2}[.)]))\s+(.+?)\s*$", line)
        if not m:
            continue
        clean = strip_md(m.group(1))
        if 2 <= len(words(clean)) <= 40 and len(clean) <= 320:
            out.append(clean)
    return dedupe(out)


def headings(raw: str) -> list[str]:
    out = []
    for line in _text(raw).splitlines():
        m = re.match(r"^\s*#{2,4}\s+(.+?)\s*$", line) or re.match(r"^\s*\*\*([^*\n]{3,90})\*\*\s*$", line)
        if not m:
            continue
        clean = strip_md(m.group(1)).rstrip(":.")
        n = len(words(clean))
        if 2 <= n <= 12:
            out.append(clean)
    return dedupe(out)


def dedupe(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        key = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\u0900-\u097f ]+", " ", line.lower())).strip()[:80]
        if not key or len(key) < 8 or key in seen:
            continue
        seen.add(key)
        out.append(line.strip())
    return out


def best_sentences(text: str, count: int, min_words: int = 6) -> list[str]:
    scored = []
    for s in split_sentences(text):
        n = len(words(s))
        if n < min_words or n > 30:
            continue
        score = 12 - abs(n - 16) * 0.5
        if re.search(r"\b(you|your)\b", s, re.I):
            score += 1.5
        if re.search(r"\b(because|therefore|means|creates|builds)\b", s, re.I):
            score += 2
        scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:count]]


@dataclass
class Node:
    label: str
    detail: str = ""
    tag: str = ""
    step: str = ""


@dataclass
class Branch:
    id: str
    title: str
    question: str
    nodes: list[Node] = field(default_factory=list)
    callout_title: str = ""
    callout_text: str = ""


@dataclass
class Mindmap:
    title: str
    author: str
    category: str
    genre_key: str
    fiction: bool
    one_liner: str
    why_it_matters: str
    branches: list[Branch]
    takeaways: list[str]
    best: str
    lang: str = "en"


CONCEPT_LENSES = {
    "business": ["Value creation before capture", "Moats and unfair advantage", "Unit economics that work", "Distribution beats product", "Capital allocation over time"],
    "psychology": ["Fast intuition vs slow reason", "Biases that distort judgment", "Incentives drive behavior", "Stories stick more than stats", "Environment shapes choice"],
    "selfhelp": ["Identity precedes behavior", "Systems beat goals", "Attention is scarce", "Friction decides follow-through", "Review loops compound growth"],
    "mystery": ["Every clue cuts both ways", "Motive hides in routine", "Timing reveals the truth", "Nothing is only what it seems", "The least likely pressure point"],
    "romance": ["Vulnerability before trust", "Timing and missed chances", "Love as daily practice", "The rival is usually fear", "Choosing each other again"],
    "fantasy": ["Power always demands a price", "Maps of the world and soul", "Prophecy vs free will", "Allies carry the quest", "The return changes home"],
    "scifi": ["Technology amplifies intent", "The future tests today's ethics", "Systems fail at the edges", "Adaptation beats prediction", "What it means to be human"],
    "history": ["Incentives move empires", "Geography shapes destiny", "Ideas outlive armies", "Crises reveal character", "Patterns rhyme across centuries"],
    "biography": ["Early constraints forge craft", "One defining bet", "Mentors accelerate mastery", "Setbacks become curriculum", "Legacy is built daily"],
    "philosophy": ["Control judgment, not outcome", "Question the unexamined want", "Meaning is made, not found", "Attention shapes reality", "Death clarifies priorities"],
    "productivity": ["One priority at a time", "Capture everything, decide fast", "Deep work in guarded blocks", "Energy before hours", "Weekly review keeps truth"],
    "leadership": ["Clarity multiplies teams", "Decide with incomplete data", "Culture is repeated behavior", "Feedback is a gift system", "Serve the mission first"],
    "default": ["The central tension", "The reframe", "The method", "The test", "The payoff"],
}

THEME_LENSES = {
    "business": ["Ambition vs sustainability", "Risk and reward", "Craft vs scale"],
    "psychology": ["Reason vs emotion", "Self vs story", "Control vs acceptance"],
    "selfhelp": ["Comfort vs growth", "Identity vs habit", "Now vs later"],
    "mystery": ["Truth vs deception", "Justice vs law", "Guilt vs innocence"],
    "romance": ["Independence vs intimacy", "Passion vs commitment", "Fate vs choice"],
    "fantasy": ["Power vs responsibility", "Destiny vs will", "Light vs shadow"],
    "scifi": ["Progress vs wisdom", "Human vs machine", "Freedom vs safety"],
    "history": ["Power vs people", "Continuity vs change", "Memory vs myth"],
    "biography": ["Talent vs grit", "Fame vs craft", "Self vs service"],
    "philosophy": ["Being vs becoming", "Knowledge vs wisdom", "Self vs world"],
    "productivity": ["Busy vs effective", "More vs essential", "Speed vs depth"],
    "leadership": ["Authority vs trust", "Vision vs execution", "Self vs team"],
    "default": ["Change vs continuity", "Individual vs collective", "Ideal vs real"],
}


def _push(nodes: list[Node], seen: set[str], label: str, **kw: str) -> None:
    clean = shorten(label, 10 if kw.get("detail") else 12)
    key = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\u0900-\u097f ]+", " ", clean.lower())).strip()[:60]
    if not clean or not key or key in seen or len(words(clean)) < 1:
        return
    seen.add(key)
    nodes.append(Node(label=clean, **kw))


def build_mindmap(book: dict) -> Mindmap:
    title = (book.get("title") or "Untitled").strip()
    author = (book.get("author") or "Unknown").strip()
    category = (book.get("category") or "General").strip()
    lang = "hi" if str(book.get("lang") or "en").lower().startswith("hi") else "en"
    genre = resolve_genre(category)
    fiction = is_fiction(category)

    overview = _text(book.get("overview"))
    key_ideas = _text(book.get("key_ideas"))
    deep_summary = _text(book.get("deep_summary"))
    deep_analysis = _text(book.get("deep_analysis"))
    daily = _text(book.get("daily_application"))
    action = _text(book.get("action_system"))
    example = _text(book.get("real_life_example"))
    tagline = strip_md(_text(book.get("tagline")))

    overview_best = best_sentences(overview, 3)
    if lang == "hi":
        one = tagline if 4 <= len(words(tagline)) <= 30 else (
            overview_best[0] if overview_best else f"{title} — {author} के केंद्रीय विचार, एक मानचित्र में।"
        )
        why = next((s for s in best_sentences(f"{overview}\n{daily}", 6)), None)
        why = shorten(why or (overview_best[1] if len(overview_best) > 1 else f"{title} को मिनटों में समझें — आज एक विचार अपनाएँ।"), 26)
    else:
        one = tagline if 4 <= len(words(tagline)) <= 30 else (overview_best[0] if overview_best else f"{title} by {author} — the essential ideas, mapped.")
        why = next((s for s in best_sentences(f"{overview}\n{daily}", 6) if re.search(r"\b(you|your|life|work|daily|decision)\b", s, re.I)), None)
        why = shorten(why or (overview_best[1] if len(overview_best) > 1 else f"Understand {title} in minutes — then apply one idea today."), 26)

    branches = [
        _core(title, author, tagline, overview_best, overview, deep_analysis, key_ideas, lang),
        _concepts(key_ideas, deep_analysis, genre, lang),
        _story(deep_summary, deep_analysis, fiction, lang),
        _people(author, category, deep_analysis, key_ideas, fiction, lang),
        _themes(key_ideas, deep_analysis, overview, genre, lang),
        _lessons(title, daily, action, key_ideas, lang),
        _apply(title, action, daily, example, lang),
        _moments(deep_summary, deep_analysis, fiction, lang),
    ]

    pool = dedupe(bullets(key_ideas)[:6] + best_sentences(overview, 4) + best_sentences(key_ideas, 6) + best_sentences(daily, 4))
    takeaways = [shorten(s, 18) for s in pool if 6 <= len(words(s)) <= 30][:5]
    if lang == "hi":
        fillers = [s.format(title=title) for s in hi.TAKEAWAY_FILLERS]
    else:
        fillers = [
            f"The core argument of {title} in one reread",
            "One concept worth explaining to a friend",
            "One story that makes the idea stick",
            "One lesson to apply this week",
            "One question to keep asking",
        ]
    while len(takeaways) < 5:
        takeaways.append(fillers[len(takeaways)])

    return Mindmap(
        title=title,
        author=author,
        category=category,
        genre_key=genre,
        fiction=fiction,
        one_liner=one[0].upper() + one[1:] if one else title,
        why_it_matters=why[0].upper() + why[1:] if why else why,
        branches=branches,
        takeaways=takeaways,
        best=takeaways[0],
        lang=lang,
    )


def _core(title, author, tagline, overview_best, overview, analysis, key_ideas, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    main = tagline if len(words(tagline)) >= 4 else (overview_best[0] if overview_best else "")
    if main:
        _push(nodes, seen, main, tag="Main message")
    problem = next((s for s in split_sentences(overview) + best_sentences(analysis, 4) if re.search(r"problem|struggle|challenge|fear|failure|trap|stuck|distract|shallow|poor|pain|समस्या|संघर्ष|भय|व्यथा", s, re.I)), "")
    if problem:
        _push(nodes, seen, problem, tag="Central problem")
    for s in overview_best:
        if len(nodes) >= 3:
            break
        if s != main:
            _push(nodes, seen, s, tag="Ultimate teaching" if len(nodes) == 1 else "")
    for line in bullets(key_ideas):
        if len(nodes) >= 3:
            break
        _push(nodes, seen, line)
    if not nodes:
        if lang == "hi":
            for label, tag in [
                (f"{author} सबसे अधिक क्या समझाना चाहते हैं", "मुख्य संदेश"),
                ("यह पुस्तक पाठक की कौन-सी समस्या सुलझाती है", "केंद्रीय समस्या"),
                ("रोज़मर्रा में ले जाने वाला एक बदलाव", "अंतिम शिक्षा"),
            ]:
                _push(nodes, seen, label, tag=tag)
        else:
            for label, tag in [
                (f"What {author} most wants you to understand", "Main message"),
                ("The problem this book solves for its reader", "Central problem"),
                ("The one shift to carry into daily life", "Ultimate teaching"),
            ]:
                _push(nodes, seen, label, tag=tag)
    why = overview_best[0] if overview_best else (main or (f"पहले यह पढ़ें — {title} का ढाँचा यहीं है।" if lang == "hi" else f"Read this first — it frames {title}."))
    if lang == "hi":
        t, q, c = hi.BRANCH["core"]
        return Branch("core", t, q, nodes[:4], c, shorten(why, 22))
    return Branch("core", "Core Idea", "What is this book really about?", nodes[:4], "Why It Matters", shorten(why, 22))


def _concepts(key_ideas, analysis, genre, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    for line in bullets(key_ideas) + bullets(analysis):
        if len(nodes) >= 6:
            break
        pair = re.match(r"^(.{3,70}?)\s*[—–:]\s*(.{12,200})$", line)
        if pair:
            _push(nodes, seen, pair.group(1), detail=shorten(pair.group(2), 18))
        elif len(words(line)) <= 16:
            _push(nodes, seen, line)
    for h in headings(key_ideas):
        if len(nodes) >= 6:
            break
        _push(nodes, seen, h)
    for s in best_sentences(analysis, 6):
        if len(nodes) >= 5:
            break
        _push(nodes, seen, s)
    lenses = hi.CONCEPT_LENSES if lang == "hi" else CONCEPT_LENSES
    for lens in lenses.get(genre, lenses["default"]):
        if len(nodes) >= 5:
            break
        _push(nodes, seen, lens)
    top = nodes[0].detail or nodes[0].label if nodes else ""
    if lang == "hi":
        t, q, c = hi.BRANCH["concepts"]
        return Branch("concepts", t, q, nodes[:6], c, shorten(top, 22))
    return Branch("concepts", "Key Concepts", "What are the big ideas?", nodes[:6], "Key Insight", shorten(top, 22))


def _story(summary, analysis, fiction, lang="en") -> Branch:
    if lang == "hi":
        steps = hi.STORY_STEPS_F if fiction else hi.STORY_STEPS_N
        fallback = hi.STORY_FALLBACK_F if fiction else hi.STORY_FALLBACK_N
        text = hi.CONNECTION_F if fiction else hi.CONNECTION_N
    else:
        steps = ("Beginning", "Development", "Turning point", "Climax", "Resolution") if fiction else ("Starting point", "Core framework", "Evidence", "Method", "Payoff")
        fallback = (
            ["A world and want are established", "Pressure rises through choices", "One decision changes everything", "The truth is faced at full cost", "A new balance — changed or broken"]
            if fiction
            else ["The problem is named clearly", "A framework reframes the problem", "Stories and evidence make it stick", "A method turns insight into action", "The payoff compounds over time"]
        )
        text = "Follow the chain: want → obstacle → choice → consequence." if fiction else "Follow the chain: problem → principle → practice → payoff."
    sentences = dedupe(split_sentences(summary) + best_sentences(analysis, 6))
    nodes: list[Node] = []
    if len(sentences) >= 3:
        per = max(1, len(sentences) // len(steps))
        for i, step in enumerate(steps):
            pick = sentences[min(len(sentences) - 1, i * per)]
            nodes.append(Node(label=shorten(pick), step=step))
    else:
        for step, label in zip(steps, fallback):
            nodes.append(Node(label=label, step=step))
    if lang == "hi":
        t, q, c = hi.BRANCH["story_f" if fiction else "story_n"]
        return Branch("story", t, q, nodes[:5], c, text)
    return Branch("story", "Story Arc" if fiction else "Structure", "How does it unfold?" if fiction else "How is the argument built?", nodes[:5], "Connection", text)


def _people(author, category, analysis, key_ideas, fiction, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    bio = bool(re.search(r"biograph|memoir|जीवनी|आत्मकथा", category or "", re.I))
    if lang == "hi":
        if fiction:
            lenses = hi.PEOPLE_F
        elif bio:
            lenses = [(a.format(author=author), b) for a, b in hi.PEOPLE_B]
        else:
            lenses = [(a.format(author=author), b) for a, b in hi.PEOPLE_N]
        insight = hi.PEOPLE_INSIGHT
    else:
        if fiction:
            lenses = [
                ("The protagonist", "Track what they want — and what it costs."),
                ("The key relationship", "Most change happens between two people."),
                ("The opposing force", "Name what stands in the way."),
                ("Who changes most", "The arc of change is the meaning."),
            ]
        elif bio:
            lenses = [
                (author, "Whose life is the evidence for every lesson."),
                ("Mentors and allies", "Notice who guided the key decisions."),
                ("Rivals and critics", "Opposition sharpens the real principles."),
                ("The era", "Context explains which bets were brave."),
            ]
        else:
            lenses = [
                (author, "The guide — follow their core argument first."),
                ("Thinkers cited", "Watch whose research backs each claim."),
                ("You, the reader", "Each idea asks one question back of you."),
                ("Case studies", "Real stories show the idea under pressure."),
            ]
        insight = "Trace one chain: person → motive → action → outcome."
    for label, detail in lenses:
        _push(nodes, seen, label, detail=detail)
    if lang == "hi":
        key = "people_f" if fiction else ("people_b" if bio else "people")
        t, q, c = hi.BRANCH[key]
        return Branch("people", t, q, nodes[:5], c, insight)
    title = "Characters" if fiction else ("People" if bio else "Thinkers")
    return Branch("people", title, "Who matters and why?", nodes[:5], "Key Insight", insight)


def _themes(key_ideas, analysis, overview, genre, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    for h in headings(key_ideas) + headings(analysis):
        if len(nodes) >= 5:
            break
        _push(nodes, seen, h)
    lenses = hi.THEME_LENSES if lang == "hi" else THEME_LENSES
    for lens in lenses.get(genre, lenses["default"]):
        if len(nodes) >= 5:
            break
        _push(nodes, seen, lens)
    keep = nodes[0].label if nodes else ("केंद्रीय तनाव" if lang == "hi" else "the central tension")
    if lang == "hi":
        t, q, c = hi.BRANCH["themes"]
        return Branch("themes", t, q, nodes[:5], c, f"एक विषय रखें: {shorten(keep, 10)}।")
    return Branch("themes", "Themes", "What deeper ideas run through it?", nodes[:5], "Remember This", f"If you keep one theme: {shorten(keep, 10)}.")


def _lessons(title, daily, action, key_ideas, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    for line in bullets(daily) + bullets(action) + bullets(key_ideas):
        if len(nodes) >= 6:
            break
        tag = "Avoid" if re.search(r"avoid|mistake|never |don't|trap|भूल|जाल|न करें", line, re.I) else ""
        _push(nodes, seen, line, tag=tag)
    for s in best_sentences(daily, 5) + best_sentences(key_ideas, 4):
        if len(nodes) >= 6:
            break
        _push(nodes, seen, s)
    if len(nodes) < 3:
        if lang == "hi":
            for label in hi.LESSON_FALLBACK:
                _push(nodes, seen, label, tag="Avoid" if "व्यर्थ" in label else "")
        else:
            for label, tag in [
                ("Small actions beat rare intensity", ""),
                ("Design the environment before willpower", ""),
                ("Measure one thing that truly matters", ""),
                ("Avoid consuming without applying", "Avoid"),
            ]:
                _push(nodes, seen, label, tag=tag)
    mistake = next((n for n in nodes if n.tag == "Avoid"), None)
    if lang == "hi":
        text = f"भूल से बचें: {shorten(mistake.label, 16)}" if mistake else f"इस सप्ताह {title} का एक पाठ जिएँ।"
        t, q, c = hi.BRANCH["lessons"]
        return Branch("lessons", t, q, nodes[:6], c, text)
    text = f"Mistake to avoid: {shorten(mistake.label, 16)}" if mistake else f"Live one lesson from {title} this week."
    return Branch("lessons", "Key Lessons", "What should you remember?", nodes[:6], "Remember This", text)


def _apply(title, action, daily, example, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    for line in bullets(action) + bullets(daily):
        if len(nodes) >= 6:
            break
        imperative = bool(re.match(r"^(write|pick|choose|define|track|review|practice|start|stop|schedule|ask|note|build|set|make|try|do|take|list|plan|लिखें|चुनें|करें|जोड़ें)\b", line.strip(), re.I))
        _push(nodes, seen, line, tag="Action" if imperative else "")
    for s in best_sentences(daily, 5):
        if len(nodes) >= 6:
            break
        _push(nodes, seen, s)
    if len(nodes) < 3:
        fallback = hi.APPLY_FALLBACK if lang == "hi" else [
            "Pick one idea to test for seven days",
            "Attach it to an existing daily cue",
            "Write a one-line evening review",
            "Use it in the next real decision",
        ]
        for label in fallback:
            _push(nodes, seen, label, tag="Action")
    ex = next((s for s in split_sentences(example) if len(words(s)) >= 8), "")
    if lang == "hi":
        t, q, c = hi.BRANCH["apply"]
        call = "उदाहरण" if ex else c
        text = shorten(ex, 22) if ex else f"आज: {title} का एक विचार किसी चल रहे निर्णय में लाएँ।"
        return Branch("apply", t, q, nodes[:6], call, text)
    return Branch(
        "apply",
        "Real-Life Application",
        "How do you use this tomorrow?",
        nodes[:6],
        "Example" if ex else "Action Step",
        shorten(ex, 22) if ex else f"Today: apply one idea from {title} to a decision you already face.",
    )


def _moments(summary, analysis, fiction, lang="en") -> Branch:
    nodes: list[Node] = []
    seen: set[str] = set()
    sentences = dedupe(split_sentences(summary) + split_sentences(analysis))
    turning = [s for s in sentences if re.search(r"\bbut |however|realiz|discover|reveal|turning|breakthrough|failed|decided|changed|truth\b|परंतु|किंतु|सच|मोड़", s, re.I)]
    for s in turning + sentences:
        if len(nodes) >= 5:
            break
        _push(nodes, seen, s)
    if len(nodes) < 3:
        if lang == "hi":
            fallback = hi.MOMENT_FALLBACK_F if fiction else hi.MOMENT_FALLBACK_N
        else:
            fallback = (
                ["The moment the want becomes urgent", "The choice that cannot be undone", "The revelation that reframes everything", "The final cost — and what it buys"]
                if fiction
                else ["The reframe that changes the question", "The evidence that makes it undeniable", "The method that makes it usable", "The result that compounds over time"]
            )
        for label in fallback:
            _push(nodes, seen, label)
    if lang == "hi":
        t, q, c = hi.BRANCH["moments_f" if fiction else "moments_n"]
        text = hi.MOMENT_F if fiction else hi.MOMENT_N
        return Branch("moments", t, q, nodes[:5], c, text)
    return Branch(
        "moments",
        "Key Moments" if fiction else "Key Insights",
        "What changes everything?" if fiction else "What are the breakthroughs?",
        nodes[:5],
        "Connection",
        "Each moment links back: event → choice → theme." if fiction else "Each insight links forward: idea → example → application.",
    )
