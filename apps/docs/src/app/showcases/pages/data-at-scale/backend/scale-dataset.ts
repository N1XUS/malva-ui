import type { ScaleDatasetConfig, ScaleRow } from './scale-protocol';

/**
 * Deterministic dataset generator for the `data-at-scale` showcase.
 *
 * The showcase claims reproducibility: the same seed must produce byte-identical
 * rows on every machine, in every browser, across reloads — that is what makes
 * the in-page benchmark numbers comparable to themselves. Nothing here may read
 * `Date.now()`, `Math.random()`, the locale, or any other ambient state.
 *
 * Relative imports only: this module is reachable from `scale.worker.ts`, whose
 * bundle is produced without the TypeScript path-alias plugin.
 */

/** Regions a generated account can belong to. Also the `region` column's filter options. */
export const SCALE_REGIONS = [
  'North America',
  'EMEA',
  'APAC',
  'LATAM',
] as const;

/** Industries a generated account can belong to. */
export const SCALE_INDUSTRIES = [
  'Software',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Logistics',
  'Energy',
  'Education',
] as const;

/** Subscription plans, ordered from smallest to largest — the ARR band is derived from the index. */
export const SCALE_PLANS = [
  'Starter',
  'Growth',
  'Business',
  'Enterprise',
] as const;

/** Lifecycle states a generated account can be in. */
export const SCALE_STATUSES = [
  'active',
  'trial',
  'pending',
  'churned',
] as const;

/** @private First word of a generated company name. */
const NAME_ADJECTIVES = [
  'Northwind',
  'Cobalt',
  'Silverline',
  'Granite',
  'Harbor',
  'Lumen',
  'Arcadia',
  'Bluepeak',
  'Ironwood',
  'Meridian',
  'Solstice',
  'Cascade',
  'Vantage',
  'Orbit',
  'Copper',
  'Everline',
  'Pinnacle',
  'Redwood',
  'Sable',
  'Tidewater',
  'Union',
  'Vertex',
  'Wayfarer',
  'Zephyr',
  'Alder',
  'Beacon',
  'Cinder',
  'Dovetail',
  'Ember',
  'Fathom',
  'Glacier',
  'Halcyon',
  'Indigo',
  'Juniper',
  'Kestrel',
  'Lantern',
  'Marlow',
  'Nimbus',
  'Onyx',
  'Quarry',
] as const;

/** @private Second word of a generated company name. */
const NAME_NOUNS = [
  'Analytics',
  'Logistics',
  'Health',
  'Robotics',
  'Foundry',
  'Grid',
  'Studios',
  'Freight',
  'Bio',
  'Capital',
  'Metals',
  'Media',
  'Mobility',
  'Payments',
  'Ceramics',
  'Textiles',
  'Learning',
  'Security',
  'Imaging',
  'Agri',
  'Chemicals',
  'Optics',
  'Rail',
  'Marine',
  'Housing',
  'Insurance',
  'Retail',
  'Utilities',
  'Aviation',
  'Semiconductor',
  'Fibre',
  'Hydro',
] as const;

/** @private Legal-form suffix of a generated company name. */
const NAME_SUFFIXES = [
  'Inc.',
  'Group',
  'Holdings',
  'Labs',
  'Systems',
  'Partners',
  'Industries',
  'Networks',
  'Technologies',
  'Ventures',
] as const;

/** @private Given name of the generated account owner. */
const OWNER_FIRST = [
  'Ada',
  'Bo',
  'Cleo',
  'Dana',
  'Elias',
  'Farrah',
  'Gil',
  'Hana',
  'Ines',
  'Jonas',
  'Kai',
  'Lena',
  'Mateo',
  'Nadia',
  'Omar',
  'Petra',
  'Quinn',
  'Rosa',
  'Silas',
  'Tomas',
  'Ute',
  'Viktor',
  'Wren',
  'Xenia',
  'Yusuf',
  'Zara',
  'Aoife',
  'Bram',
  'Camila',
  'Dieter',
  'Esme',
  'Felix',
] as const;

/** @private Family name of the generated account owner. */
const OWNER_LAST = [
  'Alvarez',
  'Bianchi',
  'Cortez',
  'Duval',
  'Eriksen',
  'Fontaine',
  'Grimaldi',
  'Haugen',
  'Iversen',
  'Jorgensen',
  'Kowalski',
  'Lindqvist',
  'Moreau',
  'Novak',
  'Okafor',
  'Petrov',
  'Quintero',
  'Rossi',
  'Sorensen',
  'Takahashi',
  'Ueda',
  'Varga',
  'Wagner',
  'Ximenes',
  'Yilmaz',
  'Zielinski',
  'Andersen',
  'Beaumont',
  'Castellano',
  'Dubois',
  'Ferreira',
  'Gruber',
] as const;

