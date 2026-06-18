import type { ZeffyQuestion, ParsedFields } from './types';

const LABEL = {
  fullName: 'Contestant FULL Name',
  dateOfBirth: 'Contestant Date of Birth',
  gender: 'Gender',
  categories: 'Categories',
} as const;

export function normalizeGender(answer: unknown): 'male' | 'female' | null {
  if (typeof answer !== 'string') return null;
  const a = answer.trim().toLowerCase();
  return a === 'male' ? 'male' : a === 'female' ? 'female' : null;
}

export function classifyItem(type: string): 'ticket' | 'donation' | 'other' {
  if (type === 'ticket') return 'ticket';
  if (type === 'donation') return 'donation';
  return 'other';
}

function asString(answer: string | string[] | undefined): string | null {
  return typeof answer === 'string' && answer.length > 0 ? answer : null;
}

export function parseQuestions(questions: ZeffyQuestion[]): ParsedFields {
  const byLabel: Record<string, string | string[]> = {};
  for (const q of questions) byLabel[q.question] = q.answer;

  const categoriesRaw = byLabel[LABEL.categories];
  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : typeof categoriesRaw === 'string'
      ? [categoriesRaw]
      : [];

  return {
    byLabel,
    fullName: asString(byLabel[LABEL.fullName]),
    gender: normalizeGender(byLabel[LABEL.gender]),
    dateOfBirth: asString(byLabel[LABEL.dateOfBirth]),
    categories,
  };
}
