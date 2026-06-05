# Objection — Anonymous Source Verification (prototype)

> **Live demo:** _<paste your Vercel URL here>_ · **Verify page:** _<vercel-url>/verify.html_

A prototype that verifies evidence from **anonymous sources** and issues a **public, privacy‑preserving certificate** with copy‑paste attribution language for journalists.

The hard part of the brief: _"anyone can hash a file after creating it — solve for provenance."_ A hash proves **integrity**, not **origin**, so we split the claim:

- **Integrity from intake** — the moment evidence enters the system each item is SHA‑256 hashed, server‑timestamped, and written to a chain‑of‑custody log. Tampering *after intake* is detectable. (A true claim, shown on the certificate.)
- **Genuineness by triangulation** — an AI engine scores how independently the items **corroborate** one another, plus internal **consistency** and **plausibility**, and classifies reliability with a confidence score.
- **Explicit limitations** — we never claim to verify the source's real‑world identity or to cryptographically prove origin. This honesty is the point.

No sensitive source data is ever exposed: raw content is processed server‑side only, people are referred to by role, and source/witness names are redacted from all output.

## Architecture

Framework‑free static front‑end + **one** Vercel serverless function. No build step.

```
Browser (static, animated UI)                  Vercel serverless
 index.html   marketing page          POST      /api/verify.js
 verify.html  intake + results   ───────────▶   1. SHA-256 + timestamp + custody (per item)
 assets/app.js  flow state machine               2. transcribe audio (Groq Whisper)
 assets/ui.js   pipeline + certificate  ◀──────  3. analyze (Groq Llama, JSON mode)
 assets/style.css design system        verdict   4. validate (+1 repair retry) / fallback
                                          JSON    5. attach integrity, redact, return
```

Correctness‑critical logic lives in small, single‑responsibility modules under `/lib`, each unit‑tested with the Node built‑in test runner:

| Module | Responsibility |
|---|---|
| `lib/integrity.js` | SHA‑256 + custody entry |
| `lib/schema.js` | verdict schema validation, recursive redaction, safe fallback |
| `lib/prompt.js` | builds the consistency/corroboration/plausibility prompt |
| `lib/analyze.js` | orchestrator: transcribe → analyze → repair → integrity merge → redact (deps injected, fully testable offline) |
| `lib/groq.js` | thin Groq adapters (`complete` = Llama JSON mode, `transcribe` = Whisper) |
| `api/verify.js` | the serverless HTTP handler |

## Tech stack

- **Front‑end:** HTML + Tailwind (Play CDN) + Alpine.js + vanilla JS — modern/animated, zero build.
- **AI:** **Groq** — `llama-3.3-70b-versatile` (JSON mode) for analysis, `whisper-large-v3` for audio transcription. Fast and free‑tier; ideal for a live demo.
- **Hosting:** Vercel (static + serverless function, zero‑config).

## Run locally

```bash
npm install
echo "GROQ_API_KEY=your_key_here" > .env.local      # free key: https://console.groq.com/keys

# Run the whole app locally (serves static files + /api/verify):
node --env-file=.env.local scripts/dev-server.mjs    # → http://localhost:3000
#   (or use the Vercel CLI:  npx vercel dev)

```

The bundled demo package (`evidence/demo.json`) is already generated and committed, so the **"Load demo package"** button works out of the box. To regenerate it from raw source files (dev‑only — requires the originals in `_evidence_src/` and makes a Groq Whisper call):

```bash
node --env-file=.env.local scripts/build-demo.mjs
```

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel (framework: **Other**, zero‑config).
2. Add the `GROQ_API_KEY` environment variable in **Project → Settings → Environment Variables**.
3. Deploy. Static files are served directly; `api/verify.js` runs as a serverless function automatically.

## AI workflow (tools, usage, build vs. cut)

This prototype was built with an **AI‑agent‑driven workflow** using Claude Code (Opus) as the engineering assistant: the work moved through an explicit *brainstorm → spec → implementation‑plan → execute* pipeline, where each implementation task was handed to a fresh sub‑agent that followed test‑driven development (write the failing test, implement, prove it green), and the engine was verified end‑to‑end against the live API before the UI was wired. The **product's** runtime intelligence is **Groq**: `llama-3.3-70b-versatile` in JSON mode performs the consistency/corroboration/plausibility analysis and returns schema‑validated structured output, and `whisper-large-v3` transcribes the audio evidence so the recording's *content* (not just its existence) participates in corroboration. **What we built:** a real working verification engine with server‑side integrity capture, audio transcription, schema validation with a self‑repair retry, privacy redaction, and a privacy‑preserving certificate with copy‑paste attribution — plus the marketing page. **What we cut (deliberately):** no user accounts/database (custody is per‑request), no real C2PA/PGP source‑side signing pipeline (we instead explain *why* true cryptographic provenance needs source‑side signing — out of scope for a half‑day build), ad‑hoc upload is scoped to .txt and .mp3 (the full .docx/.pdf/audio package runs via the pre‑processed "Load demo package"), and server‑side document extraction is noted as the next step.

## Deliberate cuts

- No accounts / database — chain‑of‑custody is per‑request and certificates are generated live (not persisted across deploys).
- No C2PA / PGP source‑side signing — documented as the honest path to true provenance, intentionally out of scope.
- Ad‑hoc upload accepts **.txt and .mp3**; the full evidence package (.docx, .pdf, audio) runs via **"Load demo package"** (pre‑extracted to clean text / pre‑transcribed). Server‑side document extraction (e.g. mammoth for .docx, a PDF text parser) is the documented next step.
- Ad‑hoc audio is capped (~3.5 MB) for Vercel's 4.5 MB function request‑body limit; the assessment's ~11‑minute recording is pre‑transcribed in the demo package. The documented next step for large‑audio upload is **Vercel Blob client‑uploads** (browser → Blob storage → server fetch → Whisper), which bypasses the body limit.
- No zip upload — multi‑file drag‑and‑drop covers it without server‑side unzip.

---

_Prototype for the Objection "Project Silver" challenge. Not legal advice; reliability scores are AI‑generated assessments, not adjudications._
