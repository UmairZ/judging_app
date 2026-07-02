# Phase 2: Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve onboarding — organizers sign up (Google/email), create orgs and competitions from a dashboard, and judges/displays join by code or organizer-provisioned device; custom claims are fully retired.

**Architecture:** All tenant-shell writes (org, competition, member docs) go through Cloud Function callables (`createOrg`, `createCompetition`, `redeemJoinCode`, `mintJudgeToken`) so security rules keep `write: false` on those docs and atomicity comes from transactions. Dashboard org discovery uses a `users/{uid}/orgs/{orgId}` mirror doc written by the same callables — no collectionGroup indexes. Join codes are staff-created docs under the competition (client-side generation of an unambiguous 8-char code); redemption is a callable transaction that writes the member doc. Pure logic lives in `src/onboarding/logic.ts` (vitest-tested), wired into `functions/src/index.ts` via the same cross-import pattern as `src/zeffy/webhook.ts`.

**Tech Stack:** React 18 + Vite + TS, Firebase JS SDK v12 (Auth incl. Google popup + anonymous, Firestore, Functions), firebase-functions v6 (v2 onCall), vitest, rules-unit-testing.

**Spec:** `docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md` (§5 Auth & roles, §7 App surface, §12 Phase 2)

## Global Constraints

- All work on branch `saas-phase-2-onboarding`, branched off `saas`. Never touch `main`.
- `zeffyWebhook` in `functions/src/index.ts` stays byte-identical (rebuilt in Phase 3). The legacy `mintJudgeToken` is REPLACED this phase.
- No custom claims anywhere after this phase: `setCustomUserClaims` and claim-bearing `createCustomToken(uid, claims)` must not appear; `src/auth/claims.ts` is deleted.
- Id charset (org/comp/judge ids): `/^[A-Za-z0-9_-]{1,128}$/` (exists as `SEG` in `src/tenant/paths.ts` — export it rather than duplicating).
- Join-code alphabet (exact): `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I, L, O, 0, 1); code length 8; regex `/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/`.
- Provisioned-device uid (exact format): `{orgId}__{compId}__{judgeId}`; callable rejects if > 128 chars.
- Member doc shapes unchanged from Phase 1: org `{ role: 'owner' | 'admin' }`; comp `{ role: 'judge' | 'display', judgeId?: string }`.
- Mirror doc (exact): `users/{uid}/orgs/{orgId}` = `{ role: 'owner' | 'admin', name: string }`; client read-own only, written only by callables.
- Join code doc (exact): `orgs/{o}/competitions/{c}/joinCodes/{CODE}` = `{ role: 'judge' | 'display', judgeId?: string, redeemedBy: string | null, redeemedAt?: Timestamp | null, createdAt: Timestamp }`; staff create requires `redeemedBy == null`; update client-forbidden (redeem is callable-only); staff may delete (revoke).
- New competitions are created with `status: 'setup'` and seeded `config/structure` = `DEFAULT_STRUCTURE_CONFIG`, `config/scoring` = `DEFAULT_SCORING_CONFIG`.
- Commands: unit `npm test`; rules `npm run test:rules` (Windows: `taskkill /F /IM java.exe` first if port 8080 is stuck); build `npm run build`; functions build `npm --prefix functions run build`.
- No new npm dependencies (no QR library — show link + code text). Inline styles, house palette from `src/ui/theme.ts`.

---

### Task 1: Onboarding pure logic

**Files:**
- Create: `src/onboarding/logic.ts`
- Create: `src/onboarding/logic.test.ts`
- Modify: `src/tenant/paths.ts` (export `SEG`; add `parseRoute`)
- Modify: `src/tenant/paths.test.ts` (add `parseRoute` cases)

**Interfaces:**
- Consumes: `SEG` charset from `src/tenant/paths.ts`.
- Produces (later tasks use these exact names):
  - `JOIN_CODE_RE: RegExp`, `generateJoinCode(): string`
  - `slugifyOrgId(name: string): string`
  - `validateIds(...ids: string[]): boolean` (all match SEG)
  - `provisionedUid(orgId, compId, judgeId): string` (throws `Error('uid too long')` if > 128)
  - `validateRedeem(code: { role: string; judgeId?: string; redeemedBy: string | null } | null): { role: 'judge' | 'display'; judgeId: string | null }` — throws `Error('not-found')`, `Error('already-redeemed')`, `Error('corrupt-code')`
  - `parseRoute(pathname): { kind: 'root' } | { kind: 'tenant'; orgId; compId } | { kind: 'join'; orgId; compId; code: string | null }`

- [ ] **Step 1: Write the failing tests**

Create `src/onboarding/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { JOIN_CODE_RE, generateJoinCode, slugifyOrgId, validateIds, provisionedUid, validateRedeem } from './logic';

describe('generateJoinCode', () => {
  it('produces 8 chars from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) expect(generateJoinCode()).toMatch(JOIN_CODE_RE);
  });
  it('does not repeat across a small sample', () => {
    const s = new Set(Array.from({ length: 50 }, generateJoinCode));
    expect(s.size).toBe(50);
  });
});

describe('slugifyOrgId', () => {
  it('lowercases, hyphenates spaces, strips unsafe chars', () => {
    expect(slugifyOrgId('Ibn Katheer Masjid!')).toBe('ibn-katheer-masjid');
    expect(slugifyOrgId('  Al-Noor  Center  ')).toBe('al-noor-center');
  });
  it('caps at 128 and never returns empty for weird input', () => {
    expect(slugifyOrgId('ب').length).toBeGreaterThan(0);
    expect(slugifyOrgId('x'.repeat(300)).length).toBeLessThanOrEqual(128);
  });
});

