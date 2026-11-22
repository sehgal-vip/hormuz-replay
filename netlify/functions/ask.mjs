// Hosted chat for the replay: the same evidence pack as scripts/agent.py, answered by OpenRouter.
// The key lives only in Netlify's environment (OPENROUTER_API_KEY); the browser never sees it.
// Free models only by default (ids ending in ":free"), so a key with no credit costs nothing.
import evidence from "./evidence.json" with { type: "json" };

// OPENROUTER_MODEL (comma-separated) is tried first; the defaults always follow as fallbacks.
const DEFAULT_MODELS = ["nvidia/nemotron-3.5-super-vl:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free"];
const MODELS = [...new Set([...(process.env.OPENROUTER_MODEL || "").split(",").map((s) => s.trim()).filter(Boolean), ...DEFAULT_MODELS])];

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function pack(tick, beatId) {
  const n = evidence.moments.length;
  const t = Math.max(0, Math.min(n - 1, Number.isFinite(tick) ? Math.trunc(tick) : 0));
  const lines = evidence.moments[t].split("\n");
  const claim = beatId && evidence.beats[beatId];
  if (claim) lines.splice(1, 0, claim); // agent.moment_pack puts the claim right after the time line
  return evidence.static + "\n" + lines.join("\n");
}

function cleanMessages(msgs) {
  let out = (Array.isArray(msgs) ? msgs : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-6);
  while (out.length && out[0].role !== "user") out = out.slice(1);
  return out.length ? out : [{ role: "user", content: "Why do you say that?" }];
}

// Free models are often rate-limited upstream, so try each in turn and keep the first real answer.
// Reasoning traces are turned off: they are slow and can use up max_tokens, leaving no answer.
async function callOne(model, messages) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "What the Hormuz" },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 450, reasoning: { enabled: false }, messages }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `OpenRouter HTTP ${r.status}`);
  const text = (j?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!text) throw new Error("empty answer");
  return text;
}

async function callModel(messages) {
  let last;
  for (const m of MODELS) {
    try { return await callOne(m, messages); } catch (e) { last = new Error(`${m}: ${e.message}`); console.log(`chat: ${last.message}`); }
  }
  throw last || new Error("no model");
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  if (!process.env.OPENROUTER_API_KEY) return json(503, { error: "Chat is off on this copy: no OpenRouter key is set. It runs in the live demo." });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Bad request." }); }
  const msgs = cleanMessages(body.messages);
  const system = { role: "system", content: evidence.system + "\nEVIDENCE PACK:\n" + pack(Number(body.tick), typeof body.beatId === "string" ? body.beatId : null) };
  try {
    let text = await callModel([system, ...msgs]);
    text = text.replaceAll("—", ", ");
    return json(200, { answer: text || "The model returned an empty answer. Ask again." });
  } catch (e) {
    const busy = /rate|429|limit/i.test(String(e.message));
    return json(502, { error: busy ? "The free chat model is busy or out of today's quota. Try again in a minute." : "The chat model is unavailable right now.", detail: String(e.message).slice(0, 300) });
  }
};

export const config = { path: "/api/ask" };
