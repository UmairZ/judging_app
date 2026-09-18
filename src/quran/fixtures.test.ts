/**
 * SPIKE verification fixtures — run against the REAL built dataset
 * (src/quran/madani15.json, produced by scripts/build-quran-dataset.mjs).
 * These pin the dataset to the physical Madani 15-line mushaf; do not loosen.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  loadDataset,
  getJuz,
  getPage,
  getPassage,
  normalizeArabic,
  type QuranDataset,
} from './index';

let d: QuranDataset;
beforeAll(async () => {
  d = await loadDataset();
});

describe('dataset structure', () => {
  it('memoizes loadDataset', async () => {
    expect(await loadDataset()).toBe(d);
  });

  it('carries source attribution in meta', () => {
    expect(d.meta.attribution).toContain('King Fahd Glorious Quran Printing Complex');
    expect(d.meta.verses).toBe(6236);
    expect(d.juzIndex).toHaveLength(30);
    expect(d.ayahIndex).toHaveLength(6236);
  });

  it('pages are contiguous 1..604 with <=15 lines each', () => {
    const byPage = new Map<number, Set<number>>();
    for (const l of d.lines) {
      if (!byPage.has(l.page)) byPage.set(l.page, new Set());
      const s = byPage.get(l.page)!;
      expect(s.has(l.line)).toBe(false); // no duplicate line numbers on a page
      s.add(l.line);
    }
    expect(byPage.size).toBe(604);
    for (let p = 1; p <= 604; p++) {
      const s = byPage.get(p);
      expect(s, `page ${p} missing`).toBeDefined();
      expect(s!.size, `page ${p} line count`).toBeLessThanOrEqual(15);
      expect(s!.size).toBeGreaterThan(0);
    }
  });

  it('lines are sorted by (page, line)', () => {
    for (let i = 1; i < d.lines.length; i++) {
      const a = d.lines[i - 1];
      const b = d.lines[i];
      expect(a.page < b.page || (a.page === b.page && a.line < b.line)).toBe(true);
    }
  });
});

describe('juz anchors', () => {
  it('getJuz(1,1) = 1', () => expect(getJuz(d, 1, 1)).toBe(1));
  it('getJuz(2,141) = 1 (last ayah before the juz-2 boundary)', () =>
    expect(getJuz(d, 2, 141)).toBe(1));
  it('getJuz(2,142) = 2', () => expect(getJuz(d, 2, 142)).toBe(2));
  it('getJuz(78,1) = 30', () => expect(getJuz(d, 78, 1)).toBe(30));
  it('getJuz(114,6) = 30', () => expect(getJuz(d, 114, 6)).toBe(30));
});

describe('page anchors', () => {
  it('getPage(1,1) = 1', () => expect(getPage(d, 1, 1)).toBe(1));
  it('getPage(2,1) = 2', () => expect(getPage(d, 2, 1)).toBe(2));
  // Confirmed from the built data (and the physical mushaf): 2:8 begins on page 3.
  it('getPage(2,8) = 3', () => expect(getPage(d, 2, 8)).toBe(3));
  // Independent well-known anchors (checkable against any Madani 15-line mushaf).
  it('getPage(2,255) = 42 (Ayat al-Kursi)', () => expect(getPage(d, 2, 255)).toBe(42));
  it('getPage(18,1) = 293 (Al-Kahf)', () => expect(getPage(d, 18, 1)).toBe(293));
  it('getPage(36,1) = 440 (Ya-Sin)', () => expect(getPage(d, 36, 1)).toBe(440));
  it('getPage(67,1) = 562 (Al-Mulk)', () => expect(getPage(d, 67, 1)).toBe(562));
  it('getPage(112,1) = 604 (Al-Ikhlas)', () => expect(getPage(d, 112, 1)).toBe(604));
});

describe('passages', () => {
  it('getPassage(2,8,7): 7 lines, first line contains وَمِنَ ٱلنَّاسِ', () => {
    const p = getPassage(d, 2, 8, 7);
    expect(p.lines).toHaveLength(7);
    // 2:8 begins at the END of a line whose first word is still in 2:7 — the passage
    // must start on the physical line carrying the ayah's first word.
    expect(normalizeArabic(p.lines[0].text)).toContain(normalizeArabic('وَمِنَ ٱلنَّاسِ'));
    expect(p.startPage).toBe(3);
    expect(p.endPage).toBe(3);
  });

  it('a passage crossing a page boundary spans startPage != endPage', () => {
    // 2:4 begins on page 2; page 2 has only 8 lines, so 7 lines run onto page 3.
    const p = getPassage(d, 2, 4, 7);
    expect(p.lines).toHaveLength(7);
    expect(p.startPage).toBe(2);
    expect(p.endPage).toBe(3);
    expect(p.startPage).not.toBe(p.endPage);
  });

  it('passage lines are consecutive physical lines', () => {
    const p = getPassage(d, 2, 255, 7);
    for (let i = 1; i < p.lines.length; i++) {
      const prev = p.lines[i - 1];
      const cur = p.lines[i];
      const samePageNext = cur.page === prev.page && cur.line === prev.line + 1;
      const nextPageTop = cur.page === prev.page + 1 && cur.line <= 2; // new page may open with a header
      expect(samePageNext || nextPageTop).toBe(true);
    }
  });

  it('a passage crossing into a new surah includes lines of the new surah', () => {
    // 1:7 is near the bottom of page 1; 7 lines reach into Al-Baqarah on page 2.
    const p = getPassage(d, 1, 7, 7);
    expect(p.lines.some((l) => l.surah === 2)).toBe(true);
    expect(p.lines.some((l) => l.kind === 'surah_name')).toBe(true);
  });

  it('rejects unknown ayat and bad line counts', () => {
    expect(() => getPassage(d, 2, 300, 7)).toThrow();
    expect(() => getPassage(d, 115, 1, 7)).toThrow();
    expect(() => getPassage(d, 2, 8, 0)).toThrow();
  });
});
