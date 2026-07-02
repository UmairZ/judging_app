# Phase 3: Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Universal contestant intake — CSV import (with bulk promote) for the common case, and the Zeffy webhook rebuilt per-tenant (tenant-path URL + per-competition secret token) — manual add already exists via Contestants → + New.

**Architecture:** A pure CSV module (`src/intake/csv.ts`) parses RFC-4180 text into people rows and deterministic registration ids; the Registrations screen writes them as immutable `source: 'csv'` registration docs (staff-create is already allowed by rules) and gains a "Promote all ready" bulk action that reuses the existing promote pipeline. The Cloud Function `zeffyWebhook` reads its tenant from the URL path (`/zeffy/{orgId}/{compId}`) and its secret token + event title from that competition's `config/zeffy` doc — the global `ZEFFY_TOKEN` env dies. No security-rules changes: registrations were already staff-create-only/immutable, and `config/zeffy` is already staff-writable.

**Tech Stack:** React 18 + Vite + TS, Firebase (Firestore/Functions), vitest. No new dependencies (hand-rolled ~40-line CSV parser, tested).

**Spec:** `docs/superpowers/specs/2026-07-01-multi-tenant-saas-design.md` §8, §12 Phase 3

## Global Constraints

- All work on branch `saas-phase-3-intake`, branched off `saas`. Never touch `main`.
- No new npm dependencies. Inline styles, house palette (`src/ui/theme.ts`).
- Registration docs stay immutable (create-only): CSV import NEVER updates or deletes a registration; re-importing an existing row surfaces as "already imported".
- CSV registration id (exact): `csv:` + slugified fullName + `:` + (dateOfBirth or `nodob`) — deterministic so re-imports are idempotent. Slug charset `[a-z0-9-]`.
- `RegistrationDoc.source` becomes `'zeffy' | 'manual' | 'csv'`.
- Webhook URL shape (exact): `/zeffy/{orgId}/{compId}?token={TOKEN}` — orgId/compId validated against `SEG` (`/^[A-Za-z0-9_-]{1,128}$/` from `src/tenant/paths.ts`).
- Per-competition Zeffy config doc `config/zeffy` = `{ eventTitle: string, token: string }`; the webhook FAILS CLOSED (403) when `token` is missing/empty. `ZEFFY_TOKEN` env is removed from the function.
- Webhook token: 24 chars from the join-code alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, rejection-sampled) ≈ 119 bits.
- `zeffyWebhook` keeps: idempotent `create()` (ALREADY_EXISTS → 'exists'), the registration-id charset guard `/^[A-Za-z0-9:_-]{1,1500}$/`, 400 on deterministic bad payloads, 200+ignored for non-`payment.completed` and non-matching event titles.
- Bulk promote only auto-promotes a registration when: fullName present, ≥1 category, ALL categories resolve, and EVERY resolved category has a resolvable division; anything else is skipped for the manual drawer.
- Commands: unit `npm test`; rules `npm run test:rules` (Windows: `taskkill /F /IM java.exe` first if 8080 is stuck); build `npm run build`; functions `npm --prefix functions run build`.

---

### Task 1: CSV parsing module

**Files:**
- Create: `src/intake/csv.ts`
- Create: `src/intake/csv.test.ts`

**Interfaces:**
- Consumes: nothing (pure leaf module — no React/Firebase; functions could bundle it).
- Produces (Task 4 relies on these exact names):
  - `parseCsv(text: string): string[][]`
  - `rowsToPeople(rows: string[][]): CsvParseResult` where `CsvParseResult = { people: CsvPerson[]; errors: { line: number; message: string }[] }` and `CsvPerson = { fullName: string; gender: 'male' | 'female' | null; dateOfBirth: string | null; categories: string[]; line: number }`
  - `csvRegistrationId(person: Pick<CsvPerson, 'fullName' | 'dateOfBirth'>): string`

- [ ] **Step 1: Write the failing tests**

