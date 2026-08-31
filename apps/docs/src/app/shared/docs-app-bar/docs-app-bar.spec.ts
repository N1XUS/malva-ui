import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { DocsAppBarComponent } from './docs-app-bar';
import { DocsAppBarPreferencesComponent } from './docs-app-bar-preferences';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

@Component({
  selector: 'docs-test-app-bar-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class AppBarTestHostComponent {}

@Component({
  selector: 'docs-test-home-route',
  imports: [DocsAppBarComponent],
  template: '<docs-app-bar />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HomeRouteComponent {}

@Component({
  selector: 'docs-test-docs-route',
  imports: [DocsAppBarComponent],
  template: '<docs-app-bar />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DocsRouteComponent {}

@Component({
  selector: 'docs-test-showcases-route',
  imports: [DocsAppBarComponent],
  template: '<docs-app-bar />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ShowcasesRouteComponent {}

async function renderAt(
  url: string,
): Promise<{ harness: RouterTestingHarness; root: HTMLElement }> {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  });

  await TestBed.configureTestingModule({
    providers: [
      provideAnimationsAsync('noop'),
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
      provideMlvI18nTesting(),
      provideRouter([
        {
          path: '',
          component: AppBarTestHostComponent,
          children: [
            { path: '', pathMatch: 'full', component: HomeRouteComponent },
            { path: 'button', component: DocsRouteComponent },
            { path: 'showcases', component: ShowcasesRouteComponent },
            {
              path: 'showcases/data-operations',
              component: ShowcasesRouteComponent,
            },
          ],
        },
      ]),
    ],
  }).compileComponents();

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return { harness, root: harness.fixture.nativeElement as HTMLElement };
}

describe('DocsAppBarComponent', () => {
  it('renders exactly the Docs and Showcases primary links', async () => {
    const { root } = await renderAt('/button');
    const links = [
      ...root.querySelectorAll<HTMLAnchorElement>('.docs-app-bar__primary a'),
    ];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Docs',
      'Showcases',
    ]);
  });

  it.each([
    ['/', 'Docs'],
    ['/button', 'Docs'],
    ['/showcases', 'Showcases'],
    ['/showcases/data-operations', 'Showcases'],
  ])('marks the correct destination active at %s', async (url, label) => {
    const { root } = await renderAt(url);
    const active = root.querySelector('.mlv-segmented-item--active');
    expect(active?.textContent?.trim()).toBe(label);
    expect(active?.getAttribute('aria-current')).toBe('page');
  });

  describe('home link accessible name', () => {
    /**
     * Minimal accname resolution for this link: `aria-label` wins outright,
     * otherwise the name comes from the contents that are still rendered.
     * `display: none` removes a node from the accessibility tree, which is what
     * the mobile media query does to `.docs-app-bar__brand`.
     */
    function accessibleName(link: HTMLAnchorElement): string {
      const label = link.getAttribute('aria-label');
      if (label) {
        return label;
      }
      return [...link.children]
        .filter((child) => (child as HTMLElement).style.display !== 'none')
        .map((child) =>
          child instanceof HTMLImageElement
            ? (child.getAttribute('alt') ?? '')
            : (child.textContent ?? ''),
        )
        .join(' ')
        .trim();
    }

    it('names the home link at the desktop breakpoint', async () => {
      const { root } = await renderAt('/button');
      const link = root.querySelector<HTMLAnchorElement>(
        '.mlv-action-bar__logo',
      );

      expect(link).toBeTruthy();
      expect(accessibleName(link as HTMLAnchorElement)).toBe('Malva UI home');
    });

    it('keeps the same name once the brand text is hidden at the mobile breakpoint', async () => {
      const { root } = await renderAt('/button');
      const link = root.querySelector<HTMLAnchorElement>(
        '.mlv-action-bar__logo',
      ) as HTMLAnchorElement;
      const brand = link.querySelector<HTMLElement>(
        '.docs-app-bar__brand',
      ) as HTMLElement;

      // Stand in for `@media (max-width: 47.999rem) { &__brand { display: none } }`.
      brand.style.display = 'none';

      expect(accessibleName(link)).toBe('Malva UI home');
    });

    it('starts the name with the visible label (WCAG 2.5.3 Label in Name)', async () => {
      const { root } = await renderAt('/button');
      const link = root.querySelector<HTMLAnchorElement>(
        '.mlv-action-bar__logo',
      ) as HTMLAnchorElement;
      const visibleLabel = link
        .querySelector('.docs-app-bar__brand')
        ?.textContent?.trim();

      expect(visibleLabel).toBe('Malva UI');
      expect(link.getAttribute('aria-label')).toContain(visibleLabel as string);
    });

    it('keeps the logo image decorative so the name is never doubled up', async () => {
      const { root } = await renderAt('/button');
      const logo = root.querySelector<HTMLImageElement>(
        '.mlv-action-bar__logo img',
      );

      expect(logo?.getAttribute('alt')).toBe('');
    });
  });

  it('provides one semantic header and a skip link', async () => {
    const { root } = await renderAt('/button');
    expect(root.querySelectorAll('header')).toHaveLength(1);
    expect(
      root.querySelector('a[href="#main-content"]')?.textContent?.trim(),
    ).toBe('Skip to content');
  });

  it('retains the selected locale after navigation creates a new app bar', async () => {
    const { harness } = await renderAt('/button');
    const preferences = harness.routeDebugElement?.query(
      By.directive(DocsAppBarPreferencesComponent),
    ).componentInstance as DocsAppBarPreferencesComponent;

    await preferences['_switchLanguage']('de');
    await harness.navigateByUrl('/showcases');

    const recreatedPreferences = harness.routeDebugElement?.query(
      By.directive(DocsAppBarPreferencesComponent),
    ).componentInstance as DocsAppBarPreferencesComponent;
    expect(recreatedPreferences.locale()).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('does not let a previous route locale request overwrite a newer route selection', async () => {
    const { harness } = await renderAt('/button');
    const i18nService = TestBed.inject(MlvI18nService);
    const german = deferred<void>();
    const french = deferred<void>();
    vi.spyOn(i18nService, 'switchLanguage')
      .mockImplementationOnce(() => german.promise)
      .mockImplementationOnce(() => french.promise);

    const firstPreferences = harness.routeDebugElement?.query(
      By.directive(DocsAppBarPreferencesComponent),
    ).componentInstance as DocsAppBarPreferencesComponent;
    const germanSwitch = firstPreferences['_switchLanguage']('de');

    await harness.navigateByUrl('/showcases');
    const secondPreferences = harness.routeDebugElement?.query(
      By.directive(DocsAppBarPreferencesComponent),
    ).componentInstance as DocsAppBarPreferencesComponent;
    const frenchSwitch = secondPreferences['_switchLanguage']('fr');

    french.resolve();
    await frenchSwitch;
    german.resolve();
    await germanSwitch;

    expect(secondPreferences.locale()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });
});
