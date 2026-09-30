/**
 * LLM provider adapter. One function: complete({ system, user, maxTokens, temperature, meta }) -> string.
 * Providers: gemini (default), anthropic, openai, mock (offline pipeline test, writes nonsense).
 * Retries on 429/5xx with exponential backoff. API keys come from the environment only.
 */
const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
const DEFAULT_MODEL = { gemini: 'gemini-2.5-flash', anthropic: 'claude-sonnet-4-5', openai: 'gpt-4.1' }; // verify against current provider docs
const MODEL = process.env.LLM_MODEL || DEFAULT_MODEL[PROVIDER];

async function post(url, headers, body) {
  let lastErr;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    lastErr = new Error(`${PROVIDER} HTTP ${res.status}: ${text.slice(0, 300)}`);
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * 2 ** i)); continue; }
    throw lastErr;
  }
  throw lastErr;
}

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Export it in your shell (never commit it).`);
  return v;
}

async function gemini({ system, user, maxTokens, temperature }) {
  const base = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com';
  const j = await post(`${base}/v1beta/models/${MODEL}:generateContent`, { 'x-goog-api-key': need('GEMINI_API_KEY') }, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  });
  const parts = j.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error(`gemini returned no content: ${JSON.stringify(j).slice(0, 300)}`);
  return parts.map((p) => p.text || '').join('');
}

async function anthropic({ system, user, maxTokens, temperature }) {
  const base = process.env.LLM_BASE_URL || 'https://api.anthropic.com';
  const j = await post(`${base}/v1/messages`, { 'x-api-key': need('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, {
    model: MODEL, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }],
  });
  return (j.content || []).map((c) => c.text || '').join('');
}

async function openai({ system, user, maxTokens, temperature }) {
  const base = process.env.LLM_BASE_URL || 'https://api.openai.com';
  const j = await post(`${base}/v1/chat/completions`, { Authorization: `Bearer ${need('OPENAI_API_KEY')}` }, {
    model: MODEL, temperature, max_completion_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return j.choices?.[0]?.message?.content || '';
}

// ---- mock: offline test of the whole pipeline (expansion, repair, gates). Not real content. ----
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const vocab = Array.from({ length: 4000 }, (_, i) => `w${i.toString(36)}x`);
function filler(words, label) {
  const out = []; let n = 0;
  while (n < words) {
    const len = rnd() < 0.2 ? 3 + Math.floor(rnd() * 3) : 10 + Math.floor(rnd() * 22);
    const s = Array.from({ length: len }, () => vocab[Math.floor(rnd() * vocab.length)]);
    if (rnd() < 0.3) s[2] = String(1800 + Math.floor(rnd() * 200));
    if (rnd() < 0.2) s[1] = 'you';
    out.push(s.join(' ').replace(/^./, (c) => c.toUpperCase()) + '.');
    n += len;
    if (out.length % 6 === 0) out.push('\n\n');
  }
  return `${label ? label + ' ' : ''}${out.join(' ')}`.replace(/ \n\n /g, '\n\n');
}
async function mock({ meta }) {
  const t = meta.task;
  if (t === 'facts') return JSON.stringify({ first_published: String(meta.book.year), author_background: 'x', central_thesis: 'x', structure: [], key_ideas_or_events: [], real_examples_or_studies: [], known_criticisms: [], do_not_claim: [], slug_base: meta.book.title, meta_title: `${meta.book.title} Summary & Key Lessons | Booknomics`.slice(0, 62), meta_description: 'A mock description for pipeline testing that is exactly long enough to pass the meta description length rule of the validator.', keywords: ['a', 'b', 'c', 'd', 'e', 'f'], category: meta.book.genre });
  if (t === 'section') return filler(Math.round(meta.target * Number(process.env.MOCK_FACTOR || 0.82)), '');
  if (t === 'expand' && process.env.MOCK_NOEXPAND) return meta.current;
  if (t === 'expand') return `${meta.current}\n\n${filler(Math.max(120, Math.round((meta.target - require('./lib.cjs').wordCount(meta.current) + 80) * Number(process.env.MOCK_EXPAND || 1))), '')}`;
  if (t === 'style') return meta.current;
  if (t === 'assets') return JSON.stringify({ quiz: Array.from({ length: 5 }, (_, i) => ({ id: `q${i + 1}`, question: `Q${i + 1}?`, options: ['a', 'b', 'c', 'd'], correct_option: i % 4, explanation: 'e' })), flashcards: Array.from({ length: 10 }, (_, i) => ({ id: `f${i + 1}`, front: `F${i}`, back: `B${i}` })) });
  if (t === 'review') return JSON.stringify({ score: 97, factual_risks: [], generic_passages: [], verdict: 'accept' });
  if (t === 'catalog') return JSON.stringify([{ title: 'Mock Book One', author: 'A. Author', year: 2001 }]);
  throw new Error(`mock: unknown task ${t}`);
}

const impl = { gemini, anthropic, openai, mock };
async function complete(req) {
  if (!impl[PROVIDER]) throw new Error(`Unknown LLM_PROVIDER "${PROVIDER}". Use gemini, anthropic, openai or mock.`);
  return impl[PROVIDER](req);
}
module.exports = { complete, PROVIDER, MODEL };
