import { Component, ErrorHandler, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvBreadcrumb } from './breadcrumb';
import { MlvBreadcrumbItem } from './breadcrumb-item';
import { MlvBreadcrumbItemHost } from './breadcrumb-item-host';
import { MlvBreadcrumbSeparator } from './breadcrumb-separator';
import type { MlvBreadcrumbEntry } from './breadcrumb.types';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';

// ─── Test Host Components ────────────────────────────────────────────────────

@Component({
  imports: [MlvBreadcrumb],
  template: ` <nav mlvBreadcrumb [items]="items" [maxItems]="maxItems"></nav> `,
})
class DataDrivenHostComponent {
  items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Widget Pro' },
  ];
  maxItems = 0;
}

@Component({
  imports: [MlvBreadcrumb, MlvBreadcrumbSeparator],
  template: `
    <nav mlvBreadcrumb [items]="items">
      <ng-template mlvSeparator>›</ng-template>
    </nav>
  `,
})
class CustomSeparatorHostComponent {
  items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Widget Pro' },
  ];
}

@Component({
  imports: [MlvBreadcrumb],
  template: `<nav mlvBreadcrumb [items]="items"></nav>`,
})
class DisabledItemHostComponent {
  items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Disabled', disabled: true },
    { label: 'Current' },
  ];
}

@Component({
  imports: [MlvBreadcrumb],
  template: `<nav mlvBreadcrumb [items]="items"></nav>`,
})
class PlainAncestorHostComponent {
  // "Settings" and "Personal" are grouping ancestors: they have no page of
  // their own, but they are not disabled either.
  items: MlvBreadcrumbEntry[] = [
    { label: 'Settings' },
    { label: 'Personal' },
    { label: 'Profile' },
  ];
}

@Component({
  imports: [MlvBreadcrumb, MlvBreadcrumbItem],
  template: `
    <nav mlvBreadcrumb>
      <mlv-breadcrumb-item href="/">Home</mlv-breadcrumb-item>
      <mlv-breadcrumb-item href="/products">Products</mlv-breadcrumb-item>
      <mlv-breadcrumb-item [current]="true">Widget Pro</mlv-breadcrumb-item>
    </nav>
  `,
})
class ProjectedHostComponent {}

/**
 * Projected mode with every input that shapes a separator live: the crumbs are
 * a `@for` plus a trailing `@if`, so the last crumb can change under the
 * breadcrumb; the `[mlvSeparator]` template comes and goes; and
 * `hideSeparatorFromScreenReaders` toggles.
 */
@Component({
  imports: [MlvBreadcrumb, MlvBreadcrumbItem, MlvBreadcrumbSeparator],
  template: `
    <nav mlvBreadcrumb [hideSeparatorFromScreenReaders]="hideSeparators()">
      @if (customSeparator()) {
        <ng-template mlvSeparator>›</ng-template>
      }
      @for (crumb of crumbs(); track crumb) {
        <mlv-breadcrumb-item [href]="'/' + crumb">{{
          crumb
        }}</mlv-breadcrumb-item>
      }
      @if (showLeaf()) {
        <mlv-breadcrumb-item current>Leaf</mlv-breadcrumb-item>
      }
    </nav>
  `,
})
class ProjectedDynamicHostComponent {
  readonly crumbs = signal(['Home', 'Products']);
  readonly showLeaf = signal(true);
  readonly hideSeparators = signal(true);
  readonly customSeparator = signal(false);
}

/**
 * The `[mlvBreadcrumbItem]` pattern: native `<li>`s projected straight into
 * the breadcrumb's own `<ol>`. No `<ol>` of the consumer's own — the component
 * already renders one, and a second nests `ol > ol` (axe `list`, serious).
 */
@Component({
  imports: [MlvBreadcrumb, MlvBreadcrumbItemHost],
  template: `
    <nav mlvBreadcrumb>
      <li mlvBreadcrumbItem>
        <a class="mlv-breadcrumb__link" href="/">Home</a>
        <span class="mlv-breadcrumb__separator" aria-hidden="true">›</span>
      </li>
      <li mlvBreadcrumbItem>
        <a class="mlv-breadcrumb__link" href="/components">Components</a>
        <span class="mlv-breadcrumb__separator" aria-hidden="true">›</span>
      </li>
      <li mlvBreadcrumbItem>
        <span
          class="mlv-breadcrumb__link mlv-breadcrumb__link--current"
          aria-current="page"
          >Breadcrumb</span
        >
      </li>
    </nav>
  `,
})
class DirectivePatternHostComponent {}

@Component({
  imports: [MlvBreadcrumb],
  template: `
    <nav
      mlvBreadcrumb
      [items]="items"
      [maxItems]="3"
      mlvDensity="compact"
    ></nav>
  `,
})
class OverflowHostComponent {
  items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Category', href: '/cat' },
    { label: 'Sub-Category', href: '/cat/sub' },
    { label: 'Product', href: '/cat/sub/product' },
    { label: 'Widget Pro' },
  ];
}

