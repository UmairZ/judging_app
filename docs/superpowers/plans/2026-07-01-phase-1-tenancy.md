# Phase 1: Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the single-tenant judging app onto the multi-tenant data model `orgs/{orgId}/competitions/{compId}/…` with member-doc-based authorization, tenant-aware routing, cross-tenant-safe security rules, and the four schema hooks — leaving the app fully working against the emulator.

**Architecture:** A `TenantProvider` (from the URL `/{orgId}/{compId}`) supplies a path prefixer `tp()`; every Firestore call site wraps its relative path in `tp()`. Authorization moves from custom claims to member documents (`orgs/{o}/members/{uid}` for staff, `…/competitions/{c}/members/{uid}` for judges/displays) read by both the client (a `MembershipProvider`) and the security rules (`get()`). Cloud Functions are intentionally untouched this phase.

**Tech Stack:** React 18 + Vite + TypeScript, Firebase JS SDK v12 (Firestore/Auth), Vitest, `@firebase/rules-unit-testing` against the Firestore emulator.

**Spec:** `docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md` (§4–§7, §10, §12 Phase 1)

## Global Constraints

- All work happens on branch `saas/phase-1-tenancy`, branched off `saas`. Never commit to `main`.
- Do NOT touch `functions/src/index.ts` — `zeffyWebhook` and `mintJudgeToken` still reference flat paths and are rebuilt in Phases 2–3. They are inert against the new schema; that is expected.
- Do NOT delete `src/auth/claims.ts` or `src/auth/claims.test.ts` — `functions/src/index.ts` imports `judgeClaims`. Phase 2 retires it.
- Firestore path charset for org/comp ids: `/^[A-Za-z0-9_-]{1,128}$/` (matches the existing judgeId constraint in functions).
- Tenant base path shape (exact): `orgs/{orgId}/competitions/{compId}` — used identically in client code, rules, tests, and seed.
- Member doc shapes (exact): org member `{ role: 'owner' | 'admin' }`; competition member `{ role: 'judge' | 'display', judgeId?: string }`.
- Schema hook values (exact): `round: 'main'`, scoring config `model: 'deduction-v1'`.
- Commands: unit tests `npm test`; rules tests `npm run test:rules` (spawns the Firestore emulator itself — requires Java); typecheck+build `npm run build`.
- Code style: no new dependencies, no router library, inline styles like the rest of the codebase, comments only for non-obvious constraints.

---

### Task 1: Tenant path parsing + TenantContext

**Files:**
- Create: `src/tenant/paths.ts`
- Create: `src/tenant/paths.test.ts`
- Create: `src/tenant/TenantContext.tsx`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `parseTenantPath(pathname: string): { orgId: string; compId: string } | null`
  - `compBasePath(orgId: string, compId: string): string` → `orgs/{o}/competitions/{c}`
  - `TenantProvider({ orgId, compId, children })` React component
  - `useTenant(): { orgId: string; compId: string; tp: (rel: string) => string }` — `tp('judges')` → `orgs/{o}/competitions/{c}/judges`. Tasks 2, 4, 5 rely on exactly these names.

- [ ] **Step 1: Write the failing test**

Create `src/tenant/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseTenantPath, compBasePath } from './paths';

describe('parseTenantPath', () => {
  it('parses /{orgId}/{compId}', () => {
    expect(parseTenantPath('/demo/2026')).toEqual({ orgId: 'demo', compId: '2026' });
  });
  it('ignores trailing slashes and extra segments', () => {
    expect(parseTenantPath('/demo/2026/')).toEqual({ orgId: 'demo', compId: '2026' });
    expect(parseTenantPath('/demo/2026/leaderboard')).toEqual({ orgId: 'demo', compId: '2026' });
  });
  it('returns null for root, single segment, or empty', () => {
    expect(parseTenantPath('/')).toBeNull();
    expect(parseTenantPath('/demo')).toBeNull();
    expect(parseTenantPath('')).toBeNull();
  });
  it('rejects segments outside the safe charset', () => {
    expect(parseTenantPath('/de mo/2026')).toBeNull();
    expect(parseTenantPath('/demo/20%26')).toBeNull();
    expect(parseTenantPath('/a.b/2026')).toBeNull();
  });
});

describe('compBasePath', () => {
  it('builds the nested competition path', () => {
    expect(compBasePath('demo', '2026')).toBe('orgs/demo/competitions/2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tenant/paths.test.ts`
Expected: FAIL — cannot resolve `./paths`.

- [ ] **Step 3: Write minimal implementation**

Create `src/tenant/paths.ts`:

