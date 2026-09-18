import * as XLSX from 'xlsx';
import type { Category } from '../domain/structure';

export interface PoolRow {
  surah: number;
  ayah: number;
  /** Display string exactly as it appears in the workbook cell (spelling/spacing varies). */
  ref: string;
  text: string;
}

export interface ParsedSheet {
  sheetName: string;
  /** [start, end] juz numbers. [0, 0] when the sheet name itself couldn't be parsed. */
  range: [number, number];
  side: 'begin' | 'end' | null;
  categoryId: string | null;
  rows: PoolRow[];
  errors: { rowIndex: number; cell: string; reason: string }[];
}

// 'Juz 1-5', 'Juz 26-30', 'Juz 1', 'Juz 30' — a single number has no dash (range collapses to [n, n]).
const SHEET_NAME_RE = /^Juz\s+(\d+)(?:\s*-\s*(\d+))?$/i;

// Trailing "surah:ayah" in column 0, regardless of how the surah name itself is spelled/spaced.
const REF_RE = /(\d+)\s*:\s*(\d+)\s*$/;

/** Sheet range starts at 1 -> begin; ends at 30 -> end; anything else = flagged, unimportable. */
function sideForRange(start: number, end: number): 'begin' | 'end' | null {
  if (start === 1) return 'begin';
  if (end === 30) return 'end';
  return null;
}

/** The category whose label or id contains the range size as a standalone integer. */
function categoryIdForSize(size: number, categories: Category[]): string | null {
  const standalone = new RegExp(`\\b${size}\\b`);
  const match = categories.find((c) => standalone.test(c.label) || standalone.test(c.id));
  return match ? match.id : null;
}

function isEmptyRow(cells: unknown[]): boolean {
  return cells.every((c) => c === undefined || c === null || String(c).trim() === '');
}

function parseSheetRows(ws: XLSX.WorkSheet): { rows: PoolRow[]; errors: ParsedSheet['errors'] } {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const rows: PoolRow[] = [];
  const errors: ParsedSheet['errors'] = [];
  raw.forEach((cells, rowIndex) => {
    if (!Array.isArray(cells) || cells.length === 0 || isEmptyRow(cells)) return;
    const refCell = String(cells[0] ?? '').trim();
    const textCell = cells[1] === undefined || cells[1] === null ? '' : String(cells[1]);
    const m = refCell.match(REF_RE);
    if (!m) {
      errors.push({ rowIndex, cell: refCell, reason: 'unrecognized ayah reference (expected a trailing "surah:ayah")' });
      return;
    }
    rows.push({ surah: Number(m[1]), ayah: Number(m[2]), ref: refCell, text: textCell });
  });
  return { rows, errors };
}

export function parseWorkbook(data: ArrayBuffer, categories: Category[]): ParsedSheet[] {
  const wb = XLSX.read(data);
  return wb.SheetNames.map((sheetName): ParsedSheet => {
    const nameMatch = sheetName.trim().match(SHEET_NAME_RE);
    if (!nameMatch) {
      return { sheetName, range: [0, 0], side: null, categoryId: null, rows: [], errors: [] };
    }
    const start = Number(nameMatch[1]);
    const end = nameMatch[2] !== undefined ? Number(nameMatch[2]) : start;
    const range: [number, number] = [start, end];
    const size = end - start + 1;
    const side = sideForRange(start, end);
    const categoryId = categoryIdForSize(size, categories);
    const { rows, errors } = parseSheetRows(wb.Sheets[sheetName]);
    return { sheetName, range, side, categoryId, rows, errors };
  });
}

export function poolId(categoryId: string, side: 'begin' | 'end'): string {
  return `${categoryId}_${side}`;
}
