import type { ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations, runAxe } from '@malva-ui/internal-testing/axe';
import { MlvList } from '../list/list';
import { MlvListItem } from '../list-item/list-item';
import { MlvListItemGroup } from './list-item-group';

@Component({
  imports: [MlvListItemGroup],
  template: `<mlv-list-item-group label="Group">Content</mlv-list-item-group>`,
})
class TestListItemGroupHostComponent {}

/**
 * A `variant="plain"` list — the collapsible shape. Both groups render a
 * toggler; the first uses the bare `open` attribute, which is the form the
 * library documents for every other boolean input.
 *
 * Each row holds a focusable `<a href>`, because the collapsed group's rows are
 * what #221 is about: a zero-height, `overflow: hidden` box still computes
 * `visibility: visible`, so without help its links stay in the tab order.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list>
      <mlv-list-item-group label="Account" open>
        <mlv-list-item><a href="#profile">Profile</a></mlv-list-item>
      </mlv-list-item-group>
      <mlv-list-item-group label="Network">
        <mlv-list-item><a href="#wifi">Wi-Fi</a></mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class PlainGroupsHost {}

/**
 * A `variant="inset"` list — the shape `apps/docs`' list examples 5 and 8 ship.
 * The variant pins group content open, so no toggler may be rendered.
 *
 * Deliberately **two** shapes, not one. The first group writes the bare `open`
 * attribute the docs examples use, so it is pinned *and* `--toggled`; the
 * second writes nothing, so it is pinned with `_expanded()` false — the shape
 * `list.spec.ts`'s `InsetListGroupsHost` ships, and the one a `!_expanded()`
 * inertness predicate would silently break while the docs-shaped first group
 * kept passing.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list variant="inset">
      <mlv-list-item-group label="Account" open>
        <mlv-list-item><a href="#profile">Profile</a></mlv-list-item>
      </mlv-list-item-group>
      <mlv-list-item-group label="Network">
        <mlv-list-item><a href="#wifi">Wi-Fi</a></mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class InsetGroupsHost {}

function groups(fixture: ComponentFixture<unknown>): MlvListItemGroup[] {
  return fixture.debugElement
    .queryAll(By.directive(MlvListItemGroup))
    .map((debugEl) => debugEl.componentInstance as MlvListItemGroup);
}

describe('MlvListItemGroup', () => {
  let fixture: ComponentFixture<TestListItemGroupHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestListItemGroupHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestListItemGroupHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a collapsible toggler when there is no enclosing list', () => {
    // `libs/core/src/ssr-smoke.spec.ts` renders a group outside any list; it
    // must stay collapsible, because nothing pins its content open.
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mlv-list-item-group__toggler')).not.toBeNull();
    expect(
      host
        .querySelector('mlv-list-item-group')
        ?.classList.contains('mlv-list-item-group--pinned'),
    ).toBe(false);
  });
});

describe('MlvListItemGroup open coercion', () => {
  let fixture: ComponentFixture<PlainGroupsHost>;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PlainGroupsHost],
    }).compileComponents();
    fixture = TestBed.createComponent(PlainGroupsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('resolves the bare `open` attribute to true', () => {
    // The documented attribute form binds the empty string. Without a
    // `coerceBooleanProperty` transform it reads falsy, and the group renders
    // collapsed while the markup says it is open.
    const [openGroup, closedGroup] = groups(fixture);
    expect(openGroup.open()).toBe(true);
    expect(closedGroup.open()).toBe(false);
  });

  it('reflects the coerced state on the host class and aria-expanded', () => {
    const host = fixture.nativeElement as HTMLElement;
    const hosts = [
      ...host.querySelectorAll('mlv-list-item-group'),
    ] as HTMLElement[];
    expect(
      hosts.map((el) => el.classList.contains('mlv-list-item-group--toggled')),
    ).toEqual([true, false]);

    const togglers = [
      ...host.querySelectorAll('.mlv-list-item-group__toggler'),
    ] as HTMLButtonElement[];
    expect(togglers.map((t) => t.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
    ]);
  });

  it('toggles from the coerced state rather than from the raw attribute', async () => {
    // A toggle on a group opened by the bare attribute must close it. When the
    // raw value is `''`, `!value` is `true` and the first click opens it again.
    const host = fixture.nativeElement as HTMLElement;
    const toggler = host.querySelector(
      '.mlv-list-item-group__toggler',
    ) as HTMLButtonElement;
    toggler.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggler.getAttribute('aria-expanded')).toBe('false');
    expect(
      (
        host.querySelector('mlv-list-item-group') as HTMLElement
      ).classList.contains('mlv-list-item-group--toggled'),
    ).toBe(false);
  });

  it('has no axe violations for collapsible groups in a plain list', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

describe('MlvListItemGroup inside variant="inset"', () => {
  let fixture: ComponentFixture<InsetGroupsHost>;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [InsetGroupsHost],
    }).compileComponents();
    fixture = TestBed.createComponent(InsetGroupsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders no toggler at all, because the variant pins the content open', () => {
    // The inset stylesheet pins `__content` to `grid-template-rows: 1fr` and
    // hides the chevron, so a rendered toggler is a `<button aria-expanded>`
    // making a claim about content it does not control — WCAG 4.1.2.
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.mlv-list-item-group__toggler')).toHaveLength(
      0,
    );
    expect(host.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    expect(host.querySelectorAll('button')).toHaveLength(0);
  });

  it('stamps the pinned modifier on every group host', () => {
    const host = fixture.nativeElement as HTMLElement;
    const hosts = [
      ...host.querySelectorAll('mlv-list-item-group'),
    ] as HTMLElement[];
    expect(hosts).toHaveLength(2);
    expect(
      hosts.map((el) => el.classList.contains('mlv-list-item-group--pinned')),
    ).toEqual([true, true]);
  });

  it('renders the section label as inert text that names the content list', () => {
    const host = fixture.nativeElement as HTMLElement;
    const labels = [
      ...host.querySelectorAll('.mlv-list-item-group__label'),
    ] as HTMLElement[];
    expect(labels.map((el) => el.textContent?.trim())).toEqual([
      'Account',
      'Network',
    ]);

    const contents = [
      ...host.querySelectorAll('.mlv-list-item-group__content'),
    ] as HTMLElement[];
    expect(contents.map((el) => el.getAttribute('aria-labelledby'))).toEqual(
      labels.map((el) => el.id),
    );
    expect(labels.every((el) => !!el.id)).toBe(true);
  });

  it('has no axe violations for pinned groups in an inset list', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

// ---------------------------------------------------------------------------
// #221 — collapsed content must leave the tab order and the accessibility tree
// ---------------------------------------------------------------------------

/** The `__content` region of every group in `fixture`, in document order. */
function contentRegions(fixture: ComponentFixture<unknown>): HTMLElement[] {
  return [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll(
      '.mlv-list-item-group__content',
    ),
  ] as HTMLElement[];
}

