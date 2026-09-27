import { Component, ErrorHandler, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import type { Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'postcss';
import { compile } from 'sass';
import {
  provideLucideIcons,
  LucideBell,
  LucideCalendar,
  LucideEllipsis,
  LucideHelpCircle,
  LucideHome,
  LucideSearch,
  LucideUser,
} from '@lucide/angular';
import type { MlvNavItem } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvBottomNav } from './bottom-nav';
import type { MlvBottomNavStacking } from './bottom-nav';

/**
 * Overflow parity (#343).
 *
 * Past five items the bar shows four and moves the rest into a "More" menu.
 * Those overflow items are the same `MlvNavItem`s, so they owe the same
 * contract as the bar's own: a `disabled` item is inert (`itemClick`'s JSDoc
 * says it is "not emitted for disabled items"), a `route` means what it means
 * on a bar `routerLink`, and the current destination is visible whether it
 * sits in the bar or behind More.
 *
 * Six items: Home, Search, Alerts, Calendar in the bar; Profile (disabled)
 * and Help (overflow indices 0 and 1, global indices 4 and 5) behind More.
 * Every route is **relative**, which is what separates a `routerLink`-style
 * resolution from a root-absolute `navigateByUrl`.
 */

const ITEMS: MlvNavItem[] = [
  { icon: 'home', label: 'Home', route: 'home' },
  { icon: 'search', label: 'Search', route: 'search' },
  { icon: 'bell', label: 'Alerts', route: 'alerts' },
  { icon: 'calendar', label: 'Calendar', route: 'calendar' },
  { icon: 'user', label: 'Profile', route: 'profile', disabled: true },
  { icon: 'help-circle', label: 'Help', route: 'help' },
];

const PROVIDERS = [
  provideLucideIcons(
    LucideHome,
    LucideSearch,
    LucideBell,
    LucideCalendar,
    LucideUser,
    LucideHelpCircle,
    LucideEllipsis,
  ),
  provideMlvI18nTesting(),
];

@Component({ selector: 'test-blank', template: '' })
class BlankComponent {}

/** A routed shell under `/app`, so relative routes have a parent to resolve against. */
@Component({
  selector: 'test-nav-shell',
  imports: [MlvBottomNav, RouterOutlet],
  template: `<mlv-bottom-nav [items]="items" /><router-outlet />`,
})
class NavShellComponent {
  readonly items = ITEMS;
}

const ROUTES: Routes = [
  {
    path: 'app',
    component: NavShellComponent,
    children: [
      { path: '', component: BlankComponent },
      { path: '**', component: BlankComponent },
    ],
  },
  // Catches the root-absolute URL the overflow used to produce, so a wrong
  // resolution fails on the URL assertion rather than as a NavigationError.
  { path: '**', component: BlankComponent },
];

@Component({
  selector: 'test-managed-overflow',
  imports: [MlvBottomNav],
  template: `<mlv-bottom-nav
    [items]="items"
    [activeIndex]="activeIndex()"
    (itemClick)="clicks.push($event)"
  />`,
})
class ManagedOverflowHostComponent {
  readonly items = ITEMS;
  readonly activeIndex = signal(0);
  readonly clicks: number[] = [];
}

/** Managed mode with a configurable item list, for an app with no router providers. */
@Component({
  selector: 'test-managed-no-router',
  imports: [MlvBottomNav],
  template: `<mlv-bottom-nav
    [items]="items()"
    [activeIndex]="activeIndex()"
    (itemClick)="clicks.push($event)"
  />`,
})
class ManagedNoRouterHostComponent {
  readonly items = input<MlvNavItem[]>(ITEMS);
  readonly activeIndex = signal(0);
  readonly clicks: number[] = [];
}

@Component({
  selector: 'test-label-visibility',
  imports: [MlvBottomNav],
  template: `<mlv-bottom-nav
    [items]="items"
    [stacking]="stacking()"
    labelVisibility="active-only"
  />`,
})
class ActiveOnlyHostComponent {
  readonly items = ITEMS;
  readonly stacking = input<MlvBottomNavStacking>('vertical');
}

/** The overlay container `mlvMenuTrigger` portals the panel into. */
function overlayContainer(): HTMLElement {
  return document.querySelector('.cdk-overlay-container') as HTMLElement;
}

/** The overflow menu's rows, in item order, once the panel is open. */
function menuItems(): HTMLElement[] {
  return Array.from(
    overlayContainer().querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
}

/** Reads the state a menu row presents, as a plain object. */
function rowState(row: HTMLElement): Record<string, string | null> {
  return {
    label: row.textContent?.trim() ?? '',
    ariaDisabled: row.getAttribute('aria-disabled'),
    ariaCurrent: row.getAttribute('aria-current'),
  };
}

/** Reads the state the "More" trigger presents, as a plain object. */
function moreState(host: HTMLElement): Record<string, string | boolean | null> {
  const more = host.querySelector('.mlv-bottom-nav__more') as HTMLElement;
  return {
    active: more.classList.contains('mlv-bottom-nav__item--active'),
    ariaCurrent: more.getAttribute('aria-current'),
  };
}

afterEach(() => {
  document
    .querySelectorAll('.cdk-overlay-container')
    .forEach((element) => element.remove());
});

describe('MlvBottomNav overflow — router mode', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(ROUTES), ...PROVIDERS],
    });
    harness = await RouterTestingHarness.create('/app');
    router = TestBed.inject(Router);
  });

  /** Opens the overflow menu from the rendered "More" trigger. */
  async function openMore(): Promise<void> {
    const host = harness.fixture.nativeElement as HTMLElement;
    (host.querySelector('.mlv-bottom-nav__more') as HTMLElement).click();
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
  }

  it('resolves an overflow route relative to the host route, like a bar link', async () => {
    const host = harness.fixture.nativeElement as HTMLElement;
    // The bar's routerLink resolves `home` under `/app`.
    const bar = host.querySelector(
      'a.mlv-bottom-nav__item',
    ) as HTMLAnchorElement;
    expect(bar.getAttribute('href')).toBe('/app/home');

    await openMore();
    const help = menuItems().find((row) => rowState(row).label === 'Help');
    help?.click();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/app/help');
  });

  it('does not navigate from a disabled overflow item, and marks it disabled', async () => {
    await openMore();
    const profile = menuItems().find(
      (row) => rowState(row).label === 'Profile',
    ) as HTMLElement;

    profile.click();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/app');
    expect(rowState(profile)).toEqual({
      label: 'Profile',
      ariaDisabled: 'true',
      ariaCurrent: null,
    });
  });

  it('marks More and the matching row current while the route is an overflow item', async () => {
    const host = harness.fixture.nativeElement as HTMLElement;
    expect(moreState(host)).toEqual({ active: false, ariaCurrent: null });

    await harness.navigateByUrl('/app/help');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();

    expect(moreState(host)).toEqual({ active: true, ariaCurrent: 'true' });
    await openMore();
    expect(menuItems().map(rowState)).toEqual([
      { label: 'Profile', ariaDisabled: 'true', ariaCurrent: null },
      { label: 'Help', ariaDisabled: null, ariaCurrent: 'page' },
    ]);
  });

  it('never marks a disabled overflow item current, as the bar never marks a disabled one', async () => {
    const host = harness.fixture.nativeElement as HTMLElement;
    await harness.navigateByUrl('/app/profile');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();

    expect(moreState(host)).toEqual({ active: false, ariaCurrent: null });
  });

  it('clears the overflow state when the route moves back into the bar', async () => {
    const host = harness.fixture.nativeElement as HTMLElement;
    await harness.navigateByUrl('/app/help');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    expect(moreState(host)).toEqual({ active: true, ariaCurrent: 'true' });

    await harness.navigateByUrl('/app/home');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();

    expect(moreState(host)).toEqual({ active: false, ariaCurrent: null });
    const home = host.querySelector('a.mlv-bottom-nav__item') as HTMLElement;
    expect(home.getAttribute('aria-current')).toBe('page');
  });
});