@Component({
  imports: [MlvBreadcrumb],
  template: `<nav mlvBreadcrumb [items]="items"></nav>`,
})
class RouterLinkHostComponent {
  items: MlvBreadcrumbEntry[] = [
    { label: 'Home', routerLink: '/' },
    { label: 'Products', routerLink: ['/products'] },
    { label: 'Widget Pro' },
  ];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MlvBreadcrumb — data-driven mode', () => {
  let fixture: ComponentFixture<DataDrivenHostComponent>;
  let host: DataDrivenHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DataDrivenHostComponent,
        CustomSeparatorHostComponent,
        DisabledItemHostComponent,
      ],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DataDrivenHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(host).toBeTruthy();
  });

  it('should render the nav element with correct ARIA label', () => {
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
  });

  it('should expose an explicit navigation landmark role', () => {
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.getAttribute('role')).toBe('navigation');
  });

  it('should apply mlv-breadcrumb class to host', () => {
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.classList.contains('mlv-breadcrumb')).toBe(true);
  });

  it('should render an ordered list', () => {
    const ol = fixture.nativeElement.querySelector('ol.mlv-breadcrumb__list');
    expect(ol).not.toBeNull();
  });

  it('should render all items', () => {
    const items = fixture.nativeElement.querySelectorAll(
      'li.mlv-breadcrumb__item',
    );
    expect(items.length).toBe(3);
  });

  it('should render separators between items (not after last)', () => {
    const separators = fixture.nativeElement.querySelectorAll(
      '.mlv-breadcrumb__separator',
    );
    expect(separators.length).toBe(2); // 3 items → 2 separators
  });

  it('should render a chevron icon as the default separator', () => {
    const separator = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__separator svg',
    );
    expect(separator).not.toBeNull();
  });

  it('should render custom separator text when mlvSeparator directive is provided', () => {
    const customFixture = TestBed.createComponent(CustomSeparatorHostComponent);
    customFixture.detectChanges();
    const separator = customFixture.nativeElement.querySelector(
      '.mlv-breadcrumb__separator',
    );
    expect(separator.textContent.trim()).toBe('›');
  });

  it('should mark last item as current with aria-current="page"', () => {
    const currentItem = fixture.nativeElement.querySelector(
      '[aria-current="page"]',
    );
    expect(currentItem).not.toBeNull();
    expect(currentItem.textContent.trim()).toBe('Widget Pro');
  });

  it('should apply mlv-breadcrumb__link--current class to last item', () => {
    const currentItem = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__link--current',
    );
    expect(currentItem).not.toBeNull();
  });

  it('should render link items as anchor elements', () => {
    const links = fixture.nativeElement.querySelectorAll(
      'a.mlv-breadcrumb__link',
    );
    expect(links.length).toBe(2); // Home + Products
  });

  it('should hide separator from screen readers by default', () => {
    const separators = fixture.nativeElement.querySelectorAll(
      '.mlv-breadcrumb__separator',
    );
    separators.forEach((sep: HTMLElement) => {
      expect(sep.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('should render disabled item as non-link span', () => {
    const disabledFixture = TestBed.createComponent(DisabledItemHostComponent);
    disabledFixture.detectChanges();
    const disabledItem = disabledFixture.nativeElement.querySelector(
      '.mlv-breadcrumb__link--disabled',
    );
    expect(disabledItem).not.toBeNull();
    expect(disabledItem.tagName.toLowerCase()).toBe('span');
  });
});

describe('MlvBreadcrumb — overflow/truncation', () => {
  let fixture: ComponentFixture<OverflowHostComponent>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverflowHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(OverflowHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('should truncate items and show ellipsis button when maxItems is set', () => {
    const ellipsis = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__ellipsis',
    );
    expect(ellipsis).not.toBeNull();
    expect(ellipsis.textContent.trim()).toBe('…');
  });

  it('should render ellipsis as a button for keyboard accessibility', () => {
    const ellipsis = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__ellipsis',
    );
    expect(ellipsis.tagName.toLowerCase()).toBe('button');
  });

  it('should always show first and last items', () => {
    const links = fixture.nativeElement.querySelectorAll(
      '.mlv-breadcrumb__link',
    );
    const texts = Array.from(links).map(
      (el) => (el as HTMLElement).textContent?.trim() ?? '',
    );
    expect(texts[0]).toBe('Home');
    expect(texts[texts.length - 1]).toBe('Widget Pro');
  });

  it('should show maxItems items total (including ellipsis)', () => {
    const items = fixture.nativeElement.querySelectorAll(
      'li.mlv-breadcrumb__item',
    );
    // 5 items with maxItems=3: first + ellipsis + last = 3 li items
    expect(items.length).toBe(3);
  });

  it('should focus the first overflow link when the popover opens', async () => {
    const ellipsis = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__ellipsis',
    ) as HTMLButtonElement;

    ellipsis.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement?.textContent?.trim()).toBe('Category');
  });

  it('should move focus through overflow links with arrow keys', async () => {
    const ellipsis = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__ellipsis',
    ) as HTMLButtonElement;

    ellipsis.click();
    fixture.detectChanges();
    await fixture.whenStable();

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement?.textContent?.trim()).toBe('Sub-Category');
  });

  it('stamps the forwarded mlvDensity on the detached overflow popup panel', async () => {
    const ellipsis = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__ellipsis',
    ) as HTMLButtonElement;

    ellipsis.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-popup');
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('mlv--compact')).toBe(true);
  });
});

// ─── Overflow menu: disabled, plain, Escape (#342) ───────────────────────────
//
// The menu is the trail's second rendering of the same crumbs, so a crumb has
// to mean the same thing in both. It did not: the menu tested `routerLink`,
// then `href`, then fell through to an `aria-disabled` span — so a disabled
// crumb that still carried a destination rendered as a live link, and a plain
// ancestor was announced as switched off. And Escape called `focus()` on the
// `ElementRef` a bare `viewChild` returns, threw, and left focus on `<body>`.

/** Routed target, so a navigation that should not happen can be observed. */
@Component({ template: '' })
class RouteStubComponent {}

/** Collects errors Angular routes through its `ErrorHandler` (listener throws). */
class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/**
 * Every crumb kind the menu can hold, collapsed behind the ellipsis
 * (`maxItems` 3 keeps `Home › … › Current`): two disabled crumbs that still
 * carry a destination — a router link and a plain href — a plain ancestor with
 * nowhere to go, and two live links.
 */
@Component({
  imports: [MlvBreadcrumb],
  template: `<nav mlvBreadcrumb [items]="items" [maxItems]="3"></nav>`,
})
class OverflowStatesHostComponent {
  readonly items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Billing', routerLink: '/billing', disabled: true },
    { label: 'Invoices', href: '/invoices', disabled: true },
    { label: 'Settings' },
    { label: 'Team', routerLink: '/team' },
    { label: 'Profile', href: '/profile' },
    { label: 'Current' },
  ];
}

