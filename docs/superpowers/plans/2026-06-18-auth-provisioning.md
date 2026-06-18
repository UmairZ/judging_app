# Auth + Device Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The pure auth core — custom-claims shaping, role resolution from a decoded token, and the role→access / role→landing matrix — that the app shell and security rules rely on. The Firebase Auth wiring (custom-token minting function, client sign-in/persistence) is documented as a deploy/UI integration point, not built here.

**Architecture:** Pure functions in `src/auth/` (Vitest, no Firebase). These encode the access model the UI guards on and the claims the rules read (`request.auth.token.admin`, `judgeId == uid`). Everything that touches Firebase Auth (createCustomToken, signInWithCustomToken, persistence, the screens) is glue/UI deferred to the app shell.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

## Global Constraints
- One real login: **admin** (email/password). Judges never log in — a device is bound to a judge by the admin, which mints a Firebase custom token.
- Judge custom token: `uid == judgeId`, claims `{ role: 'judge', judgeId }`. Admin: claim `{ admin: true }`. Optional display: `{ role: 'display' }`.
- These claim shapes MUST match what `firestore.rules` reads: admin = `request.auth.token.admin == true`; judge session ownership = `judgeId == request.auth.uid` (so the token's uid is the judgeId).
- Roles: `admin` | `judge` | `display`. Admin may reach everything (incl. judge view, for on-device re-entry); judge → judge area only; display → display only.
- Pure code: no Firebase/IO imports; no `any`; strict TS.

## File Structure
```
src/auth/claims.ts        # claim builders + roleFromClaims
src/auth/claims.test.ts
src/auth/access.ts        # canAccess(role, area) + resolveLanding(role)
src/auth/access.test.ts
```

---

### Task 1: Custom claims + role resolution

**Files:** Create `src/auth/claims.ts`, `src/auth/claims.test.ts`.

**Interfaces produced:**
- `Role = 'admin' | 'judge' | 'display'`
- `JudgeClaims { role: 'judge'; judgeId: string }`
- `AdminClaims { admin: true }`
- `DisplayClaims { role: 'display' }`
- `judgeClaims(judgeId: string): JudgeClaims`
- `adminClaims(): AdminClaims`
- `displayClaims(): DisplayClaims`
- `roleFromClaims(claims: Record<string, unknown> | null | undefined): Role | null` — decodes a Firebase token's claims into a role (admin wins; else judge if `role==='judge'` and a non-empty `judgeId`; else display if `role==='display'`; else null).

- [ ] **Step 1: Write the failing test `src/auth/claims.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { judgeClaims, adminClaims, displayClaims, roleFromClaims } from './claims';

describe('claim builders', () => {
  it('judgeClaims sets role + judgeId (uid will equal judgeId)', () => {
    expect(judgeClaims('j1')).toEqual({ role: 'judge', judgeId: 'j1' });
  });
  it('adminClaims sets the admin flag the rules read', () => {
    expect(adminClaims()).toEqual({ admin: true });
  });
  it('displayClaims sets the display role', () => {
    expect(displayClaims()).toEqual({ role: 'display' });
  });
});

describe('roleFromClaims', () => {
  it('admin flag wins', () => {
    expect(roleFromClaims({ admin: true })).toBe('admin');
    expect(roleFromClaims({ admin: true, role: 'judge', judgeId: 'x' })).toBe('admin');
  });
  it('judge requires role judge AND a non-empty judgeId', () => {
    expect(roleFromClaims({ role: 'judge', judgeId: 'j1' })).toBe('judge');
    expect(roleFromClaims({ role: 'judge', judgeId: '' })).toBeNull();
    expect(roleFromClaims({ role: 'judge' })).toBeNull();
  });
  it('recognizes display', () => {
    expect(roleFromClaims({ role: 'display' })).toBe('display');
  });
  it('returns null for empty/unknown/absent claims', () => {
    expect(roleFromClaims(null)).toBeNull();
    expect(roleFromClaims(undefined)).toBeNull();
    expect(roleFromClaims({})).toBeNull();
    expect(roleFromClaims({ role: 'wizard' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/auth/claims.test.ts`.

- [ ] **Step 3: Create `src/auth/claims.ts`**

```ts
export type Role = 'admin' | 'judge' | 'display';

export interface JudgeClaims {
  role: 'judge';
  judgeId: string;
}
export interface AdminClaims {
  admin: true;
}
export interface DisplayClaims {
  role: 'display';
}

export function judgeClaims(judgeId: string): JudgeClaims {
  return { role: 'judge', judgeId };
}
export function adminClaims(): AdminClaims {
  return { admin: true };
}
export function displayClaims(): DisplayClaims {
  return { role: 'display' };
}

export function roleFromClaims(claims: Record<string, unknown> | null | undefined): Role | null {
  if (!claims) return null;
  if (claims.admin === true) return 'admin';
  if (claims.role === 'judge' && typeof claims.judgeId === 'string' && claims.judgeId.length > 0) return 'judge';
  if (claims.role === 'display') return 'display';
  return null;
}
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/auth/claims.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/auth/claims.ts src/auth/claims.test.ts
git commit -m "feat(auth): custom claim builders and role resolution"
```

---

### Task 2: Access matrix + landing resolution

**Files:** Create `src/auth/access.ts`, `src/auth/access.test.ts`.

**Interfaces produced:**
- `Area = 'admin' | 'judge' | 'display'`
- `canAccess(role: Role | null, area: Area): boolean` — admin → every area; judge → only `judge`; display → only `display`; null → nothing.
- `resolveLanding(role: Role | null): 'admin-home' | 'judge-welcome' | 'display' | 'admin-login'` — where to send a device on load: admin→admin-home, judge→judge-welcome, display→display, null (unprovisioned)→admin-login (so the admin can provision the seat).

- [ ] **Step 1: Write the failing test `src/auth/access.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { canAccess, resolveLanding } from './access';

describe('canAccess', () => {
  it('admin can reach every area (incl. judge view for on-device re-entry)', () => {
    expect(canAccess('admin', 'admin')).toBe(true);
    expect(canAccess('admin', 'judge')).toBe(true);
    expect(canAccess('admin', 'display')).toBe(true);
  });
  it('judge is confined to the judge area', () => {
    expect(canAccess('judge', 'judge')).toBe(true);
    expect(canAccess('judge', 'admin')).toBe(false);
    expect(canAccess('judge', 'display')).toBe(false);
  });
  it('display is confined to the display area', () => {
    expect(canAccess('display', 'display')).toBe(true);
    expect(canAccess('display', 'admin')).toBe(false);
    expect(canAccess('display', 'judge')).toBe(false);
  });
  it('an unauthenticated device can reach nothing', () => {
    expect(canAccess(null, 'admin')).toBe(false);
    expect(canAccess(null, 'judge')).toBe(false);
  });
});

describe('resolveLanding', () => {
  it('sends each role to its landing', () => {
    expect(resolveLanding('admin')).toBe('admin-home');
    expect(resolveLanding('judge')).toBe('judge-welcome');
    expect(resolveLanding('display')).toBe('display');
  });
  it('sends an unprovisioned device to the admin login (to provision the seat)', () => {
    expect(resolveLanding(null)).toBe('admin-login');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/auth/access.test.ts`.

- [ ] **Step 3: Create `src/auth/access.ts`**

```ts
import type { Role } from './claims';

export type Area = 'admin' | 'judge' | 'display';

export function canAccess(role: Role | null, area: Area): boolean {
  if (role === 'admin') return true; // admin reaches everything
  return role === area; // judge→judge, display→display, null→nothing
}

export function resolveLanding(role: Role | null): 'admin-home' | 'judge-welcome' | 'display' | 'admin-login' {
  switch (role) {
    case 'admin':
      return 'admin-home';
    case 'judge':
      return 'judge-welcome';
    case 'display':
      return 'display';
    default:
      return 'admin-login';
  }
}
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/auth/access.test.ts`.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test` → all prior + new auth tests pass.
Run: `npx tsc` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/auth/access.ts src/auth/access.test.ts
git commit -m "feat(auth): role access matrix and landing resolution"
```

---

## Firebase Auth integration point (deferred — documented, not built)

Wired with the app shell + at deploy time:

**Custom-token minting (Cloud Function, admin-only callable).** Mints a judge token bound to `uid == judgeId`:
```ts
// functions/src/mintJudgeToken.ts (deploy-time)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { judgeClaims } from '...';
export const mintJudgeToken = onCall(async (req) => {
  if (req.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'admin only');
  const { judgeId } = req.data;
  return { token: await getAuth().createCustomToken(judgeId, judgeClaims(judgeId)) };
});
```

**Client (app shell, Plan 5):**
- Admin signs in with email/password (`signInWithEmailAndPassword`); their token carries `{ admin: true }` (set once via the Admin SDK on the admin account).
- Provisioning a seat: admin (authenticated) calls `mintJudgeToken({ judgeId })`, then `signInWithCustomToken(token)` on that device; `browserLocalPersistence` keeps the judge session across refresh + offline.
- On load: read `getIdTokenResult().claims` → `roleFromClaims` → `resolveLanding` → route; guard routes with `canAccess`.
- Hidden admin re-entry on a judge device: a logo long-press opens an admin-password prompt → `signInWithEmailAndPassword` re-elevates the device to admin, then back to judge on exit.

## Self-Review Notes
- **Spec coverage:** §10 roles/claims (Task 1 — shapes match `firestore.rules`), §10 access model + §9.1/§8.6 landing/provisioning routing (Task 2). Auth wiring + screens deferred to the app shell.
- **Type consistency:** `Role` shared between `claims.ts` and `access.ts`; claim shapes match the rules' `request.auth.token` reads.
