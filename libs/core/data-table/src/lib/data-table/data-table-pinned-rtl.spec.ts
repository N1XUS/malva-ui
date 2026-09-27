import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvDataTable } from './data-table';
import type { MlvDataRow, MlvDataTableColumn } from '../types';

// `sass` and `postcss` are Node-only dependencies; loading them through
// `createRequire` keeps them out of the browser-ish module graph vitest builds
// for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// The `@nx/vitest:test` executor runs with cwd = workspace root, so the path is
// resolved from this file rather than from `process.cwd()`.
const TABLE_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './data-table.scss',
);

const CELL = '.mlv-data-table__cell';
const INSET = 'var(--mlv-dt-pinned-inset)';

/** Declarations of every top-level rule whose selector list names `selector`. */
function declarations(css: string, selector: string): Map<string, string> {
  const found = new Map<string, string>();
  let matched = false;
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type !== 'root') return;
    if (!rule.selectors.some((s) => s.trim() === selector)) return;
    matched = true;
    rule.walkDecls((decl) => {
      found.set(decl.prop, decl.value);
    });
  });
  expect(matched, `no rule for \`${selector}\``).toBe(true);
  return found;
}

/**
 * A scrim gradient's direction in degrees, `[0, 360)`, for one value of
 * `--mlv-inline-direction`. `to right` is 90.
 */
function scrimAngle(gradient: string, sign: 1 | -1): number {
  const physical: Record<string, number> = { 'to right': 90, 'to left': 270 };
  const first = gradient
    .slice(gradient.indexOf('(') + 1)
    .split(',')[0]
    .trim();
  if (first in physical) return physical[first];
  const signed = /^calc\((-?\d+)deg \* var\(--mlv-inline-direction\)\)$/.exec(
    first,
  );
  if (!signed) throw new Error(`unexpected gradient direction \`${first}\``);
  const angle = Number(signed[1]) * sign;
  return ((angle % 360) + 360) % 360;
}

/**
 * A pinned column is `position: sticky` (inline, from `getCellStyle`) and its
 * offset — a running sum of logical widths from the pinned edge — reaches the
 * stylesheet as `--mlv-dt-pinned-inset`. The stylesheet puts that on the
 * **physical** side the cell's own `:dir()` resolves to: physical because
 * `.claude/rules/rtl.md`'s sticky row forbids a logical sticky inline inset, and
 * `:dir()` because `[dir='rtl'] &` would also match an LTR island inside an RTL
 * document, whose `<html dir>` `MlvRtlService` always writes.
 */