```ts
// Safe charset for org/competition ids — mirrors the judgeId constraint in functions.
const SEG = /^[A-Za-z0-9_-]{1,128}$/;

/** Parse `/{orgId}/{compId}[/…]` from a location pathname. */
export function parseTenantPath(pathname: string): { orgId: string; compId: string } | null {
  const [orgId, compId] = pathname.split('/').filter(Boolean);
  if (!orgId || !compId || !SEG.test(orgId) || !SEG.test(compId)) return null;
  return { orgId, compId };
}

/** Firestore base path for one competition (the tenant unit). */
export function compBasePath(orgId: string, compId: string): string {
  return `orgs/${orgId}/competitions/${compId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tenant/paths.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the context provider**

Create `src/tenant/TenantContext.tsx`:

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { compBasePath } from './paths';

export interface Tenant {
  orgId: string;
  compId: string;
  /** Absolute Firestore path for a competition-relative path: tp('judges'), tp(`sessions/${id}`). */
  tp: (rel: string) => string;
}

const Ctx = createContext<Tenant | null>(null);

export function TenantProvider({ orgId, compId, children }: { orgId: string; compId: string; children: ReactNode }) {
  const value = useMemo<Tenant>(() => {
    const base = compBasePath(orgId, compId);
    return { orgId, compId, tp: (rel) => `${base}/${rel}` };
  }, [orgId, compId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): Tenant {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTenant must be used inside TenantProvider');
  return t;
}
```

- [ ] **Step 6: Verify the whole suite and types still pass**

Run: `npm test && npm run build`
Expected: all existing tests PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/tenant/
git commit -m "feat(tenancy): tenant path parsing and TenantContext"
```

---

### Task 2: Membership resolution + AuthContext slim-down + App routing

**Files:**
- Create: `src/auth/membership.ts`
- Create: `src/auth/membership.test.ts`
- Create: `src/auth/MembershipContext.tsx`
- Modify: `src/auth/AuthContext.tsx` (drop claims-based role)
- Modify: `src/App.tsx` (tenant routing + new gate screens)

**Interfaces:**
- Consumes: `TenantProvider`/`useTenant` and `parseTenantPath` from Task 1; `useDocData` from `src/data/db.ts` (existing).
- Produces:
  - `resolveMembership(org: OrgMemberDoc | null, comp: CompMemberDoc | null): { role: Role | null; judgeId: string | null }`
  - `MembershipProvider({ children })` — must be rendered inside both `AuthProvider` (signed-in user guaranteed) and `TenantProvider`.
  - `useMembership(): { role: Role | null; judgeId: string | null; loading: boolean }` — Task 4's JudgeApp uses `judgeId` from here.
  - `useAuth()` keeps `{ user, loading, signInAdmin, signOut }` but **no longer returns `role`**.

- [ ] **Step 1: Write the failing test**

Create `src/auth/membership.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveMembership } from './membership';

describe('resolveMembership', () => {
  it('org owner and org admin both resolve to admin', () => {
    expect(resolveMembership({ role: 'owner' }, null)).toEqual({ role: 'admin', judgeId: null });
    expect(resolveMembership({ role: 'admin' }, null)).toEqual({ role: 'admin', judgeId: null });
  });
  it('org staff wins even when a comp member doc also exists', () => {
    expect(resolveMembership({ role: 'owner' }, { role: 'judge', judgeId: 'j1' })).toEqual({ role: 'admin', judgeId: null });
  });
  it('comp judge resolves with its judgeId', () => {
    expect(resolveMembership(null, { role: 'judge', judgeId: 'j1' })).toEqual({ role: 'judge', judgeId: 'j1' });
  });
  it('a judge member doc without judgeId resolves to no role', () => {
    expect(resolveMembership(null, { role: 'judge' })).toEqual({ role: null, judgeId: null });
  });
  it('comp display resolves to display', () => {
    expect(resolveMembership(null, { role: 'display' })).toEqual({ role: 'display', judgeId: null });
  });
  it('no member docs resolves to no role', () => {
    expect(resolveMembership(null, null)).toEqual({ role: null, judgeId: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/membership.test.ts`
Expected: FAIL — cannot resolve `./membership`.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/membership.ts`:

```ts
import type { Role } from './claims';

export interface OrgMemberDoc {
  role: 'owner' | 'admin';
}
export interface CompMemberDoc {
  role: 'judge' | 'display';
  judgeId?: string;
}
export interface Membership {
  role: Role | null;
  /** The judge seat this uid is bound to (from the member doc, NOT the auth uid). */
  judgeId: string | null;
}

export function resolveMembership(org: OrgMemberDoc | null, comp: CompMemberDoc | null): Membership {
  if (org && (org.role === 'owner' || org.role === 'admin')) return { role: 'admin', judgeId: null };
  if (comp?.role === 'judge' && typeof comp.judgeId === 'string' && comp.judgeId.length > 0) {
    return { role: 'judge', judgeId: comp.judgeId };
  }
  if (comp?.role === 'display') return { role: 'display', judgeId: null };
  return { role: null, judgeId: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/membership.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Create MembershipContext**

Create `src/auth/MembershipContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from '../tenant/TenantContext';
import { useDocData } from '../data/db';
import { resolveMembership, type Membership, type OrgMemberDoc, type CompMemberDoc } from './membership';

type Value = Membership & { loading: boolean };

const Ctx = createContext<Value>({ role: null, judgeId: null, loading: true });

/** Requires a signed-in user (render inside the auth gate) and a TenantProvider. */
export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { orgId, compId, tp } = useTenant();
  const uid = user?.uid ?? '_none_'; // never rendered signed-out; placeholder keeps the doc path valid
  const org = useDocData<OrgMemberDoc>(`orgs/${orgId}/members/${uid}`);
  const comp = useDocData<CompMemberDoc>(tp(`members/${uid}`));
  const loading = org.loading || comp.loading;
  const value: Value = { ...resolveMembership(org.data, comp.data), loading };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMembership = () => useContext(Ctx);
```

- [ ] **Step 6: Slim down AuthContext**

Modify `src/auth/AuthContext.tsx` — remove the claims/role logic. Full new content:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../firebase/app';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue>({
  user: null,
  loading: true,
  signInAdmin: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const signInAdmin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
  const signOut = () => fbSignOut(auth);

  return <Ctx.Provider value={{ user, loading, signInAdmin, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
```

- [ ] **Step 7: Rewire App.tsx routing**

Modify `src/App.tsx`. Replace the imports and the `Routed` function (keep `Splash` and `AdminLogin` exactly as they are), and add the two gate screens:

```tsx
import { useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { MembershipProvider, useMembership } from './auth/MembershipContext';
import { TenantProvider } from './tenant/TenantContext';
import { parseTenantPath } from './tenant/paths';
import JudgeApp from './judge/JudgeApp';
import AdminApp from './admin/AdminApp';
import { C, serif, arabic } from './ui/theme';

function Routed() {
  const { user, loading } = useAuth();
  // The tenant comes from the URL path: /{orgId}/{compId}. Read once — a tenant
  // switch is a full navigation, so no popstate handling needed.
  const tenant = useMemo(() => parseTenantPath(window.location.pathname), []);
  if (loading) return <Splash />;
  if (!user) return <AdminLogin />;
  if (!tenant) return <NoCompetition />;
  return (
    <TenantProvider orgId={tenant.orgId} compId={tenant.compId}>
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
  // 'display' routing lands in Phase 2 (display seats); until then it's treated as no access.
  return <NoAccess />;
}

function GateShell({ title, body }: { title: string; body: string }) {
  const { signOut, user } = useAuth();
  return (
    <div style={{ height: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.sub, maxWidth: 440, lineHeight: 1.5 }}>{body}</div>
      <div style={{ marginTop: 20, fontSize: 12.5, color: C.muted }}>Signed in as {user?.email ?? user?.uid}</div>
      <button onClick={() => void signOut()} style={{ marginTop: 10, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 13.5 }}>Sign out</button>
    </div>
  );
}

function NoCompetition() {
  return <GateShell title="No competition selected" body="Open the link for your competition — it looks like yourapp.web.app/your-org/your-competition. Organization dashboards arrive in a later update." />;
}

function NoAccess() {
  return <GateShell title="No access to this competition" body="This account is not a member of this competition. Ask the organizer for an invite, or sign in with the correct account." />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  );
}
```

Keep the existing `Splash` and `AdminLogin` components below unchanged.

- [ ] **Step 8: Verify types and tests**

Run: `npm test && npm run build`
Expected: all tests PASS (including untouched `claims.test.ts`). Build succeeds — if tsc reports `role` unused from `useAuth()` call sites, that's Task 4's JudgeApp change; for now only `src/App.tsx` consumed `role`, and it no longer does. `JudgeApp.tsx` uses `user` and `signInAdmin` only — still fine.

- [ ] **Step 9: Commit**

```bash
git add src/auth/ src/App.tsx
git commit -m "feat(tenancy): member-doc membership resolution and tenant-aware app routing"
```

---

### Task 3: Security rules rewrite + cross-tenant test matrix

**Files:**
- Modify: `firestore.rules` (full rewrite)
- Modify: `src/data/firestore.rules.test.ts` (full rewrite)

**Interfaces:**
- Consumes: member doc shapes from the Global Constraints (rules `get()` them).
- Produces: the rules contract every client write in Tasks 4–6 must satisfy — notably: session create/update requires `request.resource.data.judgeId` to equal the **member doc's** `judgeId` (not the auth uid); config/judges/panels/assignments/contestants/enrollments/tiebreaks writable only by org staff; registrations create-only by org staff; nothing crosses org boundaries.

- [ ] **Step 1: Rewrite the rules test file (failing first)**

Replace the entire content of `src/data/firestore.rules.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

// Two tenants. P1/P2 are the competition base paths; membership is seeded per test run.
const P1 = 'orgs/org1/competitions/comp1';
const P2 = 'orgs/org2/competitions/comp2';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ibn-katheer',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // org1: one staff member, two judges bound to seats jA/jB
    await setDoc(doc(db, 'orgs/org1/members/staff1'), { role: 'owner' });
    await setDoc(doc(db, `${P1}/members/uJudgeA`), { role: 'judge', judgeId: 'jA' });
    await setDoc(doc(db, `${P1}/members/uJudgeB`), { role: 'judge', judgeId: 'jB' });
    // org2: a foreign tenant
    await setDoc(doc(db, 'orgs/org2/members/staff2'), { role: 'admin' });
    await setDoc(doc(db, `${P2}/members/uJudgeZ`), { role: 'judge', judgeId: 'jZ' });
  });
});

// No custom claims anywhere — identity is the uid; authorization is the member docs.
const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('sessions — one writer per doc, judgeId from the member doc', () => {
  it('a judge can create a session for their own seat', async () => {
    await assertSucceeds(setDoc(doc(as('uJudgeA'), `${P1}/sessions/s1`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('a judge cannot create a session for another seat', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/sessions/s2`), { judgeId: 'jB', enrollmentId: 'e1', questions: [] }));
  });

  it('the auth uid alone is not enough — judgeId must match the member doc', async () => {
    // uJudgeA writing judgeId equal to their *uid* (not their seat) must fail.
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/sessions/s2b`), { judgeId: 'uJudgeA', enrollmentId: 'e1', questions: [] }));
  });

  it("a judge cannot update another judge's session", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/sessions/s3`), { judgeId: 'jB', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(updateDoc(doc(as('uJudgeA'), `${P1}/sessions/s3`), { enrollmentId: 'changed' }));
  });

  it('a judge cannot hand off their session to another seat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/sessions/s5`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(updateDoc(doc(as('uJudgeA'), `${P1}/sessions/s5`), { judgeId: 'jB' }));
  });

  it('nobody can delete a session — not even org staff', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/sessions/s4`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(deleteDoc(doc(as('uJudgeA'), `${P1}/sessions/s4`)));
    await assertFails(deleteDoc(doc(as('staff1'), `${P1}/sessions/s4`)));
  });

  it("org staff can create and update any judge's session (correct-marks feature)", async () => {
    const db = as('staff1');
    await assertSucceeds(setDoc(doc(db, `${P1}/sessions/s6`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
    await assertSucceeds(updateDoc(doc(db, `${P1}/sessions/s6`), { finalizedAt: 'now' }));
  });
});

describe('staff-only collections', () => {
  it('a judge cannot write config, staff can', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/config/scoring`), { hifz_base: 9 }));
    await assertSucceeds(setDoc(doc(as('staff1'), `${P1}/config/scoring`), { hifz_base: 9 }));
  });

  it('a judge can read config (needed for their queue)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/config/structure`), { divisions: [] });
    });
    await assertSucceeds(getDoc(doc(as('uJudgeA'), `${P1}/config/structure`)));
  });

  it('a judge cannot write contestants', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/contestants/c1`), { fullName: 'X' }));
  });
});

describe('registrations — immutable master', () => {
  it('staff can create; a judge cannot create or read', async () => {
    await assertSucceeds(setDoc(doc(as('staff1'), `${P1}/registrations/p1:i1`), { source: 'manual' }));
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/registrations/p1:i2`), { source: 'manual' }));
    await assertFails(getDoc(doc(as('uJudgeA'), `${P1}/registrations/p1:i1`)));
  });

  it('nobody (even staff) can update or delete a registration', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/registrations/p1:i3`), { source: 'zeffy' });
    });
    await assertFails(updateDoc(doc(as('staff1'), `${P1}/registrations/p1:i3`), { source: 'manual' }));
    await assertFails(deleteDoc(doc(as('staff1'), `${P1}/registrations/p1:i3`)));
  });
});

describe('member docs', () => {
  it('a user can read their own comp member doc; not somebody else’s', async () => {
    await assertSucceeds(getDoc(doc(as('uJudgeA'), `${P1}/members/uJudgeA`)));
    await assertFails(getDoc(doc(as('uJudgeA'), `${P1}/members/uJudgeB`)));
  });

  it('org staff can read any member doc in their org', async () => {
    await assertSucceeds(getDoc(doc(as('staff1'), `${P1}/members/uJudgeA`)));
    await assertSucceeds(getDoc(doc(as('staff1'), 'orgs/org1/members/staff1')));
  });

  it('member docs are not client-writable in Phase 1 (functions/seed only)', async () => {
    await assertFails(setDoc(doc(as('staff1'), `${P1}/members/uNew`), { role: 'judge', judgeId: 'jC' }));
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/members/uJudgeA`), { role: 'judge', judgeId: 'jB' }));
  });
});

