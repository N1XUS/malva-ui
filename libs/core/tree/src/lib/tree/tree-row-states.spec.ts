import { TestBed } from '@angular/core/testing';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { LucideFile, LucideFolder, provideLucideIcons } from '@lucide/angular';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTree } from './tree';
import type { MlvTreeNode } from './tree-node';

/**
 * Selected and disabled row styling, asserted against the rendered tree (#304).
 *
 * Both rules used to target `.mlv-tree__item__content--selected` /
 * `--disabled`, classes nothing stamps — `MlvTreeSubtree` marks the treeitem,
 * `.mlv-tree__item` — so neither matched a single element, while a
 * compiled-CSS check of their colours passed. Every assertion here therefore
 * finds a rule by what it declares and then asks which rendered rows its
 * selector matches.
 *
 * jsdom cascades by source order alone (it ignores specificity), so a spec
 * cannot read a winner from `getComputedStyle` where two rules set one
 * property. The stylesheet is written so it never has to: rules that compete
 * for a row's fill exclude each other, and every state override carries the
 * base selector plus a state ancestor, so it outranks the base in any browser.
 * Those are the two properties asserted.
 */

const NODES: MlvTreeNode<unknown>[] = [
  {
    id: 'selected',
    label: 'Selected',
    data: {},
    icon: 'folder',
    expanded: true,
    children: [
      {
        id: 'selected-child',
        label: 'Child of selected',
        data: {},
        icon: 'folder',
        // Expanded with a child of its own, so it renders a chevron: a rule
        // leaking from a selected parent to every chevron below it must show.
        expanded: true,
        children: [
          {
            id: 'selected-grandchild',
            label: 'Grandchild of selected',
            data: {},
            icon: 'file',
          },
        ],
      },
    ],
  },
  {
    id: 'disabled',
    label: 'Disabled',
    data: {},
    icon: 'folder',
    disabled: true,
    expanded: true,
    children: [
      {
        id: 'disabled-child',
        label: 'Child of disabled',
        data: {},
        icon: 'file',
      },
    ],
  },
  {
    id: 'disabled-selected',
    label: 'Disabled and selected',
    data: {},
    icon: 'file',
    disabled: true,
  },
  { id: 'plain', label: 'Plain', data: {}, icon: 'file' },
];

const ROWS = [
  'Selected',
  'Child of selected',
  'Grandchild of selected',
  'Disabled',
  'Child of disabled',
  'Disabled and selected',
  'Plain',
];

/** Strips `:hover` so a rule's selector can be matched in the hovered state. */
const hovered = (selector: string) => selector.replace(/:hover/g, '');

