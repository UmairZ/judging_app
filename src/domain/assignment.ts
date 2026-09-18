import type { PoolRow } from '../intake/questionBank';

/**
 * Difficulty weight of a surah-crossing question (display/future-proofing — the
 * operator hasn't fixed the value; with a two-level scale the balancing math
 * only needs the crossing FLAG, which is what the algorithm below uses).
 */
export const SURAH_CROSS_DIFFICULTY = 2;

/**
 * A pool row enriched by the CALLER via the quran module:
 * `juz = getJuz(surah, ayah)`, `crosses = passage contains a line whose surah
 * differs from the start ayah's surah`. This module never touches the dataset.
 */
export interface BankRow extends PoolRow {
  juz: number;
  crosses: boolean;
}

/** Thrown BEFORE any drawing when the pool cannot cover every enrollment — never partial output. */
export class PoolExhaustedError extends Error {
  needed: number;
  available: number;
  constructor(needed: number, available: number) {
    super(`pool exhausted: ${needed} questions needed, only ${available} available`);
    this.name = 'PoolExhaustedError';
    this.needed = needed;
    this.available = available;
  }
}

interface JuzBucket {
  crossing: BankRow[];
  plain: BankRow[];
}

function remaining(b: JuzBucket): number {
  return b.crossing.length + b.plain.length;
}

/** Random removal without replacement (swap-pop keeps it O(1)). */
function draw(arr: BankRow[], rng: () => number): BankRow {
  const i = Math.floor(rng() * arr.length);
  const row = arr[i];
  arr[i] = arr[arr.length - 1];
  arr.pop();
  return row;
}

/**
 * Seeded both-pools draw for ONE pool (spec §3). Pure and deterministic under
 * the injected rng:
 * 1. Rows bucketed by juz, each bucket split into crossing / non-crossing.
 * 2. Contestant order shuffled by the rng; each contestant targets
 *    `perContestant` juz taken round-robin from the pool's sorted juz list via
 *    one shared cyclic cursor (distinct juz while n <= |J|; wrapping only after
 *    all of J is covered; demand spread evenly over the buckets).
 * 3. Draws interleave by question round so the crossing quota stays honest:
 *    a contestant below `ceil(totalCrossingAssigned / contestants)` prefers the
 *    crossing sub-bucket, otherwise the non-crossing one — SECONDARY to the juz
 *    spread (empty preferred sub-bucket -> the other; empty juz bucket -> the
 *    globally largest remaining bucket).
 * 4. Each enrollment's rows are returned juz-ascending (ties: surah, then ayah).
 */
export function assignPool(
  rows: BankRow[],
  enrollmentIds: string[],
  perContestant: number,
  rng: () => number,
): Map<string, BankRow[]> {
  // Exhaustion check UP-FRONT — fail whole, before any drawing.
  const needed = enrollmentIds.length * perContestant;
  if (needed > rows.length) throw new PoolExhaustedError(needed, rows.length);

  const buckets = new Map<number, JuzBucket>();
  for (const row of rows) {
    let bucket = buckets.get(row.juz);
    if (!bucket) {
      bucket = { crossing: [], plain: [] };
      buckets.set(row.juz, bucket);
    }
    (row.crosses ? bucket.crossing : bucket.plain).push(row);
  }
  const juzList = [...buckets.keys()].sort((a, b) => a - b);

  // Contestant order shuffled by the injected rng (Fisher-Yates).
  const order = [...enrollmentIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Round-robin distinct-juz targets over the pool's juz list, one shared
  // cyclic cursor across contestants.
  let cursor = 0;
  const targets = new Map<string, number[]>();
  for (const id of order) {
    const t: number[] = [];
    for (let k = 0; k < perContestant; k++) {
      t.push(juzList[cursor % juzList.length]);
      cursor++;
    }
    targets.set(id, t);
  }

  const assigned = new Map<string, BankRow[]>();
  const crossingCount = new Map<string, number>();
  for (const id of order) {
    assigned.set(id, []);
    crossingCount.set(id, 0);
  }
  let totalCrossingAssigned = 0;
  const contestants = order.length;

  for (let k = 0; k < perContestant; k++) {
    for (const id of order) {
      let bucket = buckets.get(targets.get(id)![k])!;
      if (remaining(bucket) === 0) {
        // Empty juz bucket -> globally largest remaining bucket (ties: lowest juz).
        let best: JuzBucket | null = null;
        let bestSize = 0;
        for (const juz of juzList) {
          const candidate = buckets.get(juz)!;
          const size = remaining(candidate);
          if (size > bestSize) {
            best = candidate;
            bestSize = size;
          }
        }
        bucket = best!; // the up-front check guarantees rows remain somewhere
      }
      const preferCrossing =
        crossingCount.get(id)! < Math.ceil(totalCrossingAssigned / contestants);
      const preferred = preferCrossing ? bucket.crossing : bucket.plain;
      const other = preferCrossing ? bucket.plain : bucket.crossing;
      const row = draw(preferred.length > 0 ? preferred : other, rng);
      assigned.get(id)!.push(row);
      if (row.crosses) {
        crossingCount.set(id, crossingCount.get(id)! + 1);
        totalCrossingAssigned++;
      }
    }
  }

  // Q1 = earliest juz (recitation convention); ties by surah, then ayah.
  for (const list of assigned.values()) {
    list.sort((a, b) => a.juz - b.juz || a.surah - b.surah || a.ayah - b.ayah);
  }
  return assigned;
}
