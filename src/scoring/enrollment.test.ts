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
