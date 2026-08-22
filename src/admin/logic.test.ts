import { describe, expect, it } from 'vitest';
import { recordCountLabel, judgesFinishedLabel, setupStepLabel } from './logic';

describe('recordCountLabel', () => {
  it('singular at exactly 1', () => {
    expect(recordCountLabel(1)).toBe('1 record');
  });
  it('plural at 0 and N > 1', () => {
    expect(recordCountLabel(0)).toBe('0 records');
    expect(recordCountLabel(5)).toBe('5 records');
  });
});

describe('judgesFinishedLabel', () => {
  it('formats "N of M judges finished"', () => {
    expect(judgesFinishedLabel(2, 3)).toBe('2 of 3 judges finished');
    expect(judgesFinishedLabel(0, 3)).toBe('0 of 3 judges finished');
  });
});

describe('setupStepLabel', () => {
  it('shows the glyph when not done, a check once done', () => {
    expect(setupStepLabel('①', 'Review categories', false)).toBe('① Review categories');
    expect(setupStepLabel('①', 'Review categories', true)).toBe('✓ Review categories');
  });
});
