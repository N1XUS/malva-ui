import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTextarea } from './textarea';

/**
 * Regression specs for issue #365 — "a one-row textarea is the same height at
 * every density".
 *
 * `mlv-input`'s control container is `height: var(--form-ctrl-height)`,
 * border-box, and `.mlv-form-control-wrapper` ramps that variable per density.
 * The textarea sets the container to `height: auto` and sizes it from an inline
 * `min-height` / `max-height` on its scrollbar, which used to be the fixed
 * `--mlv-height-m` plus `1.5em` per extra row — the `em` resolving against the
 * scrollbar's own fixed font size, not the field's ramped one — with the
 * container's border added on top.
 *
 * jsdom resolves neither custom properties nor `calc()`, so these specs
 * evaluate the inline expressions against the ramp the shipped stylesheets
 * declare — read from the compiled wrapper, textarea and scrollbar SCSS and the
 * token sheet, never restated — and assert the **resulting geometry** at the
 * default 16px root: a one-row textarea's container is `mlv-input`'s, each
 * extra row adds one of the field's own line boxes, and the auto-resized field
 * always fits the box its `maxRows` allows.
 *
 * The model assumes the textarea's container override adds no block padding
 * and no border of its own, and that its `min-height` floor is `mlv-input`'s
 * height; a separate spec pins all three on the compiled rule. It does not
 * model Chrome flooring the `0.0625rem` border to whole pixels at other root
 * sizes — the floor is what holds the one-row case there, and the Chrome
 * measurements at 13 / 16 / 20 / 24px roots are in the PR for #365.
 *
 * Nothing here depends on *how* the wrapper picks its density (an ancestor
 * class today, a host density directive after #364) — only on the variables it
 * declares, which every density path resolves on the wrapper.
 */

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBS = resolve(HERE, '../../../../..');

const compile = (path: string) =>
  stripCssLayersFromText(sass.compile(path).css);

const WRAPPER_CSS = compile(
  resolve(
    LIBS,
    'core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss',
  ),
);
const TEXTAREA_CSS = compile(resolve(HERE, 'textarea.scss'));
const SCROLLBAR_CSS = compile(
  resolve(LIBS, 'core/scrollbar/src/lib/scrollbar/scrollbar.scss'),
);
const THEME_SCSS = readFileSync(
  resolve(LIBS, 'styles/src/lib/theme.scss'),
  'utf8',
);

/** Root font size a `rem` resolves against. */
const ROOT_FONT_SIZE_PX = 16;

/** `[selector text, declarations]` of every innermost rule in `css`. */
function rules(css: string): [string, string][] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, head, body]) => [
    head.trim(),
    body,
  ]);
}

/**
 * The declarations of every rule whose selector list contains exactly
 * `selector`, joined — Sass splits a block around a nested rule (`mixins.base`
 * nests `*`), so one source block can be emitted as several.
 */
function ruleBody(css: string, selector: string, declaring: string): string {
  const body = rules(css)
    .filter(([head]) => head.split(/,\s*/).some((s) => s.trim() === selector))
    .map(([, declarations]) => declarations)
    .join('\n');
  expect(
    body.includes(`${declaring}:`),
    `"${selector}" declares ${declaring}`,
  ).toBe(true);
  return body;
}

