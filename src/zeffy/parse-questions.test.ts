import { describe, it, expect } from 'vitest';
import { parseQuestions, classifyItem, normalizeGender } from './parse-questions';
import type { ZeffyQuestion } from './types';

const realQuestions: ZeffyQuestion[] = [
  { question: 'Contestant FULL Name', type: 'text', answer: 'Yusuf Karim' },
  { question: 'Contestant Date of Birth', type: 'date', answer: '2008-06-20' },
  { question: 'Gender', type: 'single_select', answer: 'Male' },
  { question: 'Categories', type: 'multi_select', answer: ['5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)'] },
];

describe('normalizeGender', () => {
  it('maps Male/Female case-insensitively', () => {
    expect(normalizeGender('Male')).toBe('male');
    expect(normalizeGender('female')).toBe('female');
  });
  it('returns null for anything else', () => {
    expect(normalizeGender('Other')).toBeNull();
    expect(normalizeGender(undefined)).toBeNull();
    expect(normalizeGender(['Male'])).toBeNull();
  });
});

describe('classifyItem', () => {
  it('recognizes a contest ticket', () => {
    expect(classifyItem('ticket')).toBe('ticket');
  });
  it('recognizes donations and falls back to other', () => {
    expect(classifyItem('donation')).toBe('donation');
    expect(classifyItem('whatever')).toBe('other');
  });
});

describe('parseQuestions', () => {
  it('maps the four known labels to canonical fields', () => {
    const p = parseQuestions(realQuestions);
    expect(p.fullName).toBe('Yusuf Karim');
    expect(p.dateOfBirth).toBe('2008-06-20');
    expect(p.gender).toBe('male');
    expect(p.categories).toEqual(['5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)']);
  });
  it('keeps every answer in byLabel verbatim', () => {
    const p = parseQuestions(realQuestions);
    expect(p.byLabel['Contestant FULL Name']).toBe('Yusuf Karim');
    expect(p.byLabel['Categories']).toHaveLength(3);
  });
  it('wraps a single-string category answer into an array', () => {
    const p = parseQuestions([{ question: 'Categories', type: 'single_select', answer: '1 Juz (Ages 13 and Under)' }]);
    expect(p.categories).toEqual(['1 Juz (Ages 13 and Under)']);
  });
  it('defaults missing fields to null/empty', () => {
    const p = parseQuestions([]);
    expect(p.fullName).toBeNull();
    expect(p.gender).toBeNull();
    expect(p.dateOfBirth).toBeNull();
    expect(p.categories).toEqual([]);
  });
});