describe('MlvBottomNav overflow — router mode, no route matches', () => {
  it('reports a failed overflow navigation to the ErrorHandler, as RouterLink does', async () => {
    const reported: unknown[] = [];
    TestBed.configureTestingModule({
      providers: [
        // No wildcard: `/app/help` matches nothing and the navigation fails.
        provideRouter([
          {
            path: 'app',
            component: NavShellComponent,
            children: [{ path: '', component: BlankComponent }],
          },
        ]),
        {
          provide: ErrorHandler,
          useValue: { handleError: (error: unknown) => reported.push(error) },
        },
        ...PROVIDERS,
      ],
    });
    const harness = await RouterTestingHarness.create('/app');
    const host = harness.fixture.nativeElement as HTMLElement;
    (host.querySelector('.mlv-bottom-nav__more') as HTMLElement).click();
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();

    menuItems()
      .find((row) => rowState(row).label === 'Help')
      ?.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/app');
    expect(reported.map((error) => String(error))).toEqual([
      expect.stringContaining(
        "Cannot match any routes. URL Segment: 'app/help'",
      ),
    ]);
  });
});

describe('MlvBottomNav overflow — managed mode', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ManagedOverflowHostComponent],
      providers: [provideRouter([]), ...PROVIDERS],
    });
  });

  /** Renders the managed host and opens the overflow menu. */
  async function renderOpen(activeIndex: number) {
    const fixture = TestBed.createComponent(ManagedOverflowHostComponent);
    fixture.componentInstance.activeIndex.set(activeIndex);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('.mlv-bottom-nav__more') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, host };
  }

  it('does not emit itemClick for a disabled overflow item', async () => {
    const { fixture } = await renderOpen(0);
    const profile = menuItems().find(
      (row) => rowState(row).label === 'Profile',
    ) as HTMLElement;

    profile.click();
    await fixture.whenStable();

    expect([...fixture.componentInstance.clicks]).toEqual([]);
    expect(rowState(profile).ariaDisabled).toBe('true');
  });

  it('still emits the global index for an enabled overflow item', async () => {
    const { fixture } = await renderOpen(0);
    menuItems()
      .find((row) => rowState(row).label === 'Help')
      ?.click();
    await fixture.whenStable();

    expect([...fixture.componentInstance.clicks]).toEqual([5]);
  });

  it('marks More and the matching row current for an activeIndex inside the overflow', async () => {
    const { host } = await renderOpen(5);

    expect(moreState(host)).toEqual({ active: true, ariaCurrent: 'true' });
    expect(menuItems().map(rowState)).toEqual([
      { label: 'Profile', ariaDisabled: 'true', ariaCurrent: null },
      { label: 'Help', ariaDisabled: null, ariaCurrent: 'page' },
    ]);
    // Exactly one bar-level current marker, and it is not on a bar item.
    expect(host.querySelectorAll('.mlv-bottom-nav__item--active')).toHaveLength(
      1,
    );
  });

  it('leaves More unmarked for an activeIndex inside the bar', async () => {
    const { host } = await renderOpen(1);

    expect(moreState(host)).toEqual({ active: false, ariaCurrent: null });
    expect(menuItems().map((row) => rowState(row).ariaCurrent)).toEqual([
      null,
      null,
    ]);
  });

  it('has no axe violations with the active item behind More, closed and open', async () => {
    const { fixture, host } = await renderOpen(5);
    // The open panel: a current row and a disabled row.
    await expectNoAxeViolations(overlayContainer());

    (host.querySelector('.mlv-bottom-nav__more') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    // The bar: More carrying aria-current beside four plain buttons.
    expect(moreState(host)).toEqual({ active: true, ariaCurrent: 'true' });
    await expectNoAxeViolations(host);
  });
});