/** The value `body` declares for `property`, whitespace-collapsed. */
function declared(body: string, property: string): string {
  const match = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body);
  expect(match, `declares ${property}`).not.toBeNull();
  return (match?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

/** A `--mlv-*` token's pixel value, read from the token sheet (all are `rem` literals). */
function tokenPx(name: string): number {
  const match = new RegExp(`${name}:\\s*([\\d.]+)rem;`).exec(THEME_SCSS);
  expect(match, `${name} is a rem token`).not.toBeNull();
  return Number(match?.[1]) * ROOT_FONT_SIZE_PX;
}

/** A value that is a bare `var(--token)` (optionally with a fallback), in pixels. */
function varPx(value: string): number {
  const match = /^var\((--mlv-[\w-]+)/.exec(value);
  expect(match, `"${value}" reads a token`).not.toBeNull();
  return tokenPx(match?.[1] ?? '');
}

/** One density step of the wrapper's ramp, in CSS pixels. */
interface RampStep {
  /** `--form-ctrl-height` — `mlv-input`'s control container height. */
  readonly height: number;
  /** `--form-ctrl-font-size` — the textarea field's font size. */
  readonly fontSize: number;
}

/**
 * The wrapper's ramp per density, read from the compiled stylesheet: the
 * comfortable default on the block itself, every other step on the rule the
 * density mixins emit for it.
 */
function ramp(): Record<string, RampStep> {
  const step = (body: string): RampStep => ({
    height: varPx(declared(body, '--form-ctrl-height')),
    fontSize: varPx(declared(body, '--form-ctrl-font-size')),
  });
  const result: Record<string, RampStep> = {
    comfortable: step(
      ruleBody(WRAPPER_CSS, '.mlv-form-control-wrapper', '--form-ctrl-height'),
    ),
  };
  for (const density of ['tight', 'compact', 'spacious', 'airy']) {
    // Keyed on the wrapper's own modifier (`.mlv-form-control-wrapper[class*="--x"]`
    // from the density mixins, or a plain `--x` modifier), never on a bare
    // `--x`: every density rule names the other four inside its `:not()`.
    const self = new RegExp(
      `\\.mlv-form-control-wrapper(?:\\[class\\*=["']--${density}["']\\]|--${density}\\b)`,
    );
    const match = rules(WRAPPER_CSS).find(
      ([head, body]) => self.test(head) && body.includes('--form-ctrl-height:'),
    );
    expect(
      match,
      `the wrapper ramps --form-ctrl-height at ${density}`,
    ).toBeDefined();
    result[density] = step(match?.[1] ?? '');
  }
  return result;
}

const RAMP = ramp();

const FIELD = ruleBody(TEXTAREA_CSS, '.mlv-textarea__field', 'line-height');

/** `.mlv-textarea__field`'s unitless `line-height`. */
const FIELD_LINE_HEIGHT = Number(declared(FIELD, 'line-height'));

/** `.mlv-textarea__field`'s block padding (top + bottom). */
const FIELD_PADDING_BLOCK_PX =
  2 * varPx(declared(FIELD, 'padding').split(' ')[0]);

/**
 * `.mlv-form-control-wrapper__control-container`'s top + bottom border. The
 * container is `height: auto` around the scrollbar, so the border sits on top
 * of the scrollbar's `min-height`.
 */
const CONTAINER_BORDER_BLOCK_PX = (() => {
  const border = declared(
    ruleBody(
      WRAPPER_CSS,
      '.mlv-form-control-wrapper__control-container',
      'border',
    ),
    'border',
  );
  const match = /^([\d.]+)rem\b/.exec(border);
  expect(match, `"${border}" is a rem border`).not.toBeNull();
  return 2 * Number(match?.[1]) * ROOT_FONT_SIZE_PX;
})();

/** `mlv-scrollbar`'s own font size — what an `em` in its inline style resolves against. */
const SCROLLBAR_FONT_SIZE_PX = varPx(
  declared(ruleBody(SCROLLBAR_CSS, '.mlv-scrollbar', 'font-size'), 'font-size'),
);

/**
 * Resolves an inline `min-height` / `max-height` expression to pixels for one
 * ramp step. Only the ramp variables, rem-literal tokens and the units the
 * textarea may legitimately use are known; anything else throws, so an
 * unexpected token fails the spec instead of evaluating to something plausible.
 */
function resolvePx(expression: string, step: RampStep): number {
  const substituted = expression
    .replace(
      /var\(--form-ctrl-font-size(?:,\s*var\(--mlv-font-size-m\))?\)/g,
      `${step.fontSize}px`,
    )
    .replace(/var\(--form-ctrl-height\)/g, `${step.height}px`)
    // A fixed token does not ramp — it resolves to its own value everywhere.
    .replace(
      /var\((--mlv-[\w-]+)\)/g,
      (_, name: string) => `${tokenPx(name)}px`,
    )
    .replace(
      /(\d*\.?\d+)rem/g,
      (_, n: string) => `${Number(n) * ROOT_FONT_SIZE_PX}`,
    )
    .replace(
      /(\d*\.?\d+)em/g,
      (_, n: string) => `${Number(n) * SCROLLBAR_FONT_SIZE_PX}`,
    )
    .replace(/(\d*\.?\d+)px/g, '$1')
    .replace(/calc\(/g, '(');

  if (!/^[\d.\s+\-*/()]+$/.test(substituted)) {
    throw new Error(
      `Unresolvable expression: "${expression}" → "${substituted}"`,
    );
  }
  return evaluate(substituted);
}

/** Minimal `+ - * / ( )` evaluator over plain numbers (no `eval`). */
function evaluate(source: string): number {
  const tokens = source.match(/\d*\.?\d+|[+\-*/()]/g) ?? [];
  let index = 0;
  const peek = () => tokens[index];
  const next = () => tokens[index++];

  const factor = (): number => {
    const token = next();
    if (token === '(') {
      const value = sum();
      next(); // ')'
      return value;
    }
    if (token === '-') return -factor();
    return Number(token);
  };
  const product = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      value = next() === '*' ? value * factor() : value / factor();
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      value = next() === '+' ? value + product() : value - product();
    }
    return value;
  };
  return sum();
}

/** One line box of the field at a ramp step. */
const lineBox = (step: RampStep) => step.fontSize * FIELD_LINE_HEIGHT;

/**
 * The textarea's own override of `.mlv-form-control-wrapper__control-container`
 * (`height: auto`, zero padding, the `min-height` floor), from the compiled
 * `textarea.scss`.
 */
const CONTAINER_OVERRIDE = ruleBody(
  TEXTAREA_CSS,
  '.mlv-textarea .mlv-form-control-wrapper__control-container',
  'height',
);

/**
 * The control-container height a scrollbar box of `px` produces at a ramp
 * step: the scrollbar plus the container's border, floored at the override's
 * `min-height` (the container is border-box, so the floor includes the border).
 * Block padding is absent by the override spec below.
 */
const containerFor = (px: number, step: RampStep) =>
  Math.max(
    resolvePx(declared(CONTAINER_OVERRIDE, 'min-height'), step),
    px + CONTAINER_BORDER_BLOCK_PX,
  );

const round = (px: number) => Math.round(px * 1000) / 1000;

describe('MlvTextarea — min/max height follow the density ramp (#365)', () => {
  let fixture: ComponentFixture<MlvTextarea>;
  let component: MlvTextarea;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTextarea],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvTextarea);
    component = fixture.componentInstance;
  });

  async function render(inputs: {
    rows?: number;
    minRows?: number;
    maxRows?: number;
  }): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('reads a ramp that actually ramps', () => {
    // Guards the derivation itself: five distinct control heights, so a
    // fixed-step expression cannot satisfy the geometry below by accident.
    expect(new Set(Object.values(RAMP).map((step) => step.height)).size).toBe(
      5,
    );
  });

  it("keeps the container override free of block padding and border, floored at mlv-input's height", () => {
    // `containerFor` models the override as adding nothing but the floor. Block
    // padding or a border here would grow every textarea past `mlv-input`
    // without touching the inline expressions, so pin the rule itself.
    expect(declared(CONTAINER_OVERRIDE, 'padding')).toBe('0');
    expect(CONTAINER_OVERRIDE).not.toMatch(
      /(?:^|[;\s])(?:padding-(?:top|bottom|block)[\w-]*|border[\w-]*)\s*:/,
    );
    // The floor holds the one-row case where Chrome's whole-pixel border
    // rounding leaves the inline `min-height` short (roots above 16px).
    expect(declared(CONTAINER_OVERRIDE, 'min-height')).toBe(
      'var(--form-ctrl-height)',
    );
  });

  // The expression is linear in the row count, and the clamp margin
  // (`first row - line box - field padding`) does not depend on it, so one row,
  // two rows and `maxRows = 1` per density pin the whole family.
  describe.each(Object.entries(RAMP))('at %s density', (_density, step) => {
    it("gives a one-row textarea mlv-input's control height", async () => {
      await render({ rows: 1 });

      expect(
        round(containerFor(resolvePx(component.minHeightStyle(), step), step)),
      ).toBe(step.height);
    });

    it('adds one field line box for the second row', async () => {
      await render({ rows: 2 });

      expect(
        round(containerFor(resolvePx(component.minHeightStyle(), step), step)),
      ).toBe(round(step.height + lineBox(step)));
    });

    it('caps maxRows on the same geometry, never below the auto-resized field', async () => {
      await render({ maxRows: 1 });
      const max = component.maxHeightStyle();
      expect(max).toBeDefined();
      const maxPx = resolvePx(max ?? '', step);

      expect(round(containerFor(maxPx, step))).toBe(step.height);
      // `_clampToRows()` caps the auto-resized field at maxRows line boxes plus
      // its block padding. A scrollbar box shorter than that lets the field
      // (the scroll box) spill out of the control container.
      expect(maxPx).toBeGreaterThanOrEqual(
        lineBox(step) + FIELD_PADDING_BLOCK_PX,
      );
    });
  });

  it('lets minRows set the floor on the same geometry', async () => {
    // Tight: the smallest step, where a fixed-size expression is furthest off.
    const step = RAMP['tight'];
    await render({ rows: 5, minRows: 2 });

    expect(
      round(containerFor(resolvePx(component.minHeightStyle(), step), step)),
    ).toBe(round(step.height + lineBox(step)));
  });

  it('writes no max-height without maxRows', async () => {
    await render({ rows: 3 });

    expect(component.maxHeightStyle()).toBeUndefined();
  });

  it('binds both expressions on an element inside the wrapper that declares the ramp', async () => {
    await render({ rows: 3, maxRows: 6 });
    const host = fixture.nativeElement as HTMLElement;
    const scrollbar = host.querySelector<HTMLElement>(
      '.mlv-textarea__scrollbar',
    );

    // `var()` resolves against the element that carries the declaration, so the
    // inline style must sit below `.mlv-form-control-wrapper`, where every
    // density path lands `--form-ctrl-height` / `--form-ctrl-font-size`.
    expect(scrollbar?.closest('.mlv-form-control-wrapper')).not.toBeNull();
    expect(scrollbar?.getAttribute('style')).toContain(
      `min-height: ${component.minHeightStyle()}`,
    );
    expect(scrollbar?.getAttribute('style')).toContain(
      `max-height: ${component.maxHeightStyle()}`,
    );
  });
});
