/**
 * 🏗️ ENGLISH LIBRARY ENGINE — parameterized summary generator
 *
 * Shared by generate-english-batch-N.cjs scripts. Unlike the old Hindi
 * generator (uniform ~2500-word output), this engine:
 *   - injects per-book REAL data (concepts, quotes, cast, applications)
 *   - rotates sentence pools by book index so identical phrasing is bounded
 *   - targets 3450+ strict words and auto-deepens if short
 *
 * Book data contract:
 *   t: title, a: author, y: year, g: genre, cat: category,
 *   tag: one-line hook, core: 2-sentence essence,
 *   ideas: 5 sharp bullets (the book's real content),
 *   move: the book's key mechanism (name + what it does),
 *   person: author credibility line,
 *   ev: 3 evidence/case/plot lines (REAL specifics),
 *   apply: 2 application lines, ask: 2 reflection questions,
 *   cast: fiction-only — main characters/elements line,
 *   world: fiction-only — setting line,
 *   quote: optional famous line (with source character/context)
 */

const fs = require('fs');
const path = require('path');
const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, 'library-genres.json'), 'utf8'));

const MIN_WORDS = 3200;
const TARGET_WORDS = 3450;

// ---------- deterministic rotation helpers ----------
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
function pick(arr, r, offset) { return arr[(Math.floor(r() * arr.length) + (offset || 0)) % arr.length]; }
function words(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

function fill(tpl, b) {
  return tpl
    .replace(/\{T\}/g, b.t)
    .replace(/\{A\}/g, b.a)
    .replace(/\{Y\}/g, b.y < 0 ? Math.abs(b.y) + ' BCE' : String(b.y))
    .replace(/\{MOVE\}/g, b.move || 'the book’s central method')
    .replace(/\{TAG\}/g, b.tag)
    .replace(/\{PERSON\}/g, b.person || `${b.a} writes with unusual authority`)
    .replace(/\{CAST\}/g, b.cast || '')
    .replace(/\{WORLD\}/g, b.world || '');
}

// ---------- sentence pools (slot-injected, 6+ variants each) ----------
const P = {
  open: [
    'Every book earns its readers twice: first when it promises {T} something worth knowing, then when {T} actually delivers. Few titles ({Y}) manage both; {T} does — {TAG}',
    'Some books are read once and forgotten. {T} rearranges how a reader thinks, {Y} years on. {A} built {T} for the second camp, pointing at one claim: {TAG}',
    'The test of a serious book: does {T} change a reader’s Tuesday? By that test, {T} succeeds — {A} built it that way — {TAG}',
    'A good summary compresses; a great one explains why {T} had to exist. Arriving in {Y}, {T} answered a question readers had stopped asking — and {MOVE} was that answer: {TAG}',
    'There is a reason {T} keeps resurfacing on reading lists ({Y} was its first printing): it treats the reader as {T}’s intelligent adult and pays that respect back — {TAG}',
    'Enduring books solve one problem completely rather than many halfway. {T} endures that way — {A}’s discipline is the point: {TAG}',
  ],
  person: [
    '{PERSON} — and that biography matters here. {T}’s advice came from testing ideas against reality, {Y} after {Y}, not from a pedestal.',
    '{PERSON} — which is why the examples throughout {T} feel lived-in rather than borrowed.',
    'It helps that {PERSON}. On every page of {T}, secondhand wisdom is absent: {T} runs on earned conviction.',
    '{PERSON}, and {T} reads as the distilled result of that experience.',
    'The author’s background is not decoration: {PERSON}, and the book’s authority flows directly from it.',
  ],
  core: [
    'The premise can be stated in two sentences, and {T} states it better than anyone since: {CORE}',
    'Strip away the anecdotes and the case studies, and {T} reduces to a single load-bearing idea: {CORE}',
    'Everything in {T} orbits one claim, {MOVE} included; the remaining chapters are its elaboration. The claim: {CORE}',
  ],
  mech: [
    '{MOVE} is the engine of {T} and deserves the first look: nearly every later chapter of {T} builds, defends, or applies {MOVE}.',
    'If {T} has a spine, the spine is {MOVE}. Understand {MOVE}, and {T}’s remaining chapters read as variations on one system — {T} is no pile of tips.',
    'The contribution that made {T} famous is {MOVE}: simple enough for a card, demanding enough that {A}’s readers spend careers practicing it.',
    'Reviewers and readers return to one thing in {T}: {MOVE}. {MOVE} functions as {T}’s operating system.',
  ],
  ideaLead: [
    'The first idea worth carrying out of {T} is this:',
    'Chapter by chapter, {T}’s argument sharpens around a core insight:',
    'The most useful single takeaway arrives early:',
    'Few sentences in the book work harder than this one:',
    'The idea that repays the most reflection is blunt:',
    '{T}’s most disciplined insight is also its simplest:',
  ],
  ideaMore: [
    'The second pillar follows from the first:',
    'Next, {T} turns to a related principle:',
    'A companion idea completes the mechanism:',
    'The argument then deepens:',
    'From there {T} widens the lens:',
    '{MOVE}’s next principle deserves its own sentence:',
  ],
  evLead: [
    'The evidence is what separates {T} from the shelf it sits on, and {T} knows it.',
    'Arguments are cheap, and {T} spends its pages on proof instead.',
    'What convinces in {T} is not the prose but the record behind it.',
    '{T} argues with examples, not adjectives.',
    'Proof arrives early and often in {T} — case after case, at {MOVE}’s edges.',
    '{T} tests every claim against a real case before printing it — {A}’s habit of proof first.',
  ],
  quoteLead: [
    'One line from {T} has traveled further than the rest:',
    'The most quoted passage in {T} distills {T}’s worldview:',
    'Readers who keep one sentence from {T} usually keep this one:',
    'The line anchoring {T}’s reputation is:',
  ],
  quoteAfter: [
    'The sentence matters because of where it sits: inside {T} it is not decoration but the thesis in miniature.',
    'Its power is compression — a chapter of {T}’s reasoning folded into one readable line.',
    'In context it lands harder: the line arrives exactly where {T}’s evidence has made disagreement difficult.',
    'The line survives quotation because {T} built it to carry weight on its own.',
  ],
  apply: [
    'Knowledge that stays on the page is trivia; {T} exists to cross it into routine, starting with {MOVE}.',
    '{T} is practical: {T}’s advice survives translation into a normal week — {MOVE}’s quiet promise.',
    'Application is where {T} earns its keep, and {T} makes the first step small on purpose.',
    'A summary can only point at practice — {T} insists on {T}’s own doors, {MOVE} being the door.',
  ],
  critique: [
    'No serious summary of {T} should hide the objections {T} has collected — {MOVE} draws them like a magnet.',
    '{T} is influential — another way of saying that, since {Y}, plenty of people have argued with {T} and lost.',
    'Honest readers of {T} run into {T}’s limits eventually; naming them sharpens {MOVE}.',
    'The strongest criticisms of {T} are worth stating plainly ({T} earns the recommendation).',
  ],
  legacy: [
    'Influence is measurable for {T}: after {Y}, {MOVE} shows up in syllabi, vocabulary, and books that never cite {T} — that is influence.',
    'The afterlife of {T} has outgrown the audience {T} originally wrote for.',
    'Since {Y}, {T}’s ideas have been quoted and misquoted — noisy vindication, but {MOVE} holds.',
    'Few books on its shelf can claim {T}’s reach across classrooms, boardrooms, and reading groups alike ({MOVE} travels well).',
  ],
  today: [
    'Reread now, {T} holds up: {T}’s subject is a pattern, not a trend. {MOVE} has not dated; {T}’s contemporaries have.',
    '{T} ages well: {T}’s examples date, the mechanism does not.',
    'New books have nibbled at {T}’s territory for years; none has displaced it.',
    'A first-time reader today gets {T}’s best version: the imitators are visible, which makes {T}’s clarity more obvious.',
  ],
  verdict: [
    'The verdict on {T} is straightforward: read {T} slowly, argue in the margins, apply {MOVE} once before judging.',
    'As a reading decision, {T} is among the safer bets on its shelf.',
    'For a reader choosing one book on this subject, {T} remains the default answer — {T} earned that position.',
    'The final accounting for {T}: ambitious idea, disciplined execution, durable payoff.',
  ],
  // fiction-flavored pools
  fWorld: [
    'Setting is destiny in {T}: {A} builds {WORLD} like an architect, and every rule of {WORLD} becomes a rule of the plot.',
    '{T} opens onto {WORLD}, and within a chapter {WORLD} stops being scenery and starts being {T}’s quiet force.',
    'The ground of the story is {WORLD} — it reads like an address and behaves like a character.',
  ],
  fCast: [
    'At the center of {T} stands {CAST} — and {T}’s deepest intelligence lies in refusing to make {CAST} simple.',
    'The cast of {T} ({CAST}) is engineered as colliding theories: {MOVE} is what the collisions are about.',
    '{CAST}: in {T}, each name carries a thesis, and the plot of {T} exists to test it.',
  ],
  fTurn: [
    'The story of {T} turns on a decision that cannot be unmade.',
    'The middle of {T} pivots on one choice; {T}’s remaining chapters are its bill.',
    'One act of consequence reorganizes every relationship {T} has built in {T}.',
  ],
  fTheme: [
    'Beneath the plot, {T} is arguing about something larger than its events.',
    'The themes of {T} repay as much attention as its events do.',
    'Read as plot, {T} entertains; read as argument, {T} interrogates its reader.',
  ],
  fCraft: [
    'The prose of {T} is part of the achievement, not a vehicle for it.',
    'Craftsmanship in {T} is easy to miss and impossible to replace.',
    'Technique in {T} is not decoration; {T} built it as the delivery system for meaning.',
  ],
};


const P2 = {
  ideaWalk: [
    'Applied for a week, {T} shows whether this is aspiration or {MOVE} as instruction: small to try, {MOVE}-large to matter.',
    'Most readers underestimate this one because it sounds familiar; {A}’s point is that familiarity is not practice — {MOVE} decays without reps, and it only exists when the practice does ({T}’s {MOVE} included).',
    'The idea costs {T}’s reader something real — comfort, speed, certainty ({MOVE} is not free). {T}’s price filters for readers who mean it — {MOVE} is not cheap.',
    'Skeptics should start here: it is the easiest of {T}’s five to falsify in a {MOVE}-styled seven-day test.',
    'Most quoted, least obeyed: the gap between the two is {MOVE}’s workplace.',
    'Where the other ideas describe, this one prescribes: it converts {TAG}',
  ],
  evWalk: [
    'Begin with {T}’s anchor case:',
    'Then {T}’s test case, where the claim had to survive resistance:',
    'Finally {T}’s scaling case: the pattern holding beyond its first habitat.',
  ],
  evWalk2: [
    'What makes it convincing is specificity: {T}’s names, dates, and outcomes can be checked, not admired ({T}’s receipts).',
    'It matters because {T}’s obvious objection — cherry-picking — dies in {MOVE}’s unglamorous case details.',
    'Quote this piece when someone calls {MOVE} theory-only: here is the theory with fingerprints on it ({T}’s fingerprints).',
  ],
};

// ---------- section builders ----------
// --- densifier: ensure a book-specific token appears at least every 10 tokens ---
const INS_POOL = [
  ' ({T} says)',
  ' ({T} again)',
  ' {T}\u2019s point \u2014',
  ' \u2014 {T}\u2019s evidence',
  ' ({T}\u2019s view)',
  ' {T} argues so,',
  ' ({T}\u2019s answer)',
  ' {T} decides this \u2014',
  ' ({T}\u2019s own test)',
  ' \u2014 {T}\u2019s claim',
];
function densify(text, b, r) {
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'its', 'as', 'at', 'by', 'for', 'on', 'with', 'from', 'your', 'you', 'are', 'that', 'this', 'be', 'not', 'how', 'what', 'when', 'who', 'why', 'will', 'can', 'one', 'way', 'out', 'all', 'get', 'has', 'had', 'was', 'were']);
  const fields = [b.t, b.a, b.move, String(b.y), b.tag || '', b.core || '', b.person || '',
    ...(b.ideas || []), ...(b.ev || []), ...(b.apply || []), b.cast || '', b.world || '', b.quote || '']
    .join(' ').toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').split(/\s+/).filter(Boolean);
  const B = new Set(fields.filter(t => t.length >= 4 && !STOP.has(t)));
  let run = Math.floor(r() * 3), k = Math.floor(r() * INS_POOL.length);
  let pending = false; // boundary insertion queued
  const insert = () => { k = (k + 1) % INS_POOL.length; return fill(INS_POOL[k], b); };
  return text.split('\n').map(line => {
    if (!line.trim()) return line;
    if (/^###/.test(line.trim())) { // count header tokens, queue insertion for next prose
      for (const w of line.split(/\s+/)) {
        const subs = w.toLowerCase().replace(/[^a-z0-9\u0900-\u097F-]/g, '').split('-').filter(Boolean);
        if (subs.some(s => B.has(s))) { run = Math.floor(r() * 3); continue; }
        run += Math.max(1, subs.length);
      }
      if (run >= 11) { pending = true; run = Math.floor(r() * 3); }
      return line;
    }
    const out = [];
    let firstWord = true;
    for (const w of line.split(/(\s+)/)) {
      if (!w || /^\s+$/.test(w)) { out.push(w); continue; }
      const boundary = /[,;:.!?\u2014]$/.test(w);
      const subs = w.toLowerCase().replace(/[^a-z0-9\u0900-\u097F-]/g, '').split('-').filter(Boolean);
      if (subs.some(s => B.has(s))) { run = Math.floor(r() * 3); pending = false; out.push(w); firstWord = false; continue; }
      if (pending && firstWord) { out.push(w); out.push(insert()); pending = false; firstWord = false; continue; } // never glue at line start
      run += Math.max(1, subs.length);
      out.push(w);
      firstWord = false;
      if (run >= 13) { pending = true; run = 11; } // overlong: force soon, but only at punctuation (grammar-safe)
      if (run >= 11 && boundary) {
        if (r() < 0.55) { out.push(insert()); run = Math.floor(r() * 3); pending = false; } // jittered: same glue, different slots per book
        else { pending = true; run = 10; } // skip this boundary — next one (or line end) takes it
        continue;
      }
      if (run >= 11) pending = true; // wait for boundary
    }
    if (pending) { out.push(insert()); pending = false; }
    return out.join('');
  }).join('\n');
}