/**
 * Managed mode is documented for apps with no router ("Managed mode (no
 * router)", docs example 6). `Router` is root-provided, but `ActivatedRoute`
 * comes only from `provideRouter()`, so the component must not require it.
 * No `provideRouter` anywhere in this block.
 */
describe('MlvBottomNav — managed mode without router providers', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ManagedNoRouterHostComponent],
      providers: [...PROVIDERS],
    });
  });

  it('renders a short bar and emits the clicked index', async () => {
    const fixture = TestBed.createComponent(ManagedNoRouterHostComponent);
    fixture.componentRef.setInput('items', ITEMS.slice(0, 3));
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const buttons = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button.mlv-bottom-nav__item'),
    );
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Home',
      'Search',
      'Alerts',
    ]);
    buttons[2].click();
    expect([...fixture.componentInstance.clicks]).toEqual([2]);
  });

  it('emits the global index from More and marks the overflow item current', async () => {
    const fixture = TestBed.createComponent(ManagedNoRouterHostComponent);
    fixture.componentInstance.activeIndex.set(5);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(moreState(host)).toEqual({ active: true, ariaCurrent: 'true' });

    (host.querySelector('.mlv-bottom-nav__more') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems().map(rowState)).toEqual([
      { label: 'Profile', ariaDisabled: 'true', ariaCurrent: null },
      { label: 'Help', ariaDisabled: null, ariaCurrent: 'page' },
    ]);

    menuItems()
      .find((row) => rowState(row).label === 'Help')
      ?.click();
    await fixture.whenStable();
    expect([...fixture.componentInstance.clicks]).toEqual([5]);
  });
});

