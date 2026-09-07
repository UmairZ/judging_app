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
  voiceFraction,
  hifzAtFloor,
  questionScore,
  hifzMistakeCount,
  mistakeLimitReached,
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

describe('escalating-v2 hifz deduction', () => {
  const V2 = { ...CFG, model: 'escalating-v2' };
  it('single mistake costs its base alone', () => {
    expect(hifzDeduction(q([ev('prompted_fixed')]), V2)).toBe(1);
  });
  it('adds K(K-1)/2 on top of the linear sum', () => {
    // bases 1+1=2, K=2 → +1 = 3
    expect(hifzDeduction(q([ev('prompted_fixed'), ev('prompted_fixed')]), V2)).toBe(3);
    // bases 1+2=3, K=2 → +1 = 4
    expect(hifzDeduction(q([ev('prompted_fixed'), ev('prompted_failed')]), V2)).toBe(4);
    // bases 1+1+2=4, K=3 → +3 = 7
    expect(hifzDeduction(q([ev('prompted_fixed'), ev('prompted_fixed'), ev('prompted_failed')]), V2)).toBe(7);
  });
  it('is order-independent', () => {
    const a = hifzDeduction(q([ev('prompted_failed'), ev('prompted_fixed'), ev('prompted_fixed')]), V2);
    const b = hifzDeduction(q([ev('prompted_fixed'), ev('prompted_fixed'), ev('prompted_failed')]), V2);
    expect(a).toBe(b);
  });
  it('self-corrected costs nothing and never escalates', () => {
    expect(hifzDeduction(q([ev('self_corrected'), ev('self_corrected'), ev('self_corrected')]), V2)).toBe(0);
    // one real mistake + self-corrected noise: still just the base (K=1)
    expect(hifzDeduction(q([ev('self_corrected'), ev('prompted_fixed'), ev('self_corrected')]), V2)).toBe(1);
  });
  it('unknown model id falls back to v1 linear math', () => {
    const weird = { ...CFG, model: 'weird-v9' };
    const question = q([ev('prompted_fixed'), ev('prompted_failed')]);
    expect(hifzDeduction(question, weird)).toBe(hifzDeduction(question, CFG));
  });
  it('question score still floors at 0 under escalation', () => {
    const many = q(Array.from({ length: 8 }, () => ev('prompted_failed')));
    expect(hifzQuestionScore(many, V2)).toBe(0);
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
