// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Dashboard from './Dashboard';
import type { JudgeQueueItem, QueueStatus } from './useJudgeQueue';

afterEach(() => { cleanup(); localStorage.clear(); });

function item(id: string, name: string, slotLabel: string, status: QueueStatus, marks = 0): JudgeQueueItem {
  return { enrollmentId: id, contestantId: id, category: 'cat', name, slotLabel, status, marks };
}

const noop = () => {};

describe('Dashboard queue grouping', () => {
  it('groups two-slot queues under section headers, in slotLabel order, with correct remaining counts', () => {
    const items = [
      item('z1', 'Zaid Rahman', "2 Juz' · Sisters", 'not_started'),
      item('a1', 'Ahmed Ali', "1 Juz' · Brothers", 'not_started'),
      item('a2', 'Bilal Haque', "1 Juz' · Brothers", 'not_started'),
    ];
    render(<Dashboard judgeName="Judge" items={items} tieBreaks={[]} onGrade={noop} onTieBreak={noop} />);

    const headerA = screen.getByText("1 Juz' · Brothers");
    const headerB = screen.getByText("2 Juz' · Sisters");
    const rowAhmed = screen.getByText('Ahmed Ali');
    const rowBilal = screen.getByText('Bilal Haque');
    const rowZaid = screen.getByText('Zaid Rahman');

    // remaining counts: 2 under header A, 1 under header B
    expect(headerA.nextElementSibling?.textContent).toBe('2');
    expect(headerB.nextElementSibling?.textContent).toBe('1');

    const isBefore = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(isBefore(headerA, rowAhmed)).toBe(true);
    expect(isBefore(rowAhmed, rowBilal)).toBe(true); // name-sorted within group
    expect(isBefore(rowBilal, headerB)).toBe(true);
    expect(isBefore(headerB, rowZaid)).toBe(true);
  });

  it('drops the slotLabel from grouped rows’ subtitle', () => {
    const items = [
      item('a1', 'Ahmed Ali', "1 Juz' · Brothers", 'not_started'),
      item('z1', 'Zaid Rahman', "2 Juz' · Sisters", 'in_progress', 4),
    ];
    render(<Dashboard judgeName="Judge" items={items} tieBreaks={[]} onGrade={noop} onTieBreak={noop} />);

    // Grouped rows have NO subtitle at all — the header carries the slot and
    // the status pill carries the status (operator, 2026-09-17).
    expect(screen.getByText('Ahmed Ali').nextElementSibling).toBeNull();
    expect(screen.getByText('Zaid Rahman').nextElementSibling).toBeNull();
    expect(screen.queryByText(/marks/)).toBeNull();
  });

  it('renders no section header and keeps the slotLabel in the subtitle when only one slot is present', () => {
    const items = [
      item('a1', 'Ali Khan', 'Tajweed A · Brothers', 'not_started'),
      item('b1', 'Bilal Song', 'Tajweed A · Brothers', 'not_started'),
    ];
    render(<Dashboard judgeName="Judge" items={items} tieBreaks={[]} onGrade={noop} onTieBreak={noop} />);

    // The slot text appears only as row subtitles (one per row) — never as a
    // section header, which is recognizable by its uppercase small-caps style.
    const nodes = screen.getAllByText('Tajweed A · Brothers', { exact: true });
    expect(nodes).toHaveLength(2);
    for (const n of nodes) expect((n as HTMLElement).style.textTransform).not.toBe('uppercase');

    // Single-slot rows keep only the slot as subtitle (status lives in the pill).
    const subtitle = screen.getByText('Ali Khan').nextElementSibling as HTMLElement;
    expect(subtitle.textContent).toBe('Tajweed A · Brothers');
  });

  it('keeps graded items in the collapsed section, ungrouped, with slotLabel intact', () => {
    const items = [
      item('a1', 'Ahmed Ali', "1 Juz' · Brothers", 'not_started'),
      item('z1', 'Zaid Rahman', "2 Juz' · Sisters", 'not_started'),
      item('g1', 'Graded Guy', "1 Juz' · Brothers", 'graded'),
    ];
    render(<Dashboard judgeName="Judge" items={items} tieBreaks={[]} onGrade={noop} onTieBreak={noop} />);

    fireEvent.click(screen.getByText(/Graded \(1\)/));

    const gradedSubtitle = screen.getByText('Graded Guy').nextElementSibling as HTMLElement;
    expect(gradedSubtitle.textContent).toBe("1 Juz' · Brothers");
  });
});