Create `src/intake/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToPeople, csvRegistrationId } from './csv';

describe('parseCsv', () => {
  it('parses simple rows and trims a trailing newline', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('handles quoted fields with commas, escaped quotes, and newlines', () => {
    expect(parseCsv('name,note\n"Omar, Jr.","said ""hi""\nline2"')).toEqual([
      ['name', 'note'],
      ['Omar, Jr.', 'said "hi"\nline2'],
    ]);
  });
  it('handles CRLF and skips fully empty lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('rowsToPeople', () => {
  const header = ['Full Name', 'Gender', 'DOB', 'Categories'];
  it('maps aliased headers and splits multi-categories on ; and |', () => {
    const r = rowsToPeople([header, ['Fatima Noor', 'Female', '2010-01-05', "1 Juz'; 5 Ajzā'"]]);
    expect(r.errors).toEqual([]);
    expect(r.people).toEqual([
      { fullName: 'Fatima Noor', gender: 'female', dateOfBirth: '2010-01-05', categories: ["1 Juz'", "5 Ajzā'"], line: 2 },
    ]);
  });
  it('tolerates missing optional fields and unknown gender text', () => {
    const r = rowsToPeople([['name', 'category'], ['Omar Ali', '30 Juz']]);
    expect(r.people[0]).toEqual({ fullName: 'Omar Ali', gender: null, dateOfBirth: null, categories: ['30 Juz'], line: 2 });
  });
  it('errors on a missing name and on a header row without a name column', () => {
    const r1 = rowsToPeople([['name', 'gender'], ['', 'male']]);
    expect(r1.people).toEqual([]);
    expect(r1.errors).toEqual([{ line: 2, message: 'missing full name' }]);
    const r2 = rowsToPeople([['foo', 'bar'], ['x', 'y']]);
    expect(r2.errors[0].message).toMatch(/name column/i);
  });
  it('errors on an empty input', () => {
    expect(rowsToPeople([]).errors[0].message).toMatch(/empty/i);
  });
});

describe('csvRegistrationId', () => {
  it('is deterministic, slugged, and dob-qualified', () => {
    expect(csvRegistrationId({ fullName: '  Fatima  Noor ', dateOfBirth: '2010-01-05' })).toBe('csv:fatima-noor:2010-01-05');
    expect(csvRegistrationId({ fullName: 'Omar', dateOfBirth: null })).toBe('csv:omar:nodob');
  });
  it('strips non-alphanumerics from the slug', () => {
    expect(csvRegistrationId({ fullName: "O'Malley, Jr.", dateOfBirth: null })).toBe('csv:o-malley-jr:nodob');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/intake/csv.test.ts`
Expected: FAIL — cannot resolve `./csv`.

- [ ] **Step 3: Implement**

Create `src/intake/csv.ts`:

```ts
/** Minimal RFC-4180 CSV parser: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface CsvPerson {
  fullName: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  categories: string[];
  /** 1-based source line (header is line 1) for error reporting. */
  line: number;
}

export interface CsvParseResult {
  people: CsvPerson[];
  errors: { line: number; message: string }[];
}

// Header cell → canonical field. Matching is case-insensitive on the trimmed cell.
const HEADER_ALIASES: Record<string, 'fullName' | 'gender' | 'dateOfBirth' | 'categories'> = {
  'full name': 'fullName', fullname: 'fullName', name: 'fullName', 'contestant name': 'fullName', 'student name': 'fullName',
  gender: 'gender', sex: 'gender',
  'date of birth': 'dateOfBirth', dob: 'dateOfBirth', birthdate: 'dateOfBirth', 'birth date': 'dateOfBirth',
  category: 'categories', categories: 'categories', level: 'categories',
};

function parseGender(raw: string): 'male' | 'female' | null {
  const g = raw.trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'boy' || g === 'brother') return 'male';
  if (g === 'female' || g === 'f' || g === 'girl' || g === 'sister') return 'female';
  return null;
}

/** Interpret parsed rows: first row must be a header containing a name column. */
export function rowsToPeople(rows: string[][]): CsvParseResult {
  if (rows.length === 0) return { people: [], errors: [{ line: 1, message: 'file is empty' }] };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
  if (!header.includes('fullName')) {
    return { people: [], errors: [{ line: 1, message: 'no name column found (accepted headers: name, full name, contestant name)' }] };
  }
  const people: CsvPerson[] = [];
  const errors: { line: number; message: string }[] = [];
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (f: 'fullName' | 'gender' | 'dateOfBirth' | 'categories') => {
      const col = header.indexOf(f);
      return col >= 0 ? (cells[col] ?? '').trim() : '';
    };
    const fullName = get('fullName');
    if (!fullName) { errors.push({ line, message: 'missing full name' }); return; }
    const categories = get('categories').split(/[;|]/).map((c) => c.trim()).filter(Boolean);
    people.push({
      fullName,
      gender: parseGender(get('gender')),
      dateOfBirth: get('dateOfBirth') || null,
      categories,
      line,
    });
  });
  return { people, errors };
}

/** Deterministic id so re-importing the same person is idempotent (create fails → "already imported"). */
export function csvRegistrationId(person: { fullName: string; dateOfBirth: string | null }): string {
  const slug = person.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `csv:${slug || 'unnamed'}:${person.dateOfBirth ?? 'nodob'}`;
}
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/intake/csv.test.ts` → PASS. Then `npm test && npm run build` → green (94 + 9 new).

