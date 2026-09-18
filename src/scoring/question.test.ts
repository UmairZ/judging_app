import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG, resolveScoringConfig } from './config';
import type { Question, QuestionEvent, ScoringConfig } from './types';
import {
  countEvents,
  questionScore,
  hifzMistakeCount,
  mistakeLimitReached,
} from './question';
import { sessionScore } from './session';

function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });
const evs = (type: QuestionEvent['type'], n: number): QuestionEvent[] =>
  Array.from({ length: n }, () => ev(type));

const RAW: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, model: 'raw-v3' };
const ESC: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' };

describe('countEvents', () => {
  it('tallies each event type', () => {
    const counts = countEvents(q([ev('prompted_fixed'), ev('prompted_fixed'), ev('tajweed_minor')]));
    expect(counts.prompted_fixed).toBe(2);
    expect(counts.tajweed_minor).toBe(1);
    expect(counts.prompted_failed).toBe(0);
  });
});

// Identity: weighted-v3 defaults ≡ old deduction-v1; escalating-v3 step 10 ≡ old escalating-v2.
// Old-model math reimplemented HERE as test oracles (10-point rail semantics):
// old defaults: weights 70/25/5, hifz_base 10, tajweed_base 10, voice_max 5,
// hifz_deductions { prompted_fixed: 1, prompted_failed: 2 }, tajweed_deductions { major: 1, minor: 0.5 }.
function oldV1Question(question: Question): number {
  if (question.disqualified) return 0;
  const c = countEvents(question);
  const hifz = Math.max(0, 10 - (c.prompted_fixed * 1 + c.prompted_failed * 2)) / 10;
  const taj = Math.max(0, 10 - (c.tajweed_major * 1 + c.tajweed_minor * 0.5)) / 10;
  const voice = question.voice == null ? 0 : question.voice / 5;
  return 70 * hifz + 25 * taj + 5 * voice;
}
function oldV2Question(question: Question): number {
  // v1 + K(K-1)/2 extra on the hifz deduction (K = prompted_fixed + prompted_failed)
  if (question.disqualified) return 0;
  const c = countEvents(question);
  const K = c.prompted_fixed + c.prompted_failed;
  const ded = c.prompted_fixed * 1 + c.prompted_failed * 2 + (K * (K - 1)) / 2;
  const hifz = Math.max(0, 10 - ded) / 10;
  const taj = Math.max(0, 10 - (c.tajweed_major * 1 + c.tajweed_minor * 0.5)) / 10;
  const voice = question.voice == null ? 0 : question.voice / 5;
  return 70 * hifz + 25 * taj + 5 * voice;
}

