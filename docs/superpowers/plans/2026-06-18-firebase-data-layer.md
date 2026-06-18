# Firebase Data Layer + Security Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the structure config + pure domain helpers (slot generation, deterministic IDs, division defaulting), the Firestore document types, and the security rules that *enforce* per-judge document ownership — backed by emulator rules tests.

**Architecture:** Pure domain logic lives in `src/domain/` (Vitest, no Firebase). Firestore doc shapes in `src/data/types.ts`. Security rules in `firestore.rules`, tested with `@firebase/rules-unit-testing` against the Firestore emulator (Java present). Lean: no typed converters or live `firebase` app-init yet — those land in the plans that read/write data (judge/admin apps).

**Tech Stack:** TypeScript, Vitest, `firebase` + `@firebase/rules-unit-testing` + `firebase-tools` (dev), Firestore emulator.

## Global Constraints
- Per-judge document ownership is the core invariant: a judge may write only their own `sessions` doc (`judgeId == request.auth.uid`). Judge custom tokens are minted with `uid == judgeId` (Plan 4); admins carry `request.auth.token.admin == true`.
- `registrations` are an **immutable master**: no client update/delete, ever. Admin may create (quick-add); the webhook writes via the Admin SDK and bypasses rules.
- Admin-only writes for `config/*`, `judges`, `panels`, `assignments`, `contestants`, `enrollments`, `tiebreaks`.
- Deterministic IDs: enrollment = `${contestantId}_${category}`; registration = `${paymentId}:${itemId}`.
- Structure config (`config/structure`): divisions master list + per-category `minQuestions`, enabled `divisions`, and `zeffyLabels`. Slots = cross-product of each category with its own divisions. The example config yields **6 slots**.
- Pure domain code: no Firebase/IO imports; no `any`; strict TS.

---

## File Structure
```
src/domain/structure.ts        # structure types, DEFAULT_STRUCTURE_CONFIG, generateSlots, defaultDivisionForCategory
src/domain/structure.test.ts
src/domain/ids.ts              # enrollmentId, registrationId
src/domain/ids.test.ts
src/data/types.ts              # Firestore document shapes (§5)
firebase.json                  # emulator config
.firebaserc                    # demo project id
firestore.rules                # security rules
src/data/firestore.rules.test.ts   # emulator-backed rules tests (run via `npm run test:rules`)
vite.config.ts                 # MODIFY: exclude *.rules.test.ts from the default suite
package.json                   # MODIFY: deps + test:rules / emulators scripts
```

---

### Task 1: Structure config + slot generation + division default

**Files:** Create `src/domain/structure.ts`, `src/domain/structure.test.ts`

**Interfaces produced:**
- `Division { id: string; label: string }`
- `Category { id: string; label: string; minQuestions: number; divisions: string[]; zeffyLabels?: string[] }`
- `StructureConfig { divisions: Division[]; categories: Category[] }`
- `Slot { category: string; division: string }`
- `DEFAULT_STRUCTURE_CONFIG: StructureConfig`
- `generateSlots(s: StructureConfig): Slot[]`
- `slotId(slot: Slot): string` → `` `${category}_${division}` ``
- `defaultDivisionForCategory(category: Category, gender?: 'male' | 'female' | null): string | null`

- [ ] **Step 1: Write the failing test `src/domain/structure.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STRUCTURE_CONFIG,
  generateSlots,
  slotId,
  defaultDivisionForCategory,
} from './structure';

describe('generateSlots', () => {
  it('produces the cross-product of each category with its own divisions (6 for the default)', () => {
    const slots = generateSlots(DEFAULT_STRUCTURE_CONFIG);
    expect(slots).toHaveLength(6);
    expect(slots).toContainEqual({ category: '1', division: 'brothers' });
    expect(slots).toContainEqual({ category: '15', division: 'combined' });
    expect(slots.filter((s) => s.category === '30')).toEqual([{ category: '30', division: 'combined' }]);
  });
});

describe('slotId', () => {
  it('joins category and division', () => {
    expect(slotId({ category: '5', division: 'sisters' })).toBe('5_sisters');
  });
});

describe('defaultDivisionForCategory', () => {
  const cat = (id: string) => DEFAULT_STRUCTURE_CONFIG.categories.find((c) => c.id === id)!;

  it('returns the only division for a single-division category', () => {
    expect(defaultDivisionForCategory(cat('15'))).toBe('combined');
  });

  it('maps gender to brothers/sisters for a gendered category', () => {
    expect(defaultDivisionForCategory(cat('1'), 'male')).toBe('brothers');
    expect(defaultDivisionForCategory(cat('1'), 'female')).toBe('sisters');
  });

  it('returns null for a gendered category with unknown gender', () => {
    expect(defaultDivisionForCategory(cat('1'), null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/domain/structure.test.ts` → cannot resolve `./structure`.