- [ ] **Step 5: Commit**

```bash
git add src/intake/
git commit -m "feat(intake): pure CSV parser, people mapping, deterministic registration ids"
```

---

### Task 2: Per-tenant Zeffy webhook

**Files:**
- Modify: `src/onboarding/logic.ts` + `src/onboarding/logic.test.ts` (`generateWebhookToken` via shared `randomCode`)
- Modify: `src/zeffy/webhook.ts` + `src/zeffy/webhook.test.ts` (`tenantFromWebhookPath`)
- Modify: `functions/src/index.ts` (zeffyWebhook rewrite)
- Modify: `firebase.json` (hosting rewrite `/zeffy` → `/zeffy/**`)

**Interfaces:**
- Consumes: `SEG`/`validateIds` (existing), `verifyZeffyRequest`/`handleZeffyWebhook` (existing, unchanged).
- Produces: `generateWebhookToken(): string` (24 chars, join-code alphabet — Task 3 uses it); `tenantFromWebhookPath(path: string): { orgId: string; compId: string } | null`; webhook contract per Global Constraints.

- [ ] **Step 1: Failing tests**

In `src/onboarding/logic.test.ts` add:

```ts
describe('generateWebhookToken', () => {
  it('produces 24 chars from the join-code alphabet', () => {
    for (let i = 0; i < 20; i++) expect(generateWebhookToken()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{24}$/);
  });
});
```

In `src/zeffy/webhook.test.ts` add:

```ts
import { tenantFromWebhookPath } from './webhook';

describe('tenantFromWebhookPath', () => {
  it('takes the trailing two segments (hosting rewrite and direct function URL)', () => {
    expect(tenantFromWebhookPath('/zeffy/demo/2026')).toEqual({ orgId: 'demo', compId: '2026' });
    expect(tenantFromWebhookPath('/zeffyWebhook/demo/2026')).toEqual({ orgId: 'demo', compId: '2026' });
    expect(tenantFromWebhookPath('/demo/2026/')).toEqual({ orgId: 'demo', compId: '2026' });
  });
  it('rejects missing or unsafe segments', () => {
    expect(tenantFromWebhookPath('/zeffy')).toBeNull();
    expect(tenantFromWebhookPath('/')).toBeNull();
    expect(tenantFromWebhookPath('/zeffy/de mo/2026')).toBeNull();
  });
});
```

Run: `npx vitest run src/onboarding/logic.test.ts src/zeffy/webhook.test.ts` → FAIL (missing exports).

- [ ] **Step 2: Implement the pure parts**

`src/onboarding/logic.ts`: refactor `generateJoinCode` into a shared sampler and add the token generator (replacing the existing function body — rejection sampling stays identical):

