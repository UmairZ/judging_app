import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook, poolId } from './questionBank';
import type { Category } from '../domain/structure';

const categories: Category[] = [
  // '15' listed FIRST: naive substring matching would hit "15" when looking for
  // "1" or "5", so these fixtures prove standalone-integer (word-boundary) matching.
  { id: '15', label: "15 Ajzā'", minQuestions: 2, divisions: ['brothers', 'sisters'] },
  { id: '5', label: "5 Ajzā'", minQuestions: 4, divisions: ['brothers', 'sisters'] },
  { id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers', 'sisters'] },
];

function buildWorkbook(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const workbook = buildWorkbook({
  'Juz 1-5': [
    ['Al-Baqarah 2:8', 'text0'],
    ['Al- Baqarah 2:156', 'text1'],
    [], // fully-empty row: must be skipped, not counted, not an error
    ["An-Nazi'at 79:12", 'text3'],
    ['Al-Baqarah 2:255', ''], // blank-text row: kept, text === ''
    ['Al-Baqarah', 'some text'], // bad ref: no trailing "surah:ayah" — must land in errors
  ],
  'Juz 1-15': [['Al-Baqarah 2:1', 't']],
  'Juz 26 - 30': [['Al-Baqarah 2:1', 't']], // whitespace around the dash: regex must tolerate it
  'Juz 1': [['Al-Fatihah 1:1', 't']],
  'Juz 30': [["An-Nas 114:1", 't']],
  'Juz 7-9': [['Al-Araf 7:1', 't']],
  Notes: [['this sheet is not a Juz range', '']],
});

describe('parseWorkbook', () => {
  const parsed = parseWorkbook(workbook, categories);
  const bySheet = (name: string) => parsed.find((s) => s.sheetName === name)!;

  it("parses 'Juz 1-5': range/side/category, refs regardless of spelling, blank text kept, bad ref reported not dropped", () => {
    const sheet = bySheet('Juz 1-5');
    expect(sheet.range).toEqual([1, 5]);
    expect(sheet.side).toBe('begin'); // starts at 1
    expect(sheet.categoryId).toBe('5'); // size 5 -> "5 Ajzā'"

    expect(sheet.rows).toEqual([
      { surah: 2, ayah: 8, ref: 'Al-Baqarah 2:8', text: 'text0' },
      { surah: 2, ayah: 156, ref: 'Al- Baqarah 2:156', text: 'text1' },
      { surah: 79, ayah: 12, ref: "An-Nazi'at 79:12", text: 'text3' },
      { surah: 2, ayah: 255, ref: 'Al-Baqarah 2:255', text: '' },
    ]);

    expect(sheet.errors).toEqual([
      { rowIndex: 5, cell: 'Al-Baqarah', reason: expect.stringContaining('surah:ayah') },
    ]);
  });

  it("parses 'Juz 1-15': size 15 -> category '15'", () => {
    const sheet = bySheet('Juz 1-15');
    expect(sheet.range).toEqual([1, 15]);
    expect(sheet.side).toBe('begin');
    expect(sheet.categoryId).toBe('15');
  });

  it("parses 'Juz 26 - 30' (spaces around the dash): ends at 30 -> side 'end', size 5 -> category '5' (not '15')", () => {
    const sheet = bySheet('Juz 26 - 30');
    expect(sheet.range).toEqual([26, 30]);
    expect(sheet.side).toBe('end');
    expect(sheet.categoryId).toBe('5');
  });

  it("parses 'Juz 1': single juz collapses range to [1,1], starts at 1 -> 'begin', size 1 -> category '1'", () => {
    const sheet = bySheet('Juz 1');
    expect(sheet.range).toEqual([1, 1]);
    expect(sheet.side).toBe('begin');
    expect(sheet.categoryId).toBe('1');
  });

  it("parses 'Juz 30': single juz collapses range to [30,30], ends at 30 -> 'end', size 1 -> category '1'", () => {
    const sheet = bySheet('Juz 30');
    expect(sheet.range).toEqual([30, 30]);
    expect(sheet.side).toBe('end');
    expect(sheet.categoryId).toBe('1');
  });

  it("parses 'Juz 7-9': matches neither begin nor end -> side null; size 3 matches no category -> categoryId null", () => {
    const sheet = bySheet('Juz 7-9');
    expect(sheet.range).toEqual([7, 9]);
    expect(sheet.side).toBeNull();
    expect(sheet.categoryId).toBeNull();
  });

  it("'Notes' has an unparseable sheet name: side/categoryId null, zero rows kept, still listed", () => {
    const sheet = bySheet('Notes');
    expect(sheet.side).toBeNull();
    expect(sheet.categoryId).toBeNull();
    expect(sheet.rows).toEqual([]);
    expect(sheet.errors).toEqual([]);
    expect(parsed.map((s) => s.sheetName)).toContain('Notes');
  });
});

describe('poolId', () => {
  it('joins categoryId and side', () => {
    expect(poolId('5', 'begin')).toBe('5_begin');
    expect(poolId('1', 'end')).toBe('1_end');
  });
});
