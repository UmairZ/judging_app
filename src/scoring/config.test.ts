import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCORING_CONFIG,
  weightsSum,
  validateScoringConfig,
  resolveScoringConfig,
} from './config';
import type { ScoringConfig } from './types';
import { KNOWN_MODELS } from './types';

describe('DEFAULT_SCORING_CONFIG', () => {
  it('defaults to weighted-v3 — today\'s live behavior at ×10 scale', () => {
    expect(DEFAULT_SCORING_CONFIG.model).toBe('weighted-v3');
  });

  it('matches the spec defaults', () => {
    expect(DEFAULT_SCORING_CONFIG.voice_max).toBe(5);
    expect(DEFAULT_SCORING_CONFIG.raw).toEqual({
      costs: { hesitation: 0, prompted: 10, unable: 20, tajweed_major: 10, tajweed_minor: 5 },
      voice_worth: 5,
    });
    expect(DEFAULT_SCORING_CONFIG.percent).toEqual({
      weights: { hifz: 70, tajweed: 25, voice: 5 },
      costs: { prompted: 10, unable: 20, tajweed_major: 10, tajweed_minor: 5 },
      escalation_step: 10,
    });
  });

  it('KNOWN_MODELS carries exactly the three v3 systems', () => {
    expect(KNOWN_MODELS).toEqual(['raw-v3', 'weighted-v3', 'escalating-v3']);
  });
});

describe('weightsSum', () => {
  it('sums the three percent weights', () => {
    expect(weightsSum(DEFAULT_SCORING_CONFIG)).toBe(100);
  });
});

describe('validateScoringConfig', () => {
  const withPercent = (percent: Partial<ScoringConfig['percent']>): ScoringConfig => ({
    ...DEFAULT_SCORING_CONFIG,
    percent: { ...DEFAULT_SCORING_CONFIG.percent, ...percent },
  });
  const withRaw = (raw: Partial<ScoringConfig['raw']>): ScoringConfig => ({
    ...DEFAULT_SCORING_CONFIG,
    raw: { ...DEFAULT_SCORING_CONFIG.raw, ...raw },
  });

  it('returns no errors for the default config', () => {
    expect(validateScoringConfig(DEFAULT_SCORING_CONFIG)).toEqual([]);
  });

  it('accepts all three known models', () => {
    for (const model of KNOWN_MODELS) {
      expect(validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, model })).toEqual([]);
    }
  });

  it('flags an unknown scoring model with the exact re-pick message', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, model: 'bogus-v9' };
    expect(validateScoringConfig(bad)).toContain(
      'unknown scoring system "bogus-v9" — pick a scoring system (scores use the defaults meanwhile)',
    );
  });

  it('flags a legacy model id (deduction-v1 / escalating-v2) the same way', () => {
    expect(validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, model: 'deduction-v1' }).some((e) => e.includes('deduction-v1'))).toBe(true);
    expect(validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, model: 'escalating-v2' }).some((e) => e.includes('escalating-v2'))).toBe(true);
  });

  it('does not crash on a legacy-shaped doc — flags the model id', () => {
    const legacy = {
      model: 'deduction-v1', weights: { hifz: 70, tajweed: 25, voice: 5 },
      hifz_base: 10, tajweed_base: 10, voice_max: 5,
      hifz_deductions: { prompted_fixed: 1, prompted_failed: 2 },
      tajweed_deductions: { major: 1, minor: 0.5 },
    } as unknown as ScoringConfig;
    const errors = validateScoringConfig(legacy);
    expect(errors.some((e) => e.includes('deduction-v1'))).toBe(true);
  });

  it('flags percent weights that do not sum to 100', () => {
    const bad = withPercent({ weights: { hifz: 60, tajweed: 25, voice: 5 } });
    expect(validateScoringConfig(bad)).toContain('weights must sum to 100 (got 90)');
  });

  it('flags a voice_max below 1', () => {
    const bad = { ...DEFAULT_SCORING_CONFIG, voice_max: 0 };
    expect(validateScoringConfig(bad).some((e) => e.toLowerCase().includes('voice scale'))).toBe(true);
  });

  it('flags each percent cost outside 0..100', () => {
    for (const key of ['prompted', 'unable', 'tajweed_major', 'tajweed_minor'] as const) {
      const low = withPercent({ costs: { ...DEFAULT_SCORING_CONFIG.percent.costs, [key]: -1 } });
      const high = withPercent({ costs: { ...DEFAULT_SCORING_CONFIG.percent.costs, [key]: 101 } });
      expect(validateScoringConfig(low).length).toBeGreaterThan(0);
      expect(validateScoringConfig(high).length).toBeGreaterThan(0);
    }
  });

  it('flags each raw cost outside 0..100', () => {
    for (const key of ['hesitation', 'prompted', 'unable', 'tajweed_major', 'tajweed_minor'] as const) {
      const low = withRaw({ costs: { ...DEFAULT_SCORING_CONFIG.raw.costs, [key]: -1 } });
      const high = withRaw({ costs: { ...DEFAULT_SCORING_CONFIG.raw.costs, [key]: 101 } });
      expect(validateScoringConfig(low).length).toBeGreaterThan(0);
      expect(validateScoringConfig(high).length).toBeGreaterThan(0);
    }
  });

  it('flags voice_worth outside 1..30', () => {
    expect(validateScoringConfig(withRaw({ voice_worth: 0 })).length).toBeGreaterThan(0);
    expect(validateScoringConfig(withRaw({ voice_worth: 31 })).length).toBeGreaterThan(0);
    expect(validateScoringConfig(withRaw({ voice_worth: 30 }))).toEqual([]);
    expect(validateScoringConfig(withRaw({ voice_worth: 1 }))).toEqual([]);
  });

  it('flags escalation_step outside 0..50', () => {
    expect(validateScoringConfig(withPercent({ escalation_step: -1 })).length).toBeGreaterThan(0);
    expect(validateScoringConfig(withPercent({ escalation_step: 51 })).length).toBeGreaterThan(0);
    expect(validateScoringConfig(withPercent({ escalation_step: 0 }))).toEqual([]);
    expect(validateScoringConfig(withPercent({ escalation_step: 50 }))).toEqual([]);
  });
});

