export interface Division {
  id: string;
  label: string;
}

export interface Category {
  id: string;
  label: string;
  minQuestions: number;
  divisions: string[];
  zeffyLabels?: string[];
}

export interface StructureConfig {
  divisions: Division[];
  categories: Category[];
}

export interface Slot {
  category: string;
  division: string;
}

export const DEFAULT_STRUCTURE_CONFIG: StructureConfig = {
  divisions: [
    { id: 'brothers', label: 'Brothers' },
    { id: 'sisters', label: 'Sisters' },
    { id: 'combined', label: 'Combined' },
  ],
  categories: [
    { id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers', 'sisters'], zeffyLabels: ['1 Juz (Ages 13 and Under)'] },
    { id: '5', label: "5 Ajzā'", minQuestions: 4, divisions: ['brothers', 'sisters'], zeffyLabels: ['5 Juz (Ages 20 and Under)'] },
    { id: '15', label: "15 Ajzā'", minQuestions: 5, divisions: ['combined'], zeffyLabels: ['15 Juz (Ages 27 and Under)'] },
    { id: '30', label: "30 Ajzā'", minQuestions: 6, divisions: ['combined'], zeffyLabels: ['30 Juz (Ages 35 and Under)'] },
  ],
};

export function generateSlots(s: StructureConfig): Slot[] {
  return s.categories.flatMap((c) => c.divisions.map((division) => ({ category: c.id, division })));
}

export function slotId(slot: Slot): string {
  return `${slot.category}_${slot.division}`;
}

// brothers/sisters convention for gendered categories. ponytail: hardcoded map; make it config if divisions ever stop matching gender.
const GENDER_DIVISION: Record<string, string> = { male: 'brothers', female: 'sisters' };

export function defaultDivisionForCategory(category: Category, gender?: 'male' | 'female' | null): string | null {
  if (category.divisions.length === 1) return category.divisions[0];
  if (gender) {
    const d = GENDER_DIVISION[gender];
    if (d && category.divisions.includes(d)) return d;
  }
  return null;
}
