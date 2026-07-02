# Multi-Tenant SaaS Design — Quran Contest Judging Platform

**Date:** 2026-07-01
**Status:** Approved design, pre-implementation
**Branch strategy:** all SaaS work lands on the long-lived `saas` branch; each feature/phase is a sub-branch off `saas` merged back via PR. `main` stays frozen as the working single-tenant app for the upcoming hosted competition.

## 1. Goal

Turn the single-tenant Firebase judging app into a multi-tenant SaaS any Quran memorization competition worldwide can sign up for and use. The repo stays public: self-hosters clone it and deploy the same codebase to their own Firebase project — SaaS and self-host are one codebase, no divergence.

## 2. Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Competition types served | Quran memorization competitions only; engine stays hifz/tajweed/voice |
| Stack | Stay on Firebase (Firestore + Auth + Functions + Hosting), one project serves all tenants |
| Billing at launch | Free; `plan` field on org doc reserves the attachment point for future billing |
| Tenancy shape | Organization → competitions hierarchy |
| Judge access | Join code / invite link (Kahoot-style) **and** organizer-provisioned devices — both supported |
| Registration intake | Manual add + CSV import as core; Zeffy becomes an optional per-competition integration |
| Launch scope | Foundation + schema hooks only; all features below are post-launch roadmap items |

## 3. Architecture

One Firebase project serves all tenants. The existing React/Vite SPA and Cloud Functions are extended, not replaced. The scoring engine (`src/scoring/`), structure logic (`src/domain/`), and Zeffy parsers (`src/zeffy/`) are unchanged. The offline-first judge UI and live-snapshot patterns carry over as-is.

## 4. Data model

Every current top-level collection moves under a competition; document shapes are unchanged unless noted.

```
orgs/{orgId}
  name, ownerUid, plan: 'free', createdAt
orgs/{orgId}/members/{uid}
  role: 'owner' | 'admin'                        ← org staff
orgs/{orgId}/competitions/{compId}
  name, status: 'setup' | 'live' | 'archived', createdAt
orgs/{orgId}/competitions/{compId}/members/{uid}
  role: 'judge' | 'display', judgeId?            ← per-event people
orgs/{orgId}/competitions/{compId}/config/{doc}    scoring, structure, zeffy
orgs/{orgId}/competitions/{compId}/{judges|panels|assignments|contestants|
  enrollments|tiebreaks|registrations|sessions}/{id}
```

- Membership is **per-competition** for judges/displays (a 2026 judge is not automatically a 2027 judge). Org staff (`owner`/`admin`) have admin access to all competitions in their org.
- `src/data/db.ts` helpers already take string paths; screens obtain a `basePath` from a React tenant context (active org + competition) instead of using bare collection names.

### Schema hooks (fields added now so later features need no migration)

| Hook | Where | Why |
|---|---|---|
| `round: string` (default `'main'`) | enrollments, sessions | Multi-round competitions (prelims → finals) later without migration |
| `updatedBy: uid`, `updatedAt` | all admin-writable docs | Audit log can be backfilled via Firestore triggers later |
| `model: 'deduction-v1'` | scoring config | Structurally different rubrics later; presets are just named configs |
| `startedAt`, `endedAt` | sessions | Recording bookmark links / review features later |

## 5. Auth & roles