/** Deterministic PRNG (mulberry32) — same seed, same question, forever. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('identity with the shipped engines', () => {
  // deterministic PRNG: 0-4 of each of the 5 event types, voice 0-5 or null, index 0
  const gen = (seed: number): Question => {
    const rnd = mulberry32(seed + 1);
    const int = (n: number) => Math.floor(rnd() * n);
    const events: QuestionEvent[] = [];
    const push = (type: QuestionEvent['type'], n: number) => {
      for (let i = 0; i < n; i++) events.push(ev(type));
    };
    push('self_corrected', int(5));
    push('prompted_fixed', int(5));
    push('prompted_failed', int(5));
    push('tajweed_major', int(5));
    push('tajweed_minor', int(5));
    const voice = int(7) === 6 ? null : int(6); // 0-5, or null (unrated)
    return { index: 0, events, voice };
  };

  it('weighted-v3 matches old deduction-v1 across 200 generated questions', () => {
    for (let s = 0; s < 200; s++) {
      const question = gen(s);
      expect(questionScore(question, DEFAULT_SCORING_CONFIG)).toBeCloseTo(oldV1Question(question), 10);
    }
  });

  it('escalating-v3 (step 10) matches old escalating-v2 across 200 generated questions', () => {
    const esc = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' };
    for (let s = 0; s < 200; s++) {
      const question = gen(s);
      expect(questionScore(question, esc)).toBeCloseTo(oldV2Question(question), 10);
    }
  });

  it('escalating-v3 with step 0 scores identically to weighted-v3 (escalation off)', () => {
    const noStep: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      model: 'escalating-v3',
      percent: { ...DEFAULT_SCORING_CONFIG.percent, escalation_step: 0 },
    };
    for (let s = 0; s < 200; s++) {
      const question = gen(s);
      expect(questionScore(question, noStep)).toBeCloseTo(questionScore(question, DEFAULT_SCORING_CONFIG), 10);
    }
  });
});

describe('raw-v3', () => {
  it('voice owns its fixed slice: score fills voice_worth·(r/voice_max) on a clean question', () => {
    // recitation pool 100 − 5 = 95, untouched; voice 3/5 of the 5-point slice = 3
    expect(questionScore(q([], { voice: 3 }), RAW)).toBeCloseTo(98, 10);
    expect(questionScore(q([], { voice: 5 }), RAW)).toBeCloseTo(100, 10);
    expect(questionScore(q([], { voice: 0 }), RAW)).toBeCloseTo(95, 10);
  });

  it('null voice contributes 0 — the recitation pool stands alone', () => {
    expect(questionScore(q([], { voice: null }), RAW)).toBeCloseTo(95, 10);
    expect(questionScore(q([]), RAW)).toBeCloseTo(95, 10);
  });

  it('deducts every mistake type from ONE pool at its raw cost', () => {
    // prompted 10 + unable 20 + major 10 + minor 5 = 45 off 95 → 50, +voice 5 → 55
    const question = q(
      [ev('prompted_fixed'), ev('prompted_failed'), ev('tajweed_major'), ev('tajweed_minor')],
      { voice: 5 },
    );
    expect(questionScore(question, RAW)).toBeCloseTo(55, 10);
  });

  it('floors the recitation pool at 0 under heavy mistakes — voice slice still fills', () => {
    // 3 unable (60) + 4 major (40) = 100 > 95 → recitation 0; voice 4/5 · 5 = 4
    const heavy = q([...evs('prompted_failed', 3), ...evs('tajweed_major', 4)], { voice: 4 });
    expect(questionScore(heavy, RAW)).toBeCloseTo(4, 10);
  });

  it('applies a configured hesitation cost — still excluded from hifzMistakeCount', () => {
    const priced: ScoringConfig = {
      ...RAW,
      raw: { ...RAW.raw, costs: { ...RAW.raw.costs, hesitation: 2 } },
    };
    const question = q(evs('self_corrected', 3), { voice: null });
    expect(questionScore(question, priced)).toBeCloseTo(95 - 6, 10);
    expect(hifzMistakeCount(question)).toBe(0); // hesitation never counts toward the limit
    expect(mistakeLimitReached(question, 1)).toBe(false);
  });

  it('default hesitation cost is 0 (tracked, free)', () => {
    expect(questionScore(q(evs('self_corrected', 4), { voice: null }), RAW)).toBeCloseTo(95, 10);
  });

  it('a zeroed (disqualified) question scores 0 regardless of voice', () => {
    expect(questionScore(q([], { voice: 5, disqualified: true }), RAW)).toBe(0);
  });

  it('sessionScore is the mean of question scores — hand-computed 3-question case', () => {
    // q1: 1 prompted (−10) → 85, voice 5 → +5 = 90
    // q2: clean, voice 0 → 95
    // q3: disqualified → 0
    const session = {
      enrollmentId: 'e1',
      judgeId: 'j1',
      questions: [
        q([ev('prompted_fixed')], { voice: 5 }),
        q([], { voice: 0 }),
        q([], { voice: 5, disqualified: true }),
      ],
    };
    expect(sessionScore(session, RAW)).toBeCloseTo((90 + 95 + 0) / 3, 10);
  });
});

describe('escalation_step scaling', () => {
  const withStep = (step: number): ScoringConfig => ({
    ...DEFAULT_SCORING_CONFIG,
    model: 'escalating-v3',
    percent: { ...DEFAULT_SCORING_CONFIG.percent, escalation_step: step },
  });

  it('step 20 doubles the quadratic term vs step 10 on a K=3 question — exact numbers', () => {
    const three = q(evs('prompted_fixed', 3), { voice: null }); // linear 3·10 = 30, K(K−1)/2 = 3
    // step 10: ded 30 + 30 = 60 → hifzFrac .4 → 70·.4 + 25·1 + 0 = 53
    expect(questionScore(three, withStep(10))).toBeCloseTo(53, 10);
    // step 20: ded 30 + 60 = 90 → hifzFrac .1 → 70·.1 + 25·1 + 0 = 32
    expect(questionScore(three, withStep(20))).toBeCloseTo(32, 10);
    // step 0: ded 30 → hifzFrac .7 → 70·.7 + 25·1 + 0 = 74 (≡ weighted)
    expect(questionScore(three, withStep(0))).toBeCloseTo(74, 10);
    expect(questionScore(three, DEFAULT_SCORING_CONFIG)).toBeCloseTo(74, 10);
  });

  it('escalation is order-independent (counts, not sequence)', () => {
    const a = q([ev('prompted_failed'), ev('prompted_fixed'), ev('prompted_fixed')], { voice: 2 });
    const b = q([ev('prompted_fixed'), ev('prompted_fixed'), ev('prompted_failed')], { voice: 2 });
    expect(questionScore(a, ESC)).toBeCloseTo(questionScore(b, ESC), 10);
  });

  it('tajweed never escalates', () => {
    // 3 tajweed_major: same score under escalating as under weighted — no quadratic term
    const taj = q(evs('tajweed_major', 3), { voice: null });
    expect(questionScore(taj, ESC)).toBeCloseTo(questionScore(taj, DEFAULT_SCORING_CONFIG), 10);
    // hand number: hifz 70·1 + tajweed 25·max(0,100−30)/100 = 70 + 17.5 = 87.5
    expect(questionScore(taj, ESC)).toBeCloseTo(87.5, 10);
  });

  it('hesitation is hardwired free under the percent family — never escalates, never costs', () => {
    const noise = q([...evs('self_corrected', 4), ev('prompted_fixed')], { voice: null });
    const one = q([ev('prompted_fixed')], { voice: null });
    expect(questionScore(noise, ESC)).toBeCloseTo(questionScore(one, ESC), 10);
  });
});

describe('questionScore common rules', () => {
  it('a disqualified question scores 0 in every system', () => {
    const question = q([ev('prompted_fixed')], { voice: 5, disqualified: true });
    expect(questionScore(question, DEFAULT_SCORING_CONFIG)).toBe(0);
    expect(questionScore(question, ESC)).toBe(0);
    expect(questionScore(question, RAW)).toBe(0);
  });

  it('null voice contributes 0 in the percent family', () => {
    // hifz 70·1 + tajweed 25·1 + voice 0 = 95
    expect(questionScore(q([], { voice: null }), DEFAULT_SCORING_CONFIG)).toBeCloseTo(95, 10);
  });

  it('a resolved unknown-model config scores with the defaults', () => {
    const weird = resolveScoringConfig({ ...DEFAULT_SCORING_CONFIG, model: 'weird-v9' });
    const question = q([ev('prompted_fixed'), ev('prompted_failed')], { voice: 3 });
    expect(questionScore(question, weird)).toBeCloseTo(questionScore(question, DEFAULT_SCORING_CONFIG), 10);
  });
});

describe('hifzMistakeCount / mistakeLimitReached', () => {
  it('counts prompted + prompted-failed only', () => {
    expect(hifzMistakeCount(q([ev('prompted_fixed'), ev('prompted_failed'), ev('self_corrected'), ev('tajweed_major')]))).toBe(2);
  });
  it('reaches the limit at exactly the limit, not before', () => {
    const two = q([ev('prompted_fixed'), ev('prompted_failed')]);
    expect(mistakeLimitReached(two, 3)).toBe(false);
    expect(mistakeLimitReached(two, 2)).toBe(true);
  });
  it('never fires on an already-disqualified question', () => {
    const dq = { ...q([ev('prompted_failed'), ev('prompted_failed')]), disqualified: true };
    expect(mistakeLimitReached(dq, 1)).toBe(false);
  });
});