describe('validateIds / provisionedUid', () => {
  it('accepts safe ids, rejects unsafe', () => {
    expect(validateIds('demo', '2026', 'j1')).toBe(true);
    expect(validateIds('de mo')).toBe(false);
    expect(validateIds('')).toBe(false);
  });
  it('builds the tenant-qualified uid', () => {
    expect(provisionedUid('demo', '2026', 'j1')).toBe('demo__2026__j1');
  });
  it('throws when the uid would exceed 128 chars', () => {
    expect(() => provisionedUid('a'.repeat(60), 'b'.repeat(60), 'c'.repeat(20))).toThrow('uid too long');
  });
});

describe('validateRedeem', () => {
  it('accepts an unredeemed judge code', () => {
    expect(validateRedeem({ role: 'judge', judgeId: 'j1', redeemedBy: null })).toEqual({ role: 'judge', judgeId: 'j1' });
  });
  it('accepts an unredeemed display code', () => {
    expect(validateRedeem({ role: 'display', redeemedBy: null })).toEqual({ role: 'display', judgeId: null });
  });
  it('rejects missing, redeemed, and corrupt codes', () => {
    expect(() => validateRedeem(null)).toThrow('not-found');
    expect(() => validateRedeem({ role: 'judge', judgeId: 'j1', redeemedBy: 'u9' })).toThrow('already-redeemed');
    expect(() => validateRedeem({ role: 'judge', redeemedBy: null })).toThrow('corrupt-code');
    expect(() => validateRedeem({ role: 'weird', redeemedBy: null })).toThrow('corrupt-code');
  });
});
```

Add to `src/tenant/paths.test.ts`:

```ts
import { parseRoute } from '../onboarding/logic';

describe('parseRoute', () => {
  it('root for /, single segment, invalid ids', () => {
    expect(parseRoute('/')).toEqual({ kind: 'root' });
    expect(parseRoute('/demo')).toEqual({ kind: 'root' });
  });
  it('tenant for /{org}/{comp} and deeper non-join paths', () => {
    expect(parseRoute('/demo/2026')).toEqual({ kind: 'tenant', orgId: 'demo', compId: '2026' });
    expect(parseRoute('/demo/2026/leaderboard')).toEqual({ kind: 'tenant', orgId: 'demo', compId: '2026' });
  });
  it('join with and without a code', () => {
    expect(parseRoute('/demo/2026/join/JUDGE234')).toEqual({ kind: 'join', orgId: 'demo', compId: '2026', code: 'JUDGE234' });
    expect(parseRoute('/demo/2026/join')).toEqual({ kind: 'join', orgId: 'demo', compId: '2026', code: null });
    expect(parseRoute('/demo/2026/join/bad-code!')).toEqual({ kind: 'join', orgId: 'demo', compId: '2026', code: null });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/onboarding/logic.test.ts src/tenant/paths.test.ts`
Expected: FAIL — cannot resolve `./logic`.

- [ ] **Step 3: Implement**

In `src/tenant/paths.ts`, change the `SEG` constant to an export (`export const SEG = /^[A-Za-z0-9_-]{1,128}$/;`) — nothing else changes there.

Create `src/onboarding/logic.ts`:

```ts
import { SEG, parseTenantPath } from '../tenant/paths';

// Unambiguous code alphabet: no I, L, O, 0, 1.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** 8-char join code from crypto randomness (~40 bits — plenty for short-lived, revocable codes). */
export function generateJoinCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Suggest a URL-safe org id from a display name; user can edit before submitting. */
export function slugifyOrgId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 128);
  return slug || 'org';
}

export function validateIds(...ids: string[]): boolean {
  return ids.every((id) => SEG.test(id));
}

/** Auth uid for an organizer-provisioned device — tenant-qualified so seats never collide across tenants. */
export function provisionedUid(orgId: string, compId: string, judgeId: string): string {
  const uid = `${orgId}__${compId}__${judgeId}`;
  if (uid.length > 128) throw new Error('uid too long');
  return uid;
}

export interface JoinCodeDoc {
  role: string;
  judgeId?: string;
  redeemedBy: string | null;
}

/** Decide whether a join code is redeemable; the callable maps thrown messages to HttpsError codes. */
export function validateRedeem(code: JoinCodeDoc | null): { role: 'judge' | 'display'; judgeId: string | null } {
  if (!code) throw new Error('not-found');
  if (code.redeemedBy) throw new Error('already-redeemed');
  if (code.role === 'judge') {
    if (typeof code.judgeId !== 'string' || !code.judgeId) throw new Error('corrupt-code');
    return { role: 'judge', judgeId: code.judgeId };
  }
  if (code.role === 'display') return { role: 'display', judgeId: null };
  throw new Error('corrupt-code');
}

export type Route =
  | { kind: 'root' }
  | { kind: 'tenant'; orgId: string; compId: string }
  | { kind: 'join'; orgId: string; compId: string; code: string | null };

export function parseRoute(pathname: string): Route {
  const t = parseTenantPath(pathname);
  if (!t) return { kind: 'root' };
  const segs = pathname.split('/').filter(Boolean);
  if (segs[2] === 'join') {
    const code = segs[3] && JOIN_CODE_RE.test(segs[3]) ? segs[3] : null;
    return { kind: 'join', ...t, code };
  }
  return { kind: 'tenant', ...t };
}
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/onboarding/logic.test.ts src/tenant/paths.test.ts` → PASS.
Run: `npm test && npm run build` → all green.

- [ ] **Step 5: Commit**

```bash
git add src/onboarding/ src/tenant/paths.ts src/tenant/paths.test.ts
git commit -m "feat(onboarding): pure logic — join codes, org slugs, provisioned uids, route parsing"
```

---

### Task 2: Cloud Function callables

**Files:**
- Modify: `functions/src/index.ts` (keep `zeffyWebhook` byte-identical; replace legacy `mintJudgeToken`; add three callables)

**Interfaces:**
- Consumes: `validateIds`, `provisionedUid`, `validateRedeem`, `JOIN_CODE_RE` from `../../src/onboarding/logic`; `DEFAULT_STRUCTURE_CONFIG` from `../../src/domain/structure`; `DEFAULT_SCORING_CONFIG` from `../../src/scoring/config`.
- Produces callables the client invokes by name (all region `us-central1`):
  - `createOrg({ orgId, name })` → `{ orgId }`
  - `createCompetition({ orgId, compId, name })` → `{ compId }`
  - `redeemJoinCode({ orgId, compId, code })` → `{ role, judgeId }`
  - `mintJudgeToken({ orgId, compId, judgeId })` → `{ token }` (now tenant-scoped)

- [ ] **Step 1: Replace the legacy mintJudgeToken and add the callables**

In `functions/src/index.ts`: delete the old `mintJudgeToken` export and the `import { judgeClaims } from '../../src/auth/claims';` line. Leave `zeffyWebhook` and its imports untouched. Add:

```ts
import { FieldValue } from 'firebase-admin/firestore'; // already imported — keep single import
import { validateIds, provisionedUid, validateRedeem, JOIN_CODE_RE } from '../../src/onboarding/logic';
import { DEFAULT_STRUCTURE_CONFIG } from '../../src/domain/structure';
import { DEFAULT_SCORING_CONFIG } from '../../src/scoring/config';

const REGION = { region: 'us-central1', invoker: 'public' } as const;

function requireAuth(req: { auth?: { uid: string } | null }): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'sign in first');
  return req.auth.uid;
}

