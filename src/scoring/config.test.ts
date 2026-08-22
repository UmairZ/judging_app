import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCORING_CONFIG,
  weightsSum,
  validateScoringConfig,
} from './config';

describe('DEFAULT_SCORING_CONFIG', () => {
  it('carries the scoring model version for future rubric variants', () => {
    expect(DEFAULT_SCORING_CONFIG.model).toBe('deduction-v1');
  });

  it('matches the spec defaults', () => {
    expect(DEFAULT_SCORING_CONFIG.weights).toEqual({ hifz: 70, tajweed: 25, voice: 5 });
    expect(DEFAULT_SCORING_CONFIG.hifz_base).toBe(10);
    expect(DEFAULT_SCORING_CONFIG.tajweed_base).toBe(10);
    expect(DEFAULT_SCORING_CONFIG.voice_max).toBe(5);
    expect(DEFAULT_SCORING_CONFIG.hifz_deductions).toEqual({ prompted_fixed: 1, prompted_failed: 2 });
    expect(DEFAULT_SCORING_CONFIG.tajweed_deductions).toEqual({ major: 1, minor: 0.5 });
  });
});

describe('weightsSum', () => {
  it('sums the three weights', () => {
    expect(weightsSum(DEFAULT_SCORING_CONFIG)).toBe(100);
  });
});

describe('validateScoringConfig', () => {
  it('returns no errors for the default config', () => {
    expect(validateScoringConfig(DEFAULT_SCORING_CONFIG)).toEqual([]);
  });

  it('flags weights that do not sum to 100', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, weights: { hifz: 60, tajweed: 25, voice: 5 } };
    expect(validateScoringConfig(bad)).toContain('weights must sum to 100 (got 90)');
  });

  it('flags a non-positive hifz_base', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, hifz_base: 0 };
    expect(validateScoringConfig(bad)).toContain('hifz_base must be > 0');
  });

  it('flags a non-positive tajweed_base', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, tajweed_base: 0 };
    expect(validateScoringConfig(bad)).toContain('tajweed_base must be > 0');
  });

  it('flags a non-positive voice_max', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, voice_max: 0 };
    expect(validateScoringConfig(bad)).toContain('voice_max must be > 0');
  });
});