- **Organizers:** Firebase Auth sign-in (Google + email/password). "Create organization" writes the org doc and an `owner` member doc.
- **Custom claims are removed.** All authorization derives from member docs read by security rules. `src/auth/claims.ts` and `mintJudgeToken` are retired.
- **Judges/displays — two paths, organizer's choice per seat:**
  1. **Join code / link (BYO device):** the organizer creates a judge seat and the app shows a join link/QR containing a one-time code. The judge opens it on their own phone, signs in anonymously, and a callable function `redeemJoinCode` validates the code, writes the competition member doc (`role: 'judge', judgeId`), stamps the judge seat with the claimed uid, and marks the code redeemed.
  2. **Provisioned device (serious competitions, org-supplied hardware):** the organizer, signed in on the device, provisions it directly from the dashboard — a callable `mintJudgeToken` (tenant-scoped successor of today's function: caller must be org staff, seat must exist) returns a custom token; the device signs in as the seat and the member doc is written the same way.
  Display screens support the same two paths with a `display` code/seat. Both paths converge on identical member docs, so rules and the judge UI don't distinguish them.
- The judge's auth uid maps to their seat via the member doc's `judgeId`; session writes are validated against it.

## 6. Security rules

Per-request role resolution via `get()`:

- `isOrgStaff(orgId)` — org member doc exists with role owner/admin.
- `isCompMember(orgId, compId)` — competition member doc exists.

Current rule semantics carry over one-to-one: org staff ≈ today's admin; competition members read what signed-in users read today; a judge creates/updates only sessions whose `judgeId` matches their member doc's `judgeId`; registrations are immutable (create-only, admin); sessions are never deleted.

New invariant, and the critical one: **no path is readable or writable across org boundaries.** The existing emulator rules-test harness (`test:rules`) grows a cross-tenant denial matrix.

**App Check** is enabled — signup is public, so client attestation matters.

## 7. App surface & routing

- Tenant routes: `/{orgId}/{compId}/…` wrapping the existing admin/judge/display screens (already role-gated; they gain the tenant context).
- New thin screens: landing page, sign-in, org dashboard (list/create competitions, judge-seat join codes), join-code entry page.
- Judge and display UIs are unchanged apart from the data path.

## 8. Registration intake

- **Manual add** and **CSV import** are the core intake. CSV rows parse client-side into the existing registration shape (`source: 'csv'`) and flow through the current registration → enrollment pipeline unchanged.
- **Zeffy** becomes per-competition: webhook URL carries the tenant path (`/zeffyWebhook/{orgId}/{compId}`); the secret token is generated per competition and stored in that competition's config, replacing the single global `ZEFFY_TOKEN` env var.

## 9. Scale & cost

Per-tenant data stays tiny (dozens–hundreds of docs), so whole-collection subscriptions scoped to one competition remain correct. The rules `get()` adds one document read per request — negligible. Firestore scales horizontally with tenant count; no per-tenant infrastructure exists. Future billing limits attach to `orgs/{orgId}.plan`.

## 10. Testing

- Existing unit tests (scoring, structure, parsing) adapt with path changes only.
- Rules tests grow the cross-tenant matrix (every collection × foreign-org actor → deny).
- One end-to-end smoke flow: sign up → create org → create competition → add contestant (manual + CSV) → judge joins by code → grades offline/online → leaderboard shows.

## 11. Existing data / migration

The new schema ships fresh. The current live contest keeps running on `main` / the existing Firebase project. If this year's data should appear in the SaaS later, a one-off script copies the flat collections into one org/competition. Not part of any phase.

## 12. Phasing

Each phase is a sub-branch off `saas` and leaves the app deployable.

1. **Tenancy** — data model move, tenant context, routing, security rules + cross-tenant tests, schema hooks.
2. **Onboarding** — organizer sign-in, org dashboard, create-competition flow, judge/display join codes (`redeemJoinCode`).
3. **Intake** — manual add, CSV import, per-tenant Zeffy webhook.
4. **Polish** — landing page, App Check, docs for self-hosters, optional migration script.

## 13. Post-launch roadmap (each gets its own spec → plan → sub-branch)

Ordered roughly by expected value:

1. **Question generation engine** — Quran metadata dataset (e.g. Tanzil), random starting points within category range, repeat-avoidance across a slot, exclusion rules, judge reveal UI, generated questions stored on sessions for audit. The flagship differentiator.
2. **Mobile compatibility** — the app today is laptop/tablet (wide-screen) first. Two stages: (a) responsive web pass so all screens work on phones (judge grading first — it's the screen most likely to be used on a phone via join codes); (b) native iPhone/Android apps (evaluate wrapping the PWA vs. React Native once the responsive pass ships).
3. **i18n + RTL (Arabic first)** — near-mandatory for a worldwide Quran SaaS; schedule early because string-wrapping cost grows with the codebase.
4. **Small wins bundle** — scoring config templates (named presets at competition creation), recording bookmark links (base URL + start time → per-contestant `?t=` links + CSV export), results CSV export.
5. **OBS integration** — companion bridge using the obs-websocket API: when a session starts/ends, query the live recording/stream timecode and store precise per-contestant offsets (and optionally trigger record start/stop). Builds directly on the `startedAt`/`endedAt` hooks and the bookmark-links feature; degrades gracefully to plain timestamp links when OBS isn't connected.
6. **In-app session audio recording** — record recitation on the judge device, upload to Storage, attach to session for review/appeals.
7. **Multi-round competitions** — prelims → finals with advancement rules, building on the `round` field.
8. **Public results page + PDF certificates** — shareable read-only leaderboard, generated award certificates.
9. **Contestant check-in / queue** — "now serving" flow feeding the existing projector screen.
10. **Judge analytics** — inter-judge variance, outlier flagging (computable at read time from existing data).
11. **Audit log UI** — surface the `updatedBy`/`updatedAt` trail; optionally Firestore-trigger history docs.
12. **Public registration form** — per-competition shareable registration page writing into `registrations`.
13. **Billing** — Stripe (Firebase extension), limits gated on `orgs/{orgId}.plan`.
14. **First-run setup experience** — a guided configuration flow for new competitions (categories, divisions, question counts, scoring, judges, intake). **Deliberately sequenced last among product phases** (decided 2026-07-02): its contents depend on engines still to be built (scoring model updates, question generation engine, and configuration surfaces not yet identified), so building it earlier would mean rebuilding it after every engine change. Foundation hooks already in place: competitions are created with `status: 'setup'` (unused until this phase) and default config docs, and every configuration area has an editing screen the flow can deep-link into. Until this ships, new competitions start from the seeded defaults and organizers configure via the existing admin tabs.

## 14. Out of scope

- Non-Quran competition types / generic rubric engine.
- Livestream integrations beyond OBS (StreamYard, vMix, …) — add when real demand names the software; bookmark links cover them generically.
- Organization-level judge pools shared across competitions.
- Per-tenant Firebase projects.
