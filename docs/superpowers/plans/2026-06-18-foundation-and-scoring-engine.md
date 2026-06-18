# Foundation + Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the single-PWA project (Vite + React + TypeScript + Vitest) and build the pure, framework-free scoring module that is the heart of the app — fully covered by tests, with zero Firebase or UI dependencies.

**Architecture:** One Vite app. The scoring logic lives in `src/scoring/` as pure functions with no React/Firebase imports, so both the judge UI and the admin leaderboard (later plans) import the exact same math. Scores are always derived from raw per-question events + config; nothing is stored pre-computed. Everything is unit-tested with Vitest, ending with an integration test that reproduces the spec's worked example.

**Tech Stack:** Vite 6, React 18, TypeScript 5 (strict), Vitest 2. No other runtime dependencies in this plan.

## Global Constraints

These apply to every task (copied from spec v1.2):

- **Store raw, derive scores.** Raw deduction events are canonical; every score recomputes from `events[]` + config. Never store a computed score as the source of truth.
- **Nothing scoring-related is hardcoded.** Weights, bases, deduction values all come from a `ScoringConfig` argument — never literals inside functions.
- **One scoring module.** All math lives in `src/scoring/`, pure (no React, no Firebase, no I/O). Judge app + admin import the same functions.
- **Component weights:** default `{ hifz: 70, tajweed: 25, voice: 5 }`, must sum to 100. Each session score is in `[0, 100]`.
- **Per-question bases** (`hifz_base`, `tajweed_base`, default 10) are intermediate scales normalized back to `[0,1]`; `hifz_base` doubles as the DQ auto-flag trigger.
- **Voice is per question** (`q.voice`, `0..voice_max`, `null` until rated; `voice_max` default 5).
- **DQ zeros all three components** (hifz, tajweed, voice) for that question.
- **A fresh/started session reads ~95** (unrated voice contributes 0; no renormalization).
- **Tie-break questions (`isTieBreak`) are excluded from the primary session score.**
- TypeScript `strict` mode is on; no `any`. Default deduction values: `prompted_fixed: 1`, `prompted_failed: 2`, `self_corrected: 0` (untracked penalty), `tajweed_major: 1`, `tajweed_minor: 0.5`.

---

## File Structure

```
package.json                 # scripts + deps
tsconfig.json                # strict TS config
vite.config.ts               # Vite + Vitest config
index.html                   # app entry
src/main.tsx                 # React bootstrap (minimal shell)
src/App.tsx                  # placeholder root component
src/smoke.test.ts            # harness smoke test (Task 1)
src/scoring/types.ts         # all scoring types (Task 2)
src/scoring/config.ts        # DEFAULT_SCORING_CONFIG + validation (Task 2)
src/scoring/question.ts      # per-question math (Tasks 3-4)
src/scoring/session.ts       # per-session aggregation (Task 5)
src/scoring/enrollment.ts    # cross-judge summary + leaderboard comparator (Task 6)
src/scoring/index.ts         # public API barrel (Task 7)
src/scoring/*.test.ts        # co-located unit tests per module
src/scoring/worked-example.test.ts  # spec §3.6 integration test (Task 7)
```

Each `src/scoring/*.ts` has one responsibility and is imported by name from `index.ts`. Tests are co-located (`*.test.ts`) — Vitest's `include` picks them up.

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/smoke.test.ts`
- Modify: `.gitignore` (append `node_modules/` and `dist/`)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest) command and a buildable Vite app that later tasks/plans extend.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ibn-katheer-judging",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ibn Katheer Qur'an Competition — Judging</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/App.tsx` (placeholder shell)**

```tsx
export default function App() {
  return <main>Ibn Katheer Judging — foundation ready.</main>;
}
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Write the harness smoke test `src/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs Vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Append build artifacts to `.gitignore`**

Append these two lines to the existing `.gitignore`:

```
node_modules/
dist/
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes without error; creates `node_modules/` and `package-lock.json`.

- [ ] **Step 10: Run the smoke test to verify the harness works**

Run: `npm test`
Expected: PASS — `1 passed` (the `test harness > runs Vitest` test).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.tsx src/App.tsx src/smoke.test.ts .gitignore
git commit -m "chore: scaffold Vite + React + TS + Vitest foundation"
```

---

### Task 2: Scoring types + default config + validation

