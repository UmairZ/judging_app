import { describe, it, expect } from 'vitest';
import { assignPool, PoolExhaustedError, type BankRow } from './assignment';

/** Deterministic PRNG (mulberry32) — same seed, same draw, forever. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

/** Synthetic bank row: identity is (juz, n); surah/ayah crafted so sort ties are exercised. */
function row(juz: number, n: number, crosses = false): BankRow {
  return {
    juz,
    crosses,
    surah: juz * 10 + (n % 3),
    ayah: n,
    ref: `Synthetic ${juz * 10 + (n % 3)}:${n}`,
    text: `row ${juz}/${n}`,
  };
}

/** Pool builder: `perJuz` rows in each of `juzzes`, first `crossingPerJuz` of each marked crossing. */
function pool(juzzes: number[], perJuz: number, crossingPerJuz = 0): BankRow[] {
  const rows: BankRow[] = [];
  for (const j of juzzes) {
    for (let n = 0; n < perJuz; n++) rows.push(row(j, n, n < crossingPerJuz));
  }
  return rows;
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `e${i + 1}`);
}

function allAssigned(result: Map<string, BankRow[]>): BankRow[] {
  return [...result.values()].flat();
}

describe('assignPool', () => {
  it('property (50 seeds): no reuse, distinct-juz spread, juz-ascending order', () => {
    // 10 contestants x 4 questions from a 60-row 5-juz pool (12 rows/juz, some crossing).
    const rows = pool([1, 2, 3, 4, 5], 12, 4);
    for (const seed of SEEDS) {
      const result = assignPool(rows, ids(10), 4, mulberry32(seed));
      expect(result.size).toBe(10);

      // No row assigned twice across the whole pool.
      const flat = allAssigned(result);
      expect(flat.length).toBe(40);
      expect(new Set(flat.map((r) => r.ref + '#' + r.ayah)).size).toBe(40);

      for (const list of result.values()) {
        expect(list.length).toBe(4);
        // n (4) <= |J| (5): every contestant's rows are of distinct juz.
        expect(new Set(list.map((r) => r.juz)).size).toBe(4);
        // Output sorted juz-ascending, ties by surah then ayah.
        for (let i = 1; i < list.length; i++) {
          const a = list[i - 1];
          const b = list[i];
          const cmp = a.juz - b.juz || a.surah - b.surah || a.ayah - b.ayah;
          expect(cmp).toBeLessThan(0);
        }
      }
    }
  });

  it('property (50 seeds): n > |J| wraps — all juz covered before any duplicates pile up', () => {
    // 7 questions over a 5-juz pool: every juz used, none used 3x before all used 2x.
    const rows = pool([1, 2, 3, 4, 5], 6);
    for (const seed of SEEDS) {
      const result = assignPool(rows, ids(3), 7, mulberry32(seed));
      for (const list of result.values()) {
        expect(list.length).toBe(7);
        const counts = new Map<number, number>();
        for (const r of list) counts.set(r.juz, (counts.get(r.juz) ?? 0) + 1);
        // All 5 juz covered.
        expect(counts.size).toBe(5);
        // 7 = 5 + 2: no juz used 3x before all used 2x (so max count is 2).
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
      }
      // Still no reuse across contestants.
      const flat = allAssigned(result);
      expect(new Set(flat.map((r) => r.ref + '#' + r.ayah)).size).toBe(flat.length);
    }
  });

  it('property (50 seeds): crossing counts per contestant differ by at most 1', () => {
    // 20 crossing / 40 non-crossing (4 + 8 per juz); 12 contestants x 4 = 48 draws
    // forces at least 8 crossing assignments — balance must hold regardless.
    const rows = pool([1, 2, 3, 4, 5], 12, 4);
    for (const seed of SEEDS) {
      const result = assignPool(rows, ids(12), 4, mulberry32(seed));
      const crossingCounts = [...result.values()].map(
        (list) => list.filter((r) => r.crosses).length,
      );
      const max = Math.max(...crossingCounts);
      const min = Math.min(...crossingCounts);
      expect(max - min).toBeLessThanOrEqual(1);
    }
  });

  it('throws PoolExhaustedError up-front (needed 44 > available 40) with no partial output', () => {
    const rows = pool([1, 2, 3, 4, 5], 8); // 40 rows
    let thrown: unknown;
    try {
      assignPool(rows, ids(11), 4, mulberry32(1)); // needs 44
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(PoolExhaustedError);
    const err = thrown as PoolExhaustedError;
    expect(err.needed).toBe(44);
    expect(err.available).toBe(40);
    // Up-front check: the rng was never consulted (no drawing before the throw).
    let rngCalls = 0;
    const countingRng = () => {
      rngCalls++;
      return 0.5;
    };
    expect(() => assignPool(rows, ids(11), 4, countingRng)).toThrow(PoolExhaustedError);
    expect(rngCalls).toBe(0);
  });

  it('property (50 seeds): single-juz pool is plain random with still no reuse', () => {
    const rows = pool([30], 40, 10);
    for (const seed of SEEDS) {
      const result = assignPool(rows, ids(8), 4, mulberry32(seed));
      const flat = allAssigned(result);
      expect(flat.length).toBe(32);
      expect(new Set(flat.map((r) => r.ref + '#' + r.ayah)).size).toBe(32);
      for (const list of result.values()) {
        expect(list.length).toBe(4);
        expect(list.every((r) => r.juz === 30)).toBe(true);
      }
    }
  });

  it('property (50 seeds): deterministic — same seed, identical output', () => {
    const rows = pool([1, 2, 3, 4, 5], 12, 4);
    for (const seed of SEEDS) {
      const a = assignPool(rows, ids(10), 4, mulberry32(seed));
      const b = assignPool(rows, ids(10), 4, mulberry32(seed));
      expect([...a.entries()]).toEqual([...b.entries()]);
    }
  });

  it('different seeds produce different assignments (rng actually steers the draw)', () => {
    const rows = pool([1, 2, 3, 4, 5], 12, 4);
    const a = assignPool(rows, ids(10), 4, mulberry32(1));
    const b = assignPool(rows, ids(10), 4, mulberry32(2));
    expect(JSON.stringify([...a.entries()])).not.toBe(JSON.stringify([...b.entries()]));
  });
});
