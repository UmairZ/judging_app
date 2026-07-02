/** Minimal RFC-4180 CSV parser: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface CsvPerson {
  fullName: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  categories: string[];
  /** 1-based source line (header is line 1) for error reporting. */
  line: number;
}

export interface CsvParseResult {
  people: CsvPerson[];
  errors: { line: number; message: string }[];
}

// Header cell → canonical field. Matching is case-insensitive on the trimmed cell.
const HEADER_ALIASES: Record<string, 'fullName' | 'gender' | 'dateOfBirth' | 'categories'> = {
  'full name': 'fullName', fullname: 'fullName', name: 'fullName', 'contestant name': 'fullName', 'student name': 'fullName',
  gender: 'gender', sex: 'gender',
  'date of birth': 'dateOfBirth', dob: 'dateOfBirth', birthdate: 'dateOfBirth', 'birth date': 'dateOfBirth',
  category: 'categories', categories: 'categories', level: 'categories',
};

function parseGender(raw: string): 'male' | 'female' | null {
  const g = raw.trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'boy' || g === 'brother') return 'male';
  if (g === 'female' || g === 'f' || g === 'girl' || g === 'sister') return 'female';
  return null;
}

/** Interpret parsed rows: first row must be a header containing a name column. */
export function rowsToPeople(rows: string[][]): CsvParseResult {
  if (rows.length === 0) return { people: [], errors: [{ line: 1, message: 'file is empty' }] };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
  if (!header.includes('fullName')) {
    return { people: [], errors: [{ line: 1, message: 'no name column found (accepted headers: name, full name, contestant name)' }] };
  }
  const people: CsvPerson[] = [];
  const errors: { line: number; message: string }[] = [];
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (f: 'fullName' | 'gender' | 'dateOfBirth' | 'categories') => {
      const col = header.indexOf(f);
      return col >= 0 ? (cells[col] ?? '').trim() : '';
    };
    const fullName = get('fullName');
    if (!fullName) { errors.push({ line, message: 'missing full name' }); return; }
    const categories = get('categories').split(/[;|]/).map((c) => c.trim()).filter(Boolean);
    people.push({
      fullName,
      gender: parseGender(get('gender')),
      dateOfBirth: get('dateOfBirth') || null,
      categories,
      line,
    });
  });
  return { people, errors };
}

/** Deterministic id so re-importing the same person is idempotent (create fails → "already imported"). */
export function csvRegistrationId(person: { fullName: string; dateOfBirth: string | null }): string {
  const slug = person.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `csv:${slug || 'unnamed'}:${person.dateOfBirth ?? 'nodob'}`;
}