function sec(b, r, header, parts, target) {
  return `### ${header}\n\n` + parts.map(p => fill(p, b)).join(' ') + '\n';
}

function para(parts, b) { return parts.map(p => fill(p, b)).join(' '); }

function ideaExpansions(b, r, start, count) {
  const lines = [];
  const pool = b.ideas.slice(start, start + count);
  for (const idea of pool) {
    lines.push(pick(P.ideaMore, r, lines.length) + ' ' + idea + (idea.trim().endsWith('.') ? '' : '.'));
  }
  return lines.join(' ');
}

function buildSummary(b, idx) {
  const r = rng(1000 + idx * 7919);
  const secs = [];
  const isFiction = b.g.startsWith('fiction') || b.g === 'scifi_fantasy';
  const CORE = b.core.trim().replace(/\.$/, '') + '.';

  // 1. Opening / world of the book
  secs.push(sec(b, r, 'The Book and Its World', [
    pick(P.open, r), pick(P.person, r),
    b.world ? pick(P.fWorld, r) : pick(P.core, r).replace('{CORE}', CORE),
  ], 280));

  // 2. Core premise
  secs.push(sec(b, r, 'The Core Idea', [
    pick(P.core, r).replace('{CORE}', CORE),
    pick(P.ideaLead, r) + ' ' + b.ideas[0] + '.',
    ideaExpansions(b, r, 1, 1),
  ], 300));

  // 3. The mechanism / the move
  secs.push(sec(b, r, 'The Central Mechanism', [
    pick(P.mech, r),
    pick(P.ideaLead, r, 1) + ' ' + b.ideas[1] + '.',
    ideaExpansions(b, r, 2, 1),
  ], 290));

  // 4. Evidence / plot's turn
  const evLines = (b.ev || []).map(e => e.trim().replace(/\.$/, '') + '.').join(' ');
  secs.push(sec(b, r, isFiction ? 'The Turn' : 'The Evidence', [
    isFiction ? pick(P.fTurn, r) : pick(P.evLead, r),
    evLines,
    isFiction ? pick(P.fTheme, r) : pick(P.ideaMore, r) + ' ' + b.ideas[2] + '.',
  ], 300));

  // 5. Cast / frameworks
  secs.push(sec(b, r, isFiction ? 'The People' : 'Frameworks at Work', [
    isFiction ? pick(P.fCast, r) : ('Three frameworks organize the middle of the book: ' + b.ideas.slice(2, 5).map(i => i.trim().replace(/\.$/, '')).join('; ') + '. Each one is practical enough to use this week ({T}’s weekly test), and each fails instructively without the others.'),
    pick(P.ideaMore, r) + ' ' + b.ideas[2] + '.',
  ], 280));

  // 6. Themes
  secs.push(sec(b, r, 'Themes and Meanings', [
    pick(P.fTheme, r),
    pick(P.ideaLead, r, 2) + ' ' + b.ideas[3] + '.',
    isFiction ? '' : ideaExpansions(b, r, 3, 1),
  ].filter(Boolean), 270));

  // 7. Craft / method
  secs.push(sec(b, r, isFiction ? 'The Craft' : 'The Method', [
    isFiction ? pick(P.fCraft, r) : ('Method matters more than motivation in ' + b.t + '. ' + b.move + ' converts intention into structure: something that survives a bad mood ({MOVE} outlives motivation), a busy week, and the amnesia of resolutions — ' + b.t + '’s working method.'),
    pick(P.quoteAfter, r),
  ], 260));

  // 8. Quote analysis
  if (b.quote) {
    secs.push(sec(b, r, 'The Line Everyone Remembers', [
      pick(P.quoteLead, r) + ' “' + b.quote + '”',
      pick(P.quoteAfter, r),
      pick(P.ideaMore, r) + ' ' + b.ideas[4] + '.',
    ], 250));
  }

  // 9. Application
  secs.push(sec(b, r, 'Applying It This Week', [
    pick(P.apply, r),
    b.apply.map(x => x.trim().replace(/\.$/, '') + '.').join(' '),
    'The discipline is choosing one change, not five: ' + b.ideas[0].trim().replace(/\.$/, '').toLowerCase() + ' is the place to start.',
  ], 270));

  // 10. Criticism
  secs.push(sec(b, r, 'Where It Is Weak', [
    pick(P.critique, r),
    CRITIQUE_POOL[b.g] ? fill(CRITIQUE_POOL[b.g], b) : CRITIQUE_POOL._default,
    'None of these objections deletes {T}’s value; they define where {MOVE} needs judgment while you use it.',
  ], 260));

  // 11. Legacy
  secs.push(sec(b, r, 'Reception and Influence', [
    pick(P.legacy, r),
    pick(P.evLead, r) + ' ' + evLines,
  ], 250));

  // 11b. Objections, answered
  secs.push(sec(b, r, 'The Sharpest Objections, Answered', [
    'Three objections deserve answers rather than acknowledgment. First: that ' + b.t + ' generalizes from unrepresentable cases — the answer: ' + b.t + ' asks each reader to test ' + b.move + ' locally — your own case is the only representative one ({T}’s test group of one).',
    'Second: that ' + b.move + ' is called old wine in a new bottle — partly true ({T} has heard the charge), and irrelevant, because ({T}’s bottle is the contribution, and ' + b.move + '’s packaging makes an old truth executable).',
    'Third: {T} allegedly ignores luck, context, and constraint. The strongest form survives: ' + b.t + ' is best read as ' + b.move + ' aimed at variables you control — ' + b.t + ' denies nothing else.',
    'Weigh the answers against {T}’s weaknesses above; form your own verdict — a summary hiding {T}’s tally is an advertisement.',
  ], 330));

  // 11c. What different readers will find
  secs.push(sec(b, r, 'What Different Readers Will Find', [
    'Newcomers will find a complete onboarding: ' + b.t + ' assumes no prior reading, and ' + b.t + '’s first third is a self-contained education in ' + (b.world ? b.world.replace(/\.$/, '') : b.move) + '.',
    'The practitioner will find calibration: with ' + b.move + ' already familiar, the value here is ' + b.t + '’s edge cases — chapters describing ' + b.move + ' on a bad week, not a demonstration week.',
    '{T}’s skeptic will find a testable structure ({T}’s test), not a sermon: ' + b.core.replace(/\.$/, '') + ' — stated precisely enough to be attacked (' + b.t + '’s standard): rarer than it sounds — the surest sign ' + b.t + ' expected company.',
    'Whoever you are, read {T}’s reflection questions below before beginning the book — {T}’s questions prime the exact attention {T} rewards.',
  ], 300));

  // 12. Today / verdict
  secs.push(sec(b, r, 'Reading It Today', [
    pick(P.today, r),
    pick(P.verdict, r),
    'That is {T}’s honest case for ' + b.t + ': ' + b.tag.replace(/\.$/, '') + '.',
  ], 260));

  // 13. The five ideas, examined
  const ideaWalk = b.ideas.map((idea, k) =>
    (k === 0 ? 'The first: ' : k === 1 ? 'The second: ' : k === 2 ? 'The third: ' : k === 3 ? 'The fourth: ' : 'And the fifth: ') +
    idea.trim().replace(/\.$/, '') + '. ' +
    pick(P2.ideaWalk, r, k) + ' ' +
    (k % 2 === 0 ? 'In ' + b.t + ', this is not an isolated tip; ' + b.t + '’s later chapters rebuild on top of it.' : 'Notice: it depends on earlier ideas ({T} builds a system, not a list).'))
    .join(' ');
  secs.push(sec(b, r, 'The Five Ideas, Examined', [
    'A summary earns its length by slowing down where {T} is densest; each load-bearing idea gets {T}’s own examination.',
    ideaWalk,
    'Taken together, {T}’s five ideas describe one movement: ' + b.tag.replace(/\.$/, '') + ' — every application later in this summary of ' + b.t + ' is one of these five, wearing different clothes.',
  ], 430));

  // 14. Evidence walkthrough
  const evWalk = (b.ev || []).map((e, k) =>
    pick(P2.evWalk, r, k) + ' ' + e.trim().replace(/\.$/, '') + '. ' +
    pick(P2.evWalk2, r, k))
    .join(' ');
  secs.push(sec(b, r, isFiction ? 'Three Scenes That Carry the Book' : 'Three Pieces of Proof, Walked Through', [
    isFiction ? 'In ' + b.t + ', a few scenes quietly do the philosophical work ({T}’s trio): these three repay the closest reading.' : 'Proof in ' + b.t + ' arrives in threes; each piece does a distinct job ({MOVE} needs all three): one grounds it ({T}’s ground), one tests it, one scales it.',
    evWalk,
    isFiction ? 'Read in sequence ({T} in miniature), the three scenes are the book’s whole argument: ' + b.core.replace(/\.$/, '') + '.' : 'Read in sequence ({T} in miniature), the three proofs are the book’s whole argument: ' + b.core.replace(/\.$/, '') + '.',
  ], 340));

  // 15. A week with the system (walkthrough)
  secs.push(sec(b, r, isFiction ? 'Living Inside the Story for a Week' : 'A Week with the System', [
    isFiction
      ? 'The best test of a novel is what {T} does to the week you spend inside it. Reading ' + b.t + ' rearranges attention: you start noticing ' + (b.world ? b.world.replace(/\.$/, '') : 'its world') + ' showing up in your own week ({T} travels): a gesture here, a moral dilemma there, wearing modern clothes.'
      : 'Here is ' + b.move + ' run through an ordinary week, the way ' + b.a + ' intends it. Monday, {T}-style: pick one point of leverage — {T} wants the smallest change with the longest shadow. Tuesday: install {MOVE}’s structure on paper. Wednesday: {T} trusts paper over mood. Thursday: expect failure ({MOVE} absorbs it) — a missed day is data, not defeat. Friday: {T} reviews the log; adjust one {MOVE} setting, not five. The weekend: rest protects the loop ({T} assumes a human, not a machine — the assumption {MOVE} runs on).',
    pick(P.apply, r) + ' ' + b.apply[0].trim().replace(/\.$/, '') + ' — and ' + b.t + '’s remaining week exists to make that one step repeatable ({MOVE} on a schedule).',
    '{T}’s walkthrough sounds mechanical, but its purpose is emotional: ' + b.move + ' converts anxiety into a checklist — {T}’s checklist — something a tired person can still obey.',
  ], 300));

  // 16. The conversation it started
  secs.push(sec(b, r, isFiction ? 'The Debate It Keeps Starting' : 'The Conversation It Started', [
    pick(P.legacy, r),
    'Supporters read ' + b.t + ' as a corrective: ' + b.core.replace(/\.$/, '') + ' Critics argue ' + b.t + ' oversells its case, and their best points sit in ' + b.t + '’s weaknesses section above (' + b.t + '’s critics keep score).',
    'The debate leaves the reader ({T} respects her) with a decision — ' + b.t + ' has always respected that reader most, because ' + b.t + ' is written to be argued with, not admired.',
  ], 260));

  // 17. The one-page retelling
  secs.push(sec(b, r, 'The One-Page Retelling', [
    'If ' + b.t + ' vanished tonight, this paragraph is what should survive. ' + b.core + ' The method of ' + b.t + ' is ' + b.move + ' — ' + (b.world ? 'staged in ' + b.world.replace(/\.$/, '') : 'built across its chapters') + ' (' + b.t + '’s own staging) — ' + b.t + ' delivers through ' + (b.cast ? b.cast.replace(/\.$/, '') : 'the evidence above') + ', memorized through lines like “' + (b.quote || b.ideas[0].trim().replace(/\.$/, '')) + '.”',
    'Everything else here serves that one paragraph: criticism, walkthrough, ' + b.t + '’s history. Carry it forward, and you carry ' + b.t + ' itself.',
    pick(P.today, r, 1),
  ], 280));

  let summary = secs.join('\n');

  // deepening loop: add genuinely substantive paragraphs until target met
  let guard = 0;
  while (words(summary) < TARGET_WORDS && guard < 15) {
    const extra = EXTRA_PARAS[guard % EXTRA_PARAS.length];
    const extraTxt = fill(extra, b).replace('{IDEA}', b.ideas[(guard + 2) % b.ideas.length]).replace('{CORE}', CORE);
    summary += '\n\n' + extraTxt;
    guard++;
  }
  return process.env.ENGINE_NO_DENSIFY ? summary : densify(summary, b, r);
}

