import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDataTable } from './data-table';
import type { MlvDataRow, MlvDataTableColumn } from '../types';

/**
 * Selected-row styling, asserted against a rendered table (#304).
 *
 * A selected row reads the selected-state fill (SF-R1) — `--mlv-background-
 * selected` / `-selected-hover`, the same fill and hover as `mlv-list-item`
 * and `mlv-tree` — and it has to actually render: on an even stripe, and under
 * the pointer, a competing rule used to paint the row instead. It keeps the
 * table's own ink, because `--mlv-text-on-selected` is `mlv-link`'s resting
 * colour and a row hosts consumer links (WCAG 1.4.1).
 *
 * jsdom cascades by source order alone (it ignores specificity), so these
 * specs never read a winner from `getComputedStyle`. The row-fill rules are
 * written to exclude one another, and that exclusivity is what is asserted:
 * for each state, exactly one fill rule matches a given row.
 */

const ROWS: MlvDataRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
  { id: 4, name: 'Dave' },
];

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns"
    selectable="multi"
    striped
    [(selectedRows)]="selectedRows"
  />`,
})
class HostComponent {
  readonly data = ROWS;
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', pinned: true, pinSide: 'left' },
    { key: 'name', title: 'Name' },
  ];
  /** Bob (an even stripe) and Carol (an odd one) are selected. */
  readonly selectedRows = signal(new Set<MlvDataRow>([ROWS[1], ROWS[2]]));
}

/** Strips `:hover` so a rule's selector can be matched in the hovered state. */
const hovered = (selector: string) => selector.replace(/:hover/g, '');

/** Whether `selector` targets the row itself rather than a descendant of it. */
const targetsRow = (selector: string) =>
  /\.mlv-data-table__row[\w-]*(?:\.[\w-]+|:[\w-]+(?:\([^)]*\))?)*$/.test(
    selector,
  );

/**
 * The pinned cell's own resting surface. Every row-state rule for a pinned
 * cell is this selector under a row-state ancestor, so it always outranks it.
 */
const PINNED_BASE = '.mlv-data-table__cell--pinned';

describe('MlvDataTable selected row', () => {
  let style: HTMLStyleElement;
  let host: HTMLElement;

  beforeEach(async () => {
    style = document.createElement('style');
    style.textContent = compile(
      fileURLToPath(
        new URL(['.', 'data-table.scss'].join('/'), import.meta.url),
      ),
    ).css;
    document.head.appendChild(style);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => style.remove());

  /** Top-level style rules of the compiled stylesheet, one entry per selector. */
  function selectors(): { selector: string; rule: CSSStyleRule }[] {
    return [...(style.sheet?.cssRules ?? [])]
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .flatMap((rule) =>
        rule.selectorText.split(/,(?![^(]*\))/).map((selector) => ({
          selector: selector.trim(),
          rule,
        })),
      );
  }

  function row(name: string): HTMLTableRowElement {
    const found = [
      ...host.querySelectorAll<HTMLTableRowElement>(
        '.mlv-data-table__row--data',
      ),
    ].find((tr) => tr.textContent?.includes(name));
    if (!found) throw new Error(`no rendered row for "${name}"`);
    return found;
  }

  function pinnedCell(name: string): HTMLElement {
    const cell = row(name).querySelector<HTMLElement>(
      '.mlv-data-table__cell--pinned',
    );
    if (!cell) throw new Error(`row "${name}" has no pinned cell`);
    return cell;
  }

  /**
   * The fill a rule declares — the `background` shorthand, else the
   * `background-color` longhand. jsdom reports `''` for the shorthand of a
   * rule that sets only the longhand, so reading one alone would drop it.
   */
  function fillOf(rule: CSSStyleRule): string {
    return (
      rule.style.getPropertyValue('background') ||
      rule.style.getPropertyValue('background-color')
    ).trim();
  }

  /** Fill values of every rule matching `el` in the given state. */
  function fills(
    el: Element,
    state: 'rest' | 'hover',
    target: 'row' | 'cell',
  ): string[] {
    return selectors()
      .filter(({ selector, rule }) => {
        if (!fillOf(rule)) return false;
        if (selector.includes('::') || selector === PINNED_BASE) return false;
        if (state === 'rest' && selector.includes(':hover')) return false;
        if ((target === 'row') !== targetsRow(selector)) return false;
        return el.matches(hovered(selector));
      })
      .map(({ rule }) => fillOf(rule))
      .filter((value) => value !== 'inherit');
  }

  it('renders the fixture with Bob on an even stripe and both rows selected', () => {
    expect(row('Bob').matches(':nth-child(even)')).toBe(true);
    expect(row('Carol').matches(':nth-child(odd)')).toBe(true);
    for (const name of ['Bob', 'Carol'])
      expect(row(name).classList).toContain('mlv-data-table__row--selected');
    expect(row('Dave').classList).not.toContain(
      'mlv-data-table__row--selected',
    );
  });

  it('fills a selected row with the selected pair, on an even stripe too', () => {
    for (const name of ['Bob', 'Carol']) {
      expect(fills(row(name), 'rest', 'row')).toEqual([
        'var(--mlv-background-selected)',
      ]);
      expect(fills(pinnedCell(name), 'rest', 'cell')).toEqual([
        'var(--mlv-background-selected)',
      ]);
    }
    // An unselected even row keeps its stripe.
    expect(fills(row('Dave'), 'rest', 'row')).toEqual([
      'var(--mlv-background-sunken)',
    ]);
  });

  it('turns a selected row -selected-hover, not the neutral hover', () => {
    for (const name of ['Bob', 'Carol']) {
      expect(
        fills(row(name), 'hover', 'row').filter(
          (value) => value !== 'var(--mlv-background-selected)',
        ),
      ).toEqual(['var(--mlv-background-selected-hover)']);
      expect(
        fills(pinnedCell(name), 'hover', 'cell').filter(
          (value) => value !== 'var(--mlv-background-selected)',
        ),
      ).toEqual(['var(--mlv-background-selected-hover)']);
    }
    // An unselected odd row still takes the neutral hover.
    expect(fills(row('Alice'), 'hover', 'row')).toEqual([
      'var(--mlv-background-neutral-1-hover)',
    ]);
  });

  it('keeps the table ink on a selected row, so a link inside it stays distinct', () => {
    // `--mlv-text-on-selected` is `mlv-link`'s resting colour: tinting the row
    // would leave a consumer's `<a mlvLink>` cell the colour of the text
    // around it (WCAG 1.4.1). No selection rule may recolour the row or
    // anything inside it, at rest or hovered.
    const bob = row('Bob');
    const inside = [bob, ...bob.querySelectorAll('*')];
    const tinted = selectors().filter(
      ({ selector, rule }) =>
        selector.includes('--selected') &&
        !selector.includes('::') &&
        rule.style.getPropertyValue('color') !== '' &&
        inside.some((el) => el.matches(hovered(selector))),
    );
    expect(tinted.map(({ selector }) => selector)).toEqual([]);
    expect(getComputedStyle(bob).color).toBe(
      getComputedStyle(row('Dave')).color,
    );
  });
});