/** @private Workspace nouns used for child (tree) rows. */
const WORKSPACE_NAMES = [
  'Core Platform',
  'Field Ops',
  'Data Team',
  'Growth',
  'Support Desk',
  'Billing',
  'Research',
  'Partner Portal',
] as const;

/**
 * @private Midnight UTC on 2026-01-01 — the fixed anchor every renewal date is
 * offset from. A generated date must never depend on when the page is opened.
 */
const RENEWAL_ANCHOR_MS = Date.UTC(2026, 0, 1);

/** @private Number of distinct renewal days the generator can draw. */
const RENEWAL_SPAN_DAYS = 730;

/** @private Days subtracted from the anchor for offset `0`. */
const RENEWAL_BACKDATE_DAYS = 180;

/** @private One rendered `YYYY-MM-DD` per offset, built once and reused across every row. */
const RENEWAL_DATES: string[] = [];

/** @private Milliseconds in a day. */
const DAY_MS = 86_400_000;

/**
 * @private Resolves the `YYYY-MM-DD` string for a renewal offset, memoising it.
 *
 * At 100k+ rows the naive form allocates one `Date` and one ISO string per row;
 * there are only {@link RENEWAL_SPAN_DAYS} possible answers, so the table is
 * built once and indexed thereafter.
 */
function renewalDateFor(offset: number): string {
  const cached = RENEWAL_DATES[offset];
  if (cached !== undefined) return cached;
  const iso = new Date(
    RENEWAL_ANCHOR_MS + (offset - RENEWAL_BACKDATE_DAYS) * DAY_MS,
  )
    .toISOString()
    .slice(0, 10);
  RENEWAL_DATES[offset] = iso;
  return iso;
}

/**
 * Creates a seeded pseudo-random generator (mulberry32).
 *
 * Every operation is a 32-bit integer op (`Math.imul`, shifts, xor) followed by
 * one exact division by 2^32, so the stream is bit-identical on every JavaScript
 * engine — unlike `Math.random()`, which is implementation-defined and unseeded.
 *
 * @param seed - Any number; only its low 32 bits are used.
 * @returns A function yielding successive values in `[0, 1)`.
 */
export function createScaleRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @private Draws one element of a pool. */
function pick<T>(pool: readonly T[], draw: number): T {
  return pool[Math.floor(draw * pool.length) % pool.length];
}

/** @private Draws an integer in `[min, max]`. */
function pickInt(min: number, max: number, draw: number): number {
  return min + Math.floor(draw * (max - min + 1));
}

/**
 * @private Lower and upper ARR bound per plan, indexed by {@link SCALE_PLANS}.
 * Kept as a plain table so the money column has a believable, plan-correlated
 * distribution instead of uniform noise.
 */
const ARR_BANDS: readonly (readonly [number, number])[] = [
  [4_800, 24_000],
  [24_000, 90_000],
  [90_000, 320_000],
  [320_000, 1_800_000],
];

/** @private Lower and upper seat count per plan, indexed by {@link SCALE_PLANS}. */
const SEAT_BANDS: readonly (readonly [number, number])[] = [
  [3, 25],
  [25, 120],
  [120, 600],
  [600, 5_000],
];

/**
 * Generates `rowCount` deterministic top-level rows.
 *
 * Each row consumes a **fixed** number of draws from a single stream, so the
 * generator is prefix-stable: `generateScaleRows(s, 400).slice(0, 50)` is
 * exactly `generateScaleRows(s, 50)`. Growing the dataset therefore extends it
 * rather than reshuffling it, which keeps the row-count control on the showcase
 * from looking like a reseed.
 *
 * @param seed - Dataset seed.
 * @param rowCount - Number of top-level rows. Values below one yield an empty array.
 */
