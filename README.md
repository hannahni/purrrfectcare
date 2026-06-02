# 🐾 PurrfectCare — full-stack cat care assistant

A feline care assistant built with **Next.js** (App Router) and deployable to **Vercel** in a few clicks.
It does daily health logging, builds trends, gives food & care guidance, and answers questions through a
knowledge-grounded chat assistant — with hard guardrails that escalate urgent symptoms and never diagnose.

> ⚠️ **Not a veterinarian.** PurrfectCare gives general, educational guidance only. For any urgent or
> worsening sign, contact a vet or emergency clinic.

---

## Architecture

| Layer | File(s) | Notes |
|---|---|---|
| **Data input** | `app/page.js` (Today tab), `lib/store.js` | Day-by-day check-ins, cat profile, diet |
| **Processing / NLP** | `lib/nlp.js` | Free text → structured symptom tags |
| **Knowledge / RAG** | `lib/knowledge.js` | Curated vet + community + product sources, keyword/tag retrieval |
| **Reasoning + guardrails** | `lib/reasoning.js` | Rule engine; decides escalation independently of the LLM |
| **AI engine (server)** | `app/api/chat/route.js` | Reads `ANTHROPIC_API_KEY`, calls Claude over retrieved docs |
| **Output UI** | `app/page.js` | Dashboard, chat, food/care, proactive nudges |

The `lib/` core is shared: the **server** uses it for authoritative answers, the **client** uses it to render
the dashboard instantly. The Anthropic key is used **only** in the server route — it never reaches the browser.

---

## Run locally

Requires **Node.js 18.17+**.

```bash
cd purrfectcare
npm install

# add your key for local dev
cp .env.example .env.local
#   then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

npm run dev
# open http://localhost:3000
```

Without a key the app still runs — chat falls back to the built-in guardrailed rule engine.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New… → Project → Import** your repo (framework auto-detects as Next.js).
3. **Settings → Environment Variables**, add exactly:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
   | `ANTHROPIC_MODEL` *(optional)* | e.g. `claude-opus-4-8` |

4. **Deploy.** The chat route runs as a serverless function that reads the key from the environment.

> The variable name must be exactly `ANTHROPIC_API_KEY` — that is what `app/api/chat/route.js` reads via
> `process.env.ANTHROPIC_API_KEY`.

---

## Data persistence (current state & next step)

v1 stores each user's data in **browser localStorage** (no database, nothing to provision — works perfectly on
Vercel). This is deliberate: Vercel's serverless filesystem is ephemeral, so SQLite would not persist there.

**To add real cross-device persistence**, drop in a hosted Postgres (Vercel Postgres or Neon):

1. Create a Vercel Postgres / Neon database, add its connection string to your env vars.
2. Add API routes (`app/api/cats`, `app/api/logs`, …) that read/write those tables.
3. Swap `loadDb` / `saveDb` in `lib/store.js` for `fetch()` calls to those routes.

The data model in `lib/store.js` is already entity-shaped (cats / logs / chats keyed by id), so this is a
mechanical change, not a rewrite.

### Other graduation hooks (marked `// GRADUATION:` in code)
- `lib/knowledge.js` → move `DOCS` to a vector store (pgvector / Pinecone) for embedding-based RAG over live
  AVMA / Reddit / Chewy / Amazon content.
- `lib/nudges.js` → compute via a **Vercel Cron** job and send push/email instead of rendering on load.
