# Sourcery

> Your notes, turned into questions. With receipts.

An AI-powered study reviewer that turns your own materials (PDF/DOCX) into interactive questions — and shows its source for every one. Built to the PRD in `Sourcery.docx` (v1.1).

**Current status: Phases 1–3 complete** — foundation (auth, schema, RLS, dashboard), upload + extraction + jobs, and the AI pipeline (coverage planning, generation, 4-layer validation, dedupe, honest shortfall). Phase 4 (review experience) is next.

> To run generation end-to-end you must set `GROQ_API_KEY` in `.env.local` and run `npm run dev:all` (web + worker). The deterministic pipeline is covered by `npm run test:pipeline`.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase: Auth (email verification required), PostgreSQL with RLS on every table, private Storage
- Groq as primary AI provider (free tier; contractually does not train on inputs — PRD §27.4), abstracted behind the Vercel AI SDK so providers stay swappable
- pg-boss (Postgres-backed queue) for background jobs — extraction + generation workers

## Setup

1. Create a Supabase project (free tier is fine).
2. In Authentication → Providers → Email, keep **Confirm email** enabled. Set your site URL and add `http://localhost:3000/auth/callback` to redirect URLs.
3. Copy `supabase/migrations/0001_init.sql` into the Supabase SQL editor and run it (creates all tables, RLS policies, the private `source-documents` bucket, and the profile trigger).
4. `cp .env.local.example .env.local` and fill in the values from Supabase → Project Settings → API (plus `DATABASE_URL` for pg-boss later).
5. `npm install && npm run dev`

## Route map (PRD §28.4)

| Route | Purpose | Phase |
|---|---|---|
| `/` | Landing | 1 |
| `/login`, `/signup`, `/verify-email` | Auth (email confirmation required) | 1 |
| `/dashboard` | Reviewer cards, Create Reviewer CTA, empty state | 1 |
| `/reviewers/new` | Create reviewer + upload material | 2 |
| `/reviewers/[id]` | Branches on status: verify / generate / ready | 2–3 |
| `/api/reviewers/[id]` | DELETE with hard cascade + storage cleanup | 1 |

## Key product rules (do not break)

- **The uploaded material is the source of truth.** No supporting source evidence = no question (PRD §3).
- Layered validation L1–L4 before any question is stored (PRD §18).
- Never fabricate questions to hit a requested count (PRD §25).
- RLS on every table; API keys never reach the browser; private storage only (PRD §27).
- Hard delete with cascade — deleting a reviewer removes its files, chunks, questions, and attempts (PRD §26.3).

## Decisions resolved from PRD §38 (Open Questions)

| # | Question | Decision |
|---|---|---|
| 1 | Job runner | pg-boss on Supabase Postgres + worker functions |
| 3 | AI models | Groq split (Phase 3): generation `openai/gpt-oss-120b`, L2 closed-evidence `qwen/qwen3.8-27b` (cross-vendor), L3 judge `openai/gpt-oss-20b`; each env-overridable |
| 4 | Dedupe method | L4 fact-key comparison (Jaccard over question+answer content tokens); no embeddings provider needed |
| 5 | Minimum viable count | 5 — below that, refuse with an honest message; between 5 and requested, show the shortfall screen |
| 9 | Delete policy | Hard delete with cascade |
| 10 | Email verification | Required at signup |

Still open: extraction libraries (#2, resolved Phase 2: unpdf + mammoth), exact quotas after cost measurement (#6), languages (#7), provider data terms (#8).
