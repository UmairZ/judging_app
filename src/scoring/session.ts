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