**Files:**
- Create: `src/scoring/types.ts`
- Create: `src/scoring/config.ts`
- Test: `src/scoring/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (relied on by every later task):
  - `DeductionEventType = 'prompted_fixed' | 'prompted_failed' | 'self_corrected' | 'tajweed_major' | 'tajweed_minor'`
  - `QuestionEvent { type: DeductionEventType; ts?: string }`
  - `Question { index: number; isAdded?: boolean; isTieBreak?: boolean; disqualified?: boolean; voice?: number | null; events: QuestionEvent[] }`
  - `Session { enrollmentId: string; judgeId: string; questions: Question[] }`
  - `ScoringConfig { weights: { hifz: number; tajweed: number; voice: number }; hifz_base: number; tajweed_base: number; voice_max: number; hifz_deductions: { prompted_fixed: number; prompted_failed: number }; tajweed_deductions: { major: number; minor: number } }`
  - `EventCounts { prompted_fixed; prompted_failed; self_corrected; tajweed_major; tajweed_minor: number }`
  - `ComponentMeans { H: number; T: number; V: number }`
  - `EnrollmentSummary { score: number | null; hBar: number; tBar: number; totalPromptedFailed: number; startedCount: number }`
  - `DEFAULT_SCORING_CONFIG: ScoringConfig`
  - `weightsSum(cfg: ScoringConfig): number`
  - `validateScoringConfig(cfg: ScoringConfig): string[]` (empty array = valid)

- [ ] **Step 1: Create `src/scoring/types.ts`**

```ts
export type DeductionEventType =
  | 'prompted_fixed'
  | 'prompted_failed'
  | 'self_corrected'
  | 'tajweed_major'
  | 'tajweed_minor';

export interface QuestionEvent {
  type: DeductionEventType;
  ts?: string;
}

export interface Question {
  index: number;
  isAdded?: boolean;
  isTieBreak?: boolean;
  disqualified?: boolean;
  /** Per-question voice rating, 0..voice_max; null until rated. */
  voice?: number | null;
  events: QuestionEvent[];
}

export interface Session {
  enrollmentId: string;
  judgeId: string;
  questions: Question[];
}

export interface ScoringConfig {
  weights: { hifz: number; tajweed: number; voice: number };
  hifz_base: number;
  tajweed_base: number;
  voice_max: number;
  hifz_deductions: { prompted_fixed: number; prompted_failed: number };
  tajweed_deductions: { major: number; minor: number };
}

export interface EventCounts {
  prompted_fixed: number;
  prompted_failed: number;
  self_corrected: number;
  tajweed_major: number;
  tajweed_minor: number;
}

export interface ComponentMeans {
  H: number;
  T: number;
  V: number;
}

export interface EnrollmentSummary {
  /** Mean session score across started sessions; null when none started. */
  score: number | null;
  /** Cross-judge mean of the H component. */
  hBar: number;
  /** Cross-judge mean of the T component. */
  tBar: number;
  /** Total prompted_failed events across all started sessions (tie-break). */
  totalPromptedFailed: number;
  startedCount: number;
}
```

- [ ] **Step 2: Write the failing test `src/scoring/config.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCORING_CONFIG,
  weightsSum,
  validateScoringConfig,
} from './config';

describe('DEFAULT_SCORING_CONFIG', () => {
  it('matches the spec defaults', () => {
    expect(DEFAULT_SCORING_CONFIG.weights).toEqual({ hifz: 70, tajweed: 25, voice: 5 });
    expect(DEFAULT_SCORING_CONFIG.hifz_base).toBe(10);
    expect(DEFAULT_SCORING_CONFIG.tajweed_base).toBe(10);
    expect(DEFAULT_SCORING_CONFIG.voice_max).toBe(5);
    expect(DEFAULT_SCORING_CONFIG.hifz_deductions).toEqual({ prompted_fixed: 1, prompted_failed: 2 });
    expect(DEFAULT_SCORING_CONFIG.tajweed_deductions).toEqual({ major: 1, minor: 0.5 });
  });
});

describe('weightsSum', () => {
  it('sums the three weights', () => {
    expect(weightsSum(DEFAULT_SCORING_CONFIG)).toBe(100);
  });
});

describe('validateScoringConfig', () => {
  it('returns no errors for the default config', () => {
    expect(validateScoringConfig(DEFAULT_SCORING_CONFIG)).toEqual([]);
  });

  it('flags weights that do not sum to 100', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, weights: { hifz: 60, tajweed: 25, voice: 5 } };
    expect(validateScoringConfig(bad)).toContain('weights must sum to 100 (got 90)');
  });

  it('flags a non-positive hifz_base', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, hifz_base: 0 };
    expect(validateScoringConfig(bad)).toContain('hifz_base must be > 0');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/scoring/config.test.ts`
Expected: FAIL — cannot resolve `./config` (module not found).

- [ ] **Step 4: Create `src/scoring/config.ts`**

```ts
import type { ScoringConfig } from './types';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { hifz: 70, tajweed: 25, voice: 5 },
  hifz_base: 10,
  tajweed_base: 10,
  voice_max: 5,
  hifz_deductions: { prompted_fixed: 1, prompted_failed: 2 },
  tajweed_deductions: { major: 1, minor: 0.5 },
};

