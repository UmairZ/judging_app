// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// The quran module lazy-loads a 2MB dataset — jsdom must never touch it. The mock
// keeps the interface: loadDataset resolves a tiny fixture object, getPassage builds
// `lineCount` fixture lines on page 3.
vi.mock('../../quran', () => ({
  loadDataset: vi.fn(() => Promise.resolve({ fake: true })),
  getPassage: vi.fn((_d: unknown, surah: number, ayah: number, lineCount: number) => ({
    startPage: 3,
    endPage: 3,
    lines: Array.from({ length: lineCount }, (_, i) => ({ page: 3, line: i + 1, text: `LINE-${i + 1}`, surah, ayah })),
  })),
  getPage: vi.fn(() => 3),
}));

const quran = await import('../../quran');
const { default: PassagePanel } = await import('./PassagePanel');

afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

const ROW = { surah: 2, ayah: 8, ref: 'Al-Baqarah 2:8', text: 'وَمِنَ النَّاسِ', juz: 1, crosses: false };

describe('PassagePanel — pane variant', () => {
  it('renders ref + page meta and passageLines rtl lines with the first line highlighted; no close chrome', async () => {
    render(<PassagePanel row={ROW} passageLines={3} lang="en" variant="pane" />);
    expect(await screen.findByText('Al-Baqarah 2:8 · page 3')).toBeTruthy();
    const first = screen.getByText('LINE-1');
    const second = screen.getByText('LINE-2');
    expect(screen.getByText('LINE-3')).toBeTruthy();
    expect(screen.queryByText('LINE-4')).toBeNull(); // exactly passageLines lines
    // first (starting-ayah) line highlighted; the rest transparent
    expect(first.style.background).not.toBe(second.style.background);
    expect(second.style.background).toBe('transparent');
    // rtl rendering
    expect(first.parentElement!.getAttribute('dir')).toBe('rtl');
    // pane has no close chrome
    expect(screen.queryByLabelText('Close')).toBeNull();
    expect(vi.mocked(quran.getPassage)).toHaveBeenCalledWith(expect.anything(), 2, 8, 3);
  });

  it('shows the loading copy while the dataset is in flight', () => {
    vi.mocked(quran.loadDataset).mockImplementationOnce(() => new Promise(() => {}));
    render(<PassagePanel row={ROW} passageLines={3} lang="en" variant="pane" />);
    expect(screen.getByText('Loading passage…')).toBeTruthy();
    expect(screen.queryByText('LINE-1')).toBeNull();
  });

  it('renders "page {n} → {m}" when the passage crosses pages', async () => {
    vi.mocked(quran.getPassage).mockImplementationOnce(() => ({
      startPage: 3, endPage: 4,
      lines: [{ page: 3, line: 15, text: 'LINE-1', surah: 2, ayah: 8 }, { page: 4, line: 1, text: 'LINE-2', surah: 2, ayah: 9 }],
    }));
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="pane" />);
    expect(await screen.findByText('Al-Baqarah 2:8 · page 3 → 4')).toBeTruthy();
  });

  it('invalid ref with bank text → falls back to the bank cell text under the ref meta', async () => {
    vi.mocked(quran.getPassage).mockImplementationOnce(() => { throw new Error('No such ayah in dataset: 2:8'); });
    render(<PassagePanel row={ROW} passageLines={3} lang="en" variant="pane" />);
    expect(await screen.findByText(ROW.text)).toBeTruthy();
    expect(screen.getByText('Al-Baqarah 2:8')).toBeTruthy();
  });

  it('invalid ref AND blank bank text → own-question copy, never an empty line', async () => {
    vi.mocked(quran.getPassage).mockImplementationOnce(() => { throw new Error('No such ayah in dataset: 2:8'); });
    render(<PassagePanel row={{ ...ROW, text: '' }} passageLines={3} lang="en" variant="pane" />);
    expect(await screen.findByText("Judge's own question")).toBeTruthy();
  });

  it('null row (added/tie-break question) → own-question copy, dataset never loaded', () => {
    render(<PassagePanel row={null} passageLines={7} lang="en" variant="pane" />);
    expect(screen.getByText("Judge's own question")).toBeTruthy();
    expect(vi.mocked(quran.loadDataset)).not.toHaveBeenCalled();
  });
});

