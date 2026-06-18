import type { ScoringConfig } from './types';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { hifz: 70, tajweed: 25, voice: 5 },
  hifz_base: 10,
  tajweed_base: 10,
  voice_max: 5,
  hifz_deductions: { prompted_fixed: 1, prompted_failed: 2 },
  tajweed_deductions: { major: 1, minor: 0.5 },
};

export function weightsSum(cfg: ScoringConfig): number {
  return cfg.weights.hifz + cfg.weights.tajweed + cfg.weights.voice;
}

export function validateScoringConfig(cfg: ScoringConfig): string[] {
  const errors: string[] = [];
  const sum = weightsSum(cfg);
  if (sum !== 100) errors.push(`weights must sum to 100 (got ${sum})`);
  if (cfg.hifz_base <= 0) errors.push('hifz_base must be > 0');
  if (cfg.tajweed_base <= 0) errors.push('tajweed_base must be > 0');
  if (cfg.voice_max <= 0) errors.push('voice_max must be > 0');
  return errors;
}
