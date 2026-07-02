# Phase 4: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production readiness — landing page, config-driven App Check, member removal (the missing half of Revoke), tenant-scoped photo storage un-locked, competition-existence gate + small hardening, and self-hoster deployment docs.

**Architecture:** `removeMember` joins the existing callable family (admin SDK owns membership writes; it deletes the comp member doc, clears the seat pointer, and deletes codes redeemed by that uid). Storage rules gain cross-service `firestore.get()` membership checks over the tenant path `orgs/{o}/competitions/{c}/contestants/{id}/photo` — the client reuses `tp()` since Firestore and Storage tenant paths are intentionally identical. App Check is opt-in by configuration: the client initializes only when `VITE_APPCHECK_SITE_KEY` is set; callables enforce only when the functions env sets `ENFORCE_APP_CHECK=true` — dev and self-hosters keep working with zero setup.

**Tech Stack:** Existing stack; `firebase/app-check` (part of the already-installed firebase SDK — no new dependency).

**Spec:** `docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md` §12 Phase 4, plus the accumulated follow-up ledger.

## Global Constraints

- All work on branch `saas-phase-4-polish`, branched off `saas`. Never touch `main`.
- No new npm dependencies (`firebase/app-check` ships inside the `firebase` package). Inline styles, house palette (`src/ui/theme.ts`).
- `removeMember` removes ONLY competition members with role `judge` or `display` — never org staff (`failed-precondition` otherwise). It must: delete the member doc, `FieldValue.delete()` the seat's `uid` field when the member had a `judgeId`, and delete every joinCode doc whose `redeemedBy` equals the removed uid.
- `redeemJoinCode` gains a staff guard: an org owner/admin redeeming a code → `failed-precondition` (staff don't need seats; prevents accidental code burn).
- Storage path (exact): `orgs/{orgId}/competitions/{compId}/contestants/{contestantId}/photo` — same shape as the Firestore tenant path so `tp()` builds it. Write: org staff only, `< 5MB`, contentType `image/*`. Read: org staff or competition member.
- App Check env names (exact): client `VITE_APPCHECK_SITE_KEY` (reCAPTCHA v3 site key); functions `ENFORCE_APP_CHECK` (`'true'` to enforce). Neither set → behavior identical to today. The Zeffy webhook NEVER enforces App Check (Zeffy's servers can't attest; its token is the boundary).
- Landing page shows for signed-out visitors at `/` only; signed-out visitors on tenant/join URLs go straight to their existing screens.
- Id charset stays `/^[A-Za-z0-9_-]{1,128}$/` (SEG / `validateIds`).
- Commands: unit `npm test` (112 baseline); rules `npm run test:rules` (28 baseline); build `npm run build`; functions `npm --prefix functions run build`. Emulator port cleanup ONLY via `bash .superpowers/sdd/kill-emulators.sh` — NEVER `taskkill /IM java.exe` (other Java processes on this machine must not be killed).

---

### Task 1: `removeMember` callable + staff-redeem guard + rules test

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `src/data/firestore.rules.test.ts` (one new test; no rules change)

**Interfaces:**
- Consumes: existing `requireAuth`, `requireOrgStaff`, `validateIds`, `db`, `FieldValue`, `HttpsError`, `REGION`.
- Produces: callable `removeMember({ orgId, compId, memberUid })` → `{ removed: true }` (Task 2's UI invokes it by this exact name/payload).

- [ ] **Step 1: Rules test first (no rules change expected — pins an untested denial)**

In `src/data/firestore.rules.test.ts`, add to the `beforeEach` seed block:

```ts
await setDoc(doc(db, `${P1}/members/uNoSeat`), { role: 'judge' }); // corrupt: judge with no judgeId
```

Add to the sessions describe block:

```ts
it('a judge member doc without a judgeId cannot create sessions', async () => {
  await assertFails(setDoc(doc(as('uNoSeat'), `${P1}/sessions/sq`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  await assertFails(setDoc(doc(as('uNoSeat'), `${P1}/sessions/sq2`), { enrollmentId: 'e1', questions: [] }));
});
```

Run: `npm run test:rules` → 29 tests, all green (the rules already deny via the field comparison; this pins it).

- [ ] **Step 2: staff-redeem guard**

In `functions/src/index.ts` `redeemJoinCode`, after `requireAuth` and input validation, before the transaction:

```ts
// Staff don't need seats — and letting them redeem burns the code for the real judge.
const callerOrg = await db.doc(`orgs/${orgId}/members/${uid}`).get();
const callerRole = callerOrg.data()?.role;
if (callerRole === 'owner' || callerRole === 'admin') {
  throw new HttpsError('failed-precondition', 'organizers open competitions from the dashboard — codes are for judges and displays');
}
```

- [ ] **Step 3: removeMember callable**

Add below `mintJudgeToken` in `functions/src/index.ts`:

```ts
// Kick a competition member (judge/display): delete their membership, free the seat,
// and delete any codes they redeemed so the seat can be re-issued. Org staff are
// managed elsewhere — this callable refuses to touch them.
export const removeMember = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, memberUid } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof memberUid !== 'string' || !validateIds(orgId, compId, memberUid)) {
    throw new HttpsError('invalid-argument', 'invalid ids');
  }
  await requireOrgStaff(uid, orgId);
  const base = `orgs/${orgId}/competitions/${compId}`;
  const memberRef = db.doc(`${base}/members/${memberUid}`);
  const member = await memberRef.get();
  if (!member.exists) throw new HttpsError('not-found', 'not a member of this competition');
  const role = member.data()?.role;
  if (role !== 'judge' && role !== 'display') {
    throw new HttpsError('failed-precondition', 'only judge and display members can be removed here');
  }
  const judgeId = member.data()?.judgeId;
  const redeemed = await db.collection(`${base}/joinCodes`).where('redeemedBy', '==', memberUid).get();
  const batch = db.batch();
  batch.delete(memberRef);
  if (typeof judgeId === 'string' && judgeId) {
    batch.set(db.doc(`${base}/judges/${judgeId}`), { uid: FieldValue.delete() }, { merge: true });
  }
  redeemed.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return { removed: true };
});
```

- [ ] **Step 4: Verify + commit**

Run: `npm --prefix functions run build && npm test && npm run build` → green.

```bash
git add functions/src/index.ts src/data/firestore.rules.test.ts
git commit -m "feat(polish): removeMember callable, staff-redeem guard, seatless-judge rules test"
```

---

### Task 2: Kick UI — unified per-seat state in the join-codes panel

**Files:**
- Modify: `src/admin/Devices.tsx` (join-codes panel rows)

**Interfaces:**
- Consumes: `removeMember` callable (Task 1); existing `joinCodes` subscription, `judges` list (each `JudgeDoc` may carry `uid?: string` — set by both redeem and provisioning), `useTenant()` `{orgId, compId, tp}`, `httpsCallable`/`getFunctions` pattern already used in this file.
- Produces: per-judge row states: **connected** (judge.uid set) → "connected · Kick"; else **code outstanding** → code + Copy link + Revoke; else → Generate code. Display row: redeemed code → "connected · Kick" (kick by `code.redeemedBy`), else same as today.

- [ ] **Step 1: Kick handler**

In the Devices component add:

```tsx
const [kicking, setKicking] = useState<string | null>(null);
const kickMember = async (memberUid: string) => {
  if (!window.confirm('Kick this device? It loses access immediately; generate a new code to re-admit.')) return;
  setKicking(memberUid);
  try {
    await httpsCallable(getFunctions(app, 'us-central1'), 'removeMember')({ orgId, compId, memberUid });
  } catch (err) {
    setStatusNote({ text: (err as { message?: string })?.message ?? 'Could not remove the member.', warn: true });
  } finally {
    setKicking(null);
  }
};
```

(Reuse the existing `httpsCallable`/`getFunctions`/`app` imports already present for provisioning; `statusNote` object state already exists.)

- [ ] **Step 2: Rework the judge rows**

Replace each judge row's right side in the join-codes panel with the three-state render:

```tsx
{judges.map((j) => {
  const code = joinCodes.find((c) => c.role === 'judge' && c.judgeId === j.id);
  return (
    <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #EAE3D3', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{j.name}</div>
      {j.uid ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ color: C.green }}>connected ✓</span>
          <button onClick={() => void kickMember(j.uid!)} disabled={kicking === j.uid} style={{ background: 'none', border: 'none', color: C.fail, cursor: 'pointer', fontSize: 12.5 }}>
            {kicking === j.uid ? 'Kicking…' : 'Kick'}
          </button>
        </div>
      ) : code ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <code style={{ background: '#fff', border: '1px solid #D8D0BE', borderRadius: 6, padding: '4px 8px', fontWeight: 700, letterSpacing: '.08em' }}>{code.id}</code>
          <span style={{ color: C.muted }}>waiting</span>
          <button onClick={() => { void navigator.clipboard.writeText(codeLink(orgId, compId, code.id)); }} style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontSize: 12.5, textDecoration: 'underline' }}>Copy link</button>
          <button onClick={() => { void removeDoc(tp(`joinCodes/${code.id}`)); }} style={{ background: 'none', border: 'none', color: C.fail, cursor: 'pointer', fontSize: 12.5 }}>Revoke</button>
        </div>
      ) : (
        <button onClick={() => { void writeDoc(tp(`joinCodes/${generateJoinCode()}`), { role: 'judge', judgeId: j.id, redeemedBy: null, createdAt: now() }, false); }} style={{ background: 'none', border: `1px solid ${C.green}`, color: C.green, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          Generate code
        </button>
      )}
    </div>
  );
})}
```

Notes: the connected state keys off `j.uid` (covers BOTH join-code and provisioned devices — Task 1's callable clears it on kick, which also flips this row back). The redeemed-code sub-state disappears from judge rows (a redeemed code implies `j.uid` is set; the callable deletes the code on kick). The `waiting` code row keeps Revoke (unredeemed only — matches the Phase 2 gating).

- [ ] **Step 3: Display row kick**

In the display-seat block: when `code?.redeemedBy`, render "connected ✓ · Kick" (kick with `code.redeemedBy`) instead of the current status text; unredeemed and no-code states unchanged:

```tsx
{code && code.redeemedBy ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
    <span style={{ color: C.green }}>connected ✓</span>
    <button onClick={() => void kickMember(code.redeemedBy!)} disabled={kicking === code.redeemedBy} style={{ background: 'none', border: 'none', color: C.fail, cursor: 'pointer', fontSize: 12.5 }}>
      {kicking === code.redeemedBy ? 'Kicking…' : 'Kick'}
    </button>
  </div>
) : code ? (
  /* existing unredeemed code row: code + waiting + Copy link + Revoke */
) : (
  /* existing Generate code button */
)}
```

- [ ] **Step 4: Verify + commit**

Run: `npm test && npm run build` → green.

```bash
git add src/admin/Devices.tsx
git commit -m "feat(polish): kick connected devices from the provisioning panel"
```

---

### Task 3: Tenant-scoped photo storage

**Files:**
- Modify: `storage.rules` (full rewrite — currently locked `if false`)
- Modify: `src/admin/Contestants.tsx` (photo path + failure copy)

**Interfaces:**
- Consumes: `tp()` (Firestore and Storage tenant paths are the same shape by design); Firestore member docs (rules read them cross-service).
- Produces: working photo upload for org staff; photos readable by competition members.

- [ ] **Step 1: Rewrite storage.rules**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Membership lives in Firestore; storage rules read it cross-service.
    function isOrgStaff(orgId) {
      return request.auth != null
        && firestore.exists(/databases/(default)/documents/orgs/$(orgId)/members/$(request.auth.uid))
        && firestore.get(/databases/(default)/documents/orgs/$(orgId)/members/$(request.auth.uid)).data.role in ['owner', 'admin'];
    }
    function isCompMember(orgId, compId) {
      return request.auth != null
        && firestore.exists(/databases/(default)/documents/orgs/$(orgId)/competitions/$(compId)/members/$(request.auth.uid));
    }

    // Contestant photos, tenant-scoped (same path shape as the Firestore docs).
    match /orgs/{orgId}/competitions/{compId}/contestants/{contestantId}/photo {
      allow read: if isOrgStaff(orgId) || isCompMember(orgId, compId);
      allow write: if isOrgStaff(orgId)
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

(The old locked `/contestants/**` match is deleted — legacy flat paths fall to default deny.)

- [ ] **Step 2: Point the upload at the tenant path**

In `src/admin/Contestants.tsx` `handlePhotoFile`, change the path line:

```ts
const path = tp(`contestants/${selectedId}/photo`);
```

and the failure copy to: `'Photo upload failed — check the file is an image under 5 MB.'` (`tp` is already in scope from the Phase 1 sweep.)

- [ ] **Step 3: Verify + commit**

Run: `npm test && npm run build` → green. (Storage rules have no emulator test harness in this repo; the controller's end-to-end smoke uploads a photo against the storage emulator.)

```bash
git add storage.rules src/admin/Contestants.tsx
git commit -m "feat(polish): tenant-scoped photo storage with cross-service membership rules"
```

---

### Task 4: Client hardening bundle

**Files:**
- Modify: `src/App.tsx` (competition-existence gate)
- Modify: `src/auth/MembershipContext.tsx` (outside-provider guard)
- Modify: `src/admin/Registrations.tsx` (rotateToken busy/error)
- Modify: `src/admin/Registrations.tsx` (bulk-promote flash only on clean run)

**Interfaces:**
- Consumes: `useDocData`, `useTenant`, existing `GateShell`.
- Produces: `CompetitionGate` inside the tenant tree; `useMembership()` throws outside its provider.

- [ ] **Step 1: Competition-existence gate**

In `src/App.tsx`, wrap `RoleGate`'s output: after membership resolves and yields a role, verify the competition doc exists (readable by any member/staff per rules `get`):

```tsx
function RoleGate() {
  const { role, loading } = useMembership();
  const { orgId, compId } = useTenant();
  const comp = useDocData<{ name?: string }>(`orgs/${orgId}/competitions/${compId}`);
  if (loading || comp.loading) return <Splash />;
  // Org staff resolve to 'admin' even for a typo'd competition id — writing there
  // would create a ghost tenant. Gate on the competition doc actually existing.
  if (role === 'admin' && !comp.data) return <CompNotFound />;
  if (role === 'admin') return <AdminApp />;
  if (role === 'judge') return <JudgeApp />;
  if (role === 'display') return <Projector />;
  return <NoAccess />;
}

function CompNotFound() {
  return <GateShell title="Competition not found" body="No competition exists at this address. Check the link, or create it from your dashboard." />;
}
```

Add the `useDocData` and `useTenant` imports; keep everything else in `Routed` unchanged.

- [ ] **Step 2: useMembership guard**

In `src/auth/MembershipContext.tsx`: change the context default to `null`, and make the hook throw:

```tsx
const Ctx = createContext<Value | null>(null);
// ...provider unchanged...
export const useMembership = (): Value => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMembership must be used inside MembershipProvider');
  return v;
};
```

- [ ] **Step 3: rotateToken busy/error**

In `src/admin/Registrations.tsx`:

```tsx
const [rotating, setRotating] = useState(false);
const rotateToken = async () => {
  if (zeffyToken && !window.confirm('Rotate the webhook token? The old URL stops working immediately — update it in Zeffy.')) return;
  setRotating(true);
  try {
    await writeDoc(tp('config/zeffy'), { token: generateWebhookToken() });
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Could not update the token');
  } finally {
    setRotating(false);
  }
};
```

and `disabled={rotating}` on both the Rotate and Generate buttons (label `Rotating…`/`Generating…` while busy).

- [ ] **Step 4: bulk-promote flash only when clean**

In `handleBulkPromote`, track `let failed = false;` — set it in the catch before `break`, and afterwards:

```ts
if (!failed) {
  setFlash(`Promoted ${promoted} · ${skipped} need review (open each to resolve)`);
  setTimeout(() => setFlash(null), 6000);
}
```

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run build` → green.

```bash
git add src/App.tsx src/auth/MembershipContext.tsx src/admin/Registrations.tsx
git commit -m "feat(polish): competition-existence gate, membership guard, rotate/bulk-promote hardening"
```

---

### Task 5: App Check wiring (config-driven)

**Files:**
- Modify: `src/firebase/app.ts`
- Modify: `functions/src/index.ts` (callable options)

**Interfaces:**
- Consumes: env names from Global Constraints (`VITE_APPCHECK_SITE_KEY`, `ENFORCE_APP_CHECK`).
- Produces: a `CALLABLE` options const replacing `REGION` on the four member/tenant callables + `removeMember`; the webhook keeps plain `REGION`-style options.

- [ ] **Step 1: Client init**

In `src/firebase/app.ts`, after the `app` export:

```ts
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// App Check is opt-in by configuration: set VITE_APPCHECK_SITE_KEY (reCAPTCHA v3)
// to attest this web app. Unset (dev, self-hosters) → no-op.
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
if (appCheckKey) {
  if (import.meta.env.DEV) {
    // Emulator/dev: use a debug token instead of real attestation.
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true });
}
```

- [ ] **Step 2: Functions enforcement**

In `functions/src/index.ts`:

```ts
// App Check enforcement is deploy-time config: set ENFORCE_APP_CHECK=true in the
// functions env once the web app attests. The Zeffy webhook never enforces —
// Zeffy's servers can't attest; its per-competition token is the boundary.
const CALLABLE = { ...REGION, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' } as const;
```

and switch the five callables (`createOrg`, `createCompetition`, `redeemJoinCode`, `mintJudgeToken`, `removeMember`) from `onCall(REGION, …)` to `onCall(CALLABLE, …)`. `zeffyWebhook` stays as-is.

- [ ] **Step 3: Verify + commit**

Run: `npm test && npm run build && npm --prefix functions run build` → green (both envs unset → behavior unchanged).

```bash
git add src/firebase/app.ts functions/src/index.ts
git commit -m "feat(polish): config-driven App Check — client attestation and callable enforcement"
```

---

### Task 6: Landing page

**Files:**
- Create: `src/onboarding/LandingPage.tsx`
- Modify: `src/App.tsx` (signed-out root → landing)

**Interfaces:**
- Consumes: `SignInScreen` (rendered by the landing page when the visitor clicks a CTA).
- Produces: `<LandingPage />` (no props).

- [ ] **Step 1: LandingPage**

Create `src/onboarding/LandingPage.tsx`:

```tsx
import { useState } from 'react';
import SignInScreen from './SignInScreen';
import { C, serif, arabic } from '../ui/theme';

const FEATURES: { title: string; body: string }[] = [
  { title: 'Live judging', body: 'Judges score on their own phones or provisioned devices — offline-tolerant, synced the moment connectivity returns.' },
  { title: 'Fair scoring', body: 'Hifz, tajweed, and voice weighted your way. Raw deductions are the source of truth; scores recompute instantly when config changes.' },
  { title: 'Instant results', body: 'A live leaderboard and projector mode, recomputed from every synced session — no spreadsheets on finals night.' },
];

export default function LandingPage() {
  const [signIn, setSignIn] = useState(false);
  if (signIn) return <SignInScreen />;

  const cta: React.CSSProperties = { fontSize: 15, fontWeight: 700, padding: '13px 28px', borderRadius: 8, cursor: 'pointer', border: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 20%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
      <div style={{ maxWidth: 780, textAlign: 'center', paddingTop: '14vh' }}>
        <div style={{ fontFamily: arabic, fontSize: 20, color: C.brassDark, direction: 'rtl', marginBottom: 14 }}>بسم الله</div>
        <h1 style={{ fontFamily: serif, fontSize: 42, fontWeight: 600, color: C.greenDeep, margin: '0 0 14px', lineHeight: 1.15 }}>
          Run your Qur'an competition, end to end
        </h1>
        <p style={{ fontSize: 16.5, color: C.sub, lineHeight: 1.6, margin: '0 auto 30px', maxWidth: 560 }}>
          Registration to leaderboard: multi-judge scoring, live results, and projector-ready standings — built for memorization contests of any size.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 60 }}>
          <button onClick={() => setSignIn(true)} style={{ ...cta, background: C.green, color: '#fff' }}>Get started — it's free</button>
          <button onClick={() => setSignIn(true)} style={{ ...cta, background: 'transparent', color: C.green, border: `1.5px solid ${C.green}` }}>Sign in</button>
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 60 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ flex: '1 1 200px', maxWidth: 240, background: C.cream, borderRadius: 10, padding: '18px 20px', textAlign: 'left', boxShadow: '0 4px 16px rgba(20,40,36,.08)' }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55 }}>{f.body}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, paddingBottom: 30 }}>
          Open source — run it yourself, or sign up and go.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route it**