describe('PassagePanel — font size header', () => {
  it('meta header carries A−/A+ steppers; A+ enlarges the passage lines, clamped at the largest step', async () => {
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="pane" />);
    const line = await screen.findByText('LINE-1');
    expect(line.style.fontSize).toBe('22px'); // default
    const larger = screen.getByLabelText('Larger text');
    fireEvent.click(larger);
    expect(screen.getByText('LINE-1').style.fontSize).toBe('26px');
    fireEvent.click(larger);
    fireEvent.click(larger); // 30 → 34 (max)
    expect(screen.getByText('LINE-1').style.fontSize).toBe('34px');
    expect((screen.getByLabelText('Larger text') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Larger text')); // disabled — no change
    expect(screen.getByText('LINE-1').style.fontSize).toBe('34px');
  });

  it('A− shrinks and clamps at the smallest step', async () => {
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="pane" />);
    await screen.findByText('LINE-1');
    const smaller = screen.getByLabelText('Smaller text');
    fireEvent.click(smaller); // 22 → 18 (min)
    expect(screen.getByText('LINE-1').style.fontSize).toBe('18px');
    expect((screen.getByLabelText('Smaller text') as HTMLButtonElement).disabled).toBe(true);
  });

  it('size persists across remount via localStorage (per-device preference)', async () => {
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="pane" />);
    await screen.findByText('LINE-1');
    fireEvent.click(screen.getByLabelText('Larger text'));
    cleanup();
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="overlay" onClose={() => {}} />);
    expect((await screen.findByText('LINE-1')).style.fontSize).toBe('26px');
  });

  it('a stored value outside the size list falls back to the default', async () => {
    localStorage.setItem('judge-passage-size', '999');
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="pane" />);
    expect((await screen.findByText('LINE-1')).style.fontSize).toBe('22px');
  });

  it('own-question and loading states show no size controls; Arabic labels present on the passage state', async () => {
    render(<PassagePanel row={null} passageLines={7} lang="en" variant="pane" />);
    expect(screen.queryByLabelText('Larger text')).toBeNull();
    cleanup();
    vi.mocked(quran.loadDataset).mockImplementationOnce(() => new Promise(() => {}));
    render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="pane" />);
    expect(screen.queryByLabelText('Larger text')).toBeNull();
    cleanup();
    render(<PassagePanel row={ROW} passageLines={2} lang="ar" variant="pane" />);
    await screen.findByText('LINE-1');
    expect(screen.getByLabelText('تكبير الخط')).toBeTruthy();
    expect(screen.getByLabelText('تصغير الخط')).toBeTruthy();
  });

  it('invalid-ref fallback text also gets the header and obeys the size', async () => {
    vi.mocked(quran.getPassage).mockImplementationOnce(() => { throw new Error('No such ayah in dataset: 2:8'); });
    render(<PassagePanel row={ROW} passageLines={3} lang="en" variant="pane" />);
    const cell = await screen.findByText(ROW.text);
    expect(cell.style.fontSize).toBe('22px');
    fireEvent.click(screen.getByLabelText('Larger text'));
    expect(screen.getByText(ROW.text).style.fontSize).toBe('26px');
  });
});

describe('PassagePanel — overlay variant', () => {
  it('renders the Passage title and closes on ×, Escape and backdrop click (not card click)', async () => {
    const onClose = vi.fn();
    const { container } = render(<PassagePanel row={ROW} passageLines={2} lang="en" variant="overlay" onClose={onClose} />);
    expect(await screen.findByText('LINE-1')).toBeTruthy();
    expect(screen.getByText('Passage')).toBeTruthy();
    fireEvent.click(screen.getByText('LINE-1')); // inside the card — must NOT close
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(container.firstChild as HTMLElement); // backdrop
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('Arabic: صفحة meta and المقطع title', async () => {
    render(<PassagePanel row={ROW} passageLines={2} lang="ar" variant="overlay" onClose={() => {}} />);
    expect(await screen.findByText('Al-Baqarah 2:8 · صفحة 3')).toBeTruthy();
    expect(screen.getByText('المقطع')).toBeTruthy();
  });
});