export function weightsSum(cfg: ScoringConfig): number {
  return cfg.weights.hifz + cfg.weights.tajweed + cfg.weights.voice;
}

export function validateScoringConfig(cfg: ScoringConfig): string[] {
  const errors: string[] = [];
  const sum = weightsSum(cfg);
  if (sum !== 100) errors.push(`weights must sum to 100 (got ${sum})`);
  if (cfg.hifz_base <= 0) errors.push('hifz_base must be > 0');
  if (cfg.tajweed_base <= 0) errors.push('tajweed_base must be > 0');
  if (cfg.voice_max <= 0) errors.push('voice_max must be > 0');
  return errors;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/scoring/config.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/scoring/types.ts src/scoring/config.ts src/scoring/config.test.ts
git commit -m "feat(scoring): scoring types, default config, and validation"
```

---

### Task 3: Per-question hifz & tajweed scoring

**Files:**
- Create: `src/scoring/question.ts`
- Test: `src/scoring/question.test.ts`

**Interfaces:**
- Consumes: `Question`, `ScoringConfig`, `EventCounts` from `./types`.
- Produces:
  - `countEvents(q: Question): EventCounts`
  - `hifzDeduction(q: Question, cfg: ScoringConfig): number`
  - `hifzQuestionScore(q: Question, cfg: ScoringConfig): number`
  - `hifzFraction(q: Question, cfg: ScoringConfig): number`
  - `tajweedDeduction(q: Question, cfg: ScoringConfig): number`
  - `tajweedQuestionScore(q: Question, cfg: ScoringConfig): number`
  - `tajweedFraction(q: Question, cfg: ScoringConfig): number`

- [ ] **Step 1: Write the failing test `src/scoring/question.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG } from './config';
import type { Question, QuestionEvent } from './types';
import {
  countEvents,
  hifzDeduction,
  hifzQuestionScore,
  hifzFraction,
  tajweedDeduction,
  tajweedQuestionScore,
  tajweedFraction,
} from './question';

function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });

describe('countEvents', () => {
  it('tallies each event type', () => {
    const counts = countEvents(q([ev('prompted_fixed'), ev('prompted_fixed'), ev('tajweed_minor')]));
    expect(counts.prompted_fixed).toBe(2);
    expect(counts.tajweed_minor).toBe(1);
    expect(counts.prompted_failed).toBe(0);
  });
});

describe('hifz scoring', () => {
  it('deducts 1 per prompted_fixed and 2 per prompted_failed', () => {
    const question = q([ev('prompted_fixed'), ev('prompted_failed')]); // 1 + 2 = 3
    expect(hifzDeduction(question, CFG)).toBe(3);
    expect(hifzQuestionScore(question, CFG)).toBe(7);
    expect(hifzFraction(question, CFG)).toBeCloseTo(0.7, 10);
  });

  it('ignores self_corrected (zero penalty)', () => {
    const question = q([ev('self_corrected'), ev('self_corrected')]);
    expect(hifzDeduction(question, CFG)).toBe(0);
    expect(hifzFraction(question, CFG)).toBe(1);
  });

  it('floors the question score at 0', () => {
    const question = q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'),
      ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed')]); // 12 > base 10
    expect(hifzQuestionScore(question, CFG)).toBe(0);
    expect(hifzFraction(question, CFG)).toBe(0);
  });

  it('returns 0 for a disqualified question', () => {
    const question = q([ev('prompted_fixed')], { disqualified: true });
    expect(hifzQuestionScore(question, CFG)).toBe(0);
    expect(hifzFraction(question, CFG)).toBe(0);
  });
});