```ts
function randomCode(length: number): string {
  const out: string[] = [];
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      // Rejection sampling: drop bytes past the largest multiple of 31 to keep the draw uniform.
      if (b >= 248 || out.length >= length) continue;
      out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}

/** 8-char join code (~40 bits — plenty for short-lived, revocable codes). */
export function generateJoinCode(): string {
  return randomCode(8);
}

/** 24-char webhook secret (~119 bits) — the security boundary for per-tenant Zeffy. */
export function generateWebhookToken(): string {
  return randomCode(24);
}
```

`src/zeffy/webhook.ts`: add (importing `SEG` from `../tenant/paths`):

```ts
import { SEG } from '../tenant/paths';

/** Tenant from a webhook request path — the trailing two segments of /zeffy/{orgId}/{compId}. */
export function tenantFromWebhookPath(path: string): { orgId: string; compId: string } | null {
  const segs = path.split('/').filter(Boolean);
  if (segs.length < 2) return null;
  const orgId = segs[segs.length - 2];
  const compId = segs[segs.length - 1];
  if (!SEG.test(orgId) || !SEG.test(compId)) return null;
  return { orgId, compId };
}
```

Run: `npx vitest run src/onboarding/logic.test.ts src/zeffy/webhook.test.ts` → PASS.

- [ ] **Step 3: Rewrite the function**

In `functions/src/index.ts`, replace the `zeffyWebhook` export body (imports to add: `tenantFromWebhookPath` joins the existing `../../src/zeffy/webhook` import). The comment block above it should be updated to describe per-tenant routing. Full replacement:

```ts
// Zeffy payment.completed receiver, per-tenant: the URL path names the competition
// (/zeffy/{orgId}/{compId}) and the secret token + event-title filter live in that
// competition's config/zeffy doc ({ token, eventTitle }, admin-managed in-app).
// Fails CLOSED when the competition has no token configured.
export const zeffyWebhook = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  const tenant = tenantFromWebhookPath(req.path);
  if (!tenant) {
    res.status(404).send('unknown tenant');
    return;
  }
  const base = `orgs/${tenant.orgId}/competitions/${tenant.compId}`;

  const cfg = (await db.doc(`${base}/config/zeffy`).get()).data() ?? {};
  const expectedToken = typeof cfg.token === 'string' ? cfg.token : '';
  const expectedEventTitle = typeof cfg.eventTitle === 'string' ? cfg.eventTitle : '';
  if (!expectedToken) {
    res.status(403).send('forbidden'); // fail closed: no token configured for this competition
    return;
  }
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token || token !== expectedToken) {
    res.status(403).send('forbidden');
    return;
  }

  const payload = req.body;
  if (payload?.type !== 'payment.completed') {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }
  if (!expectedEventTitle.trim()) {
    res.status(500).send('event title not configured');
    return;
  }
  const eventTitle = typeof payload?.data?.description === 'string' ? payload.data.description : '';
  if (!verifyZeffyRequest({ token, eventTitle }, { token: expectedToken, eventTitle: expectedEventTitle })) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const result = await handleZeffyWebhook(payload, async (id, doc) => {
      // Path-injection guard: the doc id derives from attacker-controllable payment/item ids.
      if (!/^[A-Za-z0-9:_-]{1,1500}$/.test(id)) throw new Error('invalid registration id');
      try {
        await db.doc(`${base}/registrations/${id}`).create({ ...doc, createdAt: FieldValue.serverTimestamp() });
        return 'written';
      } catch (err) {
        const code = (err as { code?: number | string })?.code;
        if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) return 'exists';
        throw err;
      }
    });
    res.status(200).json({ ok: true, processed: result.processed });
  } catch (err) {
    console.error('zeffyWebhook', err);
    if (err instanceof Error && err.message === 'invalid registration id') {
      res.status(400).send('bad request');
      return;
    }
    res.status(500).send('error');
  }
});
```

Delete the now-dead `process.env.ZEFFY_TOKEN` handling entirely (it was only used here).

In `firebase.json`, change the hosting rewrite `{ "source": "/zeffy", ... }` to `{ "source": "/zeffy/**", "function": { "functionId": "zeffyWebhook", "region": "us-central1" } }`.

- [ ] **Step 4: Verify**

Run: `npm test && npm run build && npm --prefix functions run build` → all green. Grep guard: `grep -n "ZEFFY_TOKEN" functions/src/index.ts` → no matches.

