import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { OverlayContainer } from '@angular/cdk/overlay';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MlvBreadcrumb } from './breadcrumb';
import { MlvBreadcrumbItem } from './breadcrumb-item';
import { MlvBreadcrumbSeparator } from './breadcrumb-separator';
import type { MlvBreadcrumbEntry } from './breadcrumb.types';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

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
      providers: [
        provideMlvI18nTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
      ],
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
      providers: [
        provideMlvI18nTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
      ],
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

describe('MlvBreadcrumb — projected items mode', () => {
  let fixture: ComponentFixture<ProjectedHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectedHostComponent],
      providers: [
        provideMlvI18nTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
      ],
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

describe('MlvBreadcrumb — router integration', () => {
  let fixture: ComponentFixture<RouterLinkHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterLinkHostComponent],
      providers: [
        provideMlvI18nTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
      ],
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
      providers: [
        provideMlvI18nTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
      ],
    }).compileComponents();
  });

  it('should not claim role=listitem on the custom-element host (WCAG: only valid inside <ol>/<ul>)', () => {
    const fixture = TestBed.createComponent(ItemDefaultHostComponent);
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('mlv-breadcrumb-item'));
    expect(el.nativeElement.getAttribute('role')).toBeNull();
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
      providers: [
        provideMlvI18nTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
      ],
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
    const mix =
      /^color-mix\( ?in srgb, ?(.+?) ([\d.]+)%, ?(.+?) ?\)$/.exec(value);
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
