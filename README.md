# Ibn Katheer Qur'an Competition — Judging App

A PWA for running a Qur'an memorization contest: judges grade contestants live on
their own devices, scores roll up to a live leaderboard, and an audience projector
shows standings. Replaces a Google Forms workflow.

**Live:** https://ubayy.app (prod) · https://ubayy-sandbox.web.app (sandbox)

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

# 1. build functions (the emulator runs compiled output, not TS source)
npm --prefix functions run build

# 2. start the emulators (firestore, auth, functions)
npm run emulators

# 3. seed fake contest data (in another shell)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=demo-ubayy \
  node functions/seed.mjs

# 4. run the app
npm run dev
```

Sign up at `/` (Google or email) to land on your org dashboard, where you can
create an org and a competition. Existing tenants are reached by join links
of the form `/{org}/{comp}/join/{CODE}`.

The seed script provisions tenant `demo/2026` with an admin
(`admin@ibnkatheer.local` / `admin123`) and two demo join codes: `JUDGE234`
(judge seat "Ustadha Zaynab") and `SCREEN22` (display/projector). Open
`http://localhost:5173/demo/2026/join/JUDGE234` or `.../join/SCREEN22` to
redeem them. Custom claims are fully retired — all authorization is via
Firestore member docs (`orgs/{org}/members`, `orgs/{org}/competitions/{comp}/members`).

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

## Deploy your own instance

**Prerequisites:**
- A Firebase project on the **Blaze plan** (required for Cloud Functions)
- `npx firebase login` to authenticate your machine

**Setup:**

1. **Enable services** in your Firebase console:
   - Authentication: Email/Password, Google, Anonymous sign-in
   - Firestore Database (start in production mode)
   - Cloud Storage
   - Cloud Functions (gen 2)

2. **Update your project config:**
   - Copy your Firebase web-app config from the console
   - Paste it into `src/firebase/app.ts` (the `firebaseConfig` object — it's public client config, safe to commit)

3. **Deploy:**
   ```bash
   npx firebase use --add              # select your project
   npm --prefix functions install
   npm install
   npx firebase deploy                 # deploys hosting, functions, and Firestore + Storage rules
   ```

4. **Use the app:**
   - Navigate to your hosting URL
   - Sign up with email or Google
   - Create an organization and competition
   - Intake, judging, and live results all run from the app — no env vars required

**Optional hardening (App Check):**
For production, set up reCAPTCHA v3 protection:
- Create a reCAPTCHA v3 key in your reCAPTCHA admin console
- Set `VITE_APPCHECK_SITE_KEY` at build time: create a `.env.production` file in the repo root containing `VITE_APPCHECK_SITE_KEY=your_key` (Vite picks it up automatically), then `npm run build`
- In `functions/.env`, set `ENFORCE_APP_CHECK=true`
- Enable App Check enforcement in your Firebase console

**Note:** A migration script for importing pre-SaaS single-tenant data is available on request.

## How it fits together

- **Structure** (`config/structure`) defines categories × divisions, which
  generate **slots**. Each slot is assigned one **panel**; judges are grouped
  into panels. Editing structure regenerates slots live.
- **Registrations** arrive via three intake paths (all promoted by an admin into
  **contestants + enrollments**):
  - Manual: Contestants → + New, enter details directly.
  - CSV: Registrations → Import CSV, accepts headers `name`/`full name`, `gender`,
    `dob`/`date of birth`, `category`/`categories`; multi-category separators `;`/`|`.
    Duplicate name+DOB rows are treated as the same person and report "already
    imported" — give contestants distinct DOBs (or names) to import both.
  - Zeffy webhook: Configure the per-competition webhook URL + rotatable token in
    Registrations panel (no `ZEFFY_TOKEN` env required; webhook token is per-tenant
    and self-service rotatable).
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
  auth/      AuthContext + membership helpers (admin / judge / display roles)
  admin/     admin screens (leaderboard, structure, panels, scoring, …)
  judge/     judge dashboard + grading screen + tie-break flow
  zeffy/     webhook payload parsing
functions/   Cloud Functions (zeffyWebhook, mintJudgeToken) + emulator seed
             (seed.mjs creates the demo/2026 tenant under orgs/demo/competitions/2026)
```

Cloud Functions (`zeffyWebhook`, `mintJudgeToken`) are legacy single-tenant and
are rebuilt tenant-scoped in Phases 2–3 of the SaaS work — see
`docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md`.