describe('MlvBreadcrumb — overflow menu states (#342)', () => {
  let fixture: ComponentFixture<OverflowStatesHostComponent>;
  let overlayContainer: OverlayContainer;
  let errorHandler: CapturingErrorHandler;

  const ellipsis = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.mlv-breadcrumb__ellipsis');

  /** The menu item labelled `label`, looked up in the portaled pane. */
  const menuItem = (label: string): HTMLElement => {
    const item = Array.from(
      overlayContainer
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((el) => el.textContent?.trim() === label);
    if (!item) throw new Error(`no menu item "${label}"`);
    return item;
  };

  /** Label of the focused element — a string, never the node itself. */
  const focusedLabel = (): string =>
    document.activeElement?.textContent?.trim() ?? '';

  async function openMenu(): Promise<void> {
    ellipsis().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function press(key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement?.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();
    return event;
  }

  beforeEach(async () => {
    errorHandler = new CapturingErrorHandler();
    await TestBed.configureTestingModule({
      imports: [OverflowStatesHostComponent],
      providers: [
        provideMlvI18nTesting(),
        provideRouter([{ path: '**', component: RouteStubComponent }]),
        { provide: ErrorHandler, useValue: errorHandler },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(OverflowStatesHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('renders a disabled crumb as a disabled menu item with no destination', async () => {
    await openMenu();

    for (const label of ['Billing', 'Invoices']) {
      const item = menuItem(label);
      expect(item.tagName).toBe('SPAN');
      expect(item.hasAttribute('href')).toBe(false);
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.classList.contains('mlv-breadcrumb__overflow-link')).toBe(
        true,
      );
      expect(
        item.classList.contains('mlv-breadcrumb__overflow-link--disabled'),
      ).toBe(true);
    }
  });

  it('renders a plain crumb as an enabled menu item — not a disabled one', async () => {
    await openMenu();

    const settings = menuItem('Settings');
    expect(settings.tagName).toBe('SPAN');
    expect(settings.hasAttribute('href')).toBe(false);
    expect(settings.hasAttribute('aria-disabled')).toBe(false);
    expect(
      settings.classList.contains('mlv-breadcrumb__overflow-link--plain'),
    ).toBe(true);
    expect(
      settings.classList.contains('mlv-breadcrumb__overflow-link--disabled'),
    ).toBe(false);

    // The live links are untouched.
    for (const label of ['Team', 'Profile']) {
      const link = menuItem(label);
      expect(link.tagName).toBe('A');
      expect(link.hasAttribute('href')).toBe(true);
      expect(link.hasAttribute('aria-disabled')).toBe(false);
    }
  });

  it('does not navigate or close when a disabled crumb is clicked', async () => {
    const router = TestBed.inject(Router);
    await openMenu();

    for (const label of ['Billing', 'Invoices']) {
      const item = menuItem(label);
      // A screen reader's activation is a click on the item itself; a pointer
      // lands on the row, since the item is `pointer-events: none`.
      item.click();
      (item.closest('mlv-list-item') as HTMLElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(router.url).toBe('/');
      expect(ellipsis().getAttribute('aria-expanded')).toBe('true');
    }
  });

  it('lets a live crumb navigate natively and close the menu', async () => {
    const router = TestBed.inject(Router);
    // Bubble phase, so it reads the event after every listener in the menu —
    // a row listener returning `false` would have `preventDefault()`ed it by
    // then — and cancels it last so jsdom does not attempt the navigation.
    const cancelledByMenu: boolean[] = [];
    const record = (event: Event): void => {
      cancelledByMenu.push(event.defaultPrevented);
      event.preventDefault();
    };

    await openMenu();
    document.addEventListener('click', record);
    try {
      menuItem('Profile').click();
    } finally {
      document.removeEventListener('click', record);
    }
    fixture.detectChanges();
    await fixture.whenStable();

    expect(cancelledByMenu).toEqual([false]);
    expect(ellipsis().getAttribute('aria-expanded')).toBe('false');

    // The leave animation never ends under jsdom; the pane detaches on the
    // popup's watchdog, and only a detached popup can open again.
    await vi.waitFor(() =>
      expect(
        overlayContainer.getContainerElement().querySelector('.mlv-popup'),
      ).toBeNull(),
    );

    await openMenu();
    menuItem('Team').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/team');
    expect(ellipsis().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps disabled crumbs out of the arrow-key model', async () => {
    await openMenu();
    expect(focusedLabel()).toBe('Team');

    await press('ArrowDown');
    expect(focusedLabel()).toBe('Profile');
    await press('ArrowDown');
    expect(focusedLabel()).toBe('Team'); // wraps past Billing / Invoices
    await press('ArrowUp');
    expect(focusedLabel()).toBe('Profile');
    await press('Home');
    expect(focusedLabel()).toBe('Team');
  });

  it('closes on Escape and returns focus to the ellipsis', async () => {
    await openMenu();
    const menu = overlayContainer
      .getContainerElement()
      .querySelector('[role="menu"]') as HTMLElement;
    expect(menu.contains(document.activeElement)).toBe(true);

    const escape = await press('Escape');

    expect(escape.defaultPrevented).toBe(true);
    expect(ellipsis().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement === ellipsis()).toBe(true);
    expect(errorHandler.errors.map(String)).toEqual([]);
  });

  it('has no axe violations with disabled, plain and live crumbs in the open menu', async () => {
    await openMenu();

    // State: five menu items — two disabled, one plain, two links.
    const menu = overlayContainer
      .getContainerElement()
      .querySelector('[role="menu"]') as HTMLElement;
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(5);
    expect(menu.querySelectorAll('[aria-disabled="true"]')).toHaveLength(2);

    await expectNoAxeViolations(document.body);
  });
});

// ─── Collapsed trail order (#316) ────────────────────────────────────────────
//
// The trail is an `<ol>`: adjacent crumbs claim a parent → child step, and the
// ellipsis stands in for exactly the crumbs between its neighbours. So putting
// the menu's crumbs back where the ellipsis sits has to give the `items` array
// back, unchanged — for every `maxItems`, not only the `maxItems ≤ 3` shape
// where the ellipsis is the whole middle.

/** The docs' overflow example (`breadcrumb/examples/3`), six crumbs deep. */
const LONG_TRAIL: MlvBreadcrumbEntry[] = [
  { label: 'Home', href: '/' },
  { label: 'Organization', href: '/org' },
  { label: 'Projects', href: '/org/projects' },
  { label: 'Web Platform', href: '/org/projects/web' },
  { label: 'Frontend', href: '/org/projects/web/frontend' },
  { label: 'Components' },
];

@Component({
  imports: [MlvBreadcrumb],
  template: `<nav mlvBreadcrumb [items]="items" [maxItems]="maxItems"></nav>`,
})
class TrailOrderHostComponent {
  items: MlvBreadcrumbEntry[] = LONG_TRAIL;
  maxItems = 4;
}

describe('MlvBreadcrumb — collapsed trail order', () => {
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrailOrderHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  function render(
    items: MlvBreadcrumbEntry[],
    maxItems: number,
  ): ComponentFixture<TrailOrderHostComponent> {
    const fixture = TestBed.createComponent(TrailOrderHostComponent);
    fixture.componentInstance.items = items;
    fixture.componentInstance.maxItems = maxItems;
    fixture.detectChanges();
    return fixture;
  }

  /** The rendered trail, one label per `<li>`, `'…'` for the ellipsis. */
  function trail(fixture: ComponentFixture<TrailOrderHostComponent>): string[] {
    const listItems = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'li.mlv-breadcrumb__item',
    );
    return Array.from(listItems, (li) =>
      li.querySelector('.mlv-breadcrumb__ellipsis')
        ? '…'
        : (li.querySelector('.mlv-breadcrumb__link')?.textContent?.trim() ??
          ''),
    );
  }

  /** Opens the ellipsis menu and returns its crumbs, in DOM order. */
  async function openMenu(
    fixture: ComponentFixture<TrailOrderHostComponent>,
  ): Promise<string[]> {
    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-breadcrumb__ellipsis',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menuItems = overlayContainer
      .getContainerElement()
      .querySelectorAll('.mlv-breadcrumb__overflow-list [role="menuitem"]');
    return Array.from(menuItems, (el) => el.textContent?.trim() ?? '');
  }

  it('collapses the crumbs after the root and keeps the nearest ancestors visible (docs example 3)', async () => {
    const fixture = render(LONG_TRAIL, 4);

    expect(trail(fixture)).toEqual(['Home', '…', 'Frontend', 'Components']);
    expect(await openMenu(fixture)).toEqual([
      'Organization',
      'Projects',
      'Web Platform',
    ]);
  });

  it('fills every extra slot from the tail, next to the current page', async () => {
    const fixture = render(LONG_TRAIL, 5);

    expect(trail(fixture)).toEqual([
      'Home',
      '…',
      'Web Platform',
      'Frontend',
      'Components',
    ]);
    expect(await openMenu(fixture)).toEqual(['Organization', 'Projects']);
  });

  it('opens the menu on the first collapsed crumb and counts exactly the menu', async () => {
    const fixture = render(LONG_TRAIL, 4);
    const ellipsis = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-breadcrumb__ellipsis',
    ) as HTMLButtonElement;

    expect(ellipsis.getAttribute('aria-label')).toBe(
      'Show 3 more breadcrumb items',
    );
    await openMenu(fixture);
    expect(document.activeElement?.textContent?.trim()).toBe('Organization');
  });

  it('keeps aria-current on the last crumb alone', () => {
    const fixture = render(LONG_TRAIL, 4);
    const current = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[aria-current="page"]',
    );

    expect(Array.from(current, (el) => el.textContent?.trim())).toEqual([
      'Components',
    ]);
  });

  it('reads in document order for every maxItems and trail length', async () => {
    const failures: string[] = [];
    // Whole values, plus the fractional and NaN values a computed binding
    // (`[maxItems]="width() / 120"`) can produce.
    const budgets = [-1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, NaN];

    for (let total = 1; total <= 7; total++) {
      const labels = Array.from({ length: total }, (_, i) => `Crumb ${i + 1}`);
      const items = labels.map<MlvBreadcrumbEntry>((label, i) =>
        i === total - 1 ? { label } : { label, href: `/${i + 1}` },
      );

      for (const maxItems of budgets) {
        const fixture = render(items, maxItems);
        const shown = trail(fixture);
        const ellipsisAt = shown.indexOf('…');
        const hidden = ellipsisAt === -1 ? [] : await openMenu(fixture);
        const combo = `total=${total} maxItems=${maxItems}`;

        // Putting the menu back where the ellipsis sits restores `items`.
        const restored =
          ellipsisAt === -1
            ? shown
            : [
                ...shown.slice(0, ellipsisAt),
                ...hidden,
                ...shown.slice(ellipsisAt + 1),
              ];
        if (restored.join(' › ') !== labels.join(' › ')) {
          failures.push(`${combo}: ${shown.join(' › ')} + [${hidden}]`);
        }

        // Truncation only when the trail outgrows the budget — the first and
        // the last crumb always fit, so `maxItems` below 2 still keeps two.
        // `NaN > 0` is false: a NaN budget truncates nothing.
        const collapses = maxItems > 0 && total > Math.max(maxItems, 2);
        if (collapses !== (ellipsisAt !== -1)) {
          failures.push(
            `${combo}: ellipsis ${collapses ? 'missing' : 'unexpected'}`,
          );
        }

        if (collapses) {
          // The ellipsis sits right after the root; the slots left over after
          // the root, the ellipsis and the current page go to the tail. Slots
          // are whole: the most that fit under `maxItems`, never fewer than
          // the three a collapse needs.
          if (ellipsisAt !== 1) {
            failures.push(`${combo}: ellipsis at ${ellipsisAt}`);
          }
          if (shown.length !== Math.max(Math.floor(maxItems), 3)) {
            failures.push(`${combo}: ${shown.length} slots`);
          }
          if (hidden.length === 0) {
            failures.push(`${combo}: empty menu`);
          }
        }

        fixture.destroy();
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('MlvBreadcrumb — projected items mode', () => {
  let fixture: ComponentFixture<ProjectedHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectedHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectedHostComponent);
    fixture.detectChanges();
  });

  it('should render projected breadcrumb items', () => {
    const items = fixture.nativeElement.querySelectorAll('mlv-breadcrumb-item');
    expect(items.length).toBe(3);
  });

  it('should mark last projected item as current', () => {
    const currentEl = fixture.nativeElement.querySelector(
      '[aria-current="page"]',
    );
    expect(currentEl).not.toBeNull();
  });
});

// ─── Projected separators (#325) ─────────────────────────────────────────────
//
// Projected mode used to render a bare `<ng-content />` inside the `<ol>`, and
// `<mlv-breadcrumb-item>` had no separator of its own — so the trail rendered
// as one run-on word ("HomeDocumentationBreadcrumb"). Each crumb but the last
// now renders the breadcrumb's separator after its link, inside its own
// `listitem`, exactly where the data-driven `<li>` puts it.

describe('MlvBreadcrumb — projected separators', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectedHostComponent, ProjectedDynamicHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();
  });

  /**
   * Per crumb, in trail order: its label and whether it carries a separator.
   * A string array, never a node, so a failure prints the trail.
   */
  function trail(root: HTMLElement): string[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>('mlv-breadcrumb-item'),
    ).map((item) => {
      const label =
        item.querySelector('.mlv-breadcrumb__link')?.textContent?.trim() ?? '';
      const count = item.querySelectorAll('.mlv-breadcrumb__separator').length;
      return count ? `${label} ${'›'.repeat(count)}` : label;
    });
  }

  async function mountDynamic() {
    const fixture = TestBed.createComponent(ProjectedDynamicHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      host: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
      settle: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('renders a separator after every projected crumb but the last', () => {
    const fixture = TestBed.createComponent(ProjectedHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.mlv-breadcrumb__separator')).toHaveLength(2);
    expect(trail(root)).toEqual(['Home ›', 'Products ›', 'Widget Pro']);
  });

  it('places the separator inside the crumb, after its link', () => {
    const fixture = TestBed.createComponent(ProjectedHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const placement = Array.from(
      root.querySelectorAll<HTMLElement>('.mlv-breadcrumb__separator'),
    ).map((separator) => {
      const item = separator.closest('mlv-breadcrumb-item');
      const link = item?.querySelector('.mlv-breadcrumb__link');
      return {
        inListItem: item?.getAttribute('role') === 'listitem',
        afterLink:
          !!link &&
          !!(
            link.compareDocumentPosition(separator) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
        last: item?.lastElementChild === separator,
      };
    });

    expect(placement).toEqual([
      { inListItem: true, afterLink: true, last: true },
      { inListItem: true, afterLink: true, last: true },
    ]);
  });

  it('renders the default chevron, hidden from assistive technology', async () => {
    const { root } = await mountDynamic();

    const separators = Array.from(
      root.querySelectorAll<HTMLElement>('.mlv-breadcrumb__separator'),
    );
    expect(separators.map((s) => s.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
    ]);
    expect(separators.map((s) => s.querySelectorAll('svg').length)).toEqual([
      1, 1,
    ]);
  });

  it('stamps a custom [mlvSeparator] template, and drops it again', async () => {
    const { host, root, settle } = await mountDynamic();

    host.customSeparator.set(true);
    await settle();
    const separators = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>('.mlv-breadcrumb__separator'),
      );
    expect(separators().map((s) => s.textContent?.trim())).toEqual(['›', '›']);
    expect(separators().map((s) => s.querySelectorAll('svg').length)).toEqual([
      0, 0,
    ]);

    host.customSeparator.set(false);
    await settle();
    expect(separators().map((s) => s.querySelectorAll('svg').length)).toEqual([
      1, 1,
    ]);
  });

  it('follows hideSeparatorFromScreenReaders', async () => {
    const { host, root, settle } = await mountDynamic();
    const ariaHidden = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>('.mlv-breadcrumb__separator'),
      ).map((s) => s.getAttribute('aria-hidden'));

    host.hideSeparators.set(false);
    await settle();
    expect(ariaHidden()).toEqual([null, null]);

    host.hideSeparators.set(true);
    await settle();
    expect(ariaHidden()).toEqual(['true', 'true']);
  });

  it('moves the trailing gap when the last crumb leaves or joins the trail', async () => {
    const { host, root, settle } = await mountDynamic();
    expect(trail(root)).toEqual(['Home ›', 'Products ›', 'Leaf']);

    host.showLeaf.set(false);
    await settle();
    expect(trail(root)).toEqual(['Home ›', 'Products']);

    host.crumbs.set(['Home', 'Products', 'Widgets']);
    await settle();
    expect(trail(root)).toEqual(['Home ›', 'Products ›', 'Widgets']);

    host.showLeaf.set(true);
    await settle();
    expect(trail(root)).toEqual(['Home ›', 'Products ›', 'Widgets ›', 'Leaf']);

    host.crumbs.set(['Products', 'Home']);
    await settle();
    expect(trail(root)).toEqual(['Products ›', 'Home ›', 'Leaf']);
  });

  it('picks the last crumb by page order, not creation order, when the trail reorders', async () => {
    const { host, root, settle } = await mountDynamic();
    host.showLeaf.set(false);
    await settle();
    expect(trail(root)).toEqual(['Home ›', 'Products']);
    const home = root.querySelector('mlv-breadcrumb-item');

    // `track crumb` moves the existing views rather than re-creating them, so
    // Home — created first — becomes the last crumb on the page while Products,
    // created after it, leads. A pick by creation order would leave Products
    // bare and give Home the trailing gap.
    host.crumbs.set(['Products', 'Home']);
    await settle();
    const items = root.querySelectorAll('mlv-breadcrumb-item');
    expect(items[items.length - 1] === home).toBe(true);
    expect(trail(root)).toEqual(['Products ›', 'Home']);
  });
});

describe('MlvBreadcrumb — router integration', () => {
  let fixture: ComponentFixture<RouterLinkHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterLinkHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RouterLinkHostComponent);
    fixture.detectChanges();
  });

  it('should render router-link items as anchor elements', () => {
    const links = fixture.nativeElement.querySelectorAll(
      'a.mlv-breadcrumb__link',
    );
    expect(links.length).toBe(2); // Home + Products
  });
});

describe('MlvBreadcrumbItem', () => {
  @Component({
    imports: [MlvBreadcrumbItem],
    template: `<mlv-breadcrumb-item>Label</mlv-breadcrumb-item>`,
  })
  class ItemDefaultHostComponent {}

  @Component({
    imports: [MlvBreadcrumbItem],
    template: `<mlv-breadcrumb-item [current]="true"
      >Label</mlv-breadcrumb-item
    >`,
  })
  class ItemCurrentHostComponent {}

  @Component({
    imports: [MlvBreadcrumbItem],
    template: `<mlv-breadcrumb-item [disabled]="true"
      >Label</mlv-breadcrumb-item
    >`,
  })
  class ItemDisabledHostComponent {}

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ItemDefaultHostComponent,
        ItemCurrentHostComponent,
        ItemDisabledHostComponent,
      ],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();
  });

  /**
   * This assertion used to be the opposite — `role` had to be absent, on the
   * grounds that `listitem` is "only valid inside `<ol>`/`<ul>`". That premise
   * holds; the conclusion did not follow. `<mlv-breadcrumb-item>` is projected
   * through the `<ng-content />` that `breadcrumb.html` places INSIDE its own
   * `<ol>`, so the element's DOM parent is always that list. Leaving the role
   * off meant every projected-mode breadcrumb handed the `<ol>` non-`<li>`
   * children, and axe's `list` rule (serious, WCAG 1.3.1) fired on the `<ol>` —
   * the trail stopped being exposed as a list at all. `only-listitems` accepts
   * a child whose resolved role is `listitem` (`axe-core/axe.js:25846`), which
   * is exactly what this restores.
   *
   * `[mlvBreadcrumbItem]` (`MlvBreadcrumbItemHost`) still sets no role: that
   * directive is documented for the `<a>` inside an `<li>` as well as the
   * `<li>` itself, so it has no such guarantee about its parent.
   */
  it('claims role=listitem so the breadcrumb <ol> keeps its list semantics', () => {
    const fixture = TestBed.createComponent(ItemDefaultHostComponent);
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('mlv-breadcrumb-item'));
    expect(el.nativeElement.getAttribute('role')).toBe('listitem');
  });

  it('should apply mlv-breadcrumb__item class to host', () => {
    const fixture = TestBed.createComponent(ItemDefaultHostComponent);
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('mlv-breadcrumb-item'));
    expect(el.nativeElement.classList.contains('mlv-breadcrumb__item')).toBe(
      true,
    );
  });

  it('should render as span with aria-current when current=true', () => {
    const fixture = TestBed.createComponent(ItemCurrentHostComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(span).not.toBeNull();
    expect(span.tagName.toLowerCase()).toBe('span');
  });

  it('renders no separator outside a breadcrumb', () => {
    const fixture = TestBed.createComponent(ItemDefaultHostComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.mlv-breadcrumb__separator'),
    ).toHaveLength(0);
  });

  it('should render as span with disabled class when disabled=true', () => {
    const fixture = TestBed.createComponent(ItemDisabledHostComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__link--disabled',
    );
    expect(span).not.toBeNull();
    expect(span.tagName.toLowerCase()).toBe('span');
  });
});

// ─── Non-interactive crumb states ────────────────────────────────────────────

/**
 * A breadcrumb has three non-navigable states and they mean different things:
 *
 * - `--current` — the page being viewed.
 * - `--disabled` — a destination that exists but is switched off for this user.
 * - `--plain` — a grouping ancestor that simply has nowhere to navigate to.
 *
 * Collapsing the third into the second (the trap the settings-access showcase
 * fell into) tells assistive technology something false and drags the crumb
 * into the disabled colour ramp, so the three are asserted apart here.
 */
describe('MlvBreadcrumb — non-interactive crumb states', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlainAncestorHostComponent, DisabledItemHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('renders a link-less, non-current entry as a plain crumb — not a disabled one', () => {
    const fixture = TestBed.createComponent(PlainAncestorHostComponent);
    fixture.detectChanges();

    const plain = fixture.nativeElement.querySelectorAll(
      '.mlv-breadcrumb__link--plain',
    );
    expect(plain.length).toBe(2);
    expect([...plain].map((el: HTMLElement) => el.textContent?.trim())).toEqual(
      ['Settings', 'Personal'],
    );

    for (const el of plain as Iterable<HTMLElement>) {
      expect(el.tagName.toLowerCase()).toBe('span');
      expect(el.classList.contains('mlv-breadcrumb__link--disabled')).toBe(
        false,
      );
      expect(el.classList.contains('mlv-breadcrumb__link--current')).toBe(
        false,
      );
      expect(el.hasAttribute('aria-current')).toBe(false);
    }
  });

  it('still marks the last plain entry as the current page', () => {
    const fixture = TestBed.createComponent(PlainAncestorHostComponent);
    fixture.detectChanges();

    const current = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__link--current',
    );
    expect(current.textContent.trim()).toBe('Profile');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.classList.contains('mlv-breadcrumb__link--plain')).toBe(
      false,
    );
  });

  it('never dresses a disabled entry as the current page', () => {
    const fixture = TestBed.createComponent(DisabledItemHostComponent);
    fixture.detectChanges();

    const disabled = fixture.nativeElement.querySelector(
      '.mlv-breadcrumb__link--disabled',
    );
    expect(disabled.classList.contains('mlv-breadcrumb__link--current')).toBe(
      false,
    );
    expect(disabled.classList.contains('mlv-breadcrumb__link--plain')).toBe(
      false,
    );
    expect(disabled.hasAttribute('aria-current')).toBe(false);
  });
});