describe('MlvTree row states', () => {
  let style: HTMLStyleElement;
  let host: HTMLElement;

  beforeEach(async () => {
    style = document.createElement('style');
    style.textContent = compile(
      fileURLToPath(new URL(['.', 'tree.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);

    await TestBed.configureTestingModule({
      imports: [MlvTree],
      providers: [
        provideLucideIcons(LucideFolder, LucideFile),
        provideMlvI18nTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvTree);
    fixture.componentRef.setInput('nodes', NODES);
    // Multi-select, so a disabled node can hold selection alongside another.
    fixture.componentRef.setInput('selectMode', 'multi');
    fixture.detectChanges();
    fixture.componentInstance.setSelection(
      new Set(['selected', 'disabled-selected']),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => style.remove());

  /** Top-level style rules of the compiled stylesheet, in source order. */
  function rules(): CSSStyleRule[] {
    return [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );
  }

  /** Rules declaring `prop: value` exactly, whose selector mentions `scope`. */
  function declaring(prop: string, value: string, scope: string) {
    return rules().filter(
      (rule) =>
        rule.selectorText.includes(scope) &&
        rule.style.getPropertyValue(prop).trim() === value,
    );
  }

  /** The treeitem whose own row is labelled `label`. */
  function item(label: string): HTMLElement {
    const found = [
      ...host.querySelectorAll<HTMLElement>('.mlv-tree__item'),
    ].find(
      (el) =>
        el
          .querySelector(':scope > .mlv-tree__item__content .mlv-tree__label')
          ?.textContent?.trim() === label,
    );
    if (!found) throw new Error(`no rendered row labelled "${label}"`);
    return found;
  }

  /** An element of the row labelled `label` (its content box by default). */
  function part(label: string, selector = ''): HTMLElement {
    const el = item(label).querySelector<HTMLElement>(
      `:scope > .mlv-tree__item__content${selector ? ` ${selector}` : ''}`,
    );
    if (!el) throw new Error(`row "${label}" has no "${selector}"`);
    return el;
  }

  /** Labels of the rows whose `selector`-part `rule` matches, `:hover` ignored. */
  function rowsMatching(rule: CSSStyleRule, selector = ''): string[] {
    return ROWS.filter((label) => {
      const target = item(label).querySelector(
        `:scope > .mlv-tree__item__content${selector ? ` ${selector}` : ''}`,
      );
      return !!target && target.matches(hovered(rule.selectorText));
    });
  }

  it('renders every fixture row, with the state classes on the treeitem', () => {
    for (const label of ROWS) expect(item(label)).toBeTruthy();
    expect(item('Selected').classList).toContain('mlv-tree__item--selected');
    expect(item('Disabled').classList).toContain('mlv-tree__item--disabled');
  });

  it('fills the selected row, and only that row, with the selected-state pair', () => {
    const fill = declaring(
      'background-color',
      'var(--mlv-background-selected)',
      '.mlv-tree',
    );
    expect(fill.map((rule) => rule.selectorText)).toHaveLength(1);
    expect(fill[0].selectorText).not.toContain(':hover');
    expect(fill[0].style.getPropertyValue('color').trim()).toBe(
      'var(--mlv-text-on-selected)',
    );
    // Not its child (the treeitem wraps the nested group), and not a
    // selected row that is also disabled: disabled wins.
    expect(rowsMatching(fill[0])).toEqual(['Selected']);
  });

  it('turns the selected row -selected-hover, not the neutral hover, when pointed at', () => {
    const selectedHover = declaring(
      'background-color',
      'var(--mlv-background-selected-hover)',
      '.mlv-tree',
    ).filter((rule) =>
      rule.selectorText.endsWith('.mlv-tree__item__content:hover'),
    );
    expect(selectedHover).toHaveLength(1);
    expect(selectedHover[0].selectorText).toContain(':hover');
    expect(rowsMatching(selectedHover[0])).toEqual(['Selected']);

    const neutralHover = declaring(
      'background-color',
      'var(--mlv-background-neutral-1-hover)',
      '.mlv-tree__item__content:hover',
    );
    expect(neutralHover).toHaveLength(1);
    // Exclusive with the selected fill and with every disabled row.
    expect(rowsMatching(neutralHover[0])).toEqual([
      'Child of selected',
      'Grandchild of selected',
      'Child of disabled',
      'Plain',
    ]);
  });

  it('gives a disabled row the disabled ink and a not-allowed cursor, never an opacity multiply', () => {
    const disabled = declaring(
      'color',
      'var(--mlv-text-disabled)',
      '.mlv-tree',
    );
    expect(disabled).toHaveLength(1);
    expect(rowsMatching(disabled[0])).toEqual([
      'Disabled',
      'Disabled and selected',
    ]);
    expect(disabled[0].style.getPropertyValue('cursor')).toBe('not-allowed');

    // It outranks the base row rule (which sets `cursor: pointer` and the
    // primary ink) in any browser: the base selector with a state ancestor.
    expect(disabled[0].selectorText.endsWith(' .mlv-tree__item__content')).toBe(
      true,
    );
    expect(getComputedStyle(part('Disabled')).cursor).toBe('not-allowed');
    expect(getComputedStyle(part('Plain')).cursor).toBe('pointer');

    // SF-R4: a disabled surface is declared, not multiplied, and the row keeps
    // its pointer events so the not-allowed cursor can show at all. Checked on
    // every element from the row box up to the tree host — the modifier lives
    // on the treeitem, which also wraps the child group, so dimming it there
    // would dim or disable every enabled descendant row too — and, for a rule
    // keyed on the disabled state, on everything inside the disabled item: its
    // row box and its child group, whose rows are enabled.
    for (const label of ['Disabled', 'Disabled and selected']) {
      const path: Element[] = [];
      for (
        let el: Element | null = part(label);
        el;
        el = el === host ? null : el.parentElement
      )
        path.push(el);
      expect(path.at(-1)).toBe(host);
      const inside = [...item(label).querySelectorAll('*')];

      const offending = rules().filter((rule) => {
        const dims =
          rule.style.getPropertyValue('opacity') !== '' ||
          rule.style.getPropertyValue('pointer-events') === 'none';
        if (!dims) return false;
        const selector = hovered(rule.selectorText);
        return (
          path.some((el) => el.matches(selector)) ||
          (rule.selectorText.includes('--disabled') &&
            inside.some((el) => el.matches(selector)))
        );
      });
      expect(offending.map((rule) => rule.selectorText)).toEqual([]);
    }
  });

  it("strips a disabled row's chevron of its hover fill and pointer cursor", () => {
    const toggle = rules().filter(
      (rule) =>
        rule.selectorText.endsWith('.mlv-tree__toggle') &&
        rule.style.getPropertyValue('background-color').trim() ===
          'transparent',
    );
    expect(toggle).toHaveLength(1);
    expect(rowsMatching(toggle[0], '.mlv-tree__toggle')).toEqual(['Disabled']);
    expect(toggle[0].style.getPropertyValue('cursor')).toBe('inherit');
    expect(toggle[0].style.getPropertyValue('color')).toBe('inherit');
    // Has no `:hover` of its own and carries two state classes above the
    // toggle, so it beats `.mlv-tree__toggle:hover` in the hovered state too.
    expect(toggle[0].selectorText).not.toContain(':hover');
    expect(toggle[0].selectorText).toContain('.mlv-tree__item--disabled');
  });

  it("gives a selected row's chevron the row's hover fill, not a neutral chip", () => {
    const toggleHover = rules().filter(
      (rule) =>
        rule.selectorText.endsWith('.mlv-tree__toggle:hover') &&
        rule.selectorText.includes('--selected'),
    );
    expect(toggleHover).toHaveLength(1);
    expect(
      toggleHover[0].style.getPropertyValue('background-color').trim(),
    ).toBe('var(--mlv-background-selected-hover)');
    // Only the selected row's own chevron — not a selected-and-disabled row,
    // and not a child row under a selected parent, which does render one.
    expect(part('Child of selected', '.mlv-tree__toggle')).toBeTruthy();
    expect(rowsMatching(toggleHover[0], '.mlv-tree__toggle')).toEqual([
      'Selected',
    ]);
  });

  it("colours only the selected row's own icon with the selected ink", () => {
    const icon = rules().filter(
      (rule) =>
        rule.selectorText.endsWith('.mlv-tree__icon') &&
        rule.selectorText.includes('--selected'),
    );
    expect(icon.length).toBeGreaterThan(0);
    for (const rule of icon) {
      // Not every icon below a selected ancestor — the child row's too.
      expect(rowsMatching(rule, '.mlv-tree__icon')).toEqual(['Selected']);
      expect(rule.style.getPropertyValue('color').trim()).toBe(
        'var(--mlv-text-on-selected)',
      );
    }

    const disabledIcon = rules().filter(
      (rule) =>
        rule.selectorText.endsWith('.mlv-tree__icon') &&
        rule.selectorText.includes('--disabled') &&
        !rule.selectorText.includes(':not(.mlv-tree__item--disabled)'),
    );
    expect(disabledIcon).toHaveLength(1);
    expect(disabledIcon[0].style.getPropertyValue('color')).toBe('inherit');
    expect(rowsMatching(disabledIcon[0], '.mlv-tree__icon')).toEqual([
      'Disabled',
      'Disabled and selected',
    ]);
  });
});
