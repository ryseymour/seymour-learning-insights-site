// Cloudflare Pages Function: POST /api/differentiate
// Wraps the reading-level-differentiator skill. Keeps the API key server-side.
//
// GO-LIVE CHECKLIST (this endpoint is dormant until these are done):
//   1. Set the secret:  npx wrangler pages secret put ANTHROPIC_API_KEY --project-name seymourlearning
//   2. Pick MODEL below after the model test (default Haiku 4.5 = cheapest that passes the bar).
//   3. Add KV-based per-IP rate limiting (see the rate-limit TODO) before linking it publicly.
//   4. Set a hard monthly spend cap on the Anthropic account as the circuit breaker.

const MODEL = "claude-haiku-4-5"; // swap after the model test
const MAX_OUTPUT_TOKENS = 1500;
const MAX_SOURCE_CHARS = 6000;

const SYSTEM_PROMPT = `You rewrite a classroom passage at multiple reading levels. Follow this exactly.

METHOD: Brief, Build, Check. Build one version per requested level, then append a Check block.

LEVELING RULES
- Preserve every key concept at every level. Lower levels get shorter sentences and simpler syntax, not less content. Never drop a fact to hit a level.
- Scaffold required vocabulary, do not delete it. Keep must-keep terms at every level and define each in plain words at first use. Use the term's natural grammatical form.
- Make levels genuinely distinct and age-appropriate, not just shorter.
- EAL/ELL and SEN are different jobs. EAL: predictable sentence structure, preserve cognates, simple glosses. SEN: reduce cognitive load (short clauses, one idea per sentence, concrete referents) without cutting content.
- Apply real scaffolds (sentence starters, chunking, concrete referents) when leveling down.
- Do not strip qualifiers ("most", "usually", "some"); removing them can create a false absolute.
- Use only what is in the source. Do not invent facts.
- Reading levels are approximate; you cannot compute a validated Lexile or Fountas and Pinnell level.
- If a format is given, fill EVERY labeled field (Title, Passage, Glossary, questions, etc.) for EACH level, using the teacher's labels. Never drop a field; the title is dropped most often.

WRITING RULES (sound like a teacher, not like AI)
- No em-dashes, ever. Use a period or comma.
- No "not just X, it's Y". No rule-of-three padding. Vary sentence length.
- Cut throat-clearing, inflated words (vital, essential, powerful), prestige verbs (harness, utilize, foster), copula avoidance (serves as, represents), abstract filler nouns (realm, landscape), filler intensifiers (very, really, significantly).
- Do not tack on significance. Do not end on an aphorism. State the content and stop.

OUTPUT CONTRACT (no preamble, no closing summary)
For each level, easiest to hardest:
### [Level label]
[the leveled passage, or the teacher's full template filled in if a format was given]

Then:
---
**Check before you use this**
- 2 to 4 specific things to verify for THESE versions (fact drift, a dropped concept, a stripped qualifier, and if a numeric level was given, a reminder to spot-check it with their own tool).
- one common misconception this passage could reinforce, if any.
Frame the Check as a draft for the teacher's judgment. Be non-judgmental about the teacher's choices. End soft.`;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "The tool is not configured yet. Check back soon." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Could not read the request." }, 400);
  }

  const { source, levels, keepVocab, format, learnerNeed, email } = body || {};

  // Email gate (doubles as the abuse guard and the lead capture).
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Please enter a valid email to use the tool." }, 400);
  }
  if (!source || source.trim().length < 20) {
    return json({ error: "Paste a source passage (at least a couple of sentences)." }, 400);
  }
  if (source.length > MAX_SOURCE_CHARS) {
    return json({ error: `Passage is too long (max ${MAX_SOURCE_CHARS} characters).` }, 400);
  }
  if (!levels || !levels.trim()) {
    return json({ error: "Enter the target reading levels (e.g. grades 4, 6, 8)." }, 400);
  }

  // TODO (required before public launch): per-IP rate limit via a KV namespace.
  // const ip = request.headers.get("cf-connecting-ip"); check/increment a KV counter.
  // TODO: capture `email` to a KV namespace or the Substack API for the funnel.

  const userContent =
    `Source passage:\n${source.trim()}\n\nTarget levels: ${levels.trim()}` +
    (keepVocab ? `\nMust-keep vocabulary: ${keepVocab.trim()}` : "") +
    (learnerNeed ? `\nLearner need: ${learnerNeed.trim()}` : "") +
    (format ? `\nFormat (fill this exactly for each level):\n${format.trim()}` : "");

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } catch {
    return json({ error: "Could not reach the model. Try again." }, 502);
  }

  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 200);
    return json({ error: "The model returned an error.", detail }, 502);
  }

  const data = await resp.json();
  const output = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return json({ output });
}
