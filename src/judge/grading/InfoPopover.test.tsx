// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { costLine } from './InfoPopover';
import { DEFAULT_SCORING_CONFIG } from '../../scoring';
import StepperCard, { HIFZ_KEYS } from './StepperCard';

afterEach(cleanup);

const RAW = { ...DEFAULT_SCORING_CONFIG, model: 'raw-v3' };
const WEI = DEFAULT_SCORING_CONFIG; // weighted-v3
const ESC = { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' };

describe('costLine', () => {
  describe('raw-v3', () => {
    it('prices a mistake in raw points (en)', () => {
      expect(costLine('prompted_fixed', RAW, 'en')).toBe('−10 points');
    });
    it('prices a mistake in raw points (ar)', () => {
      expect(costLine('prompted_fixed', RAW, 'ar')).toBe('يُخصم 10 من النقاط');
    });
    it('shows no-penalty copy when hesitation costs 0', () => {
      expect(costLine('self_corrected', RAW, 'en')).toBe('No penalty — tracked only');
    });
    it('prices hesitation once its raw cost is no longer 0', () => {
      const cfg = { ...RAW, raw: { ...RAW.raw, costs: { ...RAW.raw.costs, hesitation: 2 } } };
      expect(costLine('self_corrected', cfg, 'en')).toBe('−2 points');
    });
  });

  describe('weighted-v3', () => {
    it("prices a hifz mistake as a percent of memorization (en)", () => {
      expect(costLine('prompted_fixed', WEI, 'en')).toBe("−10% of this question's memorization");
    });
    it('prices a hifz mistake as a percent of memorization (ar)', () => {
      expect(costLine('prompted_fixed', WEI, 'ar')).toBe('يُخصم 10٪ من حفظ هذا السؤال');
    });
    it("prices a tajweed mistake as a percent of tajweed", () => {
      expect(costLine('tajweed_minor', WEI, 'en')).toBe("−5% of this question's tajweed");
    });
    it('self_corrected is always free, regardless of raw cost', () => {
      expect(costLine('self_corrected', WEI, 'en')).toBe('No penalty — tracked only');
    });
    it('shows no-penalty copy when a percent cost is 0 (en)', () => {
      const cfg = { ...WEI, percent: { ...WEI.percent, costs: { ...WEI.percent.costs, tajweed_minor: 0 } } };
      expect(costLine('tajweed_minor', cfg, 'en')).toBe('No penalty — tracked only');
    });
    it('shows no-penalty copy when a percent cost is 0 (ar)', () => {
      const cfg = { ...WEI, percent: { ...WEI.percent, costs: { ...WEI.percent.costs, tajweed_minor: 0 } } };
      expect(costLine('tajweed_minor', cfg, 'ar')).toBe('لا خصم — يُسجَّل فقط');
    });
  });

  describe('escalating-v3', () => {
    it('appends the escalation suffix for hifz prompted/unable types (en)', () => {
      expect(costLine('prompted_fixed', ESC, 'en')).toBe(
        "−10% of this question's memorization · each repeat in this question costs 10 more percentage points",
      );
    });
    it('appends the escalation suffix for hifz prompted/unable types (ar)', () => {
      expect(costLine('prompted_fixed', ESC, 'ar')).toBe(
        'يُخصم 10٪ من حفظ هذا السؤال · كل تكرار في هذا السؤال يزيد الخصم 10 نقطة مئوية',
      );
    });
    it('does NOT repeat-suffix tajweed types', () => {
      expect(costLine('tajweed_major', ESC, 'en')).toBe("−10% of this question's tajweed");
    });
    it('self_corrected stays free under escalating too', () => {
      expect(costLine('self_corrected', ESC, 'en')).toBe('No penalty — tracked only');
    });
    it('shows no-penalty copy, with NO escalation suffix, for a 0-cost hifz type', () => {
      const cfg = { ...ESC, percent: { ...ESC.percent, costs: { ...ESC.percent.costs, prompted: 0 } } };
      expect(costLine('prompted_fixed', cfg, 'en')).toBe('No penalty — tracked only');
    });
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
    expect(
      within(tooltip).getByText(
        "−20% of this question's memorization · each repeat in this question costs 10 more percentage points",
      ),
    ).toBeTruthy();

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