- [ ] **Step 5: Commit**

```bash
git add src/onboarding/ src/zeffy/ functions/src/index.ts firebase.json
git commit -m "feat(intake): per-tenant zeffy webhook — tenant path + per-competition token"
```

---

### Task 3: Zeffy panel UI — webhook URL + token management

**Files:**
- Modify: `src/admin/Registrations.tsx` (the Zeffy config strip, ~lines 406-412 state + 535-556 JSX)

**Interfaces:**
- Consumes: `generateWebhookToken` (Task 2); `useTenant()` → `{ orgId, compId, tp }`; existing `writeDoc`, `useDocData`.
- Produces: admin-visible webhook URL + token lifecycle. `config/zeffy` doc shape `{ eventTitle, token }` (merge-writes so the two fields never clobber each other).

- [ ] **Step 1: Extend the config read + handlers**

In `Registrations.tsx`, widen the config type and add token handlers (the component already has `const { tp } = useTenant();` — widen to `const { orgId, compId, tp } = useTenant();`):

```tsx
const zeffyCfg = useDocData<{ eventTitle?: string; token?: string }>(tp('config/zeffy'));
const zeffyToken = zeffyCfg.data?.token ?? '';
const webhookUrl = zeffyToken ? `${window.location.origin}/zeffy/${orgId}/${compId}?token=${zeffyToken}` : '';
const [copied, setCopied] = useState(false);

const rotateToken = async () => {
  if (zeffyToken && !window.confirm('Rotate the webhook token? The old URL stops working immediately — update it in Zeffy.')) return;
  await writeDoc(tp('config/zeffy'), { token: generateWebhookToken() });
};
const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  } catch { /* non-secure context — the URL is visible to select manually */ }
};
```

Note: the existing `saveZeffy` writes `{ eventTitle }` with `writeDoc` (merge: true default) — merge semantics keep `token` intact; verify the call does NOT pass `merge: false`.

- [ ] **Step 2: Add the webhook row to the Zeffy strip JSX**

Directly below the existing event-title row (same bordered strip, add a second row inside it or a sibling row with the same styling):

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: `1px solid ${C.line}`, background: C.parchment, flexWrap: 'wrap' }}>
  <div style={{ minWidth: 200, flex: '1 1 240px' }}>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.greenDeep }}>Zeffy webhook</div>
    <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45 }}>
      Paste this URL into Zeffy's webhook settings. The token is this competition's secret — rotate it if it leaks.
    </div>
  </div>
  {zeffyToken ? (
    <>
      <code style={{ flex: '2 1 280px', minWidth: 220, fontSize: 12, padding: '9px 12px', border: `1px solid ${C.cardLine}`, borderRadius: 7, background: '#fff', color: C.ink, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {webhookUrl}
      </code>
      <button onClick={() => void copyUrl()} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '9px 14px', cursor: 'pointer' }}>
        {copied ? '✓ Copied' : 'Copy URL'}
      </button>
      <button onClick={() => void rotateToken()} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.brassDark, background: 'transparent', border: `1px solid ${C.brassDark}`, borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
        Rotate token
      </button>
    </>
  ) : (
    <button onClick={() => void rotateToken()} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '9px 18px', cursor: 'pointer' }}>
      Generate webhook token
    </button>
  )}
