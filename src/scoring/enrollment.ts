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
