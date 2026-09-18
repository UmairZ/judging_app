import type { ScoringConfig } from './types';
import { KNOWN_MODELS } from './types';

/**
 * Defaults = today's live behavior at ×10 scale (the v3 identity): weighted-v3
 * with percent costs 10/20/10/5 scores every session exactly as the shipped
 * deduction-v1 did with 1/2/1/0.5 on a 10-point rail.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  model: 'weighted-v3',
  voice_max: 5,
  raw: {
    costs: { hesitation: 0, prompted: 10, unable: 20, tajweed_major: 10, tajweed_minor: 5 },
    voice_worth: 5,
  },
  percent: {
    weights: { hifz: 70, tajweed: 25, voice: 5 },
    costs: { prompted: 10, unable: 20, tajweed_major: 10, tajweed_minor: 5 },
    escalation_step: 10,
  },
};

export function weightsSum(cfg: ScoringConfig): number {
  return cfg.percent.weights.hifz + cfg.percent.weights.tajweed + cfg.percent.weights.voice;
}

/**
 * The engine's single fallback gate: score with the DEFAULT config wholesale
 * when the doc is missing, carries an unknown/legacy model id, or lacks a v3
 * sub-object — never crash mid-event, never mix half-shaped configs.
 */
export function resolveScoringConfig(input: ScoringConfig | null | undefined): ScoringConfig {
  if (input == null) return DEFAULT_SCORING_CONFIG;
  if (!(KNOWN_MODELS as readonly string[]).includes(input.model)) return DEFAULT_SCORING_CONFIG;
  if (input.raw == null || input.percent == null) return DEFAULT_SCORING_CONFIG;
  return input;
}

/** Judge-facing names for the five mistakes, for plain-language errors. */
const COST_NAMES = {
  hesitation: 'Hesitation',
  prompted: 'Prompted',
  unable: 'Unable to continue',
  tajweed_major: 'Tajweed major',
  tajweed_minor: 'Tajweed minor',
} as const;

/**
 * Plain-language validation. Tolerates legacy/half-shaped docs (missing
 * `raw`/`percent`) without crashing — the unknown-model error prompts a
 * re-pick, and the engine scores with the defaults meanwhile.
 */
export function validateScoringConfig(cfg: ScoringConfig): string[] {
  const errors: string[] = [];
  if (!(KNOWN_MODELS as readonly string[]).includes(cfg.model))
    errors.push(`unknown scoring system "${cfg.model}" — pick a scoring system (scores use the defaults meanwhile)`);
  if (typeof cfg.voice_max === 'number' && cfg.voice_max < 1)
    errors.push('voice scale must be at least 1');

  const percent = cfg.percent;
  if (percent != null) {
    const sum = weightsSum(cfg);
    if (sum !== 100) errors.push(`weights must sum to 100 (got ${sum})`);
    for (const key of ['prompted', 'unable', 'tajweed_major', 'tajweed_minor'] as const) {
      const v = percent.costs[key];
      if (v < 0 || v > 100) errors.push(`${COST_NAMES[key]} must cost between 0% and 100%`);
    }
    if (percent.escalation_step < 0 || percent.escalation_step > 50)
      errors.push('the escalation step must be between 0 and 50 percentage points');
  }

  const raw = cfg.raw;
  if (raw != null) {
    for (const key of ['hesitation', 'prompted', 'unable', 'tajweed_major', 'tajweed_minor'] as const) {
      const v = raw.costs[key];
      if (v < 0 || v > 100) errors.push(`${COST_NAMES[key]} must cost between 0 and 100 points`);
    }
    if (raw.voice_worth < 1 || raw.voice_worth > 30)
      errors.push("voice's share of each question must be between 1 and 30 points");
  }

  return errors;
}
