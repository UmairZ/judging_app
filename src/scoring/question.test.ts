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
