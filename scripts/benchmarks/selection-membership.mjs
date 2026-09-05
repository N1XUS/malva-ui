/**
 * Benchmark for issue #67 -- the evidence behind "no Set fast path was added".
 *
 * Run: `node scripts/benchmarks/selection-membership.mjs` (no build required).
 * Committed so the decision stays falsifiable: anyone who thinks the linear
 * scan in `MlvSelectionService` should be an index can re-run this and argue
 * with numbers. Referenced from `.claude/projects/libs-form-utils.md`.
 *
 * Question: does replacing `MlvSelectionService`'s linear membership scan with
 * a Set/Map-backed index pay for itself at the sizes a *selection service*
 * actually sees?
 *
 * The unit of work is a "cycle": the selection changes (invalidating any
 * index), then Q membership queries are answered before it changes again.
 *
 *   A (current)  Q x findIndex over R,  `===` per element, short-circuits on a hit.
 *   B (indexed)  one hazard scan over R + one Map build over R, then Q x Map.get.
 *   C (naive)    Q x (hazard scan + Map build + one get) -- an index built per query.
 *
 * B's build cost is charged once per cycle, which is the MOST favourable
 * accounting for it. The hazard scan is included because correctness requires
 * it (see reconciliation.ts `identitySets`) -- leaving it out would flatter B.
 */

const ITERATIONS_TARGET_MS = 220;

/** `NaN` -- the only value on which `===` and SameValueZero disagree. */
function isNaNValue(value) {
  return typeof value === 'number' && Number.isNaN(value);
}

const defaultCompareWith = (a, b) => a === b;

// ─── A: the current linear scan ─────────────────────────────────────────────

function indexOfScan(values, value, compare) {
  return values.findIndex((v) => compare(v, value));
}

// ─── B: a cached, hazard-guarded index ──────────────────────────────────────

/** Returns a Map value -> first index, or `null` on a hazard (pairwise then). */
function buildIndex(values, compare) {
  if (compare !== defaultCompareWith && compare !== Object.is) return null;
  const isHazard = compare === defaultCompareWith ? isNaNValue : isNegativeZero;
  const map = new Map();
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (isHazard(v)) return null;
    if (!map.has(v)) map.set(v, i);
  }
  return map;
}

function isNegativeZero(value) {
  return typeof value === 'number' && value === 0 && 1 / value === -Infinity;
}

function indexOfIndexed(map, values, value, compare) {
  if (map === null || isNaNValue(value))
    return indexOfScan(values, value, compare);
  const hit = map.get(value);
  return hit === undefined ? -1 : hit;
}

// ─── Harness ────────────────────────────────────────────────────────────────

function timeIt(fn) {
  // Warm up so V8 re-tiers the hot callback (see reconciliation.ts's note on
  // the cold/warm crossover spread).
  for (let i = 0; i < 2000; i++) fn(i);

  let n = 64;
  for (;;) {
    const t0 = process.hrtime.bigint();
    let sink = 0;
    for (let i = 0; i < n; i++) sink += fn(i);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms >= ITERATIONS_TARGET_MS) {
      return { nsPerCycle: (ms * 1e6) / n, sink };
    }
    n *= 2;
    if (n > 1 << 26) return { nsPerCycle: (ms * 1e6) / n, sink };
  }
}

/** Selections of strings; queries deliberately MISS so neither side short-circuits. */
function makeCase(R, Q, { hitRate = 0, hitAt } = {}) {
  const values = Array.from({ length: R }, (_, i) => `value-${i}`);
  const queries = Array.from({ length: Q }, (_, i) => {
    if (i / Q >= hitRate) return `miss-${i}`;
    // Spread hits across the array so the scan's short-circuit is exercised at
    // every depth, not parked on values[0].
    const at =
      hitAt === undefined
        ? Math.floor((((i * 7919 + 13) % 1000) / 1000) * R)
        : hitAt(R);
    return values[Math.min(at, R - 1)];
  });
  return { values, queries };
}

