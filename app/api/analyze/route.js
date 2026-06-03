/* ============================================================================
   POST /api/analyze — Claude vision analysis of cat photos
   ----------------------------------------------------------------------------
   Sends one or more cat photos to Claude (using ANTHROPIC_API_KEY, server-side
   only) and returns a measured, guardrailed read of visible cues — dandruff,
   coat, skin, eyes, dental, stool, lumps — with a concern level and next steps.
   Multiple dated images of the same area => a "trend" / change-over-time read.

   Unlike /api/chat there is NO rule fallback: vision requires the model, so if
   no key is set we return a friendly error the UI surfaces.
   Never diagnoses; recommends a vet whenever something could be serious.
   ============================================================================ */
export const runtime = "nodejs";

const SYSTEM = `You are PurrfectCare's visual care assistant for cats. You are NOT a veterinarian and must never diagnose. Examine the photo(s) and describe ONLY what is visibly observable and relevant to feline health or grooming — e.g. dandruff, matting, dull or greasy coat, hair loss, skin redness/scabs, eye or nose discharge, dental tartar, lumps, or stool color/consistency. Be measured; never invent or overstate findings. Choose a concern level: "none" (looks normal or minor), "monitor" (worth watching / home care), or "vet" (recommend a veterinarian — use this whenever something could be serious or you are unsure). Err toward caution. Respond ONLY as compact JSON: {"summary": one or two plain sentences, "observations": [short strings], "concern": "none|monitor|vet", "advice": short next steps}. When multiple dated images are provided, note any visible change over time in the summary.`;

export async function POST(req){
  let payload;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const { images, cat = null, context = "" } = payload || {};
  if(!Array.isArray(images) || images.length === 0){
    return json({ error: "No images provided." }, 400);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if(!key){
    return json({ error: "Photo analysis needs an Anthropic API key. Set ANTHROPIC_API_KEY in your environment (Vercel → Settings → Environment Variables, or .env.local for local dev) to enable it." }, 400);
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const profile = cat
    ? `Cat: ${cat.name||"?"}, ${cat.age||"?"} ${cat.ageUnit||""}, breed ${cat.breed||"unknown"}, conditions: ${cat.conditions||"none noted"}.`
    : "No profile provided.";
  const intro = images.length > 1
    ? `These are ${images.length} photos of the same area (${images[0].area}) in chronological order (oldest first). Comment on any visible change or trend over time.`
    : `This is a photo of the cat's ${images[0].area}.`;

  const content = [{ type:"text", text:`${profile}\n${intro}${context ? `\nOwner note: ${context}` : ""}\nRespond ONLY as compact JSON.` }];
  for(const im of images){
    if(!im || !im.base64) continue;
    content.push({ type:"text", text:`Photo dated ${im.date||"unknown"} (${im.area||"general"}):` });
    content.push({ type:"image", source:{ type:"base64", media_type: im.mediaType || "image/jpeg", data: im.base64 } });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 600, system: SYSTEM, messages: [{ role:"user", content }] }),
    });
    if(!res.ok){
      const detail = await res.text().catch(()=> "");
      throw new Error(`Anthropic API ${res.status} ${detail.slice(0,200)}`);
    }
    const data = await res.json();
    const text = (data.content||[]).map(c=>c.text).join("").trim();
    const parsed = extractJson(text);
    if(parsed) return json({ ...normalize(parsed), used:"claude" });
    return json({ summary: text || "No clear read.", observations:[], concern:"monitor", advice:"", used:"claude" });
  } catch (e){
    return json({ error: `Couldn't analyze the photo: ${String(e.message||e)}` }, 502);
  }
}

function extractJson(text){
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if(m){ try { return JSON.parse(m[0]); } catch {} }
  return null;
}
function normalize(p){
  let c = String(p.concern||"monitor").toLowerCase();
  if(c.includes("vet") || c.includes("urgent") || c.includes("serious")) c = "vet";
  else if(c.includes("monitor") || c.includes("watch")) c = "monitor";
  else if(c.includes("none") || c.includes("normal") || c.includes("ok") || c.includes("minor")) c = "none";
  else c = "monitor";
  return {
    summary: String(p.summary||""),
    observations: Array.isArray(p.observations) ? p.observations : [],
    concern: c,
    advice: String(p.advice||""),
  };
}
function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { "content-type":"application/json" } });
}
