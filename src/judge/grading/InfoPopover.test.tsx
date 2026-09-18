// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { costLine } from './InfoPopover';
import { DEFAULT_SCORING_CONFIG } from '../../scoring';
import StepperCard, { HIFZ_KEYS } from './StepperCard';

afterEach(cleanup);

describe('costLine', () => {
  // Both languages are held on a placeholder while the operator finalizes
  // scoring v3 (2026-09-18) — see InfoPopover.tsx costLine.
  it('holds English on the [SCORING VALUE] placeholder regardless of deduction or model', () => {
    expect(costLine('prompted_fixed', DEFAULT_SCORING_CONFIG, 'en')).toBe('[SCORING VALUE]');
    expect(costLine('tajweed_minor', DEFAULT_SCORING_CONFIG, 'en')).toBe('[SCORING VALUE]');
    const v2 = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' };
    expect(costLine('prompted_failed', v2, 'en')).toBe('[SCORING VALUE]');
    expect(costLine('tajweed_major', v2, 'en')).toBe('[SCORING VALUE]');
    expect(costLine('self_corrected', DEFAULT_SCORING_CONFIG, 'en')).toBe('[SCORING VALUE]');
  });
  it('holds Arabic on the [قيمة الخصم] placeholder regardless of deduction or model', () => {
    expect(costLine('prompted_fixed', DEFAULT_SCORING_CONFIG, 'ar')).toBe('[قيمة الخصم]');
    expect(costLine('tajweed_minor', DEFAULT_SCORING_CONFIG, 'ar')).toBe('[قيمة الخصم]');
    const v2 = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' };
    expect(costLine('prompted_failed', v2, 'ar')).toBe('[قيمة الخصم]');
    expect(costLine('tajweed_major', v2, 'ar')).toBe('[قيمة الخصم]');
    expect(costLine('self_corrected', DEFAULT_SCORING_CONFIG, 'ar')).toBe('[قيمة الخصم]');
  });
});

describe('StepperCard ⓘ popover', () => {
  const promptedFailed = HIFZ_KEYS.find((k) => k.type === 'prompted_failed')!;

  it('shows the description and the escalation cost line on click, and closes on outside click', () => {
    const v2 = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' };
    render(
      <div>
        <StepperCard def={promptedFailed} count={0} lang="en" cfg={v2} onInc={() => {}} onDec={() => {}} />
        <button>outside</button>
      </div>,
    );
    const info = screen.getByLabelText('About this mistake');
    fireEvent.click(info);
    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText('Unable to continue after being prompted.')).toBeTruthy();
    expect(within(tooltip).getByText('[SCORING VALUE]')).toBeTruthy();

    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a tap (mouseenter then click, as touch fires them) leaves the popover OPEN', () => {
    render(<StepperCard def={promptedFailed} count={0} lang="en" cfg={DEFAULT_SCORING_CONFIG} onInc={() => {}} onDec={() => {}} />);
    const info = screen.getByLabelText('About this mistake');
    // touch tap sequence: mouseenter → (mousedown) → click
    fireEvent.mouseEnter(info.parentElement as HTMLElement);
    fireEvent.click(info);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    // a second cold click (no fresh mouseenter) closes it
    fireEvent.click(info);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on focus and closes on blur (spec §3: keyboard users tabbing to the ⓘ)', () => {
    render(<StepperCard def={promptedFailed} count={0} lang="en" cfg={DEFAULT_SCORING_CONFIG} onInc={() => {}} onDec={() => {}} />);
    const info = screen.getByLabelText('About this mistake');
    fireEvent.focus(info);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.blur(info);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
