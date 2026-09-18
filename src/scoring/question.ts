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

/** Auto-flag trigger: the category's mistake limit reached on this question. */
export function mistakeLimitReached(q: Question, limit: number): boolean {
  return !q.disqualified && hifzMistakeCount(q) >= limit;
}

/*
 * Event → v3 cost-key mapping (part of the engine, not the UI):
 *   self_corrected → hesitation, prompted_fixed → prompted,
 *   prompted_failed → unable, tajweed_major/minor → themselves.
 */

/**
 * Percent-family hifz fraction 0..1: costs are percentages of the question's
 * memorization. escalating-v3 adds `escalation_step · K(K−1)/2` (the k-th
 * counted hifz mistake costs its base percent + (k−1)·step — order-independent
 * closed form, program spec §D+ simulated 2026-09-04). Hesitation is hardwired
 * free here; tajweed never escalates.
 */
export function hifzFraction(q: Question, cfg: ScoringConfig): number {
  if (q.disqualified) return 0;
  const c = countEvents(q);
  let deduction =
    c.prompted_fixed * cfg.percent.costs.prompted +
    c.prompted_failed * cfg.percent.costs.unable;
  if (cfg.model === 'escalating-v3') {
    const K = hifzMistakeCount(q);
    deduction += cfg.percent.escalation_step * ((K * (K - 1)) / 2);
  }
  return Math.max(0, 100 - deduction) / 100;
}

/** Percent-family tajweed fraction 0..1 — always linear. */
export function tajweedFraction(q: Question, cfg: ScoringConfig): number {
  if (q.disqualified) return 0;
  const c = countEvents(q);
  const deduction =
    c.tajweed_major * cfg.percent.costs.tajweed_major +
    c.tajweed_minor * cfg.percent.costs.tajweed_minor;
  return Math.max(0, 100 - deduction) / 100;
}

/** null = unrated, non-DQ (callers count it as 0). 0 when disqualified. */
export function voiceFraction(q: Question, cfg: ScoringConfig): number | null {
  if (q.disqualified) return 0;
  if (q.voice == null) return null;
  return q.voice / cfg.voice_max;
}

/** raw-v3: one recitation pool of (100 − voice_worth), every mistake priced from it. */
function rawQuestionScore(q: Question, cfg: ScoringConfig): number {
  const c = countEvents(q);
  const pool = 100 - cfg.raw.voice_worth;
  const deduction =
    c.self_corrected * cfg.raw.costs.hesitation +
    c.prompted_fixed * cfg.raw.costs.prompted +
    c.prompted_failed * cfg.raw.costs.unable +
    c.tajweed_major * cfg.raw.costs.tajweed_major +
    c.tajweed_minor * cfg.raw.costs.tajweed_minor;
  const voice = q.voice == null ? 0 : q.voice / cfg.voice_max;
  return Math.max(0, pool - deduction) + cfg.raw.voice_worth * voice;
}

/**
 * 0..100 score for a single question, dispatched on cfg.model. A zeroed
 * (disqualified) question scores 0 in every system; unrated voice counts as 0.
 * Callers resolve unknown/legacy configs via resolveScoringConfig first; any
 * model id that is not 'raw-v3'/'escalating-v3' scores as weighted here.
 */
export function questionScore(q: Question, cfg: ScoringConfig): number {
  if (q.disqualified) return 0;
  if (cfg.model === 'raw-v3') return rawQuestionScore(q, cfg);
  const v = voiceFraction(q, cfg);
  return (
    cfg.percent.weights.hifz * hifzFraction(q, cfg) +
    cfg.percent.weights.tajweed * tajweedFraction(q, cfg) +
    cfg.percent.weights.voice * (v == null ? 0 : v)
  );
}