describe('cross-tenant isolation — the SaaS invariant', () => {
  it('foreign org staff cannot read or write another org’s data', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/config/structure`), { divisions: [] });
      await setDoc(doc(ctx.firestore(), `${P1}/contestants/c1`), { fullName: 'X' });
    });
    const db = as('staff2'); // org2 staff
    await assertFails(getDoc(doc(db, `${P1}/config/structure`)));
    await assertFails(getDoc(doc(db, `${P1}/contestants/c1`)));
    await assertFails(setDoc(doc(db, `${P1}/config/scoring`), { hifz_base: 1 }));
    await assertFails(setDoc(doc(db, `${P1}/sessions/sx`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('a judge of one competition cannot read or write another competition', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P2}/config/structure`), { divisions: [] });
    });
    const db = as('uJudgeA'); // comp1 judge
    await assertFails(getDoc(doc(db, `${P2}/config/structure`)));
    // even claiming their own seat id in the foreign tenant
    await assertFails(setDoc(doc(db, `${P2}/sessions/sy`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('foreign staff cannot read another org’s member docs or org doc', async () => {
    await assertFails(getDoc(doc(as('staff2'), `${P1}/members/uJudgeA`)));
    await assertFails(getDoc(doc(as('staff2'), 'orgs/org1')));
  });
});

describe('unauthenticated', () => {
  it('cannot read or write anything', async () => {
    await assertFails(getDoc(doc(anon(), `${P1}/config/structure`)));
    await assertFails(setDoc(doc(anon(), `${P1}/sessions/x`), { judgeId: 'jA' }));
    await assertFails(getDoc(doc(anon(), 'orgs/org1')));
  });
});
```

- [ ] **Step 2: Run the rules tests to verify they fail**

Run: `npm run test:rules`
Expected: FAIL — the success-path tests (`assertSucceeds`) fail because the old rules have no `match` for nested paths (denied by default). Denial tests pass; the suite is red overall.

- [ ] **Step 3: Rewrite firestore.rules**

Replace the entire content of `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }

    // Org staff: an org member doc with role owner|admin. One get() per request (deduped by Firestore).
    function isOrgStaff(orgId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/orgs/$(orgId)/members/$(request.auth.uid))
        && get(/databases/$(database)/documents/orgs/$(orgId)/members/$(request.auth.uid)).data.role in ['owner', 'admin'];
    }

    // Competition member: judge or display seat holder for this specific competition.
    function isCompMember(orgId, compId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/orgs/$(orgId)/competitions/$(compId)/members/$(request.auth.uid));
    }
    function compMember(orgId, compId) {
      return get(/databases/$(database)/documents/orgs/$(orgId)/competitions/$(compId)/members/$(request.auth.uid)).data;
    }

    // What judges can read, staff can also read.
    function canReadComp(orgId, compId) {
      return isOrgStaff(orgId) || isCompMember(orgId, compId);
    }

    match /orgs/{orgId} {
      // Org docs are staff-only; creation flows land in Phase 2 (onboarding).
      allow read: if isOrgStaff(orgId);
      allow write: if false;

      match /members/{uid} {
        allow read: if isSignedIn() && (request.auth.uid == uid || isOrgStaff(orgId));
        allow write: if false; // Phase 2: onboarding functions manage membership
      }

      match /competitions/{compId} {
        allow read: if canReadComp(orgId, compId);
        allow write: if false; // Phase 2: create-competition flow

        match /members/{uid} {
          allow read: if isSignedIn() && (request.auth.uid == uid || isOrgStaff(orgId));
          allow write: if false; // Phase 2: join codes / device provisioning via functions
        }

        // Staff-write collections; competition members may read (judges need config/contestants/etc).
        match /config/{doc}      { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }
        match /judges/{id}       { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }
        match /panels/{id}       { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }
        match /assignments/{id}  { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }
        match /contestants/{id}  { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }
        match /enrollments/{id}  { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }
        match /tiebreaks/{id}    { allow read: if canReadComp(orgId, compId); allow write: if isOrgStaff(orgId); }

        // Immutable master: staff may create; no one updates or deletes via client.
        match /registrations/{id} {
          allow read: if isOrgStaff(orgId);
          allow create: if isOrgStaff(orgId);
          allow update, delete: if false;
        }

        // A judge writes only sessions bound to their seat (member doc judgeId, NOT auth uid);
        // staff may write any (the leaderboard's "Edit to correct a judge's marks" feature).
        // ponytail: slot-assignment check (panel covers enrollment) still omitted, as before.
        match /sessions/{id} {
          allow read: if canReadComp(orgId, compId);
          allow create: if isOrgStaff(orgId) || (isCompMember(orgId, compId)
                        && compMember(orgId, compId).role == 'judge'
                        && request.resource.data.judgeId == compMember(orgId, compId).judgeId);
          allow update: if isOrgStaff(orgId) || (isCompMember(orgId, compId)
                        && compMember(orgId, compId).role == 'judge'
                        && resource.data.judgeId == compMember(orgId, compId).judgeId
                        && request.resource.data.judgeId == compMember(orgId, compId).judgeId);
          allow delete: if false;
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run the rules tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/data/firestore.rules.test.ts
git commit -m "feat(tenancy): nested multi-tenant security rules with cross-tenant isolation tests"
```

---

### Task 4: Tenant-path sweep across all screens

**Files:**
- Modify: `src/judge/JudgeApp.tsx`
- Modify: `src/judge/GradingScreen.tsx`
- Modify: `src/admin/Contestants.tsx`
- Modify: `src/admin/Leaderboard.tsx`
- Modify: `src/admin/Devices.tsx`
- Modify: `src/admin/Registrations.tsx`
- Modify: `src/admin/ScoringConfig.tsx`
- Modify: `src/admin/StructurePanels.tsx`
- Modify: `src/admin/Projector.tsx`

**Interfaces:**
- Consumes: `useTenant().tp` from Task 1; `useMembership().judgeId` from Task 2.
- Produces: every `useCollection` / `useDocData` / `useSyncState` / `writeDoc` / `removeDoc` call site passes a `tp()`-wrapped path. `src/data/db.ts` itself is NOT modified in this task.

The change is the same mechanical pattern in every file. In each component (or nested component) that calls a db helper, add:

```tsx
import { useTenant } from '../tenant/TenantContext';
// inside the component body:
const { tp } = useTenant();
```

then wrap every path argument. Examples of the exact rewrite pattern:

```tsx
// reads
const judges = useCollection<JudgeDoc>(tp('judges'));
const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;
// writes / deletes
await writeDoc(tp('contestants/' + cid), { ... });
removeDoc(tp('sessions/' + s.id));
await writeDoc(tp(`tiebreaks/${slotId(slot)}`), { ... });
```

**Special case — `src/judge/JudgeApp.tsx`:** the judge identity comes from the member doc now, not the auth uid. Replace:

```tsx
const { user, signInAdmin } = useAuth();
const judgeId = user?.uid ?? '';
```

with:

```tsx
const { signInAdmin } = useAuth();
const { judgeId: memberJudgeId } = useMembership();
const judgeId = memberJudgeId ?? '';
```

adding `import { useMembership } from '../auth/MembershipContext';`. Everything downstream (`buildJudgeQueue`, session ids `${enr}__${judgeId}`, `GradingScreen judgeId={judgeId}`) already flows from this variable — no other identity change needed.

**Special case — `src/judge/GradingScreen.tsx`:** three path sites (`useDocData`, `useSyncState`, and the `persist` + reopen `writeDoc` calls) all use `` `sessions/${sessionId}` `` — wrap each in `tp()`.

- [ ] **Step 1: Sweep the two judge files** (`JudgeApp.tsx`, `GradingScreen.tsx`) with the pattern above.

- [ ] **Step 2: Sweep the seven admin files** (`Contestants.tsx`, `Leaderboard.tsx`, `Devices.tsx`, `Registrations.tsx`, `ScoringConfig.tsx`, `StructurePanels.tsx`, `Projector.tsx`). Watch for nested/sibling components inside a file (e.g. `Registrations.tsx` has a Zeffy config section reading `config/zeffy`) — each component that touches the db needs its own `const { tp } = useTenant();`.

- [ ] **Step 3: Verify no bare paths remain**

Run: `grep -rnE "useCollection(<[^>]*>)?\('|useDocData(<[^>]*>)?\('|useDocData(<[^>]*>)?\(\`|useSyncState\('|useSyncState\(\`|writeDoc\('|writeDoc\(\`|removeDoc\('|removeDoc\(\`" src --include=*.tsx`
Expected: no matches (every call now starts with `tp(`). Also run: `grep -rn "user?.uid ?? ''" src/judge` — no matches.

- [ ] **Step 4: Typecheck, tests, build**

Run: `npm test && npm run build`
Expected: PASS / clean build.

- [ ] **Step 5: Commit**

```bash
git add src/judge/ src/admin/
git commit -m "feat(tenancy): route all Firestore access through tenant paths"
```

---

### Task 5: Schema hooks — round, audit stamps, scoring model, session timestamps

**Files:**
- Modify: `src/data/db.ts` (audit stamps in `writeDoc`)
- Modify: `src/data/types.ts` (optional new fields)
- Modify: `src/scoring/types.ts` + `src/scoring/config.ts` (+ `src/scoring/config.test.ts`) (`model` field)
- Modify: `src/judge/GradingScreen.tsx` (`round`, `startedAt`, `endedAt`)
- Modify: `src/admin/Contestants.tsx`, `src/admin/Registrations.tsx` (enrollment `round`)
- Modify: `src/admin/ScoringConfig.tsx` (persist `model` on save)

**Interfaces:**
- Consumes: nothing new.
- Produces: `writeDoc(path, data, merge?)` keeps its signature but now stamps `updatedAt: serverTimestamp()` and `updatedBy: <uid|null>` into every write. `ScoringConfig` type gains required `model: string`; `DEFAULT_SCORING_CONFIG.model === 'deduction-v1'`. Session docs carry `round: 'main'`, `startedAt` (first write), `endedAt` (set at finalize). Enrollment docs carry `round: 'main'`.

- [ ] **Step 1: Write the failing test for the scoring model field**

Add to `src/scoring/config.test.ts` (inside the existing describe, or a new one):

```ts
it('carries the scoring model version for future rubric variants', () => {
  expect(DEFAULT_SCORING_CONFIG.model).toBe('deduction-v1');
});
```

Run: `npx vitest run src/scoring/config.test.ts`
Expected: FAIL — `model` does not exist.

- [ ] **Step 2: Add the model field**

In `src/scoring/types.ts`, add to `ScoringConfig`:

```ts
export interface ScoringConfig {
  /** Rubric identifier — future scoring models get new ids; presets are named configs. */
  model: string;
  weights: { hifz: number; tajweed: number; voice: number };
  // ...rest unchanged
```

In `src/scoring/config.ts`, add to the default:

```ts
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  model: 'deduction-v1',
  weights: { hifz: 70, tajweed: 25, voice: 5 },
  // ...rest unchanged
```

In `src/admin/ScoringConfig.tsx`, docs written before this change lack `model`, so default it at save time. The save is `await writeDoc(tp('config/scoring'), edited, false);` — change to:

```ts
await writeDoc(tp('config/scoring'), { model: 'deduction-v1', ...edited }, false);
```

If tsc now flags other literal `ScoringConfig` objects (e.g. test fixtures) missing `model`, add `model: 'deduction-v1'` to each — the compiler will point at every site.

Run: `npx vitest run src/scoring && npm run build`
Expected: PASS / clean.

- [ ] **Step 3: Audit stamps in writeDoc**

In `src/data/db.ts`, add `serverTimestamp` usage and the auth import, and replace `writeDoc`:

```ts
import { auth } from '../firebase/app';

/**
 * Create or merge a document. Every write is stamped with updatedAt/updatedBy —
 * the audit-log hook: a later phase surfaces the trail, nothing else changes.
 */
export const writeDoc = (path: string, data: DocumentData, merge = true) =>
  setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }, { merge });
```

Then remove the now-redundant explicit `updatedAt: now(),` from the `persist` payload in `src/judge/GradingScreen.tsx` and from the reopen write (`finalizedAt: null` write around line 149) — `writeDoc` stamps it.

- [ ] **Step 4: round + startedAt + endedAt on sessions**

In `src/judge/GradingScreen.tsx`, update `persist`:

```ts
const persist = (extra: Record<string, unknown> = {}) => {
  const payloadQs = tieBreak ? [...primaryRef.current, ...questions] : questions;
  void writeDoc(tp(`sessions/${sessionId}`), {
    enrollmentId, judgeId, questions: payloadQs, notes,
    round: 'main',
    // startedAt is written once: only while the live doc doesn't carry it yet.
    ...(sessionDoc?.startedAt ? {} : { startedAt: now() }),
    ...extra,
  }, true);
};
```

Find the Finish/finalize handler that calls `persist({ finalizedAt: now() })` and change it to `persist({ finalizedAt: now(), endedAt: now() })`. (Reopening intentionally leaves `endedAt` — it records the last finalize time.)

In `src/data/types.ts`, extend the docs (optional — pre-existing docs lack them):

```ts
export interface EnrollmentDoc {
  contestantId: string;
  category: string;
  division: string;
  round?: string; // schema hook: multi-round competitions (default 'main')
}

export interface SessionDoc {
  enrollmentId: string;
  judgeId: string;
  questions: Question[];
  notes?: string;
  round?: string; // schema hook: multi-round competitions (default 'main')
  startedAt?: unknown; // Firestore Timestamp, stamped on first write
  endedAt?: unknown | null; // stamped at finalize (recording-bookmark hook)
  updatedAt: unknown; // Firestore Timestamp
  finalizedAt: unknown | null;
}
```

- [ ] **Step 5: round on enrollment writes**

`src/admin/Contestants.tsx` `handleAddEnrollment`:

```ts
writeDoc(tp('enrollments/' + enrollmentId(selectedId, newCat)), {
  contestantId: selectedId,
  category: newCat,
  division: newDiv,
  round: 'main',
});
```

`src/admin/Registrations.tsx` promote flow:

```ts
writeDoc(tp(`enrollments/${enrollmentId(cid, p.categoryId)}`), {
  contestantId: cid,
  category: p.categoryId,
  division: p.division,
  round: 'main',
}),
```

- [ ] **Step 6: Full verification**

Run: `npm test && npm run test:rules && npm run build`
Expected: all PASS. (Rules don't validate the new fields — session writes with the extra fields still satisfy the judgeId checks.)

- [ ] **Step 7: Commit**

```bash
git add src/data/ src/scoring/ src/judge/GradingScreen.tsx src/admin/Contestants.tsx src/admin/Registrations.tsx src/admin/ScoringConfig.tsx
git commit -m "feat(tenancy): schema hooks — round, audit stamps, scoring model id, session timestamps"
```

---

### Task 6: Emulator seed rewrite, README, end-to-end smoke

**Files:**
- Modify: `functions/seed.mjs` (nested paths, member docs, no claims)
- Modify: `README.md` (dev URL + seed description)

**Interfaces:**
- Consumes: everything above. The seed must satisfy the Task 3 rules model and the Task 1 URL shape.
- Produces: a seeded demo tenant at `orgs/demo/competitions/2026`, reachable at `http://localhost:5173/demo/2026` with the existing dev logins.

- [ ] **Step 1: Rewrite the seed**

Replace the body of `functions/seed.mjs` `main()` and the trailing auth section (keep the existing `STRUCTURE`, `SCORING`, `ev`, `q` constants; add `model: 'deduction-v1'` to `SCORING`):

```js
const BASE = 'orgs/demo/competitions/2026';
const p = (rel) => `${BASE}/${rel}`;

async function main() {
  // ── auth users (no custom claims — authorization is member docs) ─────────
  const admin = await auth.createUser({ email: 'admin@ibnkatheer.local', password: 'admin123' }).catch(() => auth.getUserByEmail('admin@ibnkatheer.local'));
  for (const jid of ['j1', 'j2', 'j3']) {
    await auth.createUser({ uid: jid, email: `${jid}@judge.local`, password: 'judge123' }).catch(() => auth.getUser(jid));
  }

  // ── tenant shell ──────────────────────────────────────────────────────────
  await db.doc('orgs/demo').set({ name: 'Demo Organization', ownerUid: admin.uid, plan: 'free', createdAt: FieldValue.serverTimestamp() });
  await db.doc(`orgs/demo/members/${admin.uid}`).set({ role: 'owner' });
  await db.doc(BASE).set({ name: '2026 Ibn Katheer Quran Competition', status: 'live', createdAt: FieldValue.serverTimestamp() });
  // judge auth uid == seat id here for convenience; the member doc binding is what the rules check
  for (const jid of ['j1', 'j2', 'j3']) {
    await db.doc(p(`members/${jid}`)).set({ role: 'judge', judgeId: jid });
  }

  // ── competition data (same demo content, nested paths) ───────────────────
  await db.doc(p('config/structure')).set(STRUCTURE);
  await db.doc(p('config/scoring')).set(SCORING);
  await db.doc(p('config/zeffy')).set({ eventTitle: '2026 Ibn Katheer Quran Competition' });

  await db.doc(p('judges/j1')).set({ name: 'Ustadha Maryam', active: true });
  await db.doc(p('judges/j2')).set({ name: 'Ustadha Sara', active: true });
  await db.doc(p('judges/j3')).set({ name: 'Ustadha Huda', active: true });
  await db.doc(p('panels/sisters')).set({ name: "Sisters' Panel", judgeIds: ['j1', 'j2', 'j3'] });
  await db.doc(p('assignments/5_sisters')).set({ category: '5', division: 'sisters', panelId: 'sisters' });

  const people = [
    { id: 'fatima', name: 'Fatima Noor' },
    { id: 'khadija', name: 'Khadija Omar' },
    { id: 'aisha', name: 'Aisha Siddiqua' },
  ];
  for (const per of people) {
    await db.doc(p(`contestants/${per.id}`)).set({ fullName: per.name, gender: 'female', photoUrl: null, registrationId: null, fields: {}, active: true });
    await db.doc(p(`enrollments/${per.id}_5`)).set({ contestantId: per.id, category: '5', division: 'sisters', round: 'main' });
  }
  await db.doc(p('registrations/demoPay:demoItem')).set({
    source: 'zeffy', zeffyPaymentId: 'demoPay', zeffyItemId: 'demoItem', kind: 'ticket',
    buyer: { email: 'parent@example.com' }, rawItem: {}, paymentStatus: 'succeeded',
    parsedFields: { fullName: 'Sumayya Idris', gender: 'female', dateOfBirth: '2009-05-01', categories: ['1 Juz (Ages 13 and Under)'] },
    createdAt: FieldValue.serverTimestamp(), promotedContestantId: null,
  });

  const mk = (enr, judge, qs) => db.doc(p(`sessions/${enr}__${judge}`)).set({ enrollmentId: enr, judgeId: judge, questions: qs, round: 'main', updatedAt: FieldValue.serverTimestamp(), finalizedAt: null });
  for (const j of ['j1', 'j2', 'j3']) await mk('fatima_5', j, [q(0, { pf: 1, tmin: 1, voice: 4 }), q(1, { tmin: 1, voice: 5 }), q(2, { pf: 1, voice: 4 }), q(3, { voice: 5 })]);
  for (const j of ['j1', 'j2', 'j3']) await mk('khadija_5', j, [q(0, { pfail: 1, tmaj: 1, voice: 3 }), q(1, { pf: 2, voice: 3 }), q(2, { tmaj: 2, voice: 4 }), q(3, { pf: 1, tmin: 2, voice: 3 })]);
  for (const j of ['j1', 'j2']) await mk('aisha_5', j, [q(0, { pfail: 2, tmaj: 2, voice: 2 }), q(1, { pf: 1, voice: 3 }), q(2, { pfail: 1, voice: 3 }), q(3, { tmin: 1, voice: 4 })]);

  console.log('seed complete: tenant demo/2026, 3 contestants in (5·sisters), 8 sessions, 1 pending registration, admin + 3 judges');
}
```

- [ ] **Step 2: Update the README**

In `README.md`, update the dev-run section: after seeding, open `http://localhost:5173/demo/2026` (not the bare root); note that the bare root now shows a "No competition selected" screen; note logins are unchanged (`admin@ibnkatheer.local` / `admin123`, `j1@judge.local` / `judge123`). Update the `functions/` line in the layout listing to mention the seed creates the `demo/2026` tenant. Add one line: Cloud Functions (zeffyWebhook, mintJudgeToken) are legacy single-tenant and are rebuilt in Phases 2–3 of the SaaS work (`docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md`).

- [ ] **Step 3: End-to-end smoke against the emulator**

```bash
firebase emulators:start   # shell 1
node functions/seed.mjs    # shell 2, with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
npm run dev                # shell 3
```

Verify in the browser:
1. `http://localhost:5173/` → signed out → sign in as admin → "No competition selected" screen.
2. `http://localhost:5173/demo/2026` as admin → AdminApp loads; Leaderboard shows the three seeded contestants with scores; ScoringConfig loads and saves.
3. Same URL, sign in as `j1@judge.local` (dev shortcut button) → JudgeApp welcome shows "Ustadha Maryam"; open a contestant; add a deduction; save status reaches "Saved"; the new session write succeeds (rules allow it via the member doc).
4. In the emulator UI (Firestore), confirm the new/updated session doc carries `round`, `startedAt`, `updatedBy`.

- [ ] **Step 4: Full verification + commit**

Run: `npm test && npm run test:rules && npm run build`
Expected: all PASS.

```bash
git add functions/seed.mjs README.md
git commit -m "feat(tenancy): seed a demo tenant and document tenant-URL dev flow"
```

---

## Post-plan checklist (for the session driving this plan)

- Merge `saas/phase-1-tenancy` → `saas` via PR once all tasks are green.
- Phase 2 (onboarding) picks up: org/competition creation rules + UI, `redeemJoinCode`, tenant-scoped `mintJudgeToken`, retirement of `src/auth/claims.ts`.
