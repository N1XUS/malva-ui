import { describe, expect, it } from 'vitest';
import {
  SCALE_INDUSTRIES,
  SCALE_PLANS,
  SCALE_REGIONS,
  SCALE_STATUSES,
  attachScaleChildren,
  buildScaleDataset,
  countScaleRows,
  createScaleRng,
  generateScaleRows,
} from './scale-dataset';
import type { ScaleRow } from './scale-protocol';

describe('createScaleRng', () => {
  it('produces the same stream for the same seed', () => {
    const a = createScaleRng(1234);
    const b = createScaleRng(1234);
    const first = Array.from({ length: 16 }, () => a());
    const second = Array.from({ length: 16 }, () => b());
    expect(first).toEqual(second);
  });

  it('produces a different stream for a different seed', () => {
    const a = Array.from({ length: 16 }, createScaleRng(1));
    const b = Array.from({ length: 16 }, createScaleRng(2));
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const rng = createScaleRng(99);
    for (let i = 0; i < 5000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is pinned to known values so a refactor cannot silently reshuffle datasets', () => {
    const rng = createScaleRng(20260902);
    const drawn = [rng(), rng(), rng()].map((n) => Number(n.toFixed(12)));
    expect(drawn).toEqual([0.270908606239, 0.542162501952, 0.799436689122]);
  });
});

describe('generateScaleRows', () => {
  it('generates exactly the requested number of top-level rows', () => {
    expect(generateScaleRows(7, 0)).toHaveLength(0);
    expect(generateScaleRows(7, 1)).toHaveLength(1);
    expect(generateScaleRows(7, 2500)).toHaveLength(2500);
  });

  it('is deterministic for a seed', () => {
    expect(generateScaleRows(42, 500)).toEqual(generateScaleRows(42, 500));
  });

  it('changes with the seed', () => {
    const a = generateScaleRows(42, 200);
    const b = generateScaleRows(43, 200);
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(b.length);
  });

  it('produces a prefix-stable stream, so a bigger dataset extends a smaller one', () => {
    const small = generateScaleRows(11, 50);
    const large = generateScaleRows(11, 400);
    expect(large.slice(0, 50)).toEqual(small);
  });

  it('assigns sequential ids and unique reference codes', () => {
    const rows = generateScaleRows(3, 1000);
    expect(rows.map((row) => row.id)).toEqual(
      Array.from({ length: 1000 }, (_, index) => index + 1),
    );
    expect(new Set(rows.map((row) => row.ref)).size).toBe(1000);
    expect(rows[41].ref).toBe('ACC-000042');
  });

  it('fills every column with a value of the documented type and domain', () => {
    const rows = generateScaleRows(5, 750);
    for (const row of rows) {
      expect(typeof row.account).toBe('string');
      expect(row.account.length).toBeGreaterThan(0);
      expect(typeof row.owner).toBe('string');
      expect(row.owner.length).toBeGreaterThan(0);
      expect(SCALE_REGIONS).toContain(row.region);
      expect(SCALE_INDUSTRIES).toContain(row.industry);
      expect(SCALE_PLANS).toContain(row.plan);
      expect(SCALE_STATUSES).toContain(row.status);
      expect(Number.isInteger(row.seats)).toBe(true);
      expect(row.seats).toBeGreaterThan(0);
      expect(Number.isInteger(row.arr)).toBe(true);
      expect(row.arr).toBeGreaterThan(0);
      expect(row.health).toBeGreaterThanOrEqual(0);
      expect(row.health).toBeLessThanOrEqual(100);
      expect(row.renewalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row._mlvChildren).toBeUndefined();
    }
  });

  it('spreads values across every declared domain rather than pinning one bucket', () => {
    const rows = generateScaleRows(8, 4000);
    expect(new Set(rows.map((row) => row.region)).size).toBe(
      SCALE_REGIONS.length,
    );
    expect(new Set(rows.map((row) => row.plan)).size).toBe(SCALE_PLANS.length);
    expect(new Set(rows.map((row) => row.status)).size).toBe(
      SCALE_STATUSES.length,
    );
    expect(new Set(rows.map((row) => row.account)).size).toBeGreaterThan(1000);
  });

  it('generates a 100k dataset', () => {
    const rows = generateScaleRows(2026, 100_000);
    expect(rows).toHaveLength(100_000);
    expect(rows[99_999].id).toBe(100_000);
  });
});

describe('attachScaleChildren', () => {
  it('leaves the parent rows untouched apart from the children key', () => {
    const flat = generateScaleRows(21, 400);
    const nested = attachScaleChildren(flat, 21);
    expect(nested).toHaveLength(flat.length);
    nested.forEach((row, index) => {
      const { _mlvChildren, ...parent } = row;
      void _mlvChildren;
      const { _mlvChildren: none, ...original } = flat[index];
      void none;
      expect(parent).toEqual(original);
    });
  });

  it('is deterministic for a seed', () => {
    const flat = generateScaleRows(21, 400);
    expect(attachScaleChildren(flat, 21)).toEqual(
      attachScaleChildren(generateScaleRows(21, 400), 21),
    );
  });

  it('gives some but not all accounts children', () => {
    const nested = attachScaleChildren(generateScaleRows(21, 2000), 21);
    const withChildren = nested.filter((row) => row._mlvChildren?.length);
    expect(withChildren.length).toBeGreaterThan(100);
    expect(withChildren.length).toBeLessThan(nested.length);
  });

  it('numbers children above every top-level id and keeps ids unique', () => {
    const nested = attachScaleChildren(generateScaleRows(21, 2000), 21);
    const ids = new Set<number>();
    let children = 0;
    const walk = (rows: readonly ScaleRow[]): void => {
      for (const row of rows) {
        expect(ids.has(row.id)).toBe(false);
        ids.add(row.id);
        for (const child of row._mlvChildren ?? []) {
          expect(child.id).toBeGreaterThan(2000);
          expect(child.ref.startsWith(`${row.ref}-`)).toBe(true);
          children++;
        }
        walk(row._mlvChildren ?? []);
      }
    };
    walk(nested);
    expect(children).toBeGreaterThan(0);
    expect(ids.size).toBe(2000 + children);
  });

  it('keeps every child inside the same domains as its parent columns', () => {
    const nested = attachScaleChildren(generateScaleRows(4, 800), 4);
    for (const parent of nested) {
      for (const child of parent._mlvChildren ?? []) {
        expect(child.region).toBe(parent.region);
        expect(child.owner).toBe(parent.owner);
        expect(SCALE_PLANS).toContain(child.plan);
        expect(SCALE_STATUSES).toContain(child.status);
        expect(child.seats).toBeGreaterThan(0);
        expect(child.arr).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildScaleDataset', () => {
  it('returns flat rows when tree mode is off', () => {
    const built = buildScaleDataset({ seed: 9, rowCount: 300, tree: false });
    expect(built.rows).toEqual(generateScaleRows(9, 300));
    expect(built.totalRows).toBe(300);
  });

  it('returns nested rows and a total that counts children when tree mode is on', () => {
    const built = buildScaleDataset({ seed: 9, rowCount: 300, tree: true });
    expect(built.rows).toHaveLength(300);
    expect(built.totalRows).toBeGreaterThan(300);
    expect(built.totalRows).toBe(countScaleRows(built.rows));
  });

  it('produces identical top-level rows whether or not tree mode is on', () => {
    const flat = buildScaleDataset({ seed: 9, rowCount: 300, tree: false });
    const nested = buildScaleDataset({ seed: 9, rowCount: 300, tree: true });
    nested.rows.forEach((row, index) => {
      const { _mlvChildren, ...parent } = row;
      void _mlvChildren;
      expect(parent).toEqual(flat.rows[index]);
    });
  });
});
