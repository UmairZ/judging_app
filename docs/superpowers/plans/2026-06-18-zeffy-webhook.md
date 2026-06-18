# Zeffy Webhook Receiver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Parse a real Zeffy `payment.completed` payload into idempotent `registrations` docs (one per ticket item), with request verification (secret token + campaign allowlist) — all as pure, fully-tested logic.

**Architecture:** Pure functions in `src/zeffy/` (Vitest, no Firebase). Tested against the two *real* payloads captured on 2026-06-18. The Firebase `onRequest` wrapper + Admin-SDK Firestore writer is ~12 lines of dependency-injected glue with no branching logic — documented as a deploy-time integration point (it can't run without a real Firebase project), not built here. The handler takes its writer as an injected dependency so it's fully testable.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

## Global Constraints
- One registration per Zeffy **item** (ticket), not per payment. Doc ID = `${data.id}:${item.id}` (verified stable across retries) — use `registrationId()` from `src/domain/ids`.
- A contest ticket is `item.type === "ticket"`; classify others as `donation`/`other`. **Store every item regardless** (master is lossless); only `ticket` items become contestant candidates later.
- Contestant answers live in `item.questions[]` (NOT `data.buyer_questions`). Exact labels: `Contestant FULL Name`, `Contestant Date of Birth`, `Gender`, `Categories` (multi-select → array of verbose strings).
- Gender normalizes `"Male"`/`"Female"` → `male`/`female`.
- `buyer` (`data.buyer`) is the purchaser — context only, never the contestant.
- Refunds are **out of scope** (deposit model). Subscribe only to `payment.completed`.
- Verification: no Zeffy signature exists — gate on a secret URL token AND `data.campaign_id` allowlist (`c0000000-0000-4000-8000-000000000000`).
- `createdAt` is NOT set by the pure parser — it's a server timestamp added at write time. Parser returns `Omit<RegistrationDoc, 'createdAt'>`.
- Pure code: no Firebase/IO imports, no `any` on domain fields; strict TS.

## File Structure
```
src/zeffy/types.ts                  # minimal Zeffy payload types + ParsedFields
src/zeffy/parse-questions.ts        # parseQuestions, classifyItem, normalizeGender
src/zeffy/parse-questions.test.ts
src/zeffy/__fixtures__/payloads.ts  # the two real captured payloads
src/zeffy/parse-registration.ts     # parseRegistration(payload) -> per-item docs
src/zeffy/parse-registration.test.ts
src/zeffy/webhook.ts                 # verifyZeffyRequest, handleZeffyWebhook(payload, deps)
src/zeffy/webhook.test.ts
```

---

### Task 1: Question parsing, item classification, gender normalization

**Files:** Create `src/zeffy/types.ts`, `src/zeffy/parse-questions.ts`, `src/zeffy/parse-questions.test.ts`.

**Interfaces produced:**
- `ZeffyQuestion { question: string; type: string; answer: string | string[] }`
- `ZeffyItem { id: string; type: string; questions: ZeffyQuestion[] }`
- `ZeffyPayload { id: string; type: string; data: ZeffyPayloadData }`; `ZeffyPayloadData { id: string; status: string; campaign_id: string; buyer: Record<string, unknown>; items: ZeffyItem[] }`
- `ParsedFields { byLabel: Record<string, string | string[]>; fullName: string | null; gender: 'male' | 'female' | null; dateOfBirth: string | null; categories: string[] }`
- `normalizeGender(answer: unknown): 'male' | 'female' | null`
- `classifyItem(type: string): 'ticket' | 'donation' | 'other'`
- `parseQuestions(questions: ZeffyQuestion[]): ParsedFields`

- [ ] **Step 1: Write the failing test `src/zeffy/parse-questions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseQuestions, classifyItem, normalizeGender } from './parse-questions';
import type { ZeffyQuestion } from './types';

const realQuestions: ZeffyQuestion[] = [
  { question: 'Contestant FULL Name', type: 'text', answer: 'Yusuf Karim' },
  { question: 'Contestant Date of Birth', type: 'date', answer: '2008-06-20' },
  { question: 'Gender', type: 'single_select', answer: 'Male' },
  { question: 'Categories', type: 'multi_select', answer: ['5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)'] },
];

describe('normalizeGender', () => {
  it('maps Male/Female case-insensitively', () => {
    expect(normalizeGender('Male')).toBe('male');
    expect(normalizeGender('female')).toBe('female');
  });
  it('returns null for anything else', () => {
    expect(normalizeGender('Other')).toBeNull();
    expect(normalizeGender(undefined)).toBeNull();
    expect(normalizeGender(['Male'])).toBeNull();
  });
});

describe('classifyItem', () => {
  it('recognizes a contest ticket', () => {
    expect(classifyItem('ticket')).toBe('ticket');
  });
  it('recognizes donations and falls back to other', () => {
    expect(classifyItem('donation')).toBe('donation');
    expect(classifyItem('whatever')).toBe('other');
  });
});

describe('parseQuestions', () => {
  it('maps the four known labels to canonical fields', () => {
    const p = parseQuestions(realQuestions);
    expect(p.fullName).toBe('Yusuf Karim');
    expect(p.dateOfBirth).toBe('2008-06-20');
    expect(p.gender).toBe('male');
    expect(p.categories).toEqual(['5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)']);
  });
  it('keeps every answer in byLabel verbatim', () => {
    const p = parseQuestions(realQuestions);
    expect(p.byLabel['Contestant FULL Name']).toBe('Yusuf Karim');
    expect(p.byLabel['Categories']).toHaveLength(3);
  });
  it('wraps a single-string category answer into an array', () => {
    const p = parseQuestions([{ question: 'Categories', type: 'single_select', answer: '1 Juz (Ages 13 and Under)' }]);
    expect(p.categories).toEqual(['1 Juz (Ages 13 and Under)']);
  });
  it('defaults missing fields to null/empty', () => {
    const p = parseQuestions([]);
    expect(p.fullName).toBeNull();
    expect(p.gender).toBeNull();
    expect(p.dateOfBirth).toBeNull();
    expect(p.categories).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/zeffy/parse-questions.test.ts`.

- [ ] **Step 3: Create `src/zeffy/types.ts`**

```ts
export interface ZeffyQuestion {
  question: string;
  type: string;
  answer: string | string[];
}

export interface ZeffyItem {
  id: string;
  type: string;
  questions: ZeffyQuestion[];
}

export interface ZeffyPayloadData {
  id: string;
  status: string;
  campaign_id: string;
  buyer: Record<string, unknown>;
  items: ZeffyItem[];
}

export interface ZeffyPayload {
  id: string;
  type: string;
  data: ZeffyPayloadData;
}

export interface ParsedFields {
  byLabel: Record<string, string | string[]>;
  fullName: string | null;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  categories: string[];
}
```

- [ ] **Step 4: Create `src/zeffy/parse-questions.ts`**

```ts
import type { ZeffyQuestion, ParsedFields } from './types';

const LABEL = {
  fullName: 'Contestant FULL Name',
  dateOfBirth: 'Contestant Date of Birth',
  gender: 'Gender',
  categories: 'Categories',
} as const;

export function normalizeGender(answer: unknown): 'male' | 'female' | null {
  if (typeof answer !== 'string') return null;
  const a = answer.trim().toLowerCase();
  return a === 'male' ? 'male' : a === 'female' ? 'female' : null;
}

export function classifyItem(type: string): 'ticket' | 'donation' | 'other' {
  if (type === 'ticket') return 'ticket';
  if (type === 'donation') return 'donation';
  return 'other';
}

function asString(answer: string | string[]): string | null {
  return typeof answer === 'string' ? answer : null;
}

export function parseQuestions(questions: ZeffyQuestion[]): ParsedFields {
  const byLabel: Record<string, string | string[]> = {};
  for (const q of questions) byLabel[q.question] = q.answer;

  const categoriesRaw = byLabel[LABEL.categories];
  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : typeof categoriesRaw === 'string'
      ? [categoriesRaw]
      : [];

  return {
    byLabel,
    fullName: asString(byLabel[LABEL.fullName] ?? ''),
    gender: normalizeGender(byLabel[LABEL.gender]),
    dateOfBirth: asString(byLabel[LABEL.dateOfBirth] ?? ''),
    categories,
  };
}
```

(Note: `asString('')` returns `''` not `null` for a present-but-empty answer; the `?? ''` only handles absence. Adjust: missing label → `byLabel[...]` is `undefined`, `undefined ?? '' = ''`, `asString('') = ''`. The test expects `null` for missing fullName. So implement `asString` to treat empty as null:)

Replace `asString` with:
```ts
function asString(answer: string | string[] | undefined): string | null {
  return typeof answer === 'string' && answer.length > 0 ? answer : null;
}
```
and call `asString(byLabel[LABEL.fullName])` / `asString(byLabel[LABEL.dateOfBirth])` (no `?? ''`).

- [ ] **Step 5: Run, verify PASS** — `npx vitest run src/zeffy/parse-questions.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/zeffy/types.ts src/zeffy/parse-questions.ts src/zeffy/parse-questions.test.ts
git commit -m "feat(zeffy): question parsing, item classification, gender normalization"
```

---

### Task 2: parseRegistration over a real payload

**Files:** Create `src/zeffy/__fixtures__/payloads.ts`, `src/zeffy/parse-registration.ts`, `src/zeffy/parse-registration.test.ts`.

**Interfaces produced:**
- `ParsedRegistration { id: string; doc: Omit<RegistrationDoc, 'createdAt'> }`
- `parseRegistration(payload: ZeffyPayload): ParsedRegistration[]` — one per item; `id = registrationId(payload.data.id, item.id)`.

- [ ] **Step 1: Create the fixture `src/zeffy/__fixtures__/payloads.ts`** (the two real 2026-06-18 captures, trimmed to fields the parser reads)

```ts
import type { ZeffyPayload } from '../types';

// Synthetic sample #1 (Kareem Ali — all four categories).
export const PAYLOAD_ALL_CATS: ZeffyPayload = {
  id: 'e1000000-0000-4000-8000-000000000001',
  type: 'payment.completed',
  data: {
    id: 'a1000000-0000-4000-8000-000000000001',
    status: 'succeeded',
    campaign_id: 'c0000000-0000-4000-8000-000000000000',
    buyer: { email: 'buyer@example.com', first_name: 'Sample', last_name: 'Buyer' },
    items: [
      {
        id: 'a1000000-0000-4000-8000-0000000000a1',
        type: 'ticket',
        questions: [
          { question: 'Contestant FULL Name', type: 'text', answer: 'Kareem Ali' },
          { question: 'Contestant Date of Birth', type: 'date', answer: '2005-03-12' },
          { question: 'Gender', type: 'single_select', answer: 'Male' },
          { question: 'Categories', type: 'multi_select', answer: ['1 Juz (Ages 13 and Under)', '5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)'] },
        ],
      },
    ],
  },
};

// Synthetic sample #2 (Yusuf Karim — three categories; the retry-tested payload).
export const PAYLOAD_THREE_CATS: ZeffyPayload = {
  id: 'e2000000-0000-4000-8000-000000000002',
  type: 'payment.completed',
  data: {
    id: 'b2000000-0000-4000-8000-000000000002',
    status: 'succeeded',
    campaign_id: 'c0000000-0000-4000-8000-000000000000',
    buyer: { email: 'buyer@example.com', first_name: 'Sample', last_name: 'Buyer' },
    items: [
      {
        id: 'b2000000-0000-4000-8000-0000000000b2',
        type: 'ticket',
        questions: [
          { question: 'Contestant FULL Name', type: 'text', answer: 'Yusuf Karim' },
          { question: 'Contestant Date of Birth', type: 'date', answer: '2008-06-20' },
          { question: 'Gender', type: 'single_select', answer: 'Male' },
          { question: 'Categories', type: 'multi_select', answer: ['5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)'] },
        ],
      },
    ],
  },
};
```

- [ ] **Step 2: Write the failing test `src/zeffy/parse-registration.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseRegistration } from './parse-registration';
import { PAYLOAD_ALL_CATS, PAYLOAD_THREE_CATS } from './__fixtures__/payloads';

describe('parseRegistration', () => {
  it('produces one registration per item with the idempotency-key id', () => {
    const regs = parseRegistration(PAYLOAD_THREE_CATS);
    expect(regs).toHaveLength(1);
    expect(regs[0].id).toBe('b2000000-0000-4000-8000-000000000002:b2000000-0000-4000-8000-0000000000b2');
  });

  it('maps the ticket into a registration doc (no createdAt — set at write time)', () => {
    const { doc } = parseRegistration(PAYLOAD_THREE_CATS)[0];
    expect(doc.source).toBe('zeffy');
    expect(doc.kind).toBe('ticket');
    expect(doc.zeffyPaymentId).toBe('b2000000-0000-4000-8000-000000000002');
    expect(doc.zeffyItemId).toBe('b2000000-0000-4000-8000-0000000000b2');
    expect(doc.paymentStatus).toBe('succeeded');
    expect(doc.promotedContestantId).toBeNull();
    expect(doc).not.toHaveProperty('createdAt');
  });

  it('puts contestant answers in parsedFields and the purchaser in buyer', () => {
    const { doc } = parseRegistration(PAYLOAD_THREE_CATS)[0];
    const pf = doc.parsedFields as { fullName: string; categories: string[]; gender: string };
    expect(pf.fullName).toBe('Yusuf Karim');
    expect(pf.gender).toBe('male');
    expect(pf.categories).toHaveLength(3);
    expect((doc.buyer as { email: string }).email).toBe('buyer@example.com');
  });

  it('preserves the raw item verbatim (lossless master)', () => {
    const { doc } = parseRegistration(PAYLOAD_ALL_CATS)[0];
    expect((doc.rawItem as { id: string }).id).toBe('a1000000-0000-4000-8000-0000000000a1');
    expect((doc.parsedFields as { categories: string[] }).categories).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run, verify FAIL** — `npx vitest run src/zeffy/parse-registration.test.ts`.

- [ ] **Step 4: Create `src/zeffy/parse-registration.ts`**

```ts
import type { RegistrationDoc } from '../data/types';
import { registrationId } from '../domain/ids';
import type { ZeffyPayload } from './types';
import { classifyItem, parseQuestions } from './parse-questions';

export interface ParsedRegistration {
  id: string;
  doc: Omit<RegistrationDoc, 'createdAt'>;
}

export function parseRegistration(payload: ZeffyPayload): ParsedRegistration[] {
  const { data } = payload;
  return data.items.map((item) => ({
    id: registrationId(data.id, item.id),
    doc: {
      source: 'zeffy',
      zeffyPaymentId: data.id,
      zeffyItemId: item.id,
      kind: classifyItem(item.type),
      buyer: data.buyer,
      rawItem: item as unknown as Record<string, unknown>,
      parsedFields: parseQuestions(item.questions) as unknown as Record<string, unknown>,
      paymentStatus: data.status,
      promotedContestantId: null,
    },
  }));
}
```

- [ ] **Step 5: Run, verify PASS** — `npx vitest run src/zeffy/parse-registration.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/zeffy/__fixtures__/payloads.ts src/zeffy/parse-registration.ts src/zeffy/parse-registration.test.ts
git commit -m "feat(zeffy): parseRegistration over real captured payloads"
```

---

### Task 3: Request verification + webhook handler (dependency-injected)

**Files:** Create `src/zeffy/webhook.ts`, `src/zeffy/webhook.test.ts`.

**Interfaces produced:**
- `verifyZeffyRequest(provided: { token: string | null; campaignId: string }, expected: { token: string; campaignId: string }): boolean`
- `RegistrationWriter = (id: string, doc: Omit<RegistrationDoc, 'createdAt'>) => Promise<'written' | 'exists'>`
- `handleZeffyWebhook(payload: ZeffyPayload, write: RegistrationWriter): Promise<{ processed: number; results: { id: string; kind: string; result: 'written' | 'exists' }[] }>`

- [ ] **Step 1: Write the failing test `src/zeffy/webhook.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { verifyZeffyRequest, handleZeffyWebhook, type RegistrationWriter } from './webhook';
import { PAYLOAD_THREE_CATS } from './__fixtures__/payloads';
import type { RegistrationDoc } from '../data/types';

const EXPECTED = { token: 'secret-123', campaignId: 'c0000000-0000-4000-8000-000000000000' };

describe('verifyZeffyRequest', () => {
  it('accepts the right token and campaign', () => {
    expect(verifyZeffyRequest({ token: 'secret-123', campaignId: EXPECTED.campaignId }, EXPECTED)).toBe(true);
  });
  it('rejects a wrong or missing token', () => {
    expect(verifyZeffyRequest({ token: 'nope', campaignId: EXPECTED.campaignId }, EXPECTED)).toBe(false);
    expect(verifyZeffyRequest({ token: null, campaignId: EXPECTED.campaignId }, EXPECTED)).toBe(false);
  });
  it('rejects a foreign campaign', () => {
    expect(verifyZeffyRequest({ token: 'secret-123', campaignId: 'other' }, EXPECTED)).toBe(false);
  });
});

describe('handleZeffyWebhook', () => {
  function fakeWriter() {
    const store = new Map<string, Omit<RegistrationDoc, 'createdAt'>>();
    const write: RegistrationWriter = async (id, doc) => {
      if (store.has(id)) return 'exists';
      store.set(id, doc);
      return 'written';
    };
    return { store, write };
  }

  it('writes one registration per item and reports results', async () => {
    const { store, write } = fakeWriter();
    const res = await handleZeffyWebhook(PAYLOAD_THREE_CATS, write);
    expect(res.processed).toBe(1);
    expect(res.results[0]).toMatchObject({ kind: 'ticket', result: 'written' });
    expect(store.size).toBe(1);
  });

  it('is idempotent — a retry of the same payload writes nothing new', async () => {
    const { store, write } = fakeWriter();
    await handleZeffyWebhook(PAYLOAD_THREE_CATS, write);
    const res2 = await handleZeffyWebhook(PAYLOAD_THREE_CATS, write);
    expect(res2.results[0].result).toBe('exists');
    expect(store.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/zeffy/webhook.test.ts`.

- [ ] **Step 3: Create `src/zeffy/webhook.ts`**

```ts
import type { RegistrationDoc } from '../data/types';
import type { ZeffyPayload } from './types';
import { parseRegistration } from './parse-registration';

export function verifyZeffyRequest(
  provided: { token: string | null; campaignId: string },
  expected: { token: string; campaignId: string },
): boolean {
  // ponytail: plain === on a high-entropy URL token over HTTPS. Swap to an HMAC if Zeffy ever signs.
  return provided.token === expected.token && provided.campaignId === expected.campaignId;
}

export type RegistrationWriter = (
  id: string,
  doc: Omit<RegistrationDoc, 'createdAt'>,
) => Promise<'written' | 'exists'>;

export async function handleZeffyWebhook(
  payload: ZeffyPayload,
  write: RegistrationWriter,
): Promise<{ processed: number; results: { id: string; kind: string; result: 'written' | 'exists' }[] }> {
  const regs = parseRegistration(payload);
  const results = [];
  for (const { id, doc } of regs) {
    const result = await write(id, doc);
    results.push({ id, kind: doc.kind, result });
  }
  return { processed: results.length, results };
}
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/zeffy/webhook.test.ts`.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test` → all prior + new zeffy tests pass.
Run: `npx tsc` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/zeffy/webhook.ts src/zeffy/webhook.test.ts
git commit -m "feat(zeffy): request verification and dependency-injected webhook handler"
```

---

## Deploy-time integration point (deferred — documented, not built)

The Cloud Function entry is glue with no logic to test; wire it when deploying (needs `firebase-admin` + `firebase-functions` and a real project):

```ts
// functions/src/zeffyWebhook.ts  (deploy-time)
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { handleZeffyWebhook, verifyZeffyRequest } from '...';

initializeApp();
const db = getFirestore();
const EXPECTED = { token: process.env.ZEFFY_TOKEN!, campaignId: process.env.ZEFFY_CAMPAIGN_ID! };

export const zeffyWebhook = onRequest(async (req, res) => {
  const payload = req.body;
  if (!verifyZeffyRequest({ token: (req.query.token as string) ?? null, campaignId: payload?.data?.campaign_id ?? '' }, EXPECTED)) {
    res.status(403).send('forbidden'); return;
  }
  await handleZeffyWebhook(payload, async (id, doc) => {
    try { await db.doc(`registrations/${id}`).create({ ...doc, createdAt: FieldValue.serverTimestamp() }); return 'written'; }
    catch { return 'exists'; } // create() throws if the doc exists → idempotent
  });
  res.status(200).send('ok'); // always 2xx so Zeffy stops retrying
});
```

## Self-Review Notes
- **Spec coverage:** §7/§7.1 — per-item registrations, idempotency-key id, `item.type` classify, `item.questions[]` parsing with the four exact labels, gender normalization, buyer-as-context, lossless `rawItem`, token+campaign verification. Refunds correctly out of scope.
- **Deferred (YAGNI until deploy):** the Firebase function entry + Admin-SDK writer (documented above; pure handler tested via DI). Category-string→ID resolution + promote belong to the admin plan (Plan 6).
- **Type consistency:** reuses `RegistrationDoc` (`src/data/types`) and `registrationId` (`src/domain/ids`).