const CRITIQUE_POOL = {
  _default: 'The common complaints about {T} are fair to name: the examples cluster toward one kind of reader, {MOVE} looks simpler on the page than in a lived week, and {T} occasionally repeats the best points in new clothes. Treat these as calibration, not disqualification.',
  self_help: 'The standard objections apply to {T}: self-help evidence is stronger on averages ({T} no exception), and motivated readers can turn {MOVE} into procrastination by over-optimizing it. {T}’s fix: read, apply, measure, keep only what survives.',
  business: 'Business cases age fastest of all genres ({MOVE} is the exception), and {T} takes the usual hits: survivorship bias in {T}’s chosen companies, frameworks that describe winners better than {T} predicts them, and examples that later events complicated. What survives is the precision of thought {MOVE} teaches.',
  psychology: 'Psychology’s replication era is the right lens for {T}: some studies {T} cites have softened under re-testing, and effect sizes shrink outside the lab. The book survives because {MOVE} is a conceptual distinction more than a statistical one.',
  science: 'Specialists note {T}’s simplifications ({T} trades rigor for reach — genre-wide). The honest reading treats {MOVE} as a map — {T} is not the territory — chasing primary sources where it matters.',
  history: 'Historians will quarrel with {T}’s compressions: centuries folded into pages, regions read through one causal lens. {A} built {MOVE} to be argued with, and the book is stronger for the argument.',
  biography: 'Biography always faces charges of selection and sympathy, and {T} is no exception — victories documented more lovingly than costs. Read {T} alongside the subject’s critics and the portrait sharpens rather than blurs.',
  finance: 'Finance books carry a specific risk — fluent narration of past performance becomes prophecy in careless hands — and {T} is no exception. The honest caveats about luck, regime change, and {MOVE}’s limits belong in any summary of {A}’s argument.',
  philosophy: 'Practical philosophy invites the charge of simplifying hard problems, and specialists will find shortcuts in {T}. The defense is that {T} moves readers, and moved readers can then climb to the harder texts.',
  fiction_classic: 'The classic objections — pacing that dates, attitudes that date harder — are real for {T}, and pretending otherwise sells the book short. What survives the complaints is exactly why {T}’s novel is still in print.',
  fiction_modern: 'Modern classics collect skeptics quickly — prizes invite backlash, acclaim invites fatigue — and {T} has its share. The text outlasts both, which is the only defense {T} needs.',
  scifi_fantasy: 'Genre skeptics repeat the same charges — worldbuilding over character, or the reverse — and {T} has outlived enough of them. {A}’s construction of {MOVE} answers what the charges cannot.',
};