async function requireOrgStaff(uid: string, orgId: string): Promise<void> {
  const m = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  const role = m.data()?.role;
  if (role !== 'owner' && role !== 'admin') throw new HttpsError('permission-denied', 'org staff only');
}

// Create an org + owner membership + dashboard mirror, atomically. Fails if the id is taken.
export const createOrg = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, name } = (req.data ?? {}) as { orgId?: unknown; name?: unknown };
  if (typeof orgId !== 'string' || typeof name !== 'string' || !validateIds(orgId) || !name.trim()) {
    throw new HttpsError('invalid-argument', 'invalid org id or name');
  }
  try {
    const batch = db.batch();
    batch.create(db.doc(`orgs/${orgId}`), { name: name.trim(), ownerUid: uid, plan: 'free', createdAt: FieldValue.serverTimestamp() });
    batch.set(db.doc(`orgs/${orgId}/members/${uid}`), { role: 'owner' });
    batch.set(db.doc(`users/${uid}/orgs/${orgId}`), { role: 'owner', name: name.trim() });
    await batch.commit();
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) {
      throw new HttpsError('already-exists', 'that org id is taken');
    }
    throw err;
  }
  return { orgId };
});

// Create a competition with default config docs. Caller must be org staff.
export const createCompetition = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, name } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof name !== 'string' || !validateIds(orgId, compId) || !name.trim()) {
    throw new HttpsError('invalid-argument', 'invalid ids or name');
  }
  await requireOrgStaff(uid, orgId);
  const base = `orgs/${orgId}/competitions/${compId}`;
  try {
    const batch = db.batch();
    batch.create(db.doc(base), { name: name.trim(), status: 'setup', createdAt: FieldValue.serverTimestamp() });
    batch.set(db.doc(`${base}/config/structure`), DEFAULT_STRUCTURE_CONFIG);
    batch.set(db.doc(`${base}/config/scoring`), DEFAULT_SCORING_CONFIG);
    await batch.commit();
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) {
      throw new HttpsError('already-exists', 'that competition id is taken');
    }
    throw err;
  }
  return { compId };
});

// Redeem a join code: transactionally consume the code and write the member doc.
export const redeemJoinCode = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, code } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof code !== 'string' || !validateIds(orgId, compId) || !JOIN_CODE_RE.test(code)) {
    throw new HttpsError('invalid-argument', 'invalid join request');
  }
  const base = `orgs/${orgId}/competitions/${compId}`;
  try {
    const result = await db.runTransaction(async (tx) => {
      const codeRef = db.doc(`${base}/joinCodes/${code}`);
      const snap = await tx.get(codeRef);
      const grant = validateRedeem(snap.exists ? (snap.data() as { role: string; judgeId?: string; redeemedBy: string | null }) : null);
      tx.set(db.doc(`${base}/members/${uid}`), grant.role === 'judge' ? { role: 'judge', judgeId: grant.judgeId } : { role: 'display' });
      if (grant.judgeId) tx.set(db.doc(`${base}/judges/${grant.judgeId}`), { uid }, { merge: true });
      tx.update(codeRef, { redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp() });
      return grant;
    });
    return result;
  } catch (err) {
    const msg = (err as Error)?.message;
    if (msg === 'not-found') throw new HttpsError('not-found', 'code not recognized');
    if (msg === 'already-redeemed') throw new HttpsError('failed-precondition', 'code already used');
    if (msg === 'corrupt-code') throw new HttpsError('failed-precondition', 'code is invalid');
    throw err;
  }
});

// Provision a device for a judge seat (org-supplied hardware). Tenant-scoped, no custom claims:
// the minted uid's authority comes entirely from the member doc written here.
export const mintJudgeToken = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, judgeId } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof judgeId !== 'string' || !validateIds(orgId, compId, judgeId)) {
    throw new HttpsError('invalid-argument', 'invalid ids');
  }
  await requireOrgStaff(uid, orgId);
  const base = `orgs/${orgId}/competitions/${compId}`;
  const seat = await db.doc(`${base}/judges/${judgeId}`).get();
  if (!seat.exists) throw new HttpsError('not-found', 'unknown judge seat');
  let deviceUid: string;
  try {
    deviceUid = provisionedUid(orgId, compId, judgeId);
  } catch {
    throw new HttpsError('invalid-argument', 'ids too long for a device uid');
  }
  await db.doc(`${base}/members/${deviceUid}`).set({ role: 'judge', judgeId });
  await db.doc(`${base}/judges/${judgeId}`).set({ uid: deviceUid }, { merge: true });
  const token = await getAuth().createCustomToken(deviceUid);
  return { token };
});
```

- [ ] **Step 2: Build functions + full client suite**

Run: `npm --prefix functions run build`
Expected: esbuild bundles clean (pure logic imports, no React in the graph).
Run: `npm test && npm run build` → green (client untouched, but confirms nothing broke via shared files).

- [ ] **Step 3: Grep guard — no claims remain in functions**

Run: `grep -n "judgeClaims\|setCustomUserClaims\|createCustomToken(.*,\s*{" functions/src/index.ts`
Expected: no matches (`createCustomToken(deviceUid)` has no claims argument).

- [ ] **Step 4: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(functions): createOrg/createCompetition/redeemJoinCode callables, tenant-scoped mintJudgeToken"
```