// ─── Colour contract (WCAG 2.1 AA) ───────────────────────────────────────────

/**
 * Angular does not attach component styles in the test environment and jsdom
 * resolves neither `var()` nor colour, so axe's `color-contrast` rule cannot
 * see these values. The tokens each part reads are therefore asserted from the
 * stylesheet source, and the ratios they resolve to are computed from
 * `libs/styles`' own palette — the two halves of the regression that made the
 * ancestor crumbs invisible at 1.42:1 and the separators 2.42:1 in light.
 *
 * `new URL(…, import.meta.url)` is rewritten by Vite into an asset URL, so both
 * files are resolved from this spec's own path instead.
 */
const specPath = fileURLToPath(import.meta.url);
const breadcrumbScss = readFileSync(
  specPath.replace(/\.spec\.ts$/, '.scss'),
  'utf8',
)
  // The comments in the stylesheet name the very tokens these assertions rule
  // out, so they would otherwise satisfy the checks on their own.
  .replace(/^\s*\/\/.*$/gm, '');

const themeScss = readFileSync(
  specPath.replace(
    /src\/lib\/breadcrumb\/breadcrumb\.spec\.ts$/,
    '../../styles/src/lib/theme.scss',
  ),
  'utf8',
);

/** Resolves a `--mlv-*` colour token to a hex string for one theme. */
function tokenHex(token: string, theme: 'light' | 'dark'): string {
  // The light tokens live in the `:root, :host, [mlvTheme='light']` block; the
  // dark ones in the `@mixin dark-tokens` block that follows it. The
  // high-contrast block after them is a separate, explicitly-authored theme.
  const lightStart = themeScss.indexOf('  :root,');
  const darkStart = themeScss.indexOf('@mixin dark-tokens');
  const darkEnd = themeScss.indexOf("[data-theme='high-contrast']");
  expect(lightStart, 'light token block').toBeGreaterThan(-1);
  expect(darkStart, 'dark token block').toBeGreaterThan(lightStart);
  expect(darkEnd, 'high-contrast block').toBeGreaterThan(darkStart);

  const section =
    theme === 'light'
      ? themeScss.slice(lightStart, darkStart)
      : themeScss.slice(darkStart, darkEnd);

  const read = (name: string, from: string): string => {
    const value = new RegExp(`${name}:\\s*([^;]+);`).exec(from)?.[1]?.trim();
    expect(value, `${name} in ${theme} theme`).toBeTruthy();
    return value as string;
  };

  /**
   * Resolves one colour expression to `#rrggbb`. Handles the three forms the
   * theme actually uses: a literal hex, a `var(--mlv-palette-*)` reference
   * (itself interpolated from a Sass variable at the top of the file), and a
   * two-colour `color-mix(in srgb, A P%, B)`.
   */
  const resolveColor = (raw: string): string => {
    const value = raw.replace(/\s+/g, ' ').trim();

    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    if (value === 'white') return '#ffffff';
    if (value === 'black') return '#000000';

    const paletteRef = /^var\((--mlv-palette-[a-z0-9-]+)\)$/.exec(value);
    if (paletteRef) {
      const interpolated = read(paletteRef[1], themeScss);
      const sassVar = /^#\{\$(mlv-palette-[a-z0-9-]+)\}$/.exec(interpolated);
      return resolveColor(
        sassVar ? read(`\\$${sassVar[1]}`, themeScss).trim() : interpolated,
      );
    }

    // color-mix(in srgb, <A> <P>%, <B>) — sRGB mixing interpolates the
    // non-linear channels directly, so a plain per-channel lerp matches.
    const mix = /^color-mix\( ?in srgb, ?(.+?) ([\d.]+)%, ?(.+?) ?\)$/.exec(
      value,
    );
    if (mix) {
      const [a, b] = [resolveColor(mix[1]), resolveColor(mix[3])];
      const weight = Number(mix[2]) / 100;
      return (
        '#' +
        [1, 3, 5]
          .map((i) => {
            const channel =
              parseInt(a.slice(i, i + 2), 16) * weight +
              parseInt(b.slice(i, i + 2), 16) * (1 - weight);
            return Math.round(channel).toString(16).padStart(2, '0');
          })
          .join('')
      );
    }

    return value;
  };

  const value = resolveColor(read(token, section));
  expect(value, `${token} in ${theme} theme`).toMatch(/^#[0-9a-f]{6}$/i);
  return value;
}

/** WCAG 2.1 relative-luminance contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('MlvBreadcrumb — colour contract', () => {
  it('never reaches for the inaccessible text ramps', () => {
    // 1.42:1 light / 2.29:1 dark against `--mlv-background-base`.
    expect(breadcrumbScss).not.toContain('--mlv-text-disabled');
    // 2.42:1 light — below the 3:1 floor a separator owes as non-text UI.
    expect(breadcrumbScss).not.toContain('--mlv-text-tertiary');
  });

  it('routes the disabled crumb through an overridable variable with an accessible default', () => {
    expect(breadcrumbScss).toContain(
      '--mlv-breadcrumb-disabled-color: var(--mlv-text-secondary);',
    );
    // The overflow popup is portaled outside this block, so its own read must
    // repeat the default as a `var()` fallback or it resolves to `inherit`.
    expect(breadcrumbScss).toContain(
      'var(--mlv-breadcrumb-disabled-color, var(--mlv-text-secondary))',
    );
  });

  it.each([
    ['light' as const, '--mlv-background-base'],
    ['light' as const, '--mlv-background-raised'],
    ['dark' as const, '--mlv-background-base'],
    ['dark' as const, '--mlv-background-raised'],
  ])('clears WCAG AA for every crumb part in %s on %s', (theme, background) => {
    const bg = tokenHex(background, theme);

    // Text: 4.5:1. Covers the current crumb, plain ancestors, disabled
    // crumbs and the overflow ellipsis alike.
    for (const token of [
      '--mlv-text-primary',
      '--mlv-text-secondary',
      '--mlv-text-action',
    ]) {
      expect(
        contrast(tokenHex(token, theme), bg),
        `${token} on ${background} (${theme})`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    // Non-text UI: 3:1. The separator reads `--mlv-text-secondary`, which
    // clears the text floor too, so this is the weaker of the two bounds.
    expect(
      contrast(tokenHex('--mlv-text-secondary', theme), bg),
      `separator on ${background} (${theme})`,
    ).toBeGreaterThanOrEqual(3);
  });
});

// ─── Scoped direction (#147) ─────────────────────────────────────────────────
//
// The overflow menu's arrow model is inline-axis, so it resolves against the
// breadcrumb's own host — not the document. That matters twice over here: the
// menu itself renders in a CDK overlay pane, which is portaled to `<body>` and
// stamped with its own `dir`, and a breadcrumb can equally sit inside a
// `[dir]` subtree while the document stays LTR.

@Component({
  imports: [MlvBreadcrumb],
  template: `
    <div [attr.dir]="scopeDir">
      <nav mlvBreadcrumb [items]="items" [maxItems]="3"></nav>
    </div>
  `,
})
class ScopedDirOverflowHostComponent {
  scopeDir: 'rtl' | 'ltr' = 'rtl';
  items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Category', href: '/cat' },
    { label: 'Sub-Category', href: '/cat/sub' },
    { label: 'Product', href: '/cat/sub/product' },
    { label: 'Widget Pro' },
  ];
}

describe('MlvBreadcrumb — scoped direction', () => {
  let fixture: ComponentFixture<ScopedDirOverflowHostComponent>;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  /** Label of the focused overflow link — a string, never the node itself. */
  const focusedLabel = (): string =>
    document.activeElement?.textContent?.trim() ?? '';

  function keydown(key: string): void {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  /** Opens the overflow popup and settles focus on its first link. */
  async function openOverflow(): Promise<void> {
    (
      fixture.nativeElement.querySelector(
        '.mlv-breadcrumb__ellipsis',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedDirOverflowHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
    fixture = TestBed.createComponent(ScopedDirOverflowHostComponent);
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
    rtlService?.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('mirrors the horizontal arrows inside a [dir="rtl"] subtree while the document stays LTR', async () => {
    fixture.detectChanges();
    expect(rtlService.direction()).toBe('ltr');

    await openOverflow();
    expect(focusedLabel()).toBe('Category');

    keydown('ArrowLeft');
    expect(focusedLabel()).toBe('Sub-Category'); // "next" once mirrored
    keydown('ArrowRight');
    expect(focusedLabel()).toBe('Category');
  });

  it('leaves the vertical arrows and Home/End alone inside a [dir="rtl"] subtree', async () => {
    fixture.detectChanges();
    await openOverflow();

    keydown('ArrowDown');
    expect(focusedLabel()).toBe('Sub-Category'); // vertical never mirrors
    keydown('ArrowUp');
    expect(focusedLabel()).toBe('Category');
    keydown('End');
    expect(focusedLabel()).toBe('Product');
    keydown('Home');
    expect(focusedLabel()).toBe('Category');
  });

  it('keeps a [dir="ltr"] island unmirrored while the document is RTL', async () => {
    fixture.componentInstance.scopeDir = 'ltr';
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    expect(rtlService.direction()).toBe('rtl');

    await openOverflow();
    expect(focusedLabel()).toBe('Category');

    keydown('ArrowRight');
    expect(focusedLabel()).toBe('Sub-Category'); // the island reads LTR
    keydown('ArrowLeft');
    expect(focusedLabel()).toBe('Category');
  });
});

/**
 * Accessibility sweep.
 *
 * The breadcrumb is `role="navigation"` wrapping an `<ol>`, and both of its
 * usage modes have to survive that: data-driven stamps its own `<li>`s, while
 * projected mode drops `<mlv-breadcrumb-item>` elements straight into the
 * `<ol>` through `<ng-content>`. Truncation adds a third shape — a named
 * `aria-haspopup="menu"` ellipsis button and, once opened, a `role="menu"`
 * portaled into the CDK overlay container with a `role="menuitem"` per hidden
 * crumb. Each is swept in the mode that produces it; the menu holding disabled
 * and plain crumbs beside links is swept in § _overflow menu states (#342)_.
 */
describe('MlvBreadcrumb accessibility', () => {
  async function mount<T>(type: new (...args: never[]) => T) {
    await TestBed.configureTestingModule({
      imports: [type],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('has no axe violations in data-driven mode', async () => {
    const { host } = await mount(DataDrivenHostComponent);

    // State: a named navigation landmark over three crumbs, the last of which
    // is the `aria-current="page"` span rather than a link.
    const nav = host.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('role')).toBe('navigation');
    expect(nav.getAttribute('aria-label')).toBeTruthy();
    expect(host.querySelectorAll('li.mlv-breadcrumb__item')).toHaveLength(3);
    expect(host.querySelectorAll('[aria-current="page"]')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations with disabled and plain crumbs', async () => {
    const { host } = await mount(DisabledItemHostComponent);

    // State: the two non-navigable branches — `--disabled` and the plain
    // ancestor — render as spans, so nothing claims to be an inert link.
    expect(
      host.querySelectorAll('.mlv-breadcrumb__link--disabled'),
    ).toHaveLength(1);
    expect(host.querySelectorAll('a')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations in projected mode', async () => {
    const { host } = await mount(ProjectedHostComponent);

    // State: three `<mlv-breadcrumb-item>` elements projected straight into the
    // component's own `<ol>` — the shape `list` / `listitem` judges — each but
    // the last carrying its separator (#325).
    expect(host.querySelectorAll('mlv-breadcrumb-item')).toHaveLength(3);
    expect(host.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(host.querySelectorAll('.mlv-breadcrumb__separator')).toHaveLength(2);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations with announced projected separators', async () => {
    const { fixture, host } = await mount(ProjectedDynamicHostComponent);
    fixture.componentInstance.hideSeparators.set(false);
    fixture.componentInstance.customSeparator.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // State: the separators are exposed to AT, so each `listitem` now holds a
    // text node beside its link — the markup `hideSeparatorFromScreenReaders`
    // opts into.
    const separators = Array.from(
      host.querySelectorAll<HTMLElement>('.mlv-breadcrumb__separator'),
    );
    expect(separators.map((s) => s.getAttribute('aria-hidden'))).toEqual([
      null,
      null,
    ]);
    expect(separators.map((s) => s.textContent?.trim())).toEqual(['›', '›']);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations in the [mlvBreadcrumbItem] pattern', async () => {
    const { host } = await mount(DirectivePatternHostComponent);

    // State: native `<li mlvBreadcrumbItem>`s are the `<ol>`'s own children —
    // one list, no `ol > ol` (#325).
    const list = host.querySelector('ol.mlv-breadcrumb__list') as HTMLElement;
    expect(
      Array.from(list.children).map((child) => child.tagName.toLowerCase()),
    ).toEqual(['li', 'li', 'li']);
    expect(host.querySelectorAll('ol')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });

  /**
   * The inline axis mirrors, and nothing about a separator's role or name may
   * change with it. Axe sees no geometry, so this is the markup half of RTL:
   * both modes, swept under a scoped `[dir="rtl"]` while the document stays
   * LTR.
   */
  it.each([
    ['data-driven', DataDrivenHostComponent],
    ['projected', ProjectedHostComponent],
    ['[mlvBreadcrumbItem]', DirectivePatternHostComponent],
  ] as const)(
    'has no axe violations in %s mode inside a [dir="rtl"] subtree',
    async (_mode, type) => {
      const { fixture, host } = await mount<unknown>(type);
      host.setAttribute('dir', 'rtl');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.querySelectorAll('.mlv-breadcrumb__separator')).toHaveLength(
        2,
      );
      expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');

      await expectNoAxeViolations(host);
    },
  );

  it('has no axe violations with the overflow menu open', async () => {
    const { fixture, host } = await mount(OverflowHostComponent);
    const overlayContainer = TestBed.inject(OverlayContainer);
    try {
      const overlayEl = overlayContainer.getContainerElement();

      const ellipsis = host.querySelector(
        '.mlv-breadcrumb__ellipsis',
      ) as HTMLButtonElement;
      expect(ellipsis.getAttribute('aria-haspopup')).toBe('menu');
      expect(ellipsis.getAttribute('aria-label')).toBeTruthy();

      ellipsis.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // State: the menu is attached with one `menuitem` per hidden crumb.
      const menu = overlayEl.querySelector('[role="menu"]') as HTMLElement;
      expect(menu).toBeTruthy();
      expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
      expect(ellipsis.getAttribute('aria-expanded')).toBe('true');

      await expectNoAxeViolations(document.body);
    } finally {
      overlayContainer.ngOnDestroy();
    }
  });
});

// ─── Landmark name (#326) ────────────────────────────────────────────────────

@Component({
  imports: [MlvBreadcrumb, MlvBreadcrumbItem],
  template: `
    <nav mlvBreadcrumb [items]="items" [ariaLabel]="label()"></nav>
    <nav mlvBreadcrumb aria-label="Section path" [items]="items"></nav>
    <nav
      mlvBreadcrumb
      aria-label="Static name"
      [ariaLabel]="override()"
      [items]="items"
    ></nav>
    <nav mlvBreadcrumb ariaLabel="Projected trail">
      <mlv-breadcrumb-item href="/">Home</mlv-breadcrumb-item>
      <mlv-breadcrumb-item current>Settings</mlv-breadcrumb-item>
    </nav>
  `,
})
class LandmarkNameHostComponent {
  readonly items: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Widget Pro' },
  ];
  readonly label = signal<string | undefined>('Project path');
  readonly override = signal<string | undefined>('Bound name');
}

/**
 * The host binding used to write the i18n "Breadcrumb" unconditionally: no
 * input existed, and a consumer's own `aria-label` was overwritten on the
 * first change detection. Every trail on a page was therefore the same
 * `navigation` landmark — `landmark-unique` — with no way to tell them apart.
 */
describe('MlvBreadcrumb — landmark name (#326)', () => {
  let fixture: ComponentFixture<LandmarkNameHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandmarkNameHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LandmarkNameHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /** The `aria-label` of every rendered breadcrumb landmark, in DOM order. */
  function landmarkNames(): (string | null)[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav'),
    ).map((nav) => nav.getAttribute('aria-label'));
  }

  it('names each landmark from ariaLabel, else the static aria-label', () => {
    expect(landmarkNames()).toEqual([
      'Project path',
      'Section path',
      'Bound name',
      'Projected trail',
    ]);
  });

  it('falls back to the static aria-label, then the localized default', async () => {
    fixture.componentInstance.override.set(undefined);
    fixture.componentInstance.label.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(landmarkNames()).toEqual([
      'Breadcrumb',
      'Section path',
      'Static name',
      'Projected trail',
    ]);
  });

  it('treats an empty ariaLabel as unset', async () => {
    fixture.componentInstance.label.set('');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(landmarkNames()[0]).toBe('Breadcrumb');
  });

  it('has no axe violations with several named trails on one page', async () => {
    // State: four `navigation` landmarks, each with its own name. Swept with
    // `landmark-unique` on — the rule that fired while every trail was
    // "Breadcrumb".
    expect(new Set(landmarkNames()).size).toBe(4);

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