</div>
```

- [ ] **Step 3: Verify + commit**

Run: `npm test && npm run build` → green.

```bash
git add src/admin/Registrations.tsx
git commit -m "feat(intake): webhook URL + token management in the Zeffy panel"
```

---

### Task 4: CSV import UI + bulk promote

**Files:**
- Modify: `src/data/types.ts` (`source: 'zeffy' | 'manual' | 'csv'`)
- Modify: `src/admin/Registrations.tsx` (import flow, bulk promote, shared promote helper, resolver widening)

**Interfaces:**
- Consumes: `parseCsv`, `rowsToPeople`, `csvRegistrationId`, `CsvPerson` (Task 1); existing `resolveCategories`, `buildDefaultDivisions`, `handleSubmit` promote writes.
- Produces: "Import CSV" and "Promote all ready" actions on the Registrations screen; `resolveCategories` additionally matches category `label` and `id` (case-insensitive) so CSV files can name categories directly.

- [ ] **Step 1: Types + resolver widening**

`src/data/types.ts`: `source: 'zeffy' | 'manual' | 'csv';` in `RegistrationDoc`.

In `Registrations.tsx` `resolveCategories`, widen the match (CSV files say "1 Juz'" or "1", Zeffy says its own label):

```ts
const cat = structure.categories.find(
  (c) =>
    c.zeffyLabels?.some((z) => z.toLowerCase() === rawLabel.toLowerCase()) ||
    c.label.toLowerCase() === rawLabel.toLowerCase() ||
    c.id.toLowerCase() === rawLabel.toLowerCase(),
);
```

- [ ] **Step 2: Shared promote builder**

Extract the promote decision from `openDrawer`/`handleSubmit` into a module-level helper in `Registrations.tsx` (used by bulk promote; the drawer keeps its interactive path):

```ts
/** Auto-promotion plan for a registration, or null when it needs the manual drawer. */
function buildPromotion(
  reg: { parsedFields?: Record<string, unknown> },
  structure: StructureConfig,
): { fullName: string; gender: 'male' | 'female' | null; pairs: CategoryDivisionPair[] } | null {
  const parsedFields = reg.parsedFields ?? {};
  const fullName = typeof parsedFields.fullName === 'string' ? parsedFields.fullName.trim() : '';
  if (!fullName) return null;
  const genderRaw = parsedFields.gender;
  const gender: 'male' | 'female' | null = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : null;
  const resolved = resolveCategories(parsedFields.categories, structure);
  if (resolved.length === 0 || resolved.some((r) => r.unmapped)) return null;
  const divisions = buildDefaultDivisions(resolved, gender, structure);
  const pairs = resolved.map((r) => ({ categoryId: r.categoryId, division: divisions[r.categoryId] ?? '' }));
  if (pairs.some((p) => !p.division)) return null; // gendered category without a gender → manual
  return { fullName, gender, pairs };
}
```

- [ ] **Step 3: Import + bulk-promote handlers**

Inside the `Registrations` component add:

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
const [importReport, setImportReport] = useState<string | null>(null);

const handleCsvFile = async (file: File) => {
  setImportReport(null);
  setError(null);
  const { people, errors } = rowsToPeople(parseCsv(await file.text()));
  if (people.length === 0) {
    setError(errors.length ? `CSV import failed — ${errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')}` : 'CSV import failed — no rows found.');
    return;
  }
  setBusy(true);
  let written = 0;
  let existing = 0;
  for (const p of people) {
    try {
      // create-only: an existing id (re-import) is rejected by rules → counted as already imported
      await writeDoc(tp(`registrations/${csvRegistrationId(p)}`), {
        source: 'csv',
        zeffyPaymentId: null,
        zeffyItemId: null,
        kind: 'ticket',
        buyer: {},
        rawItem: { line: p.line },
        parsedFields: { fullName: p.fullName, gender: p.gender, dateOfBirth: p.dateOfBirth, categories: p.categories },
        paymentStatus: 'n/a',
        createdAt: now(),
        promotedContestantId: null,
      }, false);
      written++;
    } catch {
      existing++;
    }
  }
  setBusy(false);
  const parts = [`Imported ${written} registration${written === 1 ? '' : 's'}`];
  if (existing) parts.push(`${existing} already imported`);
  if (errors.length) parts.push(`${errors.length} row${errors.length === 1 ? '' : 's'} skipped (${errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')})`);
  setImportReport(parts.join(' · '));
};