- [ ] **Step 3: Create `src/domain/structure.ts`**

```ts
export interface Division {
  id: string;
  label: string;
}

export interface Category {
  id: string;
  label: string;
  minQuestions: number;
  divisions: string[];
  zeffyLabels?: string[];
}

export interface StructureConfig {
  divisions: Division[];
  categories: Category[];
}

export interface Slot {
  category: string;
  division: string;
}

export const DEFAULT_STRUCTURE_CONFIG: StructureConfig = {
  divisions: [
    { id: 'brothers', label: 'Brothers' },
    { id: 'sisters', label: 'Sisters' },
    { id: 'combined', label: 'Combined' },
  ],
  categories: [
    { id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers', 'sisters'], zeffyLabels: ['1 Juz (Ages 13 and Under)'] },
    { id: '5', label: "5 Ajzā'", minQuestions: 4, divisions: ['brothers', 'sisters'], zeffyLabels: ['5 Juz (Ages 20 and Under)'] },
    { id: '15', label: "15 Ajzā'", minQuestions: 5, divisions: ['combined'], zeffyLabels: ['15 Juz (Ages 27 and Under)'] },
    { id: '30', label: "30 Ajzā'", minQuestions: 6, divisions: ['combined'], zeffyLabels: ['30 Juz (Ages 35 and Under)'] },
  ],
};

export function generateSlots(s: StructureConfig): Slot[] {
  return s.categories.flatMap((c) => c.divisions.map((division) => ({ category: c.id, division })));
}

export function slotId(slot: Slot): string {
  return `${slot.category}_${slot.division}`;
}

// brothers/sisters convention for gendered categories. ponytail: hardcoded map; make it config if divisions ever stop matching gender.
const GENDER_DIVISION: Record<string, string> = { male: 'brothers', female: 'sisters' };

export function defaultDivisionForCategory(category: Category, gender?: 'male' | 'female' | null): string | null {
  if (category.divisions.length === 1) return category.divisions[0];
  if (gender) {
    const d = GENDER_DIVISION[gender];
    if (d && category.divisions.includes(d)) return d;
  }
  return null;
}
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/domain/structure.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/structure.ts src/domain/structure.test.ts
git commit -m "feat(domain): structure config, slot generation, division default"
```

---

### Task 2: Deterministic ID helpers

**Files:** Create `src/domain/ids.ts`, `src/domain/ids.test.ts`

**Interfaces produced:**
- `enrollmentId(contestantId: string, category: string): string`
- `registrationId(paymentId: string, itemId: string): string`

- [ ] **Step 1: Write the failing test `src/domain/ids.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { enrollmentId, registrationId } from './ids';

describe('deterministic ids', () => {
  it('enrollmentId joins contestant and category with an underscore', () => {
    expect(enrollmentId('c123', '15')).toBe('c123_15');
  });

  it('registrationId joins payment and item with a colon', () => {
    expect(registrationId('pay_1', 'item_1')).toBe('pay_1:item_1');
  });

  it('is stable for the same inputs (idempotent doc id)', () => {
    expect(registrationId('p', 'i')).toBe(registrationId('p', 'i'));
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/domain/ids.test.ts`.

- [ ] **Step 3: Create `src/domain/ids.ts`**

```ts
export const enrollmentId = (contestantId: string, category: string): string => `${contestantId}_${category}`;
export const registrationId = (paymentId: string, itemId: string): string => `${paymentId}:${itemId}`;
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/domain/ids.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ids.ts src/domain/ids.test.ts
git commit -m "feat(domain): deterministic enrollment and registration ids"
```

---

### Task 3: Firebase emulator tooling + config

**Files:** Modify `package.json`; create `firebase.json`, `.firebaserc`; modify `vite.config.ts`.