---

### Task 3: Security rules — joinCodes, users mirror, competition list

**Files:**
- Modify: `firestore.rules`
- Modify: `src/data/firestore.rules.test.ts`

**Interfaces:**
- Consumes: Phase 1 helper functions in the rules file (`isSignedIn`, `isOrgStaff`, `isCompMember`, `canReadComp`).
- Produces the rules contract Tasks 5–6 rely on: staff can LIST competitions in their org; staff create/delete (never update) joinCodes with `redeemedBy == null` on create; users read only their own `users/{uid}/orgs` mirror.

- [ ] **Step 1: Add failing rules tests**

In `src/data/firestore.rules.test.ts`, add to the `beforeEach` seed block (inside `withSecurityRulesDisabled`):

```ts
await setDoc(doc(db, 'users/staff1/orgs/org1'), { role: 'owner', name: 'Org One' });
await setDoc(doc(db, `${P1}/joinCodes/JUDGE234`), { role: 'judge', judgeId: 'jC', redeemedBy: null });
```

Add new describe blocks:

```ts
import { collection, getDocs } from 'firebase/firestore';

describe('competitions listing', () => {
  it('org staff can list their competitions; foreign staff and judges cannot', async () => {
    await assertSucceeds(getDocs(collection(as('staff1'), 'orgs/org1/competitions')));
    await assertFails(getDocs(collection(as('staff2'), 'orgs/org1/competitions')));
    await assertFails(getDocs(collection(as('uJudgeA'), 'orgs/org1/competitions')));
  });
});

describe('join codes — staff-managed, secret from judges', () => {
  it('staff can create an unredeemed code and delete (revoke) one', async () => {
    await assertSucceeds(setDoc(doc(as('staff1'), `${P1}/joinCodes/NEWCODE2`), { role: 'judge', judgeId: 'jC', redeemedBy: null }));
    await assertSucceeds(deleteDoc(doc(as('staff1'), `${P1}/joinCodes/JUDGE234`)));
  });
  it('staff cannot create a pre-redeemed code and cannot update one (redeem is callable-only)', async () => {
    await assertFails(setDoc(doc(as('staff1'), `${P1}/joinCodes/SNEAKYY2`), { role: 'judge', judgeId: 'jC', redeemedBy: 'uEvil' }));
    await assertFails(updateDoc(doc(as('staff1'), `${P1}/joinCodes/JUDGE234`), { redeemedBy: 'x' }));
  });
  it('judges and foreign staff cannot read or write codes', async () => {
    await assertFails(getDoc(doc(as('uJudgeA'), `${P1}/joinCodes/JUDGE234`)));
    await assertFails(getDoc(doc(as('staff2'), `${P1}/joinCodes/JUDGE234`)));
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/joinCodes/HACKED22`), { role: 'judge', judgeId: 'jA', redeemedBy: null }));
  });
});

describe('users mirror — read own only', () => {
  it('a user reads their own org mirror; others cannot; nobody writes client-side', async () => {
    await assertSucceeds(getDoc(doc(as('staff1'), 'users/staff1/orgs/org1')));
    await assertFails(getDoc(doc(as('staff2'), 'users/staff1/orgs/org1')));
    await assertFails(setDoc(doc(as('staff1'), 'users/staff1/orgs/org2'), { role: 'owner', name: 'X' }));
  });
});
```

Run: `npm run test:rules` → the new `assertSucceeds` cases FAIL (no matching rules yet); existing 21 stay green.

- [ ] **Step 2: Extend firestore.rules**

Inside `match /orgs/{orgId} { match /competitions/{compId} { ... } }`, change the competition doc rule from `allow read:` to a get/list split, and add the joinCodes match:

```
match /competitions/{compId} {
  allow get: if canReadComp(orgId, compId);
  allow list: if isOrgStaff(orgId);   // dashboard lists an org's competitions
  allow write: if false;              // creation via createCompetition callable

  // ... existing member/config/... matches unchanged ...

  // Join codes are secrets between org staff and the function that redeems them.
  // Staff create (unredeemed only) and revoke; redemption is callable-only.
  match /joinCodes/{code} {
    allow read, delete: if isOrgStaff(orgId);
    allow create: if isOrgStaff(orgId) && request.resource.data.redeemedBy == null;
    allow update: if false;
  }
}
```

At the top level (sibling of `match /orgs/{orgId}`), add:

```
// Dashboard mirror maintained by callables; a user sees only their own org list.
match /users/{uid}/orgs/{orgId} {
  allow read: if isSignedIn() && request.auth.uid == uid;
  allow write: if false;
}
```

- [ ] **Step 3: Run rules tests**

Run: `npm run test:rules`
Expected: all green (21 old + 7 new assertions across 5 new tests).

- [ ] **Step 4: Commit**

```bash
git add firestore.rules src/data/firestore.rules.test.ts
git commit -m "feat(rules): join codes, users mirror, staff competition listing"
```

---

### Task 4: Sign-in screen + auth methods + route gate

**Files:**
- Modify: `src/auth/AuthContext.tsx` (add `signInGoogle`, `signUpEmail`; rename `signInAdmin` → `signInEmail`)
- Create: `src/onboarding/SignInScreen.tsx`
- Modify: `src/App.tsx` (route on `parseRoute`; remove inline `AdminLogin`; display role → Projector)
- Modify: `src/judge/JudgeApp.tsx` (rename `signInAdmin` → `signInEmail` in `AdminReentry` usage)

**Interfaces:**
- Consumes: `parseRoute` (Task 1); `useMembership` (Phase 1); `Projector` from `src/admin/Projector.tsx` (prop-less).
- Produces: `useAuth()` = `{ user, loading, signInEmail, signUpEmail, signInGoogle, signOut }`; `<SignInScreen />` (no props); App routes: signed-out → SignInScreen; root → `OrgDashboard` (Task 5 — until then a placeholder import breaks, so Tasks 4+5 SHARE ONE COMMIT GATE: implement Task 4 through Step 3, then Task 5, then run/commit both. The task boundary stays for review clarity.)

Note for the implementer: to keep the app compiling per-commit, Task 4 Step 4 (App.tsx rewiring) lands in the same commit as Task 5. Do Task 4 Steps 1–3, commit auth+screen; then Task 5 includes the App.tsx rewiring.

- [ ] **Step 1: AuthContext methods**

Replace the sign-in section of `src/auth/AuthContext.tsx`:

```tsx
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

