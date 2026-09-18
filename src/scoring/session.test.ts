import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG } from './config';
import type { Question, Session, QuestionEvent, ScoringConfig } from './types';
import { componentMeans, sessionScore } from './session';
import { questionScore } from './question';

const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });
function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
function session(questions: Question[]): Session {
  return { enrollmentId: 'e1', judgeId: 'j1', questions };
}

const RAW: ScoringConfig = { ...CFG, model: 'raw-v3' };

describe('componentMeans (percent family)', () => {
  it('averages hifz/tajweed fractions over all primary questions', () => {
    const s = session([
      q([ev('prompted_fixed')]),               // hifz 0.9 (one Prompted = 10%)
      q([]),                                    // hifz 1.0
    ]);
    const { H } = componentMeans(s, CFG);
    expect(H).toBeCloseTo(0.95, 10);
  });

  it('counts unrated voice as 0, averaged over all primary questions', () => {
    const s = session([
      q([], { voice: 4 }),     // 0.8
      q([], { voice: null }),  // unrated → 0
      q([], { voice: 2 }),     // 0.4
    ]);
    expect(componentMeans(s, CFG).V).toBeCloseTo(0.4, 10); // (0.8 + 0 + 0.4) / 3
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

  it('hand case: values unchanged from the shipped engine', () => {
    // q1: 1 Prompted (hifz .9), 1 Tajweed minor (taj .95), voice 4 (.8)
    // q2: clean, voice 2 (.4)
    const s = session([
      q([ev('prompted_fixed'), ev('tajweed_minor')], { voice: 4 }),
      q([], { voice: 2 }),
    ]);
    const m = componentMeans(s, CFG);
    expect(m.H).toBeCloseTo(0.95, 10);
    expect(m.T).toBeCloseTo(0.975, 10);
    expect(m.V).toBeCloseTo(0.6, 10);
  });
});

describe('componentMeans (raw-v3)', () => {
  it('returns zeros — components are undefined under raw (UIs gate on the model)', () => {
    const s = session([q([ev('prompted_fixed')], { voice: 4 }), q([], { voice: 5 })]);
    expect(componentMeans(s, RAW)).toEqual({ H: 0, T: 0, V: 0 });
  });
});

describe('sessionScore = mean(questionScore) for ALL models', () => {
  it('returns 0 for an empty session', () => {
    expect(sessionScore(session([]), CFG)).toBe(0);
    expect(sessionScore(session([]), RAW)).toBe(0);
  });

  it('equals the single question score for a one-question session', () => {
    const only = q([ev('prompted_fixed'), ev('tajweed_minor')], { voice: 3 });
    expect(sessionScore(session([only]), CFG)).toBeCloseTo(questionScore(only, CFG), 10);
    expect(sessionScore(session([only]), RAW)).toBeCloseTo(questionScore(only, RAW), 10);
  });

  it('reads ~95 for a fresh session (no voice rated yet)', () => {
    const fresh = session([q([]), q([]), q([]), q([])]); // each question 95
    expect(sessionScore(fresh, CFG)).toBeCloseTo(95, 10);
  });

  it('reads 100 for a perfect, fully voice-rated session', () => {
    const perfect = session([q([], { voice: 5 }), q([], { voice: 5 })]);
    expect(sessionScore(perfect, CFG)).toBeCloseTo(100, 10);
  });

  // The B1 invariant, now definitional: the header/leaderboard score IS the mean
  // of the per-question scores (both treat unrated voice as 0), so the two
  // displays never disagree.
  it('equals the mean of per-question scores (incl. an unrated-voice question)', () => {
    const qs = [q([ev('prompted_fixed')], { voice: 4 }), q([], { voice: null }), q([ev('tajweed_minor')], { voice: 2 })];
    const mean = qs.reduce((a, x) => a + questionScore(x, CFG), 0) / qs.length;
    expect(sessionScore(session(qs), CFG)).toBeCloseTo(mean, 10);
  });

  it('excludes tie-break questions from the session mean', () => {
    const s = session([
      q([], { voice: 5 }),                                        // 100
      q([ev('prompted_failed')], { isTieBreak: true, voice: 0 }), // ignored
    ]);
    expect(sessionScore(s, CFG)).toBeCloseTo(100, 10);
  });
});