describe('data-table.scss — pinned columns (#341)', () => {
  const css = stripCssLayersFromText(sass.compile(TABLE_SCSS).css);

  it('pins a start column to the left in LTR and to the right in RTL', () => {
    const ltr = declarations(css, `${CELL}--pinned-left`);
    const rtl = declarations(css, `${CELL}--pinned-left:dir(rtl)`);

    expect(ltr.get('left')).toBe(INSET);
    expect(ltr.has('right')).toBe(false);
    expect(rtl.get('left')).toBe('auto');
    expect(rtl.get('right')).toBe(INSET);
  });

  it('pins an end column to the right in LTR and to the left in RTL', () => {
    const ltr = declarations(css, `${CELL}--pinned-right`);
    const rtl = declarations(css, `${CELL}--pinned-right:dir(rtl)`);

    expect(ltr.get('right')).toBe(INSET);
    expect(ltr.has('left')).toBe(false);
    expect(rtl.get('right')).toBe('auto');
    expect(rtl.get('left')).toBe(INSET);
  });

  it('shades the scrollable side of the pinned edge in both directions', () => {
    // The scrim sits at the column's inline-end (start-pinned) or inline-start
    // (end-pinned) edge and must darken next to the column, fading away from it.
    const start = declarations(css, `${CELL}--pinned-left::after`);
    const end = declarations(css, `${CELL}--pinned-right::after`);

    expect(start.get('inset-inline-end')).toBe('-0.5rem');
    expect(scrimAngle(start.get('background') ?? '', 1)).toBe(90);
    expect(scrimAngle(start.get('background') ?? '', -1)).toBe(270);

    expect(end.get('inset-inline-start')).toBe('-0.5rem');
    expect(scrimAngle(end.get('background') ?? '', 1)).toBe(270);
    expect(scrimAngle(end.get('background') ?? '', -1)).toBe(90);
  });

  it('corrects the end-pinned header and footer for the scrollbar gutter', () => {
    // The body viewport's scrollbar sits at its inline end in both directions,
    // so the correction belongs to the end side, not to the physical right.
    // A custom property keeps its source whitespace, so compare it squeezed.
    const correction = declarations(
      css,
      '.mlv-data-table__table--virtual-header',
    ).get('--mlv-dt-pinned-end-correction');
    expect(correction?.replace(/\s+/g, '')).toBe(
      'var(--mlv-dt-virtual-scrollbar-gutter,0px)',
    );
    expect(css).not.toMatch(/--mlv-dt-pinned-(left|right)-correction/);
  });

  it('keeps the sticky virtual viewport inset physical, side from :dir()', () => {
    // `.claude/rules/rtl.md`'s sticky row: `position: sticky` must not meet a
    // logical inline inset in one rule.
    const ltr = declarations(css, '.mlv-data-table__virtual-viewport');
    const rtl = declarations(css, '.mlv-data-table__virtual-viewport:dir(rtl)');

    expect(ltr.get('position')).toBe('sticky');
    expect(ltr.get('left')).toBe('0');
    expect(
      [...ltr.keys()].some((prop) => prop.startsWith('inset-inline')),
    ).toBe(false);
    expect(rtl.get('left')).toBe('auto');
    expect(rtl.get('right')).toBe('0');
  });

  it('falls back to a logical inset where :dir() is unsupported', () => {
    // Chromium / Edge 119 are in Angular 22's default browserslist and drop
    // every `:dir(rtl)` rule. Their fallback must reset the physical side
    // *before* the logical inset (in LTR both land on the same side, so the
    // later one wins), declare no `position`, and follow the base rules in
    // source order, since the selectors weigh the same.
    const root = postcss.parse(css);
    const blocks: Postcss.AtRule[] = [];
    root.walkAtRules('supports', (at) => {
      if (at.params.trim() === 'not selector(:dir(rtl))') blocks.push(at);
    });
    expect(blocks.length).toBeGreaterThan(0);

    const fallback = (selector: string): string[] => {
      const found: string[] = [];
      for (const block of blocks) {
        block.walkRules((rule) => {
          if (rule.selector.trim() !== selector) return;
          rule.walkDecls((decl) => {
            found.push(`${decl.prop}: ${decl.value}`);
          });
          // Placed after the base rule it overrides.
          const base = root.nodes.findIndex(
            (node) => node.type === 'rule' && node.selector.trim() === selector,
          );
          expect(base, selector).toBeGreaterThanOrEqual(0);
          expect(root.index(block), selector).toBeGreaterThan(base);
        });
      }
      return found;
    };

    expect(fallback(`${CELL}--pinned-left`)).toEqual([
      'left: auto',
      `inset-inline-start: ${INSET}`,
    ]);
    expect(fallback(`${CELL}--pinned-right`)).toEqual([
      'right: auto',
      `inset-inline-end: ${INSET}`,
    ]);
    expect(fallback('.mlv-data-table__virtual-viewport')).toEqual([
      'left: auto',
      'inset-inline-start: 0',
    ]);
  });

  it('never pairs position: sticky with a logical inline inset in one rule', () => {
    // The workspace guard (`sticky-inline-inset.spec.mjs`) reads sources and
    // skips any it cannot parse — `data-table.scss` among them — so the same
    // predicate is asserted here on the compiled stylesheet.
    const offenders: string[] = [];
    const stickySelectors: string[] = [];
    postcss.parse(css).walkRules((rule) => {
      let sticky = false;
      let inset: string | null = null;
      rule.walkDecls((decl) => {
        if (decl.prop === 'position' && /\bsticky\b/.test(decl.value)) {
          sticky = true;
        }
        if (/^inset-inline(-start|-end)?$/.test(decl.prop)) inset = decl.prop;
      });
      if (sticky) stickySelectors.push(rule.selector);
      if (sticky && inset) offenders.push(`${rule.selector} { ${inset} }`);
    });
    // A relocated sticky rule would otherwise leave the check vacuous.
    expect(stickySelectors).toContain('.mlv-data-table__virtual-viewport');
    expect(offenders).toEqual([]);
  });
});

const ROWS: MlvDataRow[] = [
  { id: 1, code: 'A-1', name: 'Alice', amount: 10 },
  { id: 2, code: 'B-2', name: 'Bob', amount: 20 },
];

@Component({
  imports: [MlvDataTable],
  template: `<div class="scope">
    <mlv-data-table [data]="data" [columns]="columns" />
  </div>`,
})
class PinnedHost {
  readonly data = ROWS;
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', pinned: true, pinSide: 'left', width: '80px' },
    {
      key: 'code',
      title: 'Code',
      pinned: true,
      pinSide: 'left',
      width: '60px',
    },
    { key: 'name', title: 'Name' },
    {
      key: 'amount',
      title: 'Amount',
      pinned: true,
      pinSide: 'right',
      width: '110px',
    },
  ];
}

/**
 * The rendered half. jsdom does no sticky layout, so which physical inset a
 * pinned cell ends up with is resolved from the rules of the shipped
 * stylesheet that match it: the `:dir(rtl)` rule follows the plain one in
 * source order and outranks it, so the last matching rule declaring the
 * property is the winner.
 */