In `src/App.tsx` `Routed`: the signed-out branch becomes route-aware — root gets the landing, everything else keeps SignInScreen:

```tsx
if (!user) return route.kind === 'root' ? <LandingPage /> : <SignInScreen />;
```

(The `join` branch stays ABOVE this line, unchanged.) Add the import.

- [ ] **Step 3: Verify + commit**

Run: `npm test && npm run build` → green.

```bash
git add src/onboarding/LandingPage.tsx src/App.tsx
git commit -m "feat(polish): public landing page"
```

---

### Task 7: Self-hoster docs + full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: "Deploy your own instance" section**

Add after the Deploy section:
- Prereqs: a Firebase project (Blaze plan for Cloud Functions), `npx firebase login`.
- Enable: Authentication (Email/Password, Google, Anonymous), Firestore, Storage, Functions.
- Replace the `firebaseConfig` object in `src/firebase/app.ts` with your project's web-app config (it's public client config, safe to commit).
- `npx firebase use --add` → `npm --prefix functions install && npm install` → `npx firebase deploy`.
- Sign up at your hosting URL, create your organization and competition. Intake, judging, and results all run from the app — no env vars required.
- Optional hardening: App Check (create a reCAPTCHA v3 key, set `VITE_APPCHECK_SITE_KEY` at build time and `ENFORCE_APP_CHECK=true` in `functions/.env`, and enable enforcement in the console).
- Note: a migration script for pre-SaaS single-tenant data is available on request (tracked in the spec, not shipped).