**Interfaces produced:** a runnable Firestore emulator and an `npm run test:rules` script; the default `npm test` excludes `*.rules.test.ts`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install --save firebase
npm install --save-dev firebase-tools @firebase/rules-unit-testing
```
Expected: completes; `firebase`, `firebase-tools`, `@firebase/rules-unit-testing` appear in `package.json`.

- [ ] **Step 2: Create `.firebaserc`**

```json
{
  "projects": {
    "default": "demo-ibn-katheer"
  }
}
```

- [ ] **Step 3: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "singleProjectMode": true,
    "ui": {
      "enabled": false
    }
  }
}
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to the `"scripts"` block (keep existing scripts):
```json
"test:rules": "firebase emulators:exec --only firestore \"vitest run --config vitest.rules.config.ts\""
```

- [ ] **Step 5: Exclude rules tests from the default suite — modify `vite.config.ts`**

Change the `test` block so the default suite ignores emulator tests:
```ts
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.rules.test.ts'],
  },
```

- [ ] **Step 6: Create `vitest.rules.config.ts`** (a separate config that runs ONLY the rules tests)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.rules.test.ts'],
    fileParallelism: false,
  },
});
```

- [ ] **Step 7: Verify the emulator boots**

Run: `npx firebase emulators:exec --only firestore "echo emulator-ok"`
Expected: downloads the emulator on first run, prints `emulator-ok`, exits 0. (If the emulator cannot start — e.g. Java/port problem — report BLOCKED with the exact error.)

- [ ] **Step 8: Verify the default suite still passes and excludes rules tests**

Run: `npm test`
Expected: the existing 41 tests pass; no emulator needed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .firebaserc firebase.json vite.config.ts vitest.rules.config.ts
git commit -m "chore: firebase emulator tooling and rules-test harness"
```

---

### Task 4: Firestore document types + security rules + rules tests

**Files:** Create `src/data/types.ts`, `firestore.rules`, `src/data/firestore.rules.test.ts`.

**Interfaces produced:**
- `src/data/types.ts`: `JudgeDoc`, `PanelDoc`, `AssignmentDoc`, `RegistrationDoc`, `ContestantDoc`, `EnrollmentDoc`, `SessionDoc`, `TiebreakDoc` (shapes from spec §5; `SessionDoc.questions` reuses the scoring `Question` type).
- `firestore.rules`: the security rules enforcing the Global Constraints.

- [ ] **Step 1: Create `src/data/types.ts`**

```ts
import type { Question } from '../scoring';

export interface JudgeDoc {
  name: string;
  active: boolean;
}

export interface PanelDoc {
  name: string;
  judgeIds: string[];
}

export interface AssignmentDoc {
  category: string;
  division: string;
  panelId: string;
}

export interface RegistrationDoc {
  source: 'zeffy' | 'manual';
  zeffyPaymentId: string | null;
  zeffyItemId: string | null;
  kind: 'ticket' | 'donation' | 'other';
  buyer: Record<string, unknown>;
  rawItem: Record<string, unknown>;
  parsedFields: Record<string, unknown>;
  paymentStatus: string;
  createdAt: unknown; // Firestore Timestamp
  promotedContestantId: string | null;
}

export interface ContestantDoc {
  fullName: string;
  gender: 'male' | 'female' | null;
  photoUrl: string | null;
  registrationId: string | null;
  fields: Record<string, unknown>;
  active: boolean;
}

export interface EnrollmentDoc {
  contestantId: string;
  category: string;
  division: string;
}

export interface SessionDoc {
  enrollmentId: string;
  judgeId: string;
  questions: Question[];
  updatedAt: unknown; // Firestore Timestamp
  finalizedAt: unknown | null;
}

