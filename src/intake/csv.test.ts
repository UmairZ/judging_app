import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToPeople, csvRegistrationId } from './csv';

describe('parseCsv', () => {
  it('parses simple rows and trims a trailing newline', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('handles quoted fields with commas, escaped quotes, and newlines', () => {
    expect(parseCsv('name,note\n"Omar, Jr.","said ""hi""\nline2"')).toEqual([
      ['name', 'note'],
      ['Omar, Jr.', 'said "hi"\nline2'],
    ]);
  });
  it('handles CRLF and skips fully empty lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('rowsToPeople', () => {
  const header = ['Full Name', 'Gender', 'DOB', 'Categories'];
  it('maps aliased headers and splits multi-categories on ; and |', () => {
    const r = rowsToPeople([header, ['Fatima Noor', 'Female', '2010-01-05', "1 Juz'; 5 Ajzā'"]]);
    expect(r.errors).toEqual([]);
    expect(r.people).toEqual([
      { fullName: 'Fatima Noor', gender: 'female', dateOfBirth: '2010-01-05', categories: ["1 Juz'", "5 Ajzā'"], line: 2 },
    ]);
  });
  it('tolerates missing optional fields and unknown gender text', () => {
    const r = rowsToPeople([['name', 'category'], ['Omar Ali', '30 Juz']]);
    expect(r.people[0]).toEqual({ fullName: 'Omar Ali', gender: null, dateOfBirth: null, categories: ['30 Juz'], line: 2 });
  });
  it('errors on a missing name and on a header row without a name column', () => {
    const r1 = rowsToPeople([['name', 'gender'], ['', 'male']]);
    expect(r1.people).toEqual([]);
    expect(r1.errors).toEqual([{ line: 2, message: 'missing full name' }]);
    const r2 = rowsToPeople([['foo', 'bar'], ['x', 'y']]);
    expect(r2.errors[0].message).toMatch(/name column/i);
  });
  it('errors on an empty input', () => {
    expect(rowsToPeople([]).errors[0].message).toMatch(/empty/i);
  });
});

describe('csvRegistrationId', () => {
  it('is deterministic, slugged, and dob-qualified', () => {
    expect(csvRegistrationId({ fullName: '  Fatima  Noor ', dateOfBirth: '2010-01-05' })).toBe('csv:fatima-noor:2010-01-05');
    expect(csvRegistrationId({ fullName: 'Omar', dateOfBirth: null })).toBe('csv:omar:nodob');
  });
  it('strips non-alphanumerics from the slug', () => {
    expect(csvRegistrationId({ fullName: "O'Malley, Jr.", dateOfBirth: null })).toBe('csv:o-malley-jr:nodob');
  });
});
