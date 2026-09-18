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

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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

  it('null row (added/tie-break question) → own-question copy, dataset never loaded', () => {
    render(<PassagePanel row={null} passageLines={7} lang="en" variant="pane" />);
    expect(screen.getByText("Judge's own question")).toBeTruthy();
    expect(vi.mocked(quran.loadDataset)).not.toHaveBeenCalled();
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