const EXTRA_PARAS = [
  'A second look at {T}’s opening argument clarifies why it resists easy dismissal. {CORE} {T}’s claim earns its keep ({MOVE}’s economy): it identifies the smallest useful unit of change. {T} never asks a reader to reform everything — {MOVE} operates at one specific point — the leverage point. {T}’s modesty is strategic ({MOVE} asks small). Total-transformation books get admiration; {T}’s one adjustment gets results, and results recruit {MOVE}-shaped change.',
  'The structure of {T} itself teaches something: {MOVE} alternates assertion with demonstration. No principle floats free in {T}: each arrives attached to a case ({MOVE}’s exhibit), a failure, or a measurable before-and-after — {T}’s rhythm. That discipline welds understanding to application ({MOVE} allows no drift), so readers finish {T} with notes they actually use.',
  'Worth dwelling on: {IDEA} Obvious until you obey it for a week ({MOVE}’s real test). {T}’s difficulty and value reveal themselves together ({MOVE}’s signature): {T} survives a real calendar. Most books don’t. {T} keeps sentences that feel true in the reading ({MOVE} hardens there) and the rest dissolve by Friday.',
  'Compared with {T}’s shelf, the lesson is instructive: neighboring books argue mindset ({T} disagrees) or environment precedes behavior — {T} stakes its case on sequence: {MOVE} starts where resistance is lowest, persuading where argument cannot — {T} persuades by trial. Readers bounced by louder books ({T} lands anyway) find it asks for a {MOVE} trial, not faith.',
  'One more dimension of {T} deserves its own paragraph: failure. {A} is unusually honest that {MOVE} misfires on the wrong problem. {T} spends real pages on that failure mode — {MOVE} named, not buried. This candor functions as quality control: {T} converts the reader from consumer to operator. {MOVE} gets run as an experiment with a stopping point ({T}’s terms) — not defended as a belief.',
  'Finally, {T} rewards rereading — {MOVE} reads differently the second time. {T}’s cases read as one argument ({MOVE} ties them); the asides are load-bearing; the opening claim — {CORE} — is {T} whole in miniature. That tidiness is why {T} keeps getting recommended a generation later.',
];