/**
 * Collapsing the group with `grid-template-rows: 0fr` + `overflow: hidden` +
 * `opacity: 0` hides it from sight and from nothing else: a zero-height,
 * clipped box still computes `visibility: visible`, so AT keeps exposing its
 * rows and sequential focus navigation keeps landing on them — focus with no
 * ring anywhere on screen. `inert` is what removes both, and unlike
 * `visibility` / `display` / `hidden` it is not a rendering property, so it
 * needs no timing against the collapse transition.
 *
 * **What jsdom can and cannot prove.** It implements neither layout nor
 * `inert`: measured, `'inert' in element` is `false` and `.focus()` on a node
 * inside an `inert` subtree still moves `document.activeElement`. So nothing
 * in this file can show that Tab does not reach the link — that is the
 * browser's job. `getComputedStyle` is no help either: measured, this suite
 * never sees the component stylesheet (`__content` computes `display: block`,
 * and `grid-template-rows` / `opacity` come back empty), which is also why a
 * `visibility`-based fix would have been unassertable here. These specs
 * therefore assert the mechanism — which element carries the attribute, in
 * each of the four states — which is the actual contract, not a proxy for it.
 */
describe('MlvListItemGroup collapsed-content inertness (#221)', () => {
  afterEach(async () => {
    await TestBed.resetTestingModule();
  });

  async function mount<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [host],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('marks a collapsed group inert and leaves an expanded one alone', async () => {
    // States 1 and 2: plain list, group one `open`, group two collapsed.
    const fixture = await mount(PlainGroupsHost);
    const [expanded, collapsed] = contentRegions(fixture);

    expect(expanded.hasAttribute('inert')).toBe(false);
    expect(collapsed.hasAttribute('inert')).toBe(true);

    // The rows really are the ones the ticket is about.
    expect(collapsed.querySelector('a[href="#wifi"]')).not.toBeNull();
  });

  it('never marks a pinned group inert, with or without `open`', async () => {
    // States 3 and 4, and the trap. An inset list pins its groups open, so
    // their rows are on screen and interactive — but only the first group here
    // is `_expanded()`, because the docs write the bare `open` attribute and
    // `list.spec.ts`'s `InsetListGroupsHost` does not. The predicate is
    // `_expanded() || _alwaysOpen()`; `!_expanded()` would leave the second
    // group visible and inert, dropping every control in it out of the tab
    // order while the docs-shaped first group went on passing.
    const fixture = await mount(InsetGroupsHost);
    const [pinnedAndOpen, pinnedOnly] = contentRegions(fixture);

    const hosts = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        'mlv-list-item-group',
      ),
    ] as HTMLElement[];
    // Pin the two shapes apart, so a future change that made them identical
    // could not quietly turn this into one assertion made twice.
    expect(
      hosts.map((el) => el.classList.contains('mlv-list-item-group--pinned')),
    ).toEqual([true, true]);
    expect(
      hosts.map((el) => el.classList.contains('mlv-list-item-group--toggled')),
    ).toEqual([true, false]);

    expect(pinnedAndOpen.hasAttribute('inert')).toBe(false);
    expect(pinnedOnly.hasAttribute('inert')).toBe(false);
  });

  it('lifts and reapplies inertness as the user toggles', async () => {
    const fixture = await mount(PlainGroupsHost);
    const collapsed = contentRegions(fixture)[1];
    const toggler = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        '.mlv-list-item-group__toggler',
      ),
    ][1] as HTMLButtonElement;

    expect(collapsed.hasAttribute('inert')).toBe(true);

    toggler.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(toggler.getAttribute('aria-expanded')).toBe('true');
    expect(collapsed.hasAttribute('inert')).toBe(false);

    toggler.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(toggler.getAttribute('aria-expanded')).toBe('false');
    expect(collapsed.hasAttribute('inert')).toBe(true);
  });

  it('puts inertness on the region the toggler says it controls', async () => {
    // `aria-expanded="false"` is a claim about `aria-controls`' target. If the
    // attribute landed on some inner wrapper instead, the two would describe
    // different elements and the disclosure contract would be only half true.
    const fixture = await mount(PlainGroupsHost);
    const toggler = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        '.mlv-list-item-group__toggler',
      ),
    ][1] as HTMLButtonElement;
    const controlled = (fixture.nativeElement as HTMLElement).querySelector(
      `#${toggler.getAttribute('aria-controls')}`,
    ) as HTMLElement;

    expect(toggler.getAttribute('aria-expanded')).toBe('false');
    expect(controlled.hasAttribute('inert')).toBe(true);
  });

  it('marks a standalone collapsed group inert with no enclosing list', async () => {
    // `libs/core/src/ssr-smoke.spec.ts` renders a group outside any list, so
    // `_alwaysOpen()` is false there and the predicate falls through to
    // `_expanded()`. `inert` is a plain attribute, so it is SSR-safe.
    const fixture = await mount(TestListItemGroupHostComponent);
    expect(contentRegions(fixture)[0].hasAttribute('inert')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// #224 — the group's roles are derived from the enclosing list's `listRole`
// ---------------------------------------------------------------------------

/**
 * `<mlv-list listRole="menu">` — the shape `tabs.html:59`, `menu.ts:119`,
 * `drawer-sections.html:16` and `breadcrumb.html:77` already ship.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="menu">
      <mlv-list-item-group label="Account">
        <mlv-list-item itemRole="menuitem">Profile</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class MenuGroupHost {}

/**
 * `<mlv-list listRole="listbox">` — the shape `dropdown-panel.html:35` ships.
 * The listbox is named because a real consumer names it: `mlv-dropdown-panel`
 * binds `[attr.aria-label]="ariaLabel()"` on the same element.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="listbox" aria-label="Fruit">
      <mlv-list-item-group label="Citrus">
        <mlv-list-item itemRole="option">Lemon</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class ListboxGroupHost {}

/** `role="tree"` — the fourth container role whose ARIA children include `group`. */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="tree" aria-label="Files">
      <mlv-list-item-group label="src">
        <mlv-list-item itemRole="treeitem">main.ts</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class TreeGroupHost {}

/**
 * A container role that owns neither `listitem` nor `group` — `tablist` owns
 * `tab` and nothing else, so there is no role the group could claim. It has to
 * emit none and let the rows be seen through it.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="tablist">
      <mlv-list-item-group label="Section">
        <mlv-list-item itemRole="tab">Overview</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class TablistGroupHost {}

/**
 * `<mlv-list listRole="toolbar">` — a container role that requires **no** owned
 * children, so a `<button>` inside it is perfectly legal and the group must
 * stay collapsible. The row takes `itemRole="button"` because `toolbar` is a
 * widget container, not because the group needs it: with the default
 * `itemRole="listitem"` this composition still keeps its toggler and still
 * raises nothing about the button — only `aria-required-parent` about the
 * *row*, which is the pre-existing gap `DefaultItemRoleMenuHost` pins.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="toolbar" aria-label="Formatting">
      <mlv-list-item-group label="Text">
        <mlv-list-item itemRole="button">Bold</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class ToolbarGroupHost {}

/**
 * `<mlv-list listRole="grid">` — a container role that *does* require owned
 * children (`rowgroup` / `row`), so the toggler still has to go. The rows carry
 * a real `row` → `gridcell` structure so the composition is sweepable: measured,
 * this shape is clean, and the same shape with a toggler rendered raises
 * `aria-required-children` on the `mlv-list` naming `button[aria-controls]`.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="grid" aria-label="Files">
      <mlv-list-item-group label="Documents">
        <mlv-list-item itemRole="row"
          ><span role="gridcell">Notes</span></mlv-list-item
        >
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class GridGroupHost {}

/**
 * `variant="inset"` **plus** a `listRole` that requires nothing — the one shape
 * where inset is what suppresses the toggler and the container role is not.
 * Pins the deliberate consequence: the content region has no role to claim
 * there, so it is not named either (see `_contentLabelledBy`).
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="toolbar" variant="inset" aria-label="Formatting">
      <mlv-list-item-group label="Text">
        <mlv-list-item itemRole="button">Bold</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class InsetToolbarGroupHost {}

/**
 * `<mlv-list listRole="menu">` with `mlv-list-item` left at its **default**
 * `itemRole="listitem"` — the composition every other host in this block avoids
 * by hand-picking a container-matching row role.
 *
 * It is not clean, and the sweep below asserts exactly what it raises rather
 * than being handed a role that makes it pass. See that spec for the reasoning.
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list listRole="menu">
      <mlv-list-item-group label="Account">
        <mlv-list-item>Profile</mlv-list-item>
      </mlv-list-item-group>
    </mlv-list>
  `,
})
class DefaultItemRoleMenuHost {}

/** A group outside any list, expanded, holding the rows it is documented to hold. */
@Component({
  imports: [MlvListItem, MlvListItemGroup],
  template: `
    <mlv-list-item-group label="Recent" open>
      <mlv-list-item>Profile</mlv-list-item>
    </mlv-list-item-group>
  `,
})
class StandaloneOpenGroupHost {}

describe('MlvListItemGroup role derivation (#224)', () => {
  async function mount<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [host],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  afterEach(async () => {
    await TestBed.resetTestingModule();
  });

  /** `[host role, content role, toggler count]` for the single group in `fixture`. */
  function shape(
    fixture: ComponentFixture<unknown>,
  ): [string | null, string | null, number] {
    const root = fixture.nativeElement as HTMLElement;
    const groupEl = root.querySelector('mlv-list-item-group') as HTMLElement;
    const content = root.querySelector(
      '.mlv-list-item-group__content',
    ) as HTMLElement;
    return [
      groupEl.getAttribute('role'),
      content.getAttribute('role'),
      root.querySelectorAll('.mlv-list-item-group__toggler').length,
    ];
  }

  it('keeps listitem/list and a toggler under the default listRole="list"', async () => {
    const fixture = await mount(PlainGroupsHost);
    const root = fixture.nativeElement as HTMLElement;
    const groupEls = [
      ...root.querySelectorAll('mlv-list-item-group'),
    ] as HTMLElement[];
    const contents = contentRegions(fixture);

    expect(groupEls.map((el) => el.getAttribute('role'))).toEqual([
      'listitem',
      'listitem',
    ]);
    expect(contents.map((el) => el.getAttribute('role'))).toEqual([
      'list',
      'list',
    ]);
    expect(root.querySelectorAll('.mlv-list-item-group__toggler')).toHaveLength(
      2,
    );
  });

  it('claims no role and groups its rows under listRole="menu"', async () => {
    // `menu` owns group / menuitem / menuitemradio / menuitemcheckbox / menu /
    // separator — never `listitem`. And axe flattens a `group` the container
    // requires, so a toggler `<button>` inside one would be read as a direct
    // owned child of the menu. The group is pinned open instead.
    const fixture = await mount(MenuGroupHost);
    expect(shape(fixture)).toEqual([null, 'group', 0]);
  });

  it('claims no role and groups its rows under listRole="listbox"', async () => {
    // `listbox` owns `group` and `option`. `mlv-dropdown-panel` already renders
    // its own APG listbox groups exactly this way.
    const fixture = await mount(ListboxGroupHost);
    expect(shape(fixture)).toEqual([null, 'group', 0]);
  });

  it('claims no role and groups its rows under listRole="tree"', async () => {
    const fixture = await mount(TreeGroupHost);
    expect(shape(fixture)).toEqual([null, 'group', 0]);
  });

  it('emits no role at all under a container that owns neither listitem nor group', async () => {
    // `tablist` owns only `tab`. Any role the group claimed would be an
    // unallowed owned child, so it claims none and the rows are seen through it.
    const fixture = await mount(TablistGroupHost);
    expect(shape(fixture)).toEqual([null, null, 0]);
  });

  it('drops aria-labelledby when the content region has no role to name', async () => {
    // A roleless element carrying a global ARIA attribute is itself an owned
    // child (axe reads `aria-labelledby` through `getGlobalAriaAttr`), so
    // naming a roleless wrapper reintroduces the violation it was meant to fix.
    const fixture = await mount(TablistGroupHost);
    const content = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-list-item-group__content',
    ) as HTMLElement;
    expect(content.hasAttribute('aria-labelledby')).toBe(false);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-list-item-group__label',
      ),
    ).not.toBeNull();
  });

  it('names the grouped content region from the section label', async () => {
    const fixture = await mount(MenuGroupHost);
    const root = fixture.nativeElement as HTMLElement;
    const label = root.querySelector(
      '.mlv-list-item-group__label',
    ) as HTMLElement;
    const content = root.querySelector(
      '.mlv-list-item-group__content',
    ) as HTMLElement;
    expect(label.textContent?.trim()).toBe('Account');
    expect(content.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('claims no host role with no enclosing list, and keeps its toggler', async () => {
    // `role="listitem"` outside a `list` is a dangling required parent — the
    // shape `libs/core/src/ssr-smoke.spec.ts` renders. Nothing pins the group
    // open here, so the disclosure stays.
    const fixture = await mount(StandaloneOpenGroupHost);
    expect(shape(fixture)).toEqual([null, 'list', 1]);
  });

  it('has no axe violations under listRole="menu"', async () => {
    const fixture = await mount(MenuGroupHost);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations under listRole="listbox"', async () => {
    const fixture = await mount(ListboxGroupHost);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations under listRole="tree"', async () => {
    const fixture = await mount(TreeGroupHost);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations under listRole="tablist"', async () => {
    const fixture = await mount(TablistGroupHost);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations for an expanded group outside any list', async () => {
    const fixture = await mount(StandaloneOpenGroupHost);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  // -------------------------------------------------------------------------
  // The suppression is a closed-set test, not "any listRole but `list`"
  // -------------------------------------------------------------------------

  it('keeps a working toggler under a container role that requires no children', async () => {
    // `toolbar` carries no `requiredOwned`, so `ariaRequiredChildrenEvaluate`
    // returns `true` before it looks at anything and a `<button>` inside it is
    // legal. Suppressing here would turn `listRole="toolbar"` — or a typo like
    // `listRole="lst"` — into every section of that list being permanently
    // expanded, with `toggle()` and `[(open)]` silently inert and no warning.
    //
    // Asserting the element exists is not enough: it has to *work*. The
    // suppressed shape renders a `<div>` with no `aria-expanded` at all, so a
    // presence check alone would also pass on a `__toggler`-classed inert span.
    const fixture = await mount(ToolbarGroupHost);
    expect(shape(fixture)).toEqual([null, null, 1]);

    const root = fixture.nativeElement as HTMLElement;
    const toggler = root.querySelector(
      '.mlv-list-item-group__toggler',
    ) as HTMLButtonElement;
    const content = root.querySelector(
      '.mlv-list-item-group__content',
    ) as HTMLElement;
    const groupEl = root.querySelector('mlv-list-item-group') as HTMLElement;

    expect(toggler.getAttribute('aria-expanded')).toBe('false');
    expect(content.hasAttribute('inert')).toBe(true);
    expect(groupEl.classList.contains('mlv-list-item-group--pinned')).toBe(
      false,
    );

    toggler.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggler.getAttribute('aria-expanded')).toBe('true');
    expect(content.hasAttribute('inert')).toBe(false);
    expect(groupEl.classList.contains('mlv-list-item-group--toggled')).toBe(
      true,
    );

    toggler.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggler.getAttribute('aria-expanded')).toBe('false');
    expect(content.hasAttribute('inert')).toBe(true);
  });

  it('has no axe violations for the kept toggler under listRole="toolbar"', async () => {
    // The precondition is asserted, not assumed: a sweep of the *suppressed*
    // shape is clean too, so without this line the whole test passes with the
    // button gone and certifies nothing about it.
    const fixture = await mount(ToolbarGroupHost);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.mlv-list-item-group__toggler')).toHaveLength(
      1,
    );
    await expectNoAxeViolations(root);
  });

  it('still drops the toggler under a child-requiring container role', async () => {
    // `grid` → `['rowgroup', 'row']`, one of the twelve. Here the `<button>`
    // really would be an unallowed owned child: measured, the same markup with
    // a toggler rendered raises `aria-required-children` on the `mlv-list`,
    // naming `button[aria-controls]`.
    const fixture = await mount(GridGroupHost);
    expect(shape(fixture)).toEqual([null, null, 0]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-list-item-group__label',
      ),
    ).not.toBeNull();
  });

  it('has no axe violations under listRole="grid"', async () => {
    const fixture = await mount(GridGroupHost);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('names nothing when variant="inset" pins a group whose region has no role', async () => {
    // The one shape where the *variant* suppresses the toggler and the
    // container role does not: `toolbar` requires no children, so `_alwaysOpen`
    // is true only because of `inset`. The content region still claims no role
    // — `toolbar` has no sectioning child for a list of rows — and therefore
    // takes no `aria-labelledby` either.
    //
    // That is not a lost name so much as a name that was never exposed: a
    // roleless `<div>` is `generic`, which prohibits naming, so `aria-labelledby`
    // there is inert. And under the *other* rolelesss shape — a child-requiring
    // container such as `tablist` — it is worse than inert: measured, adding it
    // raises `aria-required-children` on the `mlv-list`, naming
    // `div[aria-labelledby]`, because a global ARIA attribute makes the
    // wrapper an owned child in its own right.
    const fixture = await mount(InsetToolbarGroupHost);
    const root = fixture.nativeElement as HTMLElement;
    const content = root.querySelector(
      '.mlv-list-item-group__content',
    ) as HTMLElement;

    expect(shape(fixture)).toEqual([null, null, 0]);
    expect(content.hasAttribute('aria-labelledby')).toBe(false);
    expect(
      root.querySelector('.mlv-list-item-group__label')?.textContent?.trim(),
    ).toBe('Text');
    await expectNoAxeViolations(root);
  });

  // -------------------------------------------------------------------------
  // The gap this change does NOT close: `MlvListItem.itemRole` still defaults
  // to `listitem`, whatever container it is in.
  // -------------------------------------------------------------------------

  it('leaves a default itemRole under a non-list container failing, unchanged', async () => {
    // Every other sweep in this block hand-picks a container-matching
    // `itemRole`. That is the named-harness hazard in role form, so this one
    // asserts the *default* and says what actually holds.
    //
    // `MlvListItem.itemRole` defaults to `'listitem'` regardless of container
    // (`list-item.ts`), so `<mlv-list listRole="menu">` + a bare
    // `<mlv-list-item>` still fails. It is **not a regression**: before #224
    // the same composition raised two violations too, on the group host and on
    // `mlv-list` — the failing node moves rather than disappearing. Changing
    // `MlvListItem`'s default is its own breaking change and is tracked in
    // #273; until then this spec pins the known-open gap so it cannot be
    // mistaken for coverage, and so closing it turns this red on purpose.
    const fixture = await mount(DefaultItemRoleMenuHost);
    const root = fixture.nativeElement as HTMLElement;

    // The group itself did its job: it claims no role and does not appear.
    expect(shape(fixture)).toEqual([null, 'group', 0]);

    const results = await runAxe(root);
    expect(results.violations.map((violation) => violation.id).sort()).toEqual([
      'aria-required-children',
      'aria-required-parent',
    ]);

    const failingTargets = results.violations.flatMap((violation) =>
      violation.nodes.flatMap((node) => node.target.flat()),
    );
    expect(failingTargets).toEqual(['mlv-list', 'mlv-list-item']);
  });
});

// ---------------------------------------------------------------------------
// The pinned group's own box — `--pinned` outside `.mlv-list--inset`
// ---------------------------------------------------------------------------

/**
 * The component's real stylesheet, with the three tokens this block reads
 * substituted for their `theme.scss` values.
 *
 * Both steps are load-bearing. `stripCssLayersFromText` because the sheet ships
 * inside `@layer mlv.components` and jsdom drops any stylesheet it cannot
 * parse — silently, so every read would come back `''`. The substitution
 * because jsdom performs no `var()` resolution *and* discards a shorthand whose
 * value contains one: measured, `padding: var(--mlv-padding-s)` computes to the
 * empty string, so the sheet as authored cannot distinguish "no block padding"
 * from "block padding declared". Only `--mlv-padding-s`, `--mlv-spacing-3` and
 * `--mlv-spacing-6` appear in the padding declarations under test.
 */
const GROUP_CSS = stripCssLayersFromText(
  sass.compile(
    join(dirname(fileURLToPath(import.meta.url)), 'list-item-group.scss'),
    { style: 'expanded' },
  ).css,
)
  .replace(/var\(--mlv-padding-s\)/g, '0.375rem 0.75rem')
  .replace(/var\(--mlv-spacing-3\)/g, '0.75rem')
  .replace(/var\(--mlv-spacing-6\)/g, '1.5rem');

describe('MlvListItemGroup pinned content padding', () => {
  let styleEl: HTMLStyleElement;

  beforeEach(() => {
    styleEl = document.createElement('style');
    styleEl.textContent = GROUP_CSS;
    document.head.appendChild(styleEl);
  });

  afterEach(async () => {
    styleEl.remove();
    await TestBed.resetTestingModule();
  });

  async function mount<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [host],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  /** Resolved block padding of every group's inner content wrapper, in order. */
  function blockPadding(fixture: ComponentFixture<unknown>): string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        '.mlv-list-item-group__content > div',
      ),
    ].map((el) => getComputedStyle(el as HTMLElement).paddingTop);
  }

  it('gives a pinned group the same block padding an expanded one has', async () => {
    // `--pinned` was reachable only inside an inset list until #224, and the
    // inset scope zeroes this padding outright — so the modifier never had to
    // supply it and did not. Outside that scope (any `listRole` in the
    // child-requiring set) the rows rendered flush against the section label:
    // measured before the fix, `0px 12px 0px 24px` against `--toggled`'s
    // `6px 12px 6px 24px`.
    const pinned = await mount(GridGroupHost);
    expect(blockPadding(pinned)).toEqual(['0.375rem']);
  });

  it('matches the expanded state and still differs from the collapsed one', async () => {
    // The reference values, from the same sheet in the same run — so this pins
    // an equality, not a literal that a token change would falsify.
    const plain = await mount(PlainGroupsHost);
    expect(blockPadding(plain)).toEqual(['0.375rem', '0px']);
  });

  it('leaves the inset scope zeroed, which still out-cascades --pinned', async () => {
    // `.mlv-list--inset .mlv-list-item-group__content > div { padding: 0 }` and
    // the new `--pinned` rule have identical specificity (0,2,1); the inset one
    // wins only because it comes later in the sheet. If it is ever hoisted
    // above, every inset section grows 6px of block padding it never had.
    const inset = await mount(InsetGroupsHost);
    expect(blockPadding(inset)).toEqual(['0px', '0px']);
  });
});
