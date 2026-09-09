import type { ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
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
    // `_expanded() || _pinnedOpen()`; `!_expanded()` would leave the second
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
    // `_pinnedOpen()` is false there and the predicate falls through to
    // `_expanded()`. `inert` is a plain attribute, so it is SSR-safe.
    const fixture = await mount(TestListItemGroupHostComponent);
    expect(contentRegions(fixture)[0].hasAttribute('inert')).toBe(true);
  });
});
