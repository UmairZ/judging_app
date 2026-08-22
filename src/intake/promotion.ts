import { defaultDivisionForCategory, type StructureConfig } from '../domain/structure';

export interface ResolvedCategory {
  categoryId: string;
  label: string;
  rawLabel: string;
  unmapped: boolean;
}

export interface CategoryDivisionPair {
  categoryId: string;
  division: string;
}

export function resolveCategories(
  rawCategories: unknown,
  structure: StructureConfig,
): ResolvedCategory[] {
  const labels: string[] = Array.isArray(rawCategories)
    ? (rawCategories as unknown[]).filter((x): x is string => typeof x === 'string')
    : typeof rawCategories === 'string'
    ? [rawCategories]
    : [];

  return labels.map((rawLabel) => {
    const cat = structure.categories.find(
      (c) =>
        c.zeffyLabels?.some((z) => z.toLowerCase() === rawLabel.toLowerCase()) ||
        c.label.toLowerCase() === rawLabel.toLowerCase() ||
        c.id.toLowerCase() === rawLabel.toLowerCase(),
    );
    return cat
      ? { categoryId: cat.id, label: cat.label, rawLabel, unmapped: false }
      : { categoryId: '', label: rawLabel, rawLabel, unmapped: true };
  });
}

export function buildDefaultDivisions(
  resolved: ResolvedCategory[],
  gender: 'male' | 'female' | null,
  structure: StructureConfig,
): Record<string, string> {
  const divs: Record<string, string> = {};
  for (const r of resolved) {
    if (r.unmapped) continue;
    const cat = structure.categories.find((c) => c.id === r.categoryId);
    if (!cat) continue;
    const d = defaultDivisionForCategory(cat, gender);
    divs[r.categoryId] = d ?? (cat.divisions[0] ?? '');
  }
  return divs;
}

/** Auto-promotion plan for a registration, or null when it needs the manual drawer. */
export function buildPromotion(
  reg: { parsedFields?: Record<string, unknown> },
  structure: StructureConfig,
): { fullName: string; gender: 'male' | 'female' | null; pairs: CategoryDivisionPair[] } | null {
  const parsedFields = reg.parsedFields ?? {};
  const fullName = typeof parsedFields.fullName === 'string' ? parsedFields.fullName.trim() : '';
  if (!fullName) return null;
  const genderRaw = parsedFields.gender;
  const gender: 'male' | 'female' | null = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : null;
  const resolved = resolveCategories(parsedFields.categories, structure);
  if (resolved.length === 0 || resolved.some((r) => r.unmapped)) return null;
  const pairs: CategoryDivisionPair[] = [];
  for (const r of resolved) {
    const cat = structure.categories.find((c) => c.id === r.categoryId);
    if (!cat) return null;
    // No fallback here: a single-division category is unambiguous; a gendered category
    // needs a resolvable gender — otherwise this registration needs the manual drawer.
    const division = cat.divisions.length === 1 ? cat.divisions[0] : defaultDivisionForCategory(cat, gender);
    if (!division) return null;
    pairs.push({ categoryId: r.categoryId, division });
  }
  return { fullName, gender, pairs };
}