function benchCycle(R, Q, opts) {
  const { values, queries } = makeCase(R, Q, opts);

  const a = timeIt(() => {
    let acc = 0;
    for (let q = 0; q < queries.length; q++) {
      acc += indexOfScan(values, queries[q], defaultCompareWith);
    }
    return acc;
  });

  const b = timeIt(() => {
    const map = buildIndex(values, defaultCompareWith);
    let acc = 0;
    for (let q = 0; q < queries.length; q++) {
      acc += indexOfIndexed(map, values, queries[q], defaultCompareWith);
    }
    return acc;
  });

  const c = timeIt(() => {
    let acc = 0;
    for (let q = 0; q < queries.length; q++) {
      const map = buildIndex(values, defaultCompareWith);
      acc += indexOfIndexed(map, values, queries[q], defaultCompareWith);
    }
    return acc;
  });

  return { a: a.nsPerCycle, b: b.nsPerCycle, c: c.nsPerCycle };
}

function pad(s, w) {
  return String(s).padStart(w);
}

console.log(`node ${process.version}\n`);

// ── Part 1: Q = 1 (what the repo actually does: one query per gesture) ──────

console.log(
  'Part 1 — Q = 1 query per selection change (the real call pattern)',
);
console.log(
  'all queries MISS, so the scan runs its full length — best case for the index\n',
);
console.log(
  `${pad('R', 8)} ${pad('A scan ns', 12)} ${pad('B indexed ns', 14)} ${pad('B/A', 8)}`,
);
for (const R of [1, 2, 4, 8, 16, 32, 57, 128, 512, 2048, 10000]) {
  const { a, b } = benchCycle(R, 1);
  console.log(
    `${pad(R, 8)} ${pad(a.toFixed(1), 12)} ${pad(b.toFixed(1), 14)} ${pad((b / a).toFixed(2) + 'x', 8)}`,
  );
}

// ── Part 2: crossover in Q, per R ───────────────────────────────────────────

console.log(
  '\nPart 2 — crossover: how many queries per selection change before B wins',
);
console.log(
  '(all queries miss; B pays one hazard scan + one Map build per cycle)\n',
);
console.log(`${pad('R', 8)} ${pad('crossover Q', 13)}`);
for (const R of [4, 8, 16, 32, 57, 128, 512, 2048, 10000]) {
  let crossover = null;
  for (const Q of [
    1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256, 512,
  ]) {
    const { a, b } = benchCycle(R, Q);
    if (b < a) {
      crossover = Q;
      break;
    }
  }
  console.log(`${pad(R, 8)} ${pad(crossover ?? '> 512', 13)}`);
}

// ── Part 3: the naive per-query index (no caching) ──────────────────────────

console.log('\nPart 3 — C: an index rebuilt per query (no signal cache)\n');
console.log(
  `${pad('R', 8)} ${pad('A scan ns', 12)} ${pad('C naive ns', 12)} ${pad('C/A', 8)}`,
);
for (const R of [8, 32, 57, 512]) {
  const { a, c } = benchCycle(R, 8);
  console.log(
    `${pad(R, 8)} ${pad(a.toFixed(1), 12)} ${pad(c.toFixed(1), 12)} ${pad((c / a).toFixed(2) + 'x', 8)}`,
  );
}

// ── Part 4: hits near the head (the common case: value already selected) ────

console.log('\nPart 4 — Q = 1, query HITS -- the scan short-circuits\n');
for (const [label, hitAt] of [
  ['hit at the tail (worst case for the scan)', (R) => R - 1],
  ['hit at the midpoint', (R) => Math.floor(R / 2)],
  ['hit at the head', () => 0],
]) {
  console.log(`  ${label}`);
  console.log(
    `  ${pad('R', 8)} ${pad('A scan ns', 12)} ${pad('B indexed ns', 14)} ${pad('B/A', 8)}`,
  );
  for (const R of [8, 32, 57, 512, 2048]) {
    const { a, b } = benchCycle(R, 1, { hitRate: 1, hitAt });
    console.log(
      `  ${pad(R, 8)} ${pad(a.toFixed(1), 12)} ${pad(b.toFixed(1), 14)} ${pad((b / a).toFixed(2) + 'x', 8)}`,
    );
  }
  console.log('');
}