describe('resolveScoringConfig', () => {
  it('returns the DEFAULT wholesale (by reference) for a nullish input', () => {
    expect(resolveScoringConfig(null)).toBe(DEFAULT_SCORING_CONFIG);
    expect(resolveScoringConfig(undefined)).toBe(DEFAULT_SCORING_CONFIG);
  });

  it('returns the DEFAULT by reference for a legacy deduction-v1 doc', () => {
    const legacy = {
      model: 'deduction-v1', weights: { hifz: 70, tajweed: 25, voice: 5 },
      hifz_base: 10, tajweed_base: 10, voice_max: 5,
      hifz_deductions: { prompted_fixed: 1, prompted_failed: 2 },
      tajweed_deductions: { major: 1, minor: 0.5 },
    } as unknown as ScoringConfig;
    expect(resolveScoringConfig(legacy)).toBe(DEFAULT_SCORING_CONFIG);
  });

  it('returns the DEFAULT when the model is unknown, even with v3 sub-objects', () => {
    expect(resolveScoringConfig({ ...DEFAULT_SCORING_CONFIG, model: 'bogus-v9' })).toBe(DEFAULT_SCORING_CONFIG);
  });

  it('returns the DEFAULT when percent is missing', () => {
    const half = { ...DEFAULT_SCORING_CONFIG, percent: undefined } as unknown as ScoringConfig;
    expect(resolveScoringConfig(half)).toBe(DEFAULT_SCORING_CONFIG);
  });

  it('returns the DEFAULT when raw is missing', () => {
    const half = { ...DEFAULT_SCORING_CONFIG, raw: undefined } as unknown as ScoringConfig;
    expect(resolveScoringConfig(half)).toBe(DEFAULT_SCORING_CONFIG);
  });

  it('passes a valid v3 config through untouched (same reference)', () => {
    const cfg: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      model: 'escalating-v3',
      percent: { ...DEFAULT_SCORING_CONFIG.percent, escalation_step: 20 },
    };
    expect(resolveScoringConfig(cfg)).toBe(cfg);
    expect(resolveScoringConfig({ ...DEFAULT_SCORING_CONFIG, model: 'raw-v3' }).model).toBe('raw-v3');
  });
});