export interface TiebreakDoc {
  category: string;
  division: string;
  contestantIds: string[];
  method: 'question' | 'override';
  resolution: Record<string, unknown>;
  resolvedBy: string;
  note: string;
  createdAt: unknown; // Firestore Timestamp
}
```

- [ ] **Step 2: Write the failing rules test `src/data/firestore.rules.test.ts`**

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
});

const judge = (id: string) => env.authenticatedContext(id, { role: 'judge', judgeId: id }).firestore();
const admin = () => env.authenticatedContext('admin1', { admin: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('sessions — one writer per doc', () => {
  it('a judge can create their own session', async () => {
    const db = judge('judgeA');
    await assertSucceeds(setDoc(doc(db, 'sessions/s1'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] }));
  });

  it("a judge cannot create a session owned by another judge", async () => {
    const db = judge('judgeA');
    await assertFails(setDoc(doc(db, 'sessions/s2'), { judgeId: 'judgeB', enrollmentId: 'e1', questions: [] }));
  });

  it("a judge cannot update another judge's session", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/s3'), { judgeId: 'judgeB', enrollmentId: 'e1', questions: [] });
    });
    const db = judge('judgeA');
    await assertFails(updateDoc(doc(db, 'sessions/s3'), { enrollmentId: 'changed' }));
  });

  it('nobody can delete a session', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/s4'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(deleteDoc(doc(judge('judgeA'), 'sessions/s4')));
  });
});

describe('admin-only collections', () => {
  it('a judge cannot write config', async () => {
    await assertFails(setDoc(doc(judge('judgeA'), 'config/scoring'), { hifz_base: 9 }));
  });

  it('an admin can write config', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'config/scoring'), { hifz_base: 9 }));
  });

  it('a judge can read config (needed for their queue)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config/structure'), { divisions: [] });
    });
    await assertSucceeds(getDoc(doc(judge('judgeA'), 'config/structure')));
  });

  it('a judge cannot write contestants', async () => {
    await assertFails(setDoc(doc(judge('judgeA'), 'contestants/c1'), { fullName: 'X' }));
  });
});

describe('registrations — immutable master', () => {
  it('an admin can create a registration', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'registrations/p1:i1'), { source: 'manual' }));
  });

  it('a judge cannot create a registration', async () => {
    await assertFails(setDoc(doc(judge('judgeA'), 'registrations/p1:i2'), { source: 'manual' }));
  });

  it('nobody (even admin) can update or delete a registration', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'registrations/p1:i3'), { source: 'zeffy' });
    });
    await assertFails(updateDoc(doc(admin(), 'registrations/p1:i3'), { source: 'manual' }));
    await assertFails(deleteDoc(doc(admin(), 'registrations/p1:i3')));
  });
});

describe('unauthenticated', () => {
  it('cannot read or write anything', async () => {
    await assertFails(getDoc(doc(anon(), 'config/structure')));
    await assertFails(setDoc(doc(anon(), 'sessions/x'), { judgeId: 'x' }));
  });
});
```

- [ ] **Step 3: Run, verify FAIL** — `npm run test:rules` → fails because `firestore.rules` is missing / denies/allows wrongly.

- [ ] **Step 4: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return request.auth != null && request.auth.token.admin == true; }

    // Admin-only collections; signed-in users may read (judges need config/contestants/etc).
    match /config/{doc}      { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /judges/{id}       { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /panels/{id}       { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /assignments/{id}  { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /contestants/{id}  { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /enrollments/{id}  { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /tiebreaks/{id}    { allow read: if isSignedIn(); allow write: if isAdmin(); }

    // Immutable master: admin may create; no one updates or deletes via client.
    match /registrations/{id} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;
    }

    // One writer per session doc. A judge writes only their own (uid == judgeId).
    // ponytail: enforces the per-judge invariant. Slot-assignment check (panel covers
    // enrollment) omitted — add a get() chain only if writing an unassigned session is a real risk.
    match /sessions/{id} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.judgeId == request.auth.uid;
      allow update: if isSignedIn()
                    && resource.data.judgeId == request.auth.uid
                    && request.resource.data.judgeId == request.auth.uid;
      allow delete: if false;
    }
  }
}
```

- [ ] **Step 5: Run, verify PASS** — `npm run test:rules`
Expected: all rules tests pass against the emulator. (If the emulator won't start in this environment, report BLOCKED with the exact error — do not weaken the rules to make tests pass.)

- [ ] **Step 6: Confirm default suite untouched** — `npm test` → existing 41 tests still pass (rules test excluded).

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts firestore.rules src/data/firestore.rules.test.ts
git commit -m "feat(data): firestore doc types and security rules with emulator tests"
```

---

## Self-Review Notes
- **Spec coverage:** §2/§4 structure + slots (Task 1), §5 deterministic IDs (Task 2) and doc shapes (Task 4), §10.1 security rules + emulator tests (Task 4).
- **Deferred (YAGNI, no consumer yet):** typed Firestore converters and live `firebase` app-init land with the judge/admin apps (Plans 5–6); the slot-assignment rule check is noted as a ponytail ceiling in `firestore.rules`.
- **Type consistency:** `Question` reused from `src/scoring`; rules tests assert exactly the constraints listed.