describe('MlvDataTable pinned columns — direction (#341)', () => {
  let style: HTMLStyleElement;
  let host: HTMLElement;
  let table: MlvDataTable;

  beforeEach(async () => {
    style = document.createElement('style');
    style.textContent = sass.compile(TABLE_SCSS).css;
    document.head.appendChild(style);

    await TestBed.configureTestingModule({
      imports: [PinnedHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    style.remove();
    // Direction is global state: `MlvRtlService` writes it onto <html>, which
    // outlives the TestBed injector.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  async function render(scopeDir: 'rtl' | 'ltr' | null): Promise<void> {
    const fixture = TestBed.createComponent(PinnedHost);
    host = fixture.nativeElement as HTMLElement;
    table = fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
    const scope = host.querySelector('.scope') as HTMLElement;
    if (scopeDir) scope.setAttribute('dir', scopeDir);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The value the last matching top-level rule declares for `prop`. */
  function resolvedInset(el: Element, prop: 'left' | 'right'): string {
    let value = '';
    for (const rule of style.sheet?.cssRules ?? []) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const declared = rule.style.getPropertyValue(prop);
      if (!declared) continue;
      const matches = rule.selectorText
        .split(/,(?![^(]*\))/)
        .map((selector) => selector.trim())
        .filter((selector) => !selector.includes('::'))
        .some((selector) => {
          try {
            return el.matches(selector);
          } catch {
            return false;
          }
        });
      if (matches) value = declared;
    }
    return value;
  }

  /** The first data row's pinned cells, in DOM order. */
  function pinnedCells(side: 'left' | 'right'): HTMLElement[] {
    const row = host.querySelector('.mlv-data-table__row--data');
    if (!row) throw new Error('no data row rendered');
    return [...row.querySelectorAll<HTMLElement>(`${CELL}--pinned-${side}`)];
  }

  it('writes the offset as a custom property, never a physical inset', async () => {
    await render('rtl');

    // jsdom's CSSOM drops a `left: calc(… var() …)` it cannot parse, so the
    // rendered `style` could never show a physical inset; the object the
    // cells are bound to can.
    for (const column of table.visibleColumns().filter((c) => c.pinned)) {
      const keys = Object.keys(table.getCellStyle(column));
      expect(keys, column.key).toContain('--mlv-dt-pinned-inset');
      expect(keys, column.key).not.toContain('left');
      expect(keys, column.key).not.toContain('right');
    }

    const [id, code] = pinnedCells('left');
    const [amount] = pinnedCells('right');
    for (const cell of [id, code, amount]) {
      expect(cell.style.position).toBe('sticky');
    }
    expect(id.style.getPropertyValue('--mlv-dt-pinned-inset')).toBe(
      'calc(0px + var(--mlv-dt-pinned-start-correction, 0px))',
    );
    // The second start-pinned column is offset by the first one's width.
    expect(code.style.getPropertyValue('--mlv-dt-pinned-inset')).toMatch(
      /^calc\(\d+(\.\d+)?px \+ var\(--mlv-dt-pinned-start-correction, 0px\)\)$/,
    );
    expect(amount.style.getPropertyValue('--mlv-dt-pinned-inset')).toBe(
      'calc(0px + var(--mlv-dt-pinned-end-correction, 0px))',
    );
  });

  it('sticks start columns to the right inside a scoped [dir="rtl"] while the document stays LTR', async () => {
    await render('rtl');
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    for (const cell of pinnedCells('left')) {
      expect(resolvedInset(cell, 'right')).toBe(INSET);
      expect(resolvedInset(cell, 'left')).toBe('auto');
    }
    for (const cell of pinnedCells('right')) {
      expect(resolvedInset(cell, 'left')).toBe(INSET);
      expect(resolvedInset(cell, 'right')).toBe('auto');
    }
  });

  it('keeps start columns on the left in LTR', async () => {
    await render(null);

    for (const cell of pinnedCells('left')) {
      expect(resolvedInset(cell, 'left')).toBe(INSET);
      expect(resolvedInset(cell, 'right')).toBe('');
    }
    for (const cell of pinnedCells('right')) {
      expect(resolvedInset(cell, 'right')).toBe(INSET);
      expect(resolvedInset(cell, 'left')).toBe('');
    }
  });

  it('keeps start columns on the left in an LTR island inside an RTL document', async () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    await render('ltr');

    const [first] = pinnedCells('left');
    // The document is RTL, so a `[dir='rtl'] &` rule would have matched here
    // and flipped the island; `:dir()` reads the nearest scope instead.
    expect(first.matches('[dir="rtl"] td, [dir="rtl"] th')).toBe(true);
    for (const cell of pinnedCells('left')) {
      expect(resolvedInset(cell, 'left')).toBe(INSET);
      expect(resolvedInset(cell, 'right')).toBe('');
    }
  });

  it('pins the header cells the same way', async () => {
    await render('rtl');

    const headers = [
      ...host.querySelectorAll<HTMLElement>(`th${CELL}--pinned-left`),
    ];
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(header.style.getPropertyValue('--mlv-dt-pinned-inset')).toMatch(
        /--mlv-dt-pinned-start-correction/,
      );
      expect(resolvedInset(header, 'right')).toBe(INSET);
    }
  });
});