- [ ] **Step 2: Full verification + commit**

Run: `npm test && npm run test:rules && npm run build && npm --prefix functions run build` → all green (112 unit / 29 rules expected).

```bash
git add README.md
git commit -m "docs(polish): self-hoster deployment guide"
```

---

## End-to-end smoke (controller, after all tasks)

1. Emulators (firestore, auth, functions, **storage**) + seed + dev server (`bash .superpowers/sdd/kill-emulators.sh` first if ports are held).
2. Signed out at `/` → landing page; "Get started" → SignInScreen. Signed out at `/demo/2026` → SignInScreen directly (no landing).
3. Admin at `/demo/nope` → "Competition not found" (not an empty AdminApp).
4. Contestants → select one → upload a small image → photo renders (storage emulator; tenant path).
5. Join `JUDGE234` in a fresh context (Ustadha Zaynab) → Provisioning shows her row "connected ✓ · Kick" → Kick → row returns to "Generate code"; the kicked context loses access (NoAccess on reload). Generate a new code for the seat → redeem works again.
6. As admin, open `/demo/2026/join/<that new code>` and try to redeem while signed in as staff → "organizers open competitions from the dashboard…" error; the code survives for the judge.
7. Registrations → Rotate token shows busy state and completes.

## Post-plan checklist

- Merge `saas-phase-4-polish` → `saas`.
- Spec §12 phases complete after this — next up is the roadmap proper (question generation engine first), each with its own spec → plan → branch.
- Remaining deferred ledger for roadmap-time: slot-assignment rules check, DOB format normalization, provisioned-uid `__x__` reserved-id tightening, double-click code idempotency, org-staff management UI.