describe('tajweed scoring', () => {
  it('deducts 1 per major and 0.5 per minor', () => {
    const question = q([ev('tajweed_major'), ev('tajweed_minor')]); // 1 + 0.5 = 1.5
    expect(tajweedDeduction(question, CFG)).toBe(1.5);
    expect(tajweedQuestionScore(question, CFG)).toBe(8.5);
    expect(tajweedFraction(question, CFG)).toBeCloseTo(0.85, 10);
  });

  it('returns 0 for a disqualified question (tajweed also zeroed)', () => {
    const question = q([ev('tajweed_minor')], { disqualified: true });
    expect(tajweedQuestionScore(question, CFG)).toBe(0);
    expect(tajweedFraction(question, CFG)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scoring/question.test.ts`
Expected: FAIL — cannot resolve `./question`.

- [ ] **Step 3: Create `src/scoring/question.ts`**

```ts
import type { Question, ScoringConfig, EventCounts } from './types';

export function countEvents(q: Question): EventCounts {
  const counts: EventCounts = {
    prompted_fixed: 0,
    prompted_failed: 0,
    self_corrected: 0,
    tajweed_major: 0,
    tajweed_minor: 0,
  };
  for (const e of q.events) counts[e.type] += 1;
  return counts;
}

export function hifzDeduction(q: Question, cfg: ScoringConfig): number {
  const c = countEvents(q);
  return (
    c.prompted_fixed * cfg.hifz_deductions.prompted_fixed +
    c.prompted_failed * cfg.hifz_deductions.prompted_failed
  );
}

export function hifzQuestionScore(q: Question, cfg: ScoringConfig): number {
  if (q.disqualified) return 0;
  return Math.max(0, cfg.hifz_base - hifzDeduction(q, cfg));
}

export function hifzFraction(q: Question, cfg: ScoringConfig): number {
  return hifzQuestionScore(q, cfg) / cfg.hifz_base;
}

export function tajweedDeduction(q: Question, cfg: ScoringConfig): number {
  const c = countEvents(q);
  return (
    c.tajweed_major * cfg.tajweed_deductions.major +
    c.tajweed_minor * cfg.tajweed_deductions.minor
  );
}

export function tajweedQuestionScore(q: Question, cfg: ScoringConfig): number {
  if (q.disqualified) return 0;
  return Math.max(0, cfg.tajweed_base - tajweedDeduction(q, cfg));
}

export function tajweedFraction(q: Question, cfg: ScoringConfig): number {
  return tajweedQuestionScore(q, cfg) / cfg.tajweed_base;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scoring/question.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/question.ts src/scoring/question.test.ts
git commit -m "feat(scoring): per-question hifz and tajweed scoring"
```

---

### Task 4: Per-question voice, auto-flag trigger, and single-question blended score

**Files:**
- Modify: `src/scoring/question.ts` (append three functions)
- Modify: `src/scoring/question.test.ts` (append tests)

**Interfaces:**
- Consumes: everything from Task 3.
- Produces:
  - `voiceFraction(q: Question, cfg: ScoringConfig): number | null` — `0` if DQ, `q.voice / voice_max` if rated, `null` if unrated (excluded from the voice mean).
  - `hifzAtFloor(q: Question, cfg: ScoringConfig): boolean` — true when hifz deductions have reached `hifz_base` on a non-DQ question (the auto-flag trigger).
  - `questionScore(q: Question, cfg: ScoringConfig): number` — blended `0..100` score of a single question (voice treated as 0 when unrated). Used for sudden-death tie-break ordering.

- [ ] **Step 1: Append failing tests to `src/scoring/question.test.ts`**

Add these imports to the existing import from `./question`: `voiceFraction`, `hifzAtFloor`, `questionScore`. Then append:

```ts
describe('voiceFraction', () => {
  it('is null when unrated and not disqualified (excluded from the mean)', () => {
    expect(voiceFraction(q([], { voice: null }), CFG)).toBeNull();
    expect(voiceFraction(q([]), CFG)).toBeNull();
  });

  it('is voice / voice_max when rated', () => {
    expect(voiceFraction(q([], { voice: 4 }), CFG)).toBeCloseTo(0.8, 10);
    expect(voiceFraction(q([], { voice: 0 }), CFG)).toBe(0);
  });

  it('is 0 for a disqualified question regardless of rating', () => {
    expect(voiceFraction(q([], { voice: 5, disqualified: true }), CFG)).toBe(0);
  });
});

describe('hifzAtFloor (auto-flag trigger)', () => {
  it('is true when deductions reach hifz_base', () => {
    const question = q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'),
      ev('prompted_failed'), ev('prompted_failed')]); // 10 == base
    expect(hifzAtFloor(question, CFG)).toBe(true);
  });

  it('is false before the floor is reached', () => {
    expect(hifzAtFloor(q([ev('prompted_failed')]), CFG)).toBe(false);
  });

  it('is false for an already-disqualified question', () => {
    const question = q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'),
      ev('prompted_failed'), ev('prompted_failed')], { disqualified: true });
    expect(hifzAtFloor(question, CFG)).toBe(false);
  });
});

describe('questionScore (single-question blended, for sudden-death)', () => {
  it('blends hifz/tajweed/voice with the configured weights', () => {
    // hifz 1.0, tajweed 1.0, voice 5/5=1.0 -> 70 + 25 + 5 = 100
    expect(questionScore(q([], { voice: 5 }), CFG)).toBeCloseTo(100, 10);
  });

  it('treats unrated voice as 0', () => {
    // hifz 1.0, tajweed 1.0, voice excluded -> 70 + 25 + 0 = 95
    expect(questionScore(q([], { voice: null }), CFG)).toBeCloseTo(95, 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scoring/question.test.ts`
Expected: FAIL — `voiceFraction`/`hifzAtFloor`/`questionScore` not exported.

- [ ] **Step 3: Append to `src/scoring/question.ts`**

```ts
/** null = excluded from the voice mean (unrated, non-DQ). 0 when disqualified. */
export function voiceFraction(q: Question, cfg: ScoringConfig): number | null {
  if (q.disqualified) return 0;
  if (q.voice == null) return null;
  return q.voice / cfg.voice_max;
}

/** Auto-flag trigger: hifz deductions have reached the base (score at floor). */
export function hifzAtFloor(q: Question, cfg: ScoringConfig): boolean {
  return !q.disqualified && hifzDeduction(q, cfg) >= cfg.hifz_base;
}

/** Blended 0..100 score for a single question (unrated voice counts as 0). */
export function questionScore(q: Question, cfg: ScoringConfig): number {
  const v = voiceFraction(q, cfg);
  return (
    cfg.weights.hifz * hifzFraction(q, cfg) +
    cfg.weights.tajweed * tajweedFraction(q, cfg) +
    cfg.weights.voice * (v == null ? 0 : v)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scoring/question.test.ts`
Expected: PASS — all question tests (Tasks 3 + 4) green.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/question.ts src/scoring/question.test.ts
git commit -m "feat(scoring): per-question voice, auto-flag trigger, blended question score"
```

---

### Task 5: Session component means + session score

**Files:**
- Create: `src/scoring/session.ts`
- Test: `src/scoring/session.test.ts`

**Interfaces:**
- Consumes: `Session`, `ScoringConfig`, `ComponentMeans` from `./types`; `hifzFraction`, `tajweedFraction`, `voiceFraction` from `./question`.
- Produces:
  - `componentMeans(session: Session, cfg: ScoringConfig): ComponentMeans` — `H`, `T` are means over **primary** (non-tie-break) questions; `V` is the mean of `voiceFraction` over questions that are rated OR disqualified (0 if none qualify). Returns `{ H: 0, T: 0, V: 0 }` when there are no primary questions.
  - `sessionScore(session: Session, cfg: ScoringConfig): number` — `weights.hifz·H + weights.tajweed·T + weights.voice·V`, range `0..100`.

- [ ] **Step 1: Write the failing test `src/scoring/session.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG } from './config';
import type { Question, Session, QuestionEvent } from './types';
import { componentMeans, sessionScore } from './session';

const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });
function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
function session(questions: Question[]): Session {
  return { enrollmentId: 'e1', judgeId: 'j1', questions };
}

describe('componentMeans', () => {
  it('averages hifz/tajweed fractions over all primary questions', () => {
    const s = session([
      q([ev('prompted_fixed')]),               // hifz 0.9
      q([]),                                    // hifz 1.0
    ]);
    const { H } = componentMeans(s, CFG);
    expect(H).toBeCloseTo(0.95, 10);
  });

  it('averages voice only over rated-or-DQ questions (unrated excluded)', () => {
    const s = session([
      q([], { voice: 4 }),     // 0.8
      q([], { voice: null }),  // excluded
      q([], { voice: 2 }),     // 0.4
    ]);
    expect(componentMeans(s, CFG).V).toBeCloseTo(0.6, 10); // (0.8 + 0.4) / 2
  });

  it('counts a disqualified question as 0 in all three component means', () => {
    const s = session([
      q([], { voice: 5 }),                                  // hifz 1, taj 1, voice 1
      q([ev('tajweed_minor')], { voice: 5, disqualified: true }), // all 0, counted
    ]);
    const m = componentMeans(s, CFG);
    expect(m.H).toBeCloseTo(0.5, 10);
    expect(m.T).toBeCloseTo(0.5, 10);
    expect(m.V).toBeCloseTo(0.5, 10);
  });

  it('excludes tie-break questions from the primary means', () => {
    const s = session([
      q([], { voice: 5 }),                          // counts
      q([ev('prompted_failed')], { isTieBreak: true, voice: 0 }), // ignored
    ]);
    const m = componentMeans(s, CFG);
    expect(m.H).toBe(1);
    expect(m.V).toBe(1);
  });

  it('returns zeros when there are no primary questions', () => {
    expect(componentMeans(session([]), CFG)).toEqual({ H: 0, T: 0, V: 0 });
  });
});

describe('sessionScore', () => {
  it('reads ~95 for a fresh session (no voice rated yet)', () => {
    const fresh = session([q([]), q([]), q([]), q([])]); // H=1, T=1, V=0
    expect(sessionScore(fresh, CFG)).toBeCloseTo(95, 10);
  });

  it('reads 100 for a perfect, fully voice-rated session', () => {
    const perfect = session([q([], { voice: 5 }), q([], { voice: 5 })]);
    expect(sessionScore(perfect, CFG)).toBeCloseTo(100, 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scoring/session.test.ts`
Expected: FAIL — cannot resolve `./session`.

- [ ] **Step 3: Create `src/scoring/session.ts`**

```ts
import type { Question, Session, ScoringConfig, ComponentMeans } from './types';
import { hifzFraction, tajweedFraction, voiceFraction } from './question';

/** Primary questions = everything except tie-break questions. */
function primaryQuestions(session: Session): Question[] {
  return session.questions.filter((q) => !q.isTieBreak);
}

export function componentMeans(session: Session, cfg: ScoringConfig): ComponentMeans {
  const qs = primaryQuestions(session);
  if (qs.length === 0) return { H: 0, T: 0, V: 0 };

  const H = qs.reduce((a, q) => a + hifzFraction(q, cfg), 0) / qs.length;
  const T = qs.reduce((a, q) => a + tajweedFraction(q, cfg), 0) / qs.length;

  const voiceFracs = qs
    .map((q) => voiceFraction(q, cfg))
    .filter((f): f is number => f != null);
  const V = voiceFracs.length
    ? voiceFracs.reduce((a, f) => a + f, 0) / voiceFracs.length
    : 0;

  return { H, T, V };
}

export function sessionScore(session: Session, cfg: ScoringConfig): number {
  const { H, T, V } = componentMeans(session, cfg);
  return cfg.weights.hifz * H + cfg.weights.tajweed * T + cfg.weights.voice * V;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scoring/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/session.ts src/scoring/session.test.ts
git commit -m "feat(scoring): session component means and session score"
```

---

### Task 6: Enrollment summary + leaderboard comparator

**Files:**
- Create: `src/scoring/enrollment.ts`
- Test: `src/scoring/enrollment.test.ts`

**Interfaces:**
- Consumes: `Session`, `ScoringConfig`, `EnrollmentSummary` from `./types`; `componentMeans`, `sessionScore` from `./session`; `countEvents` from `./question`.
- Produces:
  - `enrollmentSummary(sessions: Session[], cfg: ScoringConfig): EnrollmentSummary` — caller passes only **started** sessions. Mean session score, cross-judge `hBar`/`tBar`, total `prompted_failed`, and `startedCount`. With an empty array, returns `{ score: null, hBar: 0, tBar: 0, totalPromptedFailed: 0, startedCount: 0 }`.
  - `compareForLeaderboard(a: EnrollmentSummary, b: EnrollmentSummary): number` — §3.7 steps 1–4. Negative if `a` ranks ahead of `b`, positive if behind, `0` if still tied (caller applies sudden-death / manual). A `null` score sorts last.

- [ ] **Step 1: Write the failing test `src/scoring/enrollment.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG } from './config';
import type { Question, Session, QuestionEvent, EnrollmentSummary } from './types';
import { enrollmentSummary, compareForLeaderboard } from './enrollment';

const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });
function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
function session(questions: Question[], judgeId: string): Session {
  return { enrollmentId: 'e1', judgeId, questions };
}

describe('enrollmentSummary', () => {
  it('returns a null score and zero counts when no sessions are started', () => {
    expect(enrollmentSummary([], CFG)).toEqual({
      score: null, hBar: 0, tBar: 0, totalPromptedFailed: 0, startedCount: 0,
    });
  });

  it('averages session scores across started sessions', () => {
    // judge 1: perfect+voice -> 100 ; judge 2: fresh -> 95
    const s1 = session([q([], { voice: 5 })], 'j1');
    const s2 = session([q([])], 'j2');
    const summary = enrollmentSummary([s1, s2], CFG);
    expect(summary.startedCount).toBe(2);
    expect(summary.score).toBeCloseTo(97.5, 10);
  });

  it('totals prompted_failed across all started sessions', () => {
    const s1 = session([q([ev('prompted_failed'), ev('prompted_failed')])], 'j1');
    const s2 = session([q([ev('prompted_failed')])], 'j2');
    expect(enrollmentSummary([s1, s2], CFG).totalPromptedFailed).toBe(3);
  });
});

describe('compareForLeaderboard', () => {
  const base: EnrollmentSummary = { score: 80, hBar: 0.8, tBar: 0.8, totalPromptedFailed: 2, startedCount: 3 };

  it('orders by score descending', () => {
    const a = { ...base, score: 90 };
    const b = { ...base, score: 80 };
    expect(compareForLeaderboard(a, b)).toBeLessThan(0);
    expect(compareForLeaderboard(b, a)).toBeGreaterThan(0);
  });

  it('breaks score ties by hBar descending', () => {
    const a = { ...base, hBar: 0.9 };
    const b = { ...base, hBar: 0.7 };
    expect(compareForLeaderboard(a, b)).toBeLessThan(0);
  });

  it('then by tBar descending', () => {
    const a = { ...base, tBar: 0.9 };
    const b = { ...base, tBar: 0.7 };
    expect(compareForLeaderboard(a, b)).toBeLessThan(0);
  });

  it('then by fewer prompted_failed', () => {
    const a = { ...base, totalPromptedFailed: 1 };
    const b = { ...base, totalPromptedFailed: 5 };
    expect(compareForLeaderboard(a, b)).toBeLessThan(0);
  });

  it('returns 0 when still tied through step 4', () => {
    expect(compareForLeaderboard({ ...base }, { ...base })).toBe(0);
  });

  it('sorts a null score last', () => {
    const rated = { ...base, score: 10 };
    const unstarted = { ...base, score: null };
    expect(compareForLeaderboard(rated, unstarted)).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scoring/enrollment.test.ts`
Expected: FAIL — cannot resolve `./enrollment`.

- [ ] **Step 3: Create `src/scoring/enrollment.ts`**

```ts
import type { Session, ScoringConfig, EnrollmentSummary } from './types';
import { componentMeans, sessionScore } from './session';
import { countEvents } from './question';

/** `sessions` must be the started (existing) session docs for one enrollment. */
export function enrollmentSummary(sessions: Session[], cfg: ScoringConfig): EnrollmentSummary {
  if (sessions.length === 0) {
    return { score: null, hBar: 0, tBar: 0, totalPromptedFailed: 0, startedCount: 0 };
  }

  const scores = sessions.map((s) => sessionScore(s, cfg));
  const means = sessions.map((s) => componentMeans(s, cfg));

  const score = scores.reduce((a, x) => a + x, 0) / scores.length;
  const hBar = means.reduce((a, m) => a + m.H, 0) / means.length;
  const tBar = means.reduce((a, m) => a + m.T, 0) / means.length;
  const totalPromptedFailed = sessions.reduce(
    (a, s) => a + s.questions.reduce((qa, q) => qa + countEvents(q).prompted_failed, 0),
    0,
  );

  return { score, hBar, tBar, totalPromptedFailed, startedCount: sessions.length };
}

/**
 * Leaderboard ordering, spec §3.7 steps 1–4.
 * Negative => a ranks ahead of b; positive => behind; 0 => still tied.
 */
export function compareForLeaderboard(a: EnrollmentSummary, b: EnrollmentSummary): number {
  const sa = a.score ?? -Infinity;
  const sb = b.score ?? -Infinity;
  if (sa !== sb) return sb - sa; // higher score first
  if (a.hBar !== b.hBar) return b.hBar - a.hBar; // higher H̄ first
  if (a.tBar !== b.tBar) return b.tBar - a.tBar; // higher T̄ first
  if (a.totalPromptedFailed !== b.totalPromptedFailed) {
    return a.totalPromptedFailed - b.totalPromptedFailed; // fewer is better
  }
  return 0; // still tied -> sudden-death / manual resolution
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/scoring/enrollment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/enrollment.ts src/scoring/enrollment.test.ts
git commit -m "feat(scoring): enrollment summary and leaderboard comparator"
```

---

### Task 7: Public API barrel + spec worked-example integration test

**Files:**
- Create: `src/scoring/index.ts`
- Create: `src/scoring/worked-example.test.ts`

**Interfaces:**
- Consumes: all prior scoring modules.
- Produces: `src/scoring/index.ts` re-exporting the public API (types + all functions). This is the import surface later plans use: `import { sessionScore, DEFAULT_SCORING_CONFIG } from './scoring'`.

- [ ] **Step 1: Create `src/scoring/index.ts`**

```ts
export type {
  DeductionEventType,
  QuestionEvent,
  Question,
  Session,
  ScoringConfig,
  EventCounts,
  ComponentMeans,
  EnrollmentSummary,
} from './types';

export { DEFAULT_SCORING_CONFIG, weightsSum, validateScoringConfig } from './config';
export {
  countEvents,
  hifzDeduction,
  hifzQuestionScore,
  hifzFraction,
  tajweedDeduction,
  tajweedQuestionScore,
  tajweedFraction,
  voiceFraction,
  hifzAtFloor,
  questionScore,
} from './question';
export { componentMeans, sessionScore } from './session';
export { enrollmentSummary, compareForLeaderboard } from './enrollment';
```

- [ ] **Step 2: Write the integration test `src/scoring/worked-example.test.ts`**

This reproduces the spec §3.6 worked example (5-juz, base 10, 4 questions) from raw events, importing only through the public barrel.

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG, sessionScore, componentMeans } from './index';
import type { Question, Session, QuestionEvent } from './index';

const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });
function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
function session(questions: Question[]): Session {
  return { enrollmentId: 'e1', judgeId: 'j1', questions };
}

describe('spec §3.6 worked example', () => {
  it('Strong contestant scores 90.75 (H .90, T .95, V .80)', () => {
    // hifz fractions .9, 1.0, .8, .9 ; each tajweed_minor -> taj .95 ; voice 4 -> .8
    const strong = session([
      q([ev('prompted_fixed'), ev('tajweed_minor')], { voice: 4 }), // hifz 9 (.9)
      q([ev('tajweed_minor')], { voice: 4 }),                       // hifz 10 (1.0)
      q([ev('prompted_failed'), ev('tajweed_minor')], { voice: 4 }),// hifz 8 (.8)
      q([ev('prompted_fixed'), ev('tajweed_minor')], { voice: 4 }), // hifz 9 (.9)
    ]);
    const m = componentMeans(strong, CFG);
    expect(m.H).toBeCloseTo(0.9, 10);
    expect(m.T).toBeCloseTo(0.95, 10);
    expect(m.V).toBeCloseTo(0.8, 10);
    expect(sessionScore(strong, CFG)).toBeCloseTo(90.75, 10); // displayed as 90.8
  });

  it('Weak contestant with 1 DQ scores 35.5 (H .30, T .50, V .40)', () => {
    const weak = session([
      // hifz .4 (ded 6), tajweed .6 (ded 4), voice 3 (.6)
      q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'),
         ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major')],
        { voice: 3 }),
      // disqualified -> all components 0, voice counts as 0
      q([], { disqualified: true, voice: null }),
      // hifz .5 (ded 5), tajweed .8 (ded 2), voice 3 (.6)
      q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_fixed'),
         ev('tajweed_major'), ev('tajweed_major')],
        { voice: 3 }),
      // hifz .3 (ded 7), tajweed .6 (ded 4), voice 2 (.4)
      q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'), ev('prompted_fixed'),
         ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major')],
        { voice: 2 }),
    ]);
    const m = componentMeans(weak, CFG);
    expect(m.H).toBeCloseTo(0.3, 10);  // (.4 + 0 + .5 + .3) / 4
    expect(m.T).toBeCloseTo(0.5, 10);  // (.6 + 0 + .8 + .6) / 4
    expect(m.V).toBeCloseTo(0.4, 10);  // (.6 + 0 + .6 + .4) / 4
    expect(sessionScore(weak, CFG)).toBeCloseTo(35.5, 10);
  });
});
```

- [ ] **Step 3: Run the integration test to verify it passes**

Run: `npx vitest run src/scoring/worked-example.test.ts`
Expected: PASS — both rows match the spec.

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npm test`
Expected: PASS — all scoring + smoke tests green.

Run: `npx tsc`
Expected: no type errors (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/index.ts src/scoring/worked-example.test.ts
git commit -m "feat(scoring): public API barrel and spec worked-example integration test"
```

---

## Self-Review Notes

- **Spec coverage (scoring sections):** §3.1 weights (`sessionScore`), §3.2 per-question hifz/tajweed (Task 3), §3.3 aggregation incl. per-question voice + fresh-session-95 (Task 5), §3.4 enrollment mean over started sessions + H̄/T̄/prompted_failed (Task 6), §3.5 single-knob DQ zeroing all three components + `hifzAtFloor` auto-flag (Tasks 3–4), §3.7 steps 1–4 comparator (Task 6), §3.6 worked example (Task 7). Config schema §4 `config/scoring` → `ScoringConfig` + validation (Task 2).
- **Out of scope (later plans):** Firestore persistence, security rules, Zeffy intake, auth/provisioning, all UI, and the sudden-death *workflow* (`questionScore` provides the math; the resolution flow + `tiebreaks` storage land with the admin app).
- **Type consistency:** function/type names are identical across the Interfaces blocks and the code (`sessionScore`, `componentMeans`, `enrollmentSummary`, `compareForLeaderboard`, `voiceFraction`, `hifzAtFloor`, `questionScore`).
- **No placeholders:** every step has complete code or an exact command + expected output.
