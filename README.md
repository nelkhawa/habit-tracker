# Habit Tracker

A minimal, opinionated habit tracker with an AI coach that actually tells you the truth.

Built with React + Vite, deployed on Vercel. All data lives in your browser's localStorage — no accounts, no backend database. The only server code is a single serverless function that talks to the Claude API for the monthly analysis.

## Features

- **Configurable habits** — add, rename, recolor, and remove habits in Settings. Daily habits count per day; weekly habits show daily checkboxes but score per week.
- **Three views** — a monthly calendar with per-day checkboxes, a compact week grid with streaks, and a quarter/year heatmap.
- **Streaks & stats** — per-habit streaks, month completion, best day of the week, and a month roundup with progress bars.
- **AI monthly analysis** — an honest-coach persona (powered by Claude) reads your real patterns: weekday vs weekend splits, week-by-week trajectory, longest gaps, trend vs last month. It names a blind spot and gives three concrete actions — no cheerleading. You can give it personal context in Settings so it knows what your habits are *for*.
- **Today I learned** — a one-line daily learning journal. Entries feed into the monthly analysis.
- **Vocabulary trainer** — import words you collect while reading and get a short spaced-repetition quiz each day (Leitner boxes: correct answers push reviews further out, misses reset). You type the meaning and Claude grades it semantically (pass / fuzzy / miss) — no self-grading. Strong words flip direction — you recall the word from its definition, graded locally by string distance.
- **Monthly reflection** — evidence-based prompts plus a free-form journal, saved per month.
- **Confetti** — finish every daily habit and you've earned it.
- **Cross-device sync** — optional, no accounts: enable sync to get a private code, enter it on another device, and both share one copy of the data (stored in Vercel Blob via a serverless endpoint; the code never leaves your devices — only its SHA-256 hash is used as the storage key). Last write wins; syncs on every change and whenever the app regains focus.
- **Master list (Notion two-way sync)** — an expandable to-do panel with one section per area of your life, each mirrored to a Notion page. Ticking or adding a task here writes real checkbox blocks to Notion; edits made in Notion show up on the next refresh. The endpoint locates your to-do cluster wherever it lives on the page (top-level checkboxes or inside a callout) and inserts new tasks there.
- **Backup / restore** — export all data as JSON, restore on any device.

## Running it yourself

```bash
git clone https://github.com/nelkhawa/habit-tracker.git
cd habit-tracker
npm install
cp .env.example .env   # add your Anthropic API key for local dev
npm run dev
```

The tracker ships with example habits — replace them with your own in **Settings**. Everything except the AI analysis works with no API key at all.

### AI analysis setup

In production the analysis runs through `api/analyze.js`, a Vercel serverless function, so the API key never reaches the browser. Deploy to Vercel and set `ANTHROPIC_API_KEY` in the project's environment variables.

### Sync setup

Cross-device sync needs a [Vercel Blob](https://vercel.com/docs/vercel-blob) store connected to the project (Storage → Create → Blob). That auto-provisions `BLOB_READ_WRITE_TOKEN` for `api/sync.js`; no other configuration. Without a store, the app still works — sync just reports it's unavailable.

### Master list (Notion) setup

1. Create an internal integration at [notion.so/profile/integrations](https://www.notion.so/profile/integrations) and copy its secret.
2. In Notion, open each to-do page → ⋯ → Connections → add your integration.
3. Set three Vercel env vars and redeploy:
   - `NOTION_TOKEN` — the integration secret
   - `NOTION_TODO_PAGES` — JSON mapping section names to page ids, e.g. `{"work": "<pageId>", "side project": "<pageId>"}`
   - `TODO_ACCESS_HASH` — SHA-256 hex of your sync id, which is itself SHA-256 of `habit-tracker:<YOUR-SYNC-CODE>`; this gates the endpoint so only your devices can read your tasks. (`printf '<sync-id>' | shasum -a 256`)

Sync must be enabled in the app — the master list authenticates with your sync identity.

For local development (`npm run dev`), Vite doesn't serve the `api/` folder, so the app falls back to calling the Claude API directly from the browser using `VITE_ANTHROPIC_API_KEY` from `.env`. That fallback is for development only — don't ship a `VITE_`-prefixed key to production, since Vite inlines those into the public bundle.

## Stack

- React 19 + Vite
- No UI library, no state manager — plain components and localStorage
- Claude API (`claude-opus-4-8`) via `@anthropic-ai/sdk` in one serverless function
- Vercel for hosting + functions

## Data model

Everything is stored under `ht_*` keys in localStorage: one map of `d_<habit>_<date>` booleans for checks, per-month strings for reflections and analyses, and small JSON blobs for the habit config, learning journal, vocabulary list, and spaced-repetition state. The Settings panel can export/import the whole set as one JSON file.

## License

MIT
