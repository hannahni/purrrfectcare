/* ============================================================================
   Anthropic Messages API helper (server-only, raw fetch — no SDK).
   ----------------------------------------------------------------------------
   Centralizes the hardened call used by /api/chat and /api/analyze:
     • Prompt caching — the stable system prompt is sent as a cache_control
       block so repeated requests reuse it. (Caching only kicks in once the
       cached prefix exceeds the model's minimum size — ~4096 tokens on Opus —
       so for our short prompts it's a no-op today, but it's the correct,
       future-proof shape and costs nothing.)
     • Transient-error retries — 429 / 408 / 5xx / 529 are retried with
       exponential backoff (honoring Retry-After), so a brief blip doesn't
       silently drop the user to the rule fallback. 4xx (bad key, bad request)
       are NOT retried — they fail fast.
     • Model: defaults to claude-opus-4-8 (current Opus). No temperature/top_p/
       top_k or budget_tokens (all rejected by Opus 4.8) — prompt-only steering.
   ============================================================================ */
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function callAnthropic({ key, model, system, messages, maxTokens = 700, maxRetries = 2 }){
  // Cache the stable system prompt (string → single cached text block).
  const systemBlocks = typeof system === "string"
    ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
    : system;

  const body = JSON.stringify({ model, max_tokens: maxTokens, system: systemBlocks, messages });

  let lastErr;
  for(let attempt = 0; attempt <= maxRetries; attempt++){
    let res;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
    } catch (e){
      lastErr = new Error(`Network error reaching Anthropic: ${String(e.message || e)}`);
      if(attempt === maxRetries) throw lastErr;
      await backoff(attempt, null);
      continue;
    }

    if(res.ok){
      const data = await res.json();
      const text = (data.content || []).map(c => c.text || "").join("").trim();
      if(!text) throw new Error("Empty response from Claude");
      return { text, usage: data.usage || null, model: data.model || model };
    }

    const detail = await res.text().catch(() => "");
    lastErr = new Error(`Anthropic API ${res.status} ${detail.slice(0, 200)}`);
    // Retry only transient failures; fail fast on 4xx (e.g. 401 bad key, 400 bad request).
    const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
    if(!retryable || attempt === maxRetries) throw lastErr;
    await backoff(attempt, res);
  }
  throw lastErr || new Error("Anthropic call failed");
}

function backoff(attempt, res){
  let ms = Math.min(800 * 2 ** attempt, 3000); // 800ms, 1.6s, capped 3s — Vercel-timeout-safe
  const ra = res && res.headers && res.headers.get && res.headers.get("retry-after");
  if(ra){ const s = parseInt(ra, 10); if(!isNaN(s)) ms = Math.min(s * 1000, 5000); }
  return new Promise(r => setTimeout(r, ms));
}
