/* ============================================================================
   POST /api/chat  — server-side AI Reasoning Engine
   ----------------------------------------------------------------------------
   This is the ONLY place the Anthropic key is used. It is read from the
   environment variable ANTHROPIC_API_KEY and never sent to the browser.

   Flow:
     1. NLP        -> symptom tags from the question
     2. Knowledge  -> retrieve relevant docs (RAG)
     3. Reasoning  -> guardrail engine decides escalation independently
     4. Claude     -> drafts a warm, cited answer using ONLY the retrieved docs
     5. Guardrail  -> if the engine flagged an emergency, we PREPEND the
                      escalation so the model can never bury or soften it.
   If no key is set (or the call fails) we fall back to a deterministic answer
   composed from the same rules + docs, so the app always works.
   ============================================================================ */
import { matchTags } from "../../../lib/nlp.js";
import { retrieve } from "../../../lib/knowledge.js";
import { evaluate } from "../../../lib/reasoning.js";

export const runtime = "nodejs";

const SYSTEM = `You are PurrfectCare, a warm and practical feline care assistant. You are NOT a veterinarian and must never diagnose. Give caring, concrete general guidance and clear next steps. Use ONLY the provided sources and cite them inline like [1], [2]. If any sign could be urgent, tell the owner to contact a vet. Keep replies concise (a short paragraph or a few bullets).`;

export async function POST(req){
  let payload;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const { question, cat = null, logs = [] } = payload || {};
  if(!question || !String(question).trim()){
    return json({ error: "Missing 'question'." }, 400);
  }

  // 1–3: structure, retrieve, reason (all deterministic, server-authoritative)
  const tags = matchTags(question);
  const recentLogs = Array.isArray(logs) ? logs.slice(-7) : [];
  const docs = retrieve(tags.map(t=>t.tag), question, 4);
  const evald = evaluate({ cat, recentLogs, tags, allLogs: Array.isArray(logs) ? logs : [] });
  const sources = docs.slice(0,3).map(d => d.source);

  // 4: Claude (if a key is present)
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  let text, used;

  if(key){
    try {
      text = await callClaude({ key, model, question, cat, tags, docs });
      used = "claude";
    } catch (e){
      text = composeFallback({ evald, docs });
      used = "rules";
      text += `\n\n_(Claude call failed — answered with the built-in engine. ${String(e.message||e)})_`;
    }
  } else {
    text = composeFallback({ evald, docs });
    used = "rules-no-key";
  }

  // 5: guardrail — emergencies are prepended regardless of what the model said
  if(evald.escalate){
    const er = evald.recs.find(r => r.severity === "escalate");
    if(er) text = `🚑 **${er.title}**\n${er.body}\n\n— — —\n\n${text}`;
  }

  return json({
    text,
    used,
    sources,
    tags: tags.map(t => ({ tag: t.tag, label: t.label, redFlag: t.redFlag })),
    escalate: evald.escalate,
  });
}

async function callClaude({ key, model, question, cat, tags, docs }){
  const context = docs.map((d,i)=>`[${i+1}] ${d.title} (source: ${d.source})\n${d.body}`).join("\n\n");
  const profile = cat
    ? `Name ${cat.name}, ${cat.age} ${cat.ageUnit}, breed ${cat.breed||"unknown"}, ${cat.weight||"?"}${cat.weightUnit||""}, ${cat.neutered?"neutered":"intact"}, conditions: ${cat.conditions||"none noted"}.`
    : "No profile provided.";
  const userMsg =
    `Cat profile: ${profile}\n`+
    `Detected signals: ${tags.map(t=>t.label).join(", ") || "none"}\n\n`+
    `Sources:\n${context || "(no specific source matched)"}\n\n`+
    `Owner asks: ${question}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if(!res.ok){
    const detail = await res.text().catch(()=> "");
    throw new Error(`Anthropic API ${res.status} ${detail.slice(0,200)}`);
  }
  const data = await res.json();
  const text = (data.content||[]).map(c=>c.text).join("").trim();
  if(!text) throw new Error("Empty response");
  return text;
}

function composeFallback({ evald, docs }){
  let out = "";
  if(evald.recs.length){
    out += evald.recs.slice(0,3).map(r=>{
      const icon = r.severity==="escalate" ? "🚑" : r.severity==="monitor" ? "👀" : "💡";
      return `${icon} **${r.title}**\n${r.body}`;
    }).join("\n\n");
  } else {
    out += "I didn't catch a specific health signal in that. Here's the most relevant guidance from trusted sources:";
  }
  if(docs.length){
    out += "\n\n**From the knowledge base:**\n" + docs.slice(0,2).map((d,i)=>`[${i+1}] ${d.title} — ${d.body}`).join("\n\n");
    out += "\n\n_Sources: " + docs.slice(0,2).map((d,i)=>`[${i+1}] ${d.source}`).join("; ") + "_";
  }
  out += "\n\nThis is general guidance, not a diagnosis — when in doubt, your vet is the best call.";
  return out;
}

function json(obj, status=200){
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
