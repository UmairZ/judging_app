# Ibn Katheer Qur'an Competition — Judging App

A PWA for running a Qur'an memorization contest: judges grade contestants live on
their own devices, scores roll up to a live leaderboard, and an audience projector
shows standings. Replaces a Google Forms workflow.

**Live:** https://ibn-katheer-judging-bc25d.web.app

## Stack

- **React 18 + Vite + TypeScript** (strict), **Vitest** for tests
- **Firebase** — Firestore (offline-first via `persistentLocalCache`), Auth,
  Cloud Functions (gen 2), Hosting, Storage
- Pure, framework-free **scoring engine** in `src/scoring/`

## Local development

Dev runs against the local Firebase **emulator suite** (`.env.development` sets
`VITE_USE_EMULATOR=1`; production builds use the real project in
`src/firebase/app.ts`).

```bash
npm install
(cd functions && npm install)

# 1. start the emulators (functions, firestore, auth, storage)
npx firebase emulators:start --only functions,firestore,auth,storage

# 2. seed fake contest data (in another shell)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=ibn-katheer-judging-bc25d \
  node functions/seed.mjs

# 3. run the app
npm run dev
```

Open `http://localhost:5173/demo/2026` (not the bare root — the bare root now
shows a "No competition selected" screen, since the app is served at
`/{orgId}/{compId}`). Seeded logins (emulator only): admin
`admin@ibnkatheer.local` / `admin123`; the sign-in screen also has a dev
"Sign in as a judge (j1)" shortcut (`j1@judge.local` / `judge123`).

## Testing

```bash
npm test            # unit tests (scoring engine, etc.) — vitest run
npm run test:rules  # Firestore security-rules tests against the emulator
```

## Deploy

```bash
npm run build
npx firebase deploy            # hosting + functions + rules
# or scope it: npx firebase deploy --only hosting
```

## How it fits together

- **Structure** (`config/structure`) defines categories × divisions, which
  generate **slots**. Each slot is assigned one **panel**; judges are grouped
  into panels. Editing structure regenerates slots live.
- **Registrations** arrive from Zeffy (`zeffyWebhook` function) → an admin
  **promotes** them into **contestants + enrollments**.
- **Judges** are provisioned per-device: the admin mints a scoped custom token
  (`mintJudgeToken` function), the device signs in as that judge (no judge
  password). A long-press on the top-left corner re-opens admin sign-in.
- **Grading** is offline-tolerant — marks write to the local cache first and
  sync when connectivity returns. Scores recompute live into the **leaderboard**
  (with manual placement override + sudden-death tie-breaks).

## Project layout

```
src/
  scoring/   pure scoring engine (weights, deductions, tie-breaks) + tests
  domain/    structure config, slot generation, id helpers
  data/      Firestore hooks (useCollection/useDocData), writeDoc, sync state
  firebase/  client init (emulator vs prod)
  auth/      AuthContext + claim helpers (admin / judge roles)
  admin/     admin screens (leaderboard, structure, panels, scoring, …)
  judge/     judge dashboard + grading screen + tie-break flow
  zeffy/     webhook payload parsing
functions/   Cloud Functions (zeffyWebhook, mintJudgeToken) + emulator seed
             (seed.mjs creates the demo/2026 tenant under orgs/demo/competitions/2026)
```

Cloud Functions (`zeffyWebhook`, `mintJudgeToken`) are legacy single-tenant and
are rebuilt tenant-scoped in Phases 2–3 of the SaaS work — see
`docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md`.