/**
 * The "More" label is documented as always visible, whatever
 * `labelVisibility` says. jsdom cannot show whether it is: its cascade
 * ignores specificity and applies matching rules in source order, so the old
 * `--always` override — which came later but lost on specificity in every
 * browser — reads as the winner there. A `getComputedStyle(...).opacity`
 * assertion would certify the defect.
 *
 * What jsdom can answer exactly is which selectors match an element. So the
 * contract is stated on the compiled stylesheet and the rendered markup
 * together: no rule that collapses a label may match the More label at all.
 */
describe('MlvBottomNav overflow — More label in active-only mode', () => {
  const css = stripCssLayersFromText(
    compile(join(dirname(fileURLToPath(import.meta.url)), 'bottom-nav.scss'))
      .css,
  );

  /** Every selector whose rule collapses a label to nothing. */
  const collapsingSelectors: string[] = [];
  parse(css).walkRules((rule) => {
    const collapses = rule.nodes.some(
      (node) =>
        node.type === 'decl' &&
        ['opacity', 'max-height', 'max-width'].includes(node.prop) &&
        /^0(px|rem)?$/.test(node.value.trim()),
    );
    if (collapses) collapsingSelectors.push(...rule.selectors);
  });

  it.each<MlvBottomNavStacking>(['vertical', 'horizontal'])(
    '%s stacking: no collapsing rule matches the More label',
    async (stacking) => {
      TestBed.configureTestingModule({
        imports: [ActiveOnlyHostComponent],
        providers: [provideRouter([]), ...PROVIDERS],
      });
      const fixture = TestBed.createComponent(ActiveOnlyHostComponent);
      fixture.componentRef.setInput('stacking', stacking);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;

      const matching = (element: Element) =>
        collapsingSelectors.filter((selector) => element.matches(selector));

      // Not vacuous: an ordinary inactive label is collapsed by this stylesheet.
      const plain = host.querySelector(
        'a.mlv-bottom-nav__item .mlv-bottom-nav__label',
      ) as HTMLElement;
      expect(matching(plain).length).toBeGreaterThan(0);

      const more = host.querySelector(
        '.mlv-bottom-nav__more .mlv-bottom-nav__label',
      ) as HTMLElement;
      expect(matching(more)).toEqual([]);
    },
  );
});