export function generateScaleRows(seed: number, rowCount: number): ScaleRow[] {
  const total = Math.max(0, Math.floor(rowCount));
  const rng = createScaleRng(seed);
  const rows: ScaleRow[] = new Array(total);
  for (let index = 0; index < total; index++) {
    // Every draw is unconditional — a branch here would break prefix stability.
    const adjective = pick(NAME_ADJECTIVES, rng());
    const noun = pick(NAME_NOUNS, rng());
    const suffix = pick(NAME_SUFFIXES, rng());
    const first = pick(OWNER_FIRST, rng());
    const last = pick(OWNER_LAST, rng());
    const region = pick(SCALE_REGIONS, rng());
    const industry = pick(SCALE_INDUSTRIES, rng());
    const planIndex = Math.floor(rng() * SCALE_PLANS.length);
    const status = pick(SCALE_STATUSES, rng());
    const seatDraw = rng();
    const arrDraw = rng();
    const healthDraw = rng();
    const renewalDraw = rng();

    const seatBand = SEAT_BANDS[planIndex];
    const arrBand = ARR_BANDS[planIndex];
    rows[index] = {
      id: index + 1,
      ref: `ACC-${String(index + 1).padStart(6, '0')}`,
      account: `${adjective} ${noun} ${suffix}`,
      owner: `${first} ${last}`,
      region,
      industry,
      plan: SCALE_PLANS[planIndex],
      status,
      seats: pickInt(seatBand[0], seatBand[1], seatDraw),
      arr: pickInt(arrBand[0], arrBand[1], arrDraw),
      health: pickInt(0, 100, healthDraw),
      renewalDate: renewalDateFor(
        Math.min(
          RENEWAL_SPAN_DAYS - 1,
          Math.floor(renewalDraw * RENEWAL_SPAN_DAYS),
        ),
      ),
    };
  }
  return rows;
}

/**
 * Returns a copy of `rows` where roughly a third of the accounts carry
 * `_mlvChildren` workspaces — the data table's tree-row marker.
 *
 * Children are drawn from a stream seeded per parent id, so a parent's children
 * do not depend on how many children the accounts before it happened to get.
 * Child ids continue above the highest top-level id, and the parents themselves
 * are returned field-for-field unchanged, so switching tree mode on never
 * changes the flat table underneath it.
 *
 * @param rows - Top-level rows, as returned by {@link generateScaleRows}.
 * @param seed - The same dataset seed the rows were generated with.
 */
export function attachScaleChildren(
  rows: readonly ScaleRow[],
  seed: number,
): ScaleRow[] {
  const out: ScaleRow[] = new Array(rows.length);
  let nextChildId = rows.length + 1;
  for (let index = 0; index < rows.length; index++) {
    const parent = rows[index];
    // 0x9e3779b1 is the 32-bit golden-ratio constant: multiplying the id by it
    // decorrelates neighbouring seeds, so account 41 and 42 do not get
    // near-identical child streams.
    const rng = createScaleRng((seed + Math.imul(parent.id, 0x9e3779b1)) >>> 0);
    const childCount = rng() < 0.65 ? 0 : 1 + Math.floor(rng() * 3);
    if (childCount === 0) {
      out[index] = parent;
      continue;
    }
    const children: ScaleRow[] = new Array(childCount);
    for (let child = 0; child < childCount; child++) {
      const name = pick(WORKSPACE_NAMES, rng());
      const planIndex = Math.floor(rng() * SCALE_PLANS.length);
      const status = pick(SCALE_STATUSES, rng());
      const share = 0.15 + rng() * 0.5;
      const healthDelta = pickInt(-15, 15, rng());
      children[child] = {
        id: nextChildId++,
        ref: `${parent.ref}-W${child + 1}`,
        account: `${parent.account} — ${name}`,
        owner: parent.owner,
        region: parent.region,
        industry: parent.industry,
        plan: SCALE_PLANS[planIndex],
        status,
        seats: Math.max(1, Math.round(parent.seats * share)),
        arr: Math.max(1, Math.round(parent.arr * share)),
        health: Math.min(100, Math.max(0, parent.health + healthDelta)),
        renewalDate: parent.renewalDate,
      };
    }
    out[index] = { ...parent, _mlvChildren: children };
  }
  return out;
}

/** Counts top-level rows plus every nested child. */
export function countScaleRows(rows: readonly ScaleRow[]): number {
  let total = 0;
  for (const row of rows) {
    total++;
    if (row._mlvChildren?.length) total += countScaleRows(row._mlvChildren);
  }
  return total;
}

/** The dataset a {@link ScaleDatasetConfig} describes, plus its true row count. */
export interface ScaleDataset {
  /** Top-level rows, nested when `config.tree` was set. */
  readonly rows: ScaleRow[];
  /** Top-level rows plus every nested child. */
  readonly totalRows: number;
}

/** Builds the dataset a config describes. The only entry point the worker uses. */
export function buildScaleDataset(config: ScaleDatasetConfig): ScaleDataset {
  const flat = generateScaleRows(config.seed, config.rowCount);
  if (!config.tree) return { rows: flat, totalRows: flat.length };
  const nested = attachScaleChildren(flat, config.seed);
  return { rows: nested, totalRows: countScaleRows(nested) };
}