with implementations inside `AuthProvider`:

```tsx
const signInEmail = async (email: string, password: string) => {
  await signInWithEmailAndPassword(auth, email, password);
};
const signUpEmail = async (email: string, password: string) => {
  await createUserWithEmailAndPassword(auth, email, password);
};
const signInGoogle = async () => {
  await signInWithPopup(auth, new GoogleAuthProvider());
};
```

Update the context default and provider value accordingly. Then fix ALL `signInAdmin` call sites so this task's build stays green: `src/judge/JudgeApp.tsx` (destructure + `AdminReentry` props) AND the old `AdminLogin` inside `src/App.tsx` (destructure + dev-shortcut button) — rename to `signInEmail` in place; Task 5 deletes `AdminLogin` entirely. Grep guard: `grep -rn "signInAdmin" src` → no matches.

- [ ] **Step 2: SignInScreen**

Create `src/onboarding/SignInScreen.tsx` (house style; replaces the old AdminLogin including its dev shortcuts):

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { C, serif, arabic } from '../ui/theme';

const field: React.CSSProperties = { width: '100%', background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.ink, marginBottom: 14, fontFamily: 'inherit', boxSizing: 'border-box' };

export default function SignInScreen() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await (mode === 'signin' ? signInEmail(email, password) : signUpEmail(email, password));
    } catch {
      setError(mode === 'signin' ? 'Sign-in failed — check the email and password.' : 'Sign-up failed — try a different email or a longer password.');
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      await signInGoogle();
    } catch {
      setError('Google sign-in was cancelled or failed.');
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontFamily: arabic, fontSize: 18, color: C.brassDark, direction: 'rtl', marginBottom: 10 }}>بسم الله</div>
      <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 24 }}>Run Quran competitions — judging, live scores, leaderboards.</div>

      <div style={{ width: '100%', maxWidth: 360 }}>
        <button onClick={google} disabled={busy} style={{ width: '100%', background: '#fff', color: C.ink, fontSize: 14.5, fontWeight: 600, padding: 13, borderRadius: 8, border: '1px solid #D8D0BE', cursor: busy ? 'default' : 'pointer', marginBottom: 18 }}>
          Continue with Google
        </button>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>— or with email —</div>
        <form onSubmit={submit}>
          <input style={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input style={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          {error && <div style={{ color: C.fail, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ width: '100%', background: C.green, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 8, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} style={{ marginTop: 14, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </div>

      {import.meta.env.DEV && (
        <div style={{ marginTop: 26, fontSize: 12.5, color: C.muted }}>
          <div>Dev · emulator admin: <code>admin@ibnkatheer.local</code> / <code>admin123</code></div>
          <button onClick={() => void signInEmail('j1@judge.local', 'judge123')} style={{ marginTop: 8, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Sign in as a judge (j1)</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit (screen + auth only — App rewiring lands with Task 5)**

Run: `npm test && npm run build` → green (SignInScreen is not yet imported; that's fine, tsc compiles it standalone).

```bash
git add src/auth/AuthContext.tsx src/onboarding/SignInScreen.tsx src/judge/JudgeApp.tsx
git commit -m "feat(auth): google + email sign-up, SignInScreen"
```

---

### Task 5: Org dashboard + App routing rewire

**Files:**
- Create: `src/onboarding/OrgDashboard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/admin/AdminApp.tsx` (add "← Dashboard" link)

**Interfaces:**
- Consumes: callables `createOrg`/`createCompetition` (Task 2) via `httpsCallable(getFunctions(app, 'us-central1'), name)`; `useCollection` from `src/data/db.ts` with absolute paths (`users/{uid}/orgs`, `orgs/{orgId}/competitions`); `slugifyOrgId`, `validateIds` (Task 1); `parseRoute` (Task 1); `SignInScreen` (Task 4); `JoinScreen` arrives in Task 6 — App.tsx imports it here with a stub? NO: App.tsx routes `kind: 'join'` to the JoinScreen only in Task 6; in this task, `kind: 'join'` renders the tenant flow's NoAccess path (temporary, replaced next task).
- Produces: `<OrgDashboard />` (no props); App routing: signed-out → SignInScreen; `root` → OrgDashboard; `tenant` → TenantProvider tree (unchanged); display role → `<Projector />`.

- [ ] **Step 1: OrgDashboard**

Create `src/onboarding/OrgDashboard.tsx`:

```tsx
import { useState } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '../firebase/app';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../data/db';
import { slugifyOrgId, validateIds } from './logic';
import { C, serif } from '../ui/theme';

interface OrgMirror { role: string; name: string }
interface CompDoc { name: string; status: string }

const fns = getFunctions(app, 'us-central1');
const input: React.CSSProperties = { background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: C.ink, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', marginBottom: 10 };
const primaryBtn: React.CSSProperties = { background: C.green, color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' };

export default function OrgDashboard() {
  const { user, signOut } = useAuth();
  const orgs = useCollection<OrgMirror>(`users/${user!.uid}/orgs`);
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, padding: '40px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep }}>Your organizations</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>
            {user?.email ?? user?.uid} · <span onClick={() => void signOut()} style={{ color: C.green, cursor: 'pointer', textDecoration: 'underline' }}>Sign out</span>
          </div>
        </div>

        {orgs.map((o) => <OrgSection key={o.id} orgId={o.id} name={o.name} />)}
        {orgs.length === 0 && !creating && (
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 20 }}>No organizations yet — create one to run your first competition.</div>
        )}

        {creating ? (
          <CreateOrgForm onDone={() => setCreating(false)} />
        ) : (
          <button onClick={() => setCreating(true)} style={primaryBtn}>+ New organization</button>
        )}
      </div>
    </div>
  );
}

function OrgSection({ orgId, name }: { orgId: string; name: string }) {
  const comps = useCollection<CompDoc>(`orgs/${orgId}/competitions`);
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ background: C.cream, borderRadius: 10, padding: '20px 24px', marginBottom: 18, boxShadow: '0 4px 16px rgba(20,40,36,.08)' }}>
      <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: C.greenDeep, marginBottom: 12 }}>{name} <span style={{ fontSize: 12, color: C.muted, fontFamily: 'inherit' }}>/{orgId}</span></div>
      {comps.map((c) => (
        <div key={c.id} onClick={() => { window.location.href = `/${orgId}/${c.id}`; }} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#fff', borderRadius: 8, marginBottom: 8, cursor: 'pointer', border: '1px solid #EAE3D3' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{c.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{c.status} · /{orgId}/{c.id} →</div>
        </div>
      ))}
      {comps.length === 0 && <div style={{ fontSize: 13, color: C.sub, marginBottom: 8 }}>No competitions yet.</div>}
      {adding ? <CreateCompForm orgId={orgId} onDone={() => setAdding(false)} /> : (
        <button onClick={() => setAdding(true)} style={{ ...primaryBtn, background: 'transparent', color: C.green, border: `1px solid ${C.green}`, padding: '8px 14px' }}>+ New competition</button>
      )}
    </div>
  );
}

function CreateOrgForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIds(orgId) || !name.trim()) { setError('Give the organization a name and a URL id (letters, numbers, - or _).'); return; }
    setBusy(true); setError('');
    try {
      await httpsCallable(fns, 'createOrg')({ orgId, name: name.trim() });
      onDone();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create the organization.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ background: C.cream, borderRadius: 10, padding: '20px 24px', maxWidth: 420 }}>
      <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 12 }}>New organization</div>
      <input style={input} placeholder="Organization name" value={name} onChange={(e) => { setName(e.target.value); if (!idTouched) setOrgId(slugifyOrgId(e.target.value)); }} autoFocus />
      <input style={input} placeholder="URL id (e.g. ibn-katheer)" value={orgId} onChange={(e) => { setIdTouched(true); setOrgId(e.target.value); }} />
      {error && <div style={{ color: C.fail, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={busy} style={primaryBtn}>{busy ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={onDone} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  );
}

function CreateCompForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [compId, setCompId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIds(compId) || !name.trim()) { setError('Give the competition a name and a URL id (letters, numbers, - or _).'); return; }
    setBusy(true); setError('');
    try {
      await httpsCallable(fns, 'createCompetition')({ orgId, compId, name: name.trim() });
      window.location.href = `/${orgId}/${compId}`;
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create the competition.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <input style={input} placeholder="Competition name (e.g. 2027 Ramadan Contest)" value={name} onChange={(e) => { setName(e.target.value); if (!idTouched) setCompId(slugifyOrgId(e.target.value)); }} autoFocus />
      <input style={input} placeholder="URL id (e.g. 2027)" value={compId} onChange={(e) => { setIdTouched(true); setCompId(e.target.value); }} />
      {error && <div style={{ color: C.fail, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={busy} style={primaryBtn}>{busy ? 'Creating…' : 'Create & open'}</button>
        <button type="button" onClick={onDone} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Rewire App.tsx**

Replace `src/App.tsx` content: delete the inline `AdminLogin` and `NoCompetition` components; route via `parseRoute`. Keep `Splash`, `GateShell`, `NoAccess`.

```tsx
import { useMemo } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { MembershipProvider, useMembership } from './auth/MembershipContext';
import { TenantProvider } from './tenant/TenantContext';
import { parseRoute } from './onboarding/logic';
import SignInScreen from './onboarding/SignInScreen';
import OrgDashboard from './onboarding/OrgDashboard';
import JudgeApp from './judge/JudgeApp';
import AdminApp from './admin/AdminApp';
import Projector from './admin/Projector';
import { C, serif } from './ui/theme';

function Routed() {
  const { user, loading } = useAuth();
  const route = useMemo(() => parseRoute(window.location.pathname), []);
  if (loading) return <Splash />;
  if (route.kind === 'join') {
    // Task 6 swaps this for <JoinScreen route={route} /> — until then joiners see sign-in / no-access.
    if (!user) return <SignInScreen />;
  }
  if (!user) return <SignInScreen />;
  if (route.kind === 'root') return <OrgDashboard />;
  return (
    <TenantProvider orgId={route.orgId} compId={route.compId}>
      <MembershipProvider>
        <RoleGate />
      </MembershipProvider>
    </TenantProvider>
  );
}

function RoleGate() {
  const { role, loading } = useMembership();
  if (loading) return <Splash />;
  if (role === 'admin') return <AdminApp />;
  if (role === 'judge') return <JudgeApp />;
  if (role === 'display') return <Projector />;
  return <NoAccess />;
}
```

(`Splash`, `GateShell`, `NoAccess` stay as in Phase 1 — `GateShell`/`NoAccess` unchanged below.)

In `src/admin/AdminApp.tsx`, in the bottom sidebar block (next to Sign out), add:

```tsx
<div onClick={() => { window.location.href = '/'; }} style={{ cursor: 'pointer', fontSize: 13, color: '#9DBDB4' }}>← Dashboard</div>
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build` → green. Grep guard: `grep -n "AdminLogin\|NoCompetition" src` → no matches.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/onboarding/OrgDashboard.tsx src/admin/AdminApp.tsx
git commit -m "feat(onboarding): org dashboard, create org/competition, route rewire, display role → projector"
```

---

### Task 6: Join codes — organizer UI + JoinScreen

**Files:**
- Modify: `src/admin/Devices.tsx` (join-code management + callable payload update)
- Create: `src/onboarding/JoinScreen.tsx`
- Modify: `src/App.tsx` (route `kind: 'join'` → JoinScreen)
- Modify: `src/data/types.ts` (add `JoinCodeDoc` client type and `uid?` on `JudgeDoc`)

**Interfaces:**
- Consumes: `generateJoinCode` (Task 1); `redeemJoinCode`/`mintJudgeToken` callables (Task 2); joinCodes rules (Task 3); `useTenant().tp`, `writeDoc`/`removeDoc`/`useCollection`.
- Produces: `<JoinScreen orgId compId code />`; joinCodes UI inside the Provisioning tab.

- [ ] **Step 1: Client types**

In `src/data/types.ts` add:

```ts
export interface JudgeDoc {
  name: string;
  active: boolean;
  uid?: string; // set when a device/person claims this seat (join code or provisioning)
}

export interface JoinCodeDoc {
  role: 'judge' | 'display';
  judgeId?: string;
  redeemedBy: string | null;
  createdAt: unknown;
}
```

(JudgeDoc gains only the optional `uid` — keep existing fields.)

- [ ] **Step 2: Devices.tsx — tenant-scoped provisioning + join codes**

In `src/admin/Devices.tsx`:

1. The provision call gains tenant ids — the component already has `const { tp } = useTenant();`; extend to `const { orgId, compId, tp } = useTenant();` and change the callable payload to `fn({ orgId, compId, judgeId: selectedJudgeId })` (type param `{ orgId: string; compId: string; judgeId: string }`).
2. Subscribe to codes: `const joinCodes = useCollection<JoinCodeDoc>(tp('joinCodes'));`
3. Add a join-code panel (render it below the existing provisioning card, house style):

```tsx
function codeLink(orgId: string, compId: string, code: string) {
  return `${window.location.origin}/${orgId}/${compId}/join/${code}`;
}

// inside the component render, after the provisioning card:
<div style={{ flex: '0 0 auto', minWidth: 300, maxWidth: 620, marginTop: 24 }}>
  <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
    Join codes — judges bring their own device
  </div>
  <div style={{ background: C.cream, borderRadius: 6, padding: '16px 22px', boxShadow: '0 6px 22px rgba(20,40,36,.14)' }}>
    {judges.map((j) => {
      const code = joinCodes.find((c) => c.role === 'judge' && c.judgeId === j.id);
      return (
        <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #EAE3D3', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{j.name}</div>
          {code ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
              <code style={{ background: '#fff', border: '1px solid #D8D0BE', borderRadius: 6, padding: '4px 8px', fontWeight: 700, letterSpacing: '.08em' }}>{code.id}</code>
              <span style={{ color: code.redeemedBy ? C.green : C.muted }}>{code.redeemedBy ? 'joined ✓' : 'waiting'}</span>
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
    {/* display seat */}
    {(() => {
      const code = joinCodes.find((c) => c.role === 'display');
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 2px', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Projector / display screen</div>
          {code ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
              <code style={{ background: '#fff', border: '1px solid #D8D0BE', borderRadius: 6, padding: '4px 8px', fontWeight: 700, letterSpacing: '.08em' }}>{code.id}</code>
              <span style={{ color: code.redeemedBy ? C.green : C.muted }}>{code.redeemedBy ? 'connected ✓' : 'waiting'}</span>
              <button onClick={() => { void navigator.clipboard.writeText(codeLink(orgId, compId, code.id)); }} style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontSize: 12.5, textDecoration: 'underline' }}>Copy link</button>
              <button onClick={() => { void removeDoc(tp(`joinCodes/${code.id}`)); }} style={{ background: 'none', border: 'none', color: C.fail, cursor: 'pointer', fontSize: 12.5 }}>Revoke</button>
            </div>
          ) : (
            <button onClick={() => { void writeDoc(tp(`joinCodes/${generateJoinCode()}`), { role: 'display', redeemedBy: null, createdAt: now() }, false); }} style={{ background: 'none', border: `1px solid ${C.green}`, color: C.green, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              Generate code
            </button>
          )}
        </div>
      );
    })()}
  </div>
</div>
```

Add the imports this needs: `writeDoc, removeDoc, now` from `../data/db`, `generateJoinCode` from `../onboarding/logic`, `JoinCodeDoc` from `../data/types`.

- [ ] **Step 3: JoinScreen**

Create `src/onboarding/JoinScreen.tsx`:

```tsx
import { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app, auth } from '../firebase/app';
import { useAuth } from '../auth/AuthContext';
import { JOIN_CODE_RE } from './logic';
import { C, serif, arabic } from '../ui/theme';

export default function JoinScreen({ orgId, compId, code: urlCode }: { orgId: string; compId: string; code: string | null }) {
  const { user } = useAuth();
  const [code, setCode] = useState(urlCode ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!JOIN_CODE_RE.test(trimmed)) { setError('That code doesn’t look right — 8 letters/numbers.'); return; }
    setBusy(true);
    setError('');
    try {
      // Judges normally arrive signed out — an anonymous account is their identity for the event.
      if (!auth.currentUser) await signInAnonymously(auth);
      await httpsCallable(getFunctions(app, 'us-central1'), 'redeemJoinCode')({ orgId, compId, code: trimmed });
      window.location.href = `/${orgId}/${compId}`;
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not join — check the code with your organizer.');
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontFamily: arabic, fontSize: 18, color: C.brassDark, direction: 'rtl', marginBottom: 10 }}>بسم الله</div>
      <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep, marginBottom: 6 }}>Join the competition</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 22 }}>Enter the code your organizer gave you.</div>
      <div style={{ width: '100%', maxWidth: 300 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="JOIN CODE"
          maxLength={8}
          style={{ width: '100%', textAlign: 'center', letterSpacing: '.35em', fontWeight: 700, fontSize: 20, background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '14px 10px', color: C.ink, boxSizing: 'border-box', marginBottom: 14, textTransform: 'uppercase' }}
        />
        {error && <div style={{ color: C.fail, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button onClick={() => void join()} disabled={busy} style={{ width: '100%', background: C.green, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 8, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Joining…' : user && !user.isAnonymous ? `Join as ${user.email ?? 'this account'}` : 'Join'}
        </button>
      </div>
    </div>
  );
}
```

In `src/App.tsx` `Routed`, replace the temporary join branch with:

```tsx
if (route.kind === 'join') return <JoinScreen orgId={route.orgId} compId={route.compId} code={route.code} />;
```

(placed BEFORE the `if (!user)` gate — joiners are usually signed out; the screen handles anonymous sign-in itself). Add the import.

- [ ] **Step 4: Verify + commit**

Run: `npm test && npm run build` → green.

```bash
git add src/admin/Devices.tsx src/onboarding/JoinScreen.tsx src/App.tsx src/data/types.ts
git commit -m "feat(onboarding): join-code management and judge/display join flow"
```

---

### Task 7: Claims retirement, seed, README, verification

**Files:**
- Delete: `src/auth/claims.ts`, `src/auth/claims.test.ts`, `src/auth/access.ts`, `src/auth/access.test.ts`
- Modify: `src/auth/membership.ts` (own the `Role` type)
- Modify: `functions/seed.mjs` (users mirror + demo join codes)
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `export type Role = 'admin' | 'judge' | 'display'` now lives in `src/auth/membership.ts`.

- [ ] **Step 1: Move Role, delete dead files**

In `src/auth/membership.ts`, replace `import type { Role } from './claims';` with:

```ts
export type Role = 'admin' | 'judge' | 'display';
```

Delete the four files (`claims.ts`, `claims.test.ts`, `access.ts`, `access.test.ts` — access is dead code: only its own test imports it; re-verify with `grep -rn "from './access'\|from '../auth/access'" src` → only the test file). Grep guard: `grep -rn "claims" src functions/src --include=*.ts --include=*.tsx` → no functional references remain (comments OK).

- [ ] **Step 2: Seed — users mirror + demo join codes**

In `functions/seed.mjs` `main()`, after the org member doc write, add:

```js
await db.doc(`users/${admin.uid}/orgs/demo`).set({ role: 'owner', name: 'Demo Organization' });
```

After the judge seat writes, add a fourth unclaimed seat + codes, and put j4 on the panel so a joined judge has a queue to grade (the panel doc write becomes `judgeIds: ['j1', 'j2', 'j3', 'j4']`):

```js
await db.doc(p('judges/j4')).set({ name: 'Ustadha Zaynab', active: true });
await db.doc(p('panels/sisters')).set({ name: "Sisters' Panel", judgeIds: ['j1', 'j2', 'j3', 'j4'] });
await db.doc(p('joinCodes/JUDGE234')).set({ role: 'judge', judgeId: 'j4', redeemedBy: null, createdAt: FieldValue.serverTimestamp() });
await db.doc(p('joinCodes/SCREEN22')).set({ role: 'display', redeemedBy: null, createdAt: FieldValue.serverTimestamp() });
```

Update the completion console.log to mention the join codes.

- [ ] **Step 3: README**

Update the dev flow: emulator start now needs functions too — `npm --prefix functions run build` first, then `firebase emulators:start --only firestore,auth,functions`. Document: sign-up at `/` (Google or email), org dashboard, join links `/{org}/{comp}/join/{CODE}`, demo codes `JUDGE234` (judge seat Ustadha Zaynab) and `SCREEN22` (display) on tenant `demo/2026`. Note custom claims are fully retired.

- [ ] **Step 4: Full verification + commit**

Run: `npm test && npm run test:rules && npm run build && npm --prefix functions run build` → all green.

```bash
git add -A
git commit -m "feat(onboarding): retire custom claims, seed join codes + dashboard mirror, docs"
```

---

## End-to-end smoke (controller, after all tasks)

1. `npm --prefix functions run build`; `npx firebase emulators:start --only firestore,auth,functions`; seed; `npm run dev`.
2. `/` → create a NEW account (email) → dashboard empty state → create org `test-org` → create competition `2026` → lands in `/test-org/2026` AdminApp with default config (ScoringConfig shows defaults).
3. Existing tenant: as `admin@ibnkatheer.local` open `/demo/2026` → Provisioning tab → codes JUDGE234/SCREEN22 visible; generate + revoke works.
4. Incognito/second context: open `/demo/2026/join/JUDGE234` → Join → lands in JudgeApp as "Ustadha Zaynab"; grade one question → Saved.
5. `/demo/2026/join/SCREEN22` in another context → Projector renders.
6. Redeeming JUDGE234 again → "code already used".

## Post-plan checklist

- Merge `saas-phase-2-onboarding` → `saas` via PR.
- Phase 3 (intake) picks up: manual add + CSV import, per-tenant Zeffy webhook rebuild.