const handleBulkPromote = async () => {
  setBusy(true);
  setError(null);
  let promoted = 0;
  let skipped = 0;
  for (const reg of registrations) {
    if (reg.kind !== 'ticket' || isPromoted(reg.id)) continue;
    const plan = buildPromotion(reg, structure);
    if (!plan) { skipped++; continue; }
    try {
      const cid = crypto.randomUUID();
      await writeDoc(tp(`contestants/${cid}`), {
        fullName: plan.fullName, gender: plan.gender, photoUrl: null,
        registrationId: reg.id, fields: reg.parsedFields ?? {}, active: true,
      });
      await Promise.all(plan.pairs.map((p) =>
        writeDoc(tp(`enrollments/${enrollmentId(cid, p.categoryId)}`), {
          contestantId: cid, category: p.categoryId, division: p.division, round: 'main',
        }),
      ));
      promoted++;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Write failed');
      break;
    }
  }
  setBusy(false);
  setFlash(`Promoted ${promoted} · ${skipped} need review (open each to resolve)`);
  setTimeout(() => setFlash(null), 6000);
};
```

Imports to add: `useRef` from react; `parseCsv, rowsToPeople, csvRegistrationId` from `../intake/csv`; `now` from `../data/db` (join the existing import).

- [ ] **Step 4: Header actions JSX**

In the screen header (the row ending with the "use Contestants → + New" hint), add before that hint:

```tsx
<input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCsvFile(f); e.target.value = ''; }} />
<button onClick={() => fileInputRef.current?.click()} disabled={busy}
  style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
  Import CSV
</button>
<button onClick={() => void handleBulkPromote()} disabled={busy}
  style={{ fontSize: 12.5, fontWeight: 600, color: C.green, background: 'transparent', border: `1px solid ${C.green}`, borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>
  Promote all ready
</button>
```

(The "manually" hint keeps its place but drops its `marginLeft: 'auto'` — the Import button takes it.) Show `importReport` in the same style as the existing `flash` banner (a second conditional div below it, color `C.green` on `C.pillGreen`). Also render `error` if the screen doesn't already show it near the header (it currently surfaces errors only inside the drawer — add a header-level error banner mirroring the flash banner with `color: C.fail, background: C.failBg`).

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run build` → green. Also `npm run test:rules` once (registrations rules unchanged, but this task leans on create-only semantics — the existing suite pins them).

```bash
git add src/data/types.ts src/admin/Registrations.tsx
git commit -m "feat(intake): CSV import into registrations and bulk promote"
```

---

### Task 5: Docs + full verification

**Files:**
- Modify: `README.md`

**Interfaces:** consumes everything above.

- [ ] **Step 1: README**

In the intake-relevant docs: describe the three intake paths (manual via Contestants → + New; CSV via Registrations → Import CSV with accepted headers `name/full name`, `gender`, `dob/date of birth`, `category/categories` and `;`/`|` multi-category separators; Zeffy via the per-competition webhook URL from the Registrations panel). Note the webhook token is per-competition and rotatable, and that `ZEFFY_TOKEN` env is gone (self-hosters: no functions env needed for Zeffy anymore).

- [ ] **Step 2: Full verification + commit**

Run: `npm test && npm run test:rules && npm run build && npm --prefix functions run build` → all green.

```bash
git add README.md
git commit -m "docs(intake): three intake paths, per-tenant webhook, no more ZEFFY_TOKEN env"
```

---

## End-to-end smoke (controller, after all tasks)

1. Emulators (firestore+auth+functions) + seed + dev server.
2. As `admin@ibnkatheer.local` on `/demo/2026` → Registrations: generate webhook token → webhook URL appears; copy it.
3. `curl -X POST "<emulator functions URL>/zeffyWebhook/demo/2026?token=<TOKEN>"` with a `payment.completed` JSON body (event title matching config) → 200 `{processed: 1}`; wrong token → 403; unknown tenant → 404. Registration appears in the UI.
4. Import a 3-row CSV (one clean sisters row, one missing gender on a gendered category, one bad row without a name) → report shows 2 imported · 1 skipped; re-import → "2 already imported".
5. "Promote all ready" → clean row promoted (visible in Contestants with enrollment), gender-less row skipped with "need review"; open its drawer, set gender, promote manually.

## Post-plan checklist

- Merge `saas-phase-3-intake` → `saas`.
- Phase 4 (Polish) next per spec §12: landing page, App Check, self-hoster docs, optional migration script — plus the accumulated follow-up ledger (member-removal callable, tenant-scoped photo storage, competition-existence gate).
