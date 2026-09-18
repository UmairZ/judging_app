import type { Question, Session, ScoringConfig, ComponentMeans } from './types';
import { hifzFraction, tajweedFraction, voiceFraction, questionScore } from './question';

/** Primary questions = everything except tie-break questions. */
function primaryQuestions(session: Session): Question[] {
  return session.questions.filter((q) => !q.isTieBreak);
}

/**
 * Mean blended (0..100) score of the tie-break questions across a contestant's
 * sessions — how the panel ranks a sudden-death. null when none graded yet.
 */
export function tieBreakMean(sessions: Session[], cfg: ScoringConfig): number | null {
  const tbQs = sessions.flatMap((s) => s.questions.filter((q) => q.isTieBreak));
  if (tbQs.length === 0) return null;
  return tbQs.reduce((a, q) => a + questionScore(q, cfg), 0) / tbQs.length;
}

/**
 * Per-component means (fractions 0..1) for the percent family. Under raw-v3
 * every mistake prices from ONE pool, so components are undefined — this
 * returns { H: 0, T: 0, V: 0 } and UIs gate the component columns on the
 * model (Task 4).
 */
export function componentMeans(session: Session, cfg: ScoringConfig): ComponentMeans {
  if (cfg.model === 'raw-v3') return { H: 0, T: 0, V: 0 };

  const qs = primaryQuestions(session);
  if (qs.length === 0) return { H: 0, T: 0, V: 0 };

  const H = qs.reduce((a, q) => a + hifzFraction(q, cfg), 0) / qs.length;
  const T = qs.reduce((a, q) => a + tajweedFraction(q, cfg), 0) / qs.length;

  // Unrated voice counts as 0 (same rule as questionScore), so the session score
  // equals the mean of the per-question scores. Voice is required to finish
  // (the canFinish gate in useGradingSession), so a finalized session never
  // carries an unrated question.
  const V = qs.reduce((a, q) => a + (voiceFraction(q, cfg) ?? 0), 0) / qs.length;

  return { H, T, V };
}

/** Session score = mean of the per-question scores, for ALL models (empty → 0). */
export function sessionScore(session: Session, cfg: ScoringConfig): number {
  const qs = primaryQuestions(session);
  if (qs.length === 0) return 0;
  return qs.reduce((a, q) => a + questionScore(q, cfg), 0) / qs.length;
}
