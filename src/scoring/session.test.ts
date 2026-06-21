import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG } from './config';
import type { Question, Session, QuestionEvent } from './types';
import { componentMeans, sessionScore } from './session';
import { questionScore } from './question';

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

  // The B1 fix: the header/leaderboard score equals the mean of the per-question
  // rail scores (both treat unrated voice as 0), so the two displays never disagree.
  it('equals the mean of per-question rail scores (incl. an unrated-voice question)', () => {
    const qs = [q([ev('prompted_fixed')], { voice: 4 }), q([], { voice: null }), q([ev('tajweed_minor')], { voice: 2 })];
    const railMean = qs.reduce((a, x) => a + questionScore(x, CFG), 0) / qs.length;
    expect(sessionScore(session(qs), CFG)).toBeCloseTo(railMean, 10);
  });
});
