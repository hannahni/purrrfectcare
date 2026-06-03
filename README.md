# 🐾 PurrfectCare — your cat care companion

PurrfectCare is a full-stack web app that helps cat owners stay on top of their cat's **health and day-to-day
care**. You log a quick daily check-in, and the app models those signals over time, surfaces what needs your
attention, tracks recurring upkeep tasks, keeps a photo journal, and answers questions through a
knowledge-grounded AI assistant — with hard guardrails that escalate urgent symptoms and **never diagnose**.

Built with **Next.js** (App Router) and deployable to **Vercel**.

🔗 **Repository:** https://github.com/hannahni/purrrfectcare

> ⚠️ **Not a veterinarian.** PurrfectCare provides general, educational guidance only. It does not diagnose.
> For any urgent or worsening sign, contact a veterinarian or an emergency clinic. If you suspect poisoning,
> call the **ASPCA Animal Poison Control Center: (888) 426-4435**.

---

## Table of contents
1. [Project overview](#project-overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Setup](#setup)
5. [Usage](#usage)
6. [AI usage disclosure](#ai-usage-disclosure)
7. [Data & privacy](#data--privacy)
8. [Citations & acknowledgements](#citations--acknowledgements)
9. [External resources](#external-resources)
10. [Roadmap](#roadmap)

---

## Project overview

Most cat-care apps are either a static checklist or a symptom-checker that overstates certainty. PurrfectCare
takes a different posture:

- **Tactical daily logging** — six one-tap signals you can actually keep up with (no daily weigh-ins required).
- **Per-cat modeling over time** — it learns *your* cat's baseline and flags deviations, rather than applying
  generic thresholds.
- **Uncertainty, not false confidence** — every non-emergency recommendation carries a calibrated confidence
  level; the app says "still building a baseline" when it doesn't have enough data yet.
- **Safety first** — a deterministic rule engine decides escalation *independently of the AI*, so a model can
  never downgrade an emergency. High-risk signs always route to "see a vet now."

It spans both **behavior/health** and **household upkeep**, so it's a genuine day-to-day companion, not just a
health tracker.

---

## Features

| Area | What it does |
|---|---|
| **📋 Today** | A ~30-second daily check-in: dry-food appetite, wet-food appetite, poop, vomiting, water, energy, plus an optional occasional weigh-in and a free-text note. |
| **📊 Dashboard** | A triage view — **⚠️ Warnings** (behavior/health), **✅ Actions** (tasks to do), **🔜 Upcoming** — merging health signals and care tasks, each a tight one-liner. Plus trends, calorie targets, and food/care guidance. |
| **🗓️ Calendar** | Recurring maintenance tasks (pee pads, litter, food restock, nail trims, scratch pads, flea prevention…) with cadence and overdue/due tracking. |
| **📸 Photos** | A dated photo journal tagged by body area (eyes, skin/coat, litter/stool, lumps…). Optional **AI photo analysis** reads visible cues and can compare photos of the same area over time. |
| **💬 Assistant** | A chat assistant grounded in a curated knowledge base (retrieval-augmented), with the same escalation guardrails. |
| **📚 Knowledge** | Browse the curated source library the assistant retrieves from. |
| **🐱 Profile / ⚙️ Settings** | Cat profile (age, breed, weight, diet, medical history, photo), multi-cat support, and data export/import. |

### How the modeling works (the short version)
- **Appetite / energy / water** → per-cat rolling baseline (median + MAD → robust z-score). "Is this cat eating
  less *than its own normal*?"
- **Weight** → ordinary-least-squares regression over time with a ~95% confidence interval. It only flags a
  trend when the whole interval is on one side of zero; otherwise it's "not yet conclusive."
- **Vomiting** → frequency/clustering over a rolling 7-day window.
- **Confidence** = data sufficiency × effect size, shown on each recommendation.

---

## Architecture

| Layer | File(s) | Notes |
|---|---|---|
| **Data input** | `app/page.js` (Today tab), `lib/store.js` | Day-by-day check-ins, cat profile, diet, photos |
| **Processing / NLP** | `lib/nlp.js` | Free text → structured symptom tags |
| **Temporal modeling** | `lib/signals.js` | Per-cat baseline deviation, weight regression, vomit frequency, confidence |
| **Knowledge / RAG** | `lib/knowledge.js` | Curated vet + community + product sources, keyword/tag retrieval |
| **Reasoning + guardrails** | `lib/reasoning.js` | Rule engine; decides escalation **independently** of the LLM |
| **Maintenance** | `lib/maintenance.js` | Recurring upkeep tasks, due/overdue logic |
| **AI — chat (server)** | `app/api/chat/route.js` | Reads `ANTHROPIC_API_KEY`, calls Claude over retrieved docs |
| **AI — vision (server)** | `app/api/analyze/route.js` | Sends photos to Claude vision for a guardrailed visual read |
| **Output UI** | `app/page.js` | Sidebar nav, dashboard triage, calendar, photos, chat |

The `lib/` core is shared: the **server** uses it for authoritative answers, the **client** uses it to render
the dashboard instantly. The Anthropic key is used **only** in the server routes — it never reaches the browser.

---

## Setup

**Prerequisites:** [Node.js](https://nodejs.org) **18.17+** (LTS recommended).

```bash
# 1. clone
git clone https://github.com/hannahni/purrrfectcare.git
cd purrrfectcare

# 2. install dependencies
npm install

# 3. (optional) add your Anthropic API key for AI features
cp .env.example .env.local
#    then edit .env.local:
#    ANTHROPIC_API_KEY=sk-ant-...
#    ANTHROPIC_MODEL=claude-opus-4-8   # optional override

# 4. run
npm run dev
# open http://localhost:3000
```

Without a key, the app still runs: the **chat assistant falls back** to the built-in guardrailed rule engine,
and **photo analysis** is disabled (it requires the vision model). Get a key at
[console.anthropic.com](https://console.anthropic.com) (API usage is billed separately from any Claude.ai plan).

### Deploy to Vercel
1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com): **Add New… → Project → Import** your repo (auto-detected as Next.js).
3. **Settings → Environment Variables** — add exactly:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
   | `ANTHROPIC_MODEL` *(optional)* | e.g. `claude-opus-4-8` |

4. **Deploy.** The AI routes run as serverless functions that read the key from the environment.

> The variable name must be **exactly** `ANTHROPIC_API_KEY`. Env-var changes only take effect on a **new build**,
> so redeploy after adding it. (Tip: confirm it's working by checking the caption under an Assistant reply — it
> reads "Claude" when the key is live, "built-in engine" otherwise.)

---

## Usage

1. **Add your cat** on the Profile tab (name, age, breed, weight, diet, medical history, optional photo).
2. **Log a daily check-in** on the Today tab — tap the six signals; add a weigh-in occasionally; jot a note.
3. **Check the Dashboard** — Warnings / Actions / Upcoming tells you what to pay attention to today.
4. **Set up the Calendar** — mark upkeep tasks done to start their timers; adjust cadences or add your own.
5. **Use Photos** — upload pictures tagged by area; tap **🔍 Analyze** for an AI read, or analyze an area's
   photos **over time** for a trend (requires an API key).
6. **Ask the Assistant** anything — feeding, a worrying sign, grooming, behavior.

Use **Settings → Export** to back up your data (it lives in your browser — see below).

---

## AI usage disclosure

PurrfectCare uses AI in two ways, and we want to be transparent about both.

**1. AI features inside the product (runtime).**
- The **chat assistant** (`/api/chat`) and **photo analysis** (`/api/analyze`) call **Anthropic's Claude API**
  (default model `claude-opus-4-8`; configurable via `ANTHROPIC_MODEL`).
- The chat assistant uses **retrieval-augmented generation**: it answers using documents retrieved from the
  curated knowledge base and is instructed to cite them.
- **Guardrails:** a deterministic rule engine (`lib/reasoning.js`) decides symptom escalation independently of
  the model and **prepends** emergency guidance, so the AI cannot soften or hide an urgent warning. The model is
  instructed never to diagnose and to recommend a veterinarian whenever something could be serious.
- The AI's output is **informational guidance, not veterinary advice**, and can be wrong. Always confirm with a
  professional.
- **What gets sent to Anthropic:** only when you actively use a feature. Asking the assistant sends your message,
  cat profile summary, and the retrieved snippets. Running photo analysis sends that photo (and, for a trend,
  the selected photos). Nothing is sent in the background, and nothing is sent if no API key is configured.

**2. AI assistance in building this project (development).**
- This application was developed with the help of **Claude (via Claude Code)** for code generation, refactoring,
  and documentation, under human direction and review. All design decisions and final review are the author's.

---

## Data & privacy

- **All your data is stored locally in your browser** (`localStorage`) — cat profiles, daily logs, chat history,
  maintenance tasks, and photos. There is **no backend database** in this version and **no account/login**.
- **Photos** are auto-resized in-browser and stored as compressed images locally. They are only transmitted to
  Anthropic if you explicitly run **🔍 Analyze**.
- **Your API key** is never exposed to the browser; it is read server-side from the `ANTHROPIC_API_KEY`
  environment variable only.
- **Back up / move data** anytime via **Settings → Export / Import** (JSON).

Because data is browser-local, it does not sync across devices in this version. See the [Roadmap](#roadmap) for
the database path.

---

## Citations & acknowledgements

The knowledge base and guidance are paraphrased and synthesized from reputable, publicly available feline-health
sources. PurrfectCare is **not affiliated with or endorsed by** any of these organizations; their names are used
only to attribute the general guidance they publish.

**Primary veterinary / professional sources (highest trust):**
- **American Veterinary Medical Association (AVMA)** — general pet-health and emergency guidance.
- **Cornell Feline Health Center** — feline nutrition, illness, and symptom guidance.
- **ASPCA** — grooming, general care, and the **Animal Poison Control Center**.
- **American Association of Feline Practitioners (AAFP)** — senior-care and life-stage guidelines.
- **International Society of Feline Medicine (ISFM) / International Cat Care** — environmental-needs and
  litter-box guidance.

**Community & product perspectives (clearly labeled, lower trust, illustrative):**
- Owner-discussion communities (e.g., Reddit r/cats, r/CatAdvice) — anecdotal tips only, not medical advice.
- Aggregated product reviews (e.g., Chewy, Amazon) — opinion, not clinical evidence.

> Community and product entries in this app are **illustrative examples** of the kinds of non-authoritative
> sources a future version would retrieve; they are not live-scraped, and they are weighted below veterinary
> sources in retrieval.

**Built with:** [Next.js](https://nextjs.org), [React](https://react.dev), [Vercel](https://vercel.com), and
the [Anthropic Claude API](https://www.anthropic.com).

---

## External resources

**Feline health (for real medical questions, please use these / your own vet):**
- AVMA — https://www.avma.org
- Cornell Feline Health Center — https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center
- ASPCA — https://www.aspca.org
- ASPCA Animal Poison Control — https://www.aspca.org/pet-care/animal-poison-control · **(888) 426-4435**
- AAFP (cat-owner resources) — https://catvets.com / https://catfriendly.com
- International Cat Care — https://icatcare.org

**Developer / platform:**
- Anthropic Console (get an API key) — https://console.anthropic.com
- Anthropic API docs — https://docs.anthropic.com
- Next.js docs — https://nextjs.org/docs
- Vercel docs — https://vercel.com/docs

---

## Roadmap

Current version stores data in the browser. Planned graduation steps (marked `// GRADUATION:` in the code):

- **Persistence & sync** — add hosted Postgres (Vercel Postgres / Neon): create the DB, add `app/api/cats`,
  `app/api/logs`, … routes, and swap `loadDb` / `saveDb` in `lib/store.js` for `fetch()` calls. The data model is
  already entity-shaped, so this is mechanical.
- **Photo storage** — move base64 photos to blob storage (e.g., Vercel Blob / S3) once there's a backend.
- **Real RAG** — move `lib/knowledge.js` documents into a vector store (pgvector / Pinecone) for embedding-based
  retrieval over live AVMA / community / product content.
- **Proactive reminders** — compute maintenance due-dates via a **Vercel Cron** job and send push/email instead
  of only showing them when the app is open.

---

*PurrfectCare is an educational project and is not a substitute for professional veterinary care.*
