// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { costLine } from './InfoPopover';
import { DEFAULT_SCORING_CONFIG } from '../../scoring';
import StepperCard, { HIFZ_KEYS } from './StepperCard';

afterEach(cleanup);

describe('costLine', () => {
  it('states the flat cost under standard deductions', () => {
    expect(costLine('prompted_fixed', DEFAULT_SCORING_CONFIG, 'en')).toBe('Costs 1 point');
    expect(costLine('tajweed_minor', DEFAULT_SCORING_CONFIG, 'en')).toBe('Costs 0.5 points');
  });
  it('adds the escalation sentence under escalating-v2', () => {
    const v2 = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v2' };
    expect(costLine('prompted_failed', v2, 'en')).toBe('Costs 2 points — repeats in the same question cost 1 more each time');
    // tajweed stays flat even under v2
    expect(costLine('tajweed_major', v2, 'en')).toBe('Costs 1 point');
  });
  it('self-corrected is free', () => {
    expect(costLine('self_corrected', DEFAULT_SCORING_CONFIG, 'en')).toBe('No penalty — tracked only');
  });
});

describe('StepperCard ⓘ popover', () => {
  const promptedFailed = HIFZ_KEYS.find((k) => k.type === 'prompted_failed')!;

  it('shows the description and the escalation cost line on click, and closes on outside click', () => {
    const v2 = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v2' };
    render(
      <div>
        <StepperCard def={promptedFailed} count={0} lang="en" cfg={v2} onInc={() => {}} onDec={() => {}} />
        <button>outside</button>
      </div>,
    );
    const info = screen.getByLabelText('More info');
    fireEvent.click(info);
    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText('Hint given, but still could not continue the passage.')).toBeTruthy();
    expect(within(tooltip).getByText('Costs 2 points — repeats in the same question cost 1 more each time')).toBeTruthy();

    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