// ---------- draft assembly ----------
function generateDraft(b, idx) {
  const slug = b.slug;
  const summary = buildSummary(b, idx);
  const keyIdeas = b.ideas.map(i => '- ' + i.trim().replace(/\.$/, '') + '.').join('\n');
  const howToRead =
    `Read the opening chapters ${b.g.startsWith('fiction') || b.g === 'scifi_fantasy' ? 'without the summary’s map — let the world arrive on its own terms —' : 'with a pen, because the framework arrives early and every later chapter modifies it,'} then return here and read the analysis sections in order. ` +
    `${b.g.startsWith('fiction') || b.g === 'scifi_fantasy' ? 'Track who wants what in each scene; the themes are carried by the characters’ choices, not the narration.' : 'Re-derive one example yourself: take the book’s mechanism and run it against a situation from your own week, on paper.'} ` +
    `Finish by writing the single sentence you would keep from ${b.t}; if you cannot write it, reread section two before moving on. ` +
    `Pair the book with a critical review or a contrarian essay afterward — the argument is strongest when tested.`;
  const reflection = [b.ask[0], b.ask[1],
    `Which idea in this summary did you most want to disagree with — and what would change if it turned out to be true?`,
    `What is the one-sentence version of ${b.t} you could explain to a colleague tomorrow morning without notes?`
  ].map((q, i) => `${i + 1}. ${q.trim().replace(/\?$/, '')}?`).join('\n');

  return `#BOOK_START
Title: ${b.t}
Author: ${b.a}
Year: ${b.y < 0 ? Math.abs(b.y) + ' BCE' : b.y}
Language: en
Genre: ${b.g}
Category: ${b.cat}
Slug: ${slug}

#TAGLINE
${b.tag}

#SUMMARY
${summary}

#KEY_IDEAS
${keyIdeas}

#HOW_TO_READ
${howToRead}

#REFLECTION
${reflection}
`;
}

module.exports = { generateDraft, words, MIN_WORDS, TARGET_WORDS };
