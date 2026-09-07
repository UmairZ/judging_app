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

/** Hifz mistakes that cost points and count toward the DQ limit — self-corrected is free. */
export function hifzMistakeCount(q: Question): number {
  const c = countEvents(q);
  return c.prompted_fixed + c.prompted_failed;
}

export function hifzDeduction(q: Question, cfg: ScoringConfig): number {
  const c = countEvents(q);
  const linear =
    c.prompted_fixed * cfg.hifz_deductions.prompted_fixed +
    c.prompted_failed * cfg.hifz_deductions.prompted_failed;
  if (cfg.model === 'escalating-v2') {
    // k-th hifz mistake in a question costs its base + (k−1) — order-independent
    // closed form: Σbases + K(K−1)/2 (program spec §D+, simulated 2026-09-04).
    const K = hifzMistakeCount(q);
    return linear + (K * (K - 1)) / 2;
  }
  // 'deduction-v1' and any unknown model id fall back to linear.
  return linear;
}

/** Auto-flag trigger: the category's mistake limit reached on this question. */
export function mistakeLimitReached(q: Question, limit: number): boolean {
  return !q.disqualified && hifzMistakeCount(q) >= limit;
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

/** null = unrated, non-DQ (callers count it as 0). 0 when disqualified. */
export function voiceFraction(q: Question, cfg: ScoringConfig): number | null {
  if (q.disqualified) return 0;
  if (q.voice == null) return null;
  return q.voice / cfg.voice_max;
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
