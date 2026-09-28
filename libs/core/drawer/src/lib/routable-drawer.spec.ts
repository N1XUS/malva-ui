import { ApplicationRef, Component, getDebugNode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import type { SpyLocation } from '@angular/common/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { config as rxjsConfig } from 'rxjs';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvDrawerBody } from './drawer-body';
import { MlvDrawerHeader } from './drawer-header';
import { MlvDrawerSection } from './drawer-section/drawer-section';
import { MlvDrawerSections } from './drawer-sections/drawer-sections';
import { mlvGenerateRoutableDrawerRoute } from './generate-routable-drawer-route';
import { MlvDrawerPanel } from './drawer/drawer-panel';

@Component({
  selector: 'test-routed-sheet',
  imports: [MlvDrawerHeader, MlvDrawerBody],
  template: `
    <mlv-drawer-header title="Details" />
    <div mlvDrawerBody><button class="inside" type="button">In</button></div>
  `,
})
class RoutedSheetComponent {}

@Component({
  selector: 'test-routed-sections',
  imports: [
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvDrawerSection,
    MlvDrawerSections,
  ],
  template: `
    <mlv-drawer-header title="Settings" level="4">
      <mlv-drawer-sections />
    </mlv-drawer-header>
    <div mlvDrawerBody>
      <section mlvDrawerSection id="general" label="General">General</section>
      <section mlvDrawerSection id="access" label="Access">Access</section>
    </div>
  `,
})
class RoutedSectionsComponent {}

@Component({
  selector: 'test-parent-page',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class ParentPageComponent {}

@Component({
  selector: 'test-other-page',
  template: '<p>Other</p>',
})
class OtherPageComponent {}

/**
 * The options `mlvGenerateRoutableDrawerRoute()` takes. `closeOnNavigation` is
 * not among them; a cast through this type stands in for an untyped caller —
 * and for the next major, where the service default becomes `true`.
 */
type RoutableDrawerOptions = Parameters<
  typeof mlvGenerateRoutableDrawerRoute
>[1];

/**
 * `MlvDrawerSectionsService` builds an `IntersectionObserver` from a render
 * hook; jsdom ships none. Nothing here reads what it observes.
 */
class NoopIntersectionObserver {
  observe(): void {
    /* no-op */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}

describe('mlvGenerateRoutableDrawerRoute', () => {
  /**
   * Errors raised while the routed drawer opens. `MlvRoutableDrawer` opens the
   * drawer inside an RxJS pipeline with no error callback, so a throw there
   * reaches `config.onUnhandledError` and never the spec's own stack.
   */
  let unhandled: string[];
  let previousOnUnhandledError: typeof rxjsConfig.onUnhandledError;
  /**
   * While set, `/other`'s guard waits on it: a navigation there stays in
   * flight until the spec resolves it.
   */
  let holdOther: Promise<boolean> | null;

  beforeEach(() => {
    unhandled = [];
    previousOnUnhandledError = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = (error: unknown) =>
      unhandled.push(error instanceof Error ? error.message : String(error));
    vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
    holdOther = null;

    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        provideLocationMocks(),
        provideRouter([
          {
            path: 'other',
            component: OtherPageComponent,
            canActivate: [() => holdOther ?? true],
          },
          {
            path: 'page',
            component: ParentPageComponent,
            children: [
              mlvGenerateRoutableDrawerRoute(RoutedSheetComponent, {
                path: 'sheet',
                position: 'bottom',
                resizable: true,
                snapPoints: [30, 60],
                defaultSnap: 60,
              }),
              mlvGenerateRoutableDrawerRoute(RoutedSectionsComponent, {
                path: 'sections',
              }),
              mlvGenerateRoutableDrawerRoute(RoutedSheetComponent, {
                path: 'history',
                closeOnNavigation: true,
              } as RoutableDrawerOptions),
            ],
          },
        ]),
      ],
    });
  });

  afterEach(() => {
    rxjsConfig.onUnhandledError = previousOnUnhandledError;
    vi.unstubAllGlobals();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  /**
   * Navigates, then waits out two macrotasks — the route shell's `delay(0)`,
   * and the timer RxJS reports an error thrown there on — and the render.
   */
  async function openRoute(url: string): Promise<void> {
    await openRouteIn(await RouterTestingHarness.create(), url);
  }

  /** {@link openRoute} on a harness the spec already holds. */
  async function openRouteIn(
    harness: RouterTestingHarness,
    url: string,
  ): Promise<void> {
    await harness.navigateByUrl(url);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function panel(): HTMLElement | null {
    return document.querySelector('.mlv-drawer');
  }

  /**
   * The height the drawer panel component binds onto its host, or `null` when
   * `element` is not one. jsdom's CSSOM drops a `height: var(…)` declaration,
   * so `style.height` reads `''` for every resizable panel and cannot show
   * which snap it opened at; the binding can. A string, so a failure prints no
   * instance.
   */
  function boundPanelHeight(element: HTMLElement | null): string | null {
    const instance: unknown = element
      ? getDebugNode(element)?.componentInstance
      : null;
    if (!(instance instanceof MlvDrawerPanel)) return null;
    return instance['_dimensions']()['height'] ?? null;
  }

  it('renders the resize handle and the defaultSnap size a resizable route asks for', async () => {
    await openRoute('/page/sheet');

    expect(unhandled).toEqual([]);
    expect(panel()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(boundPanelHeight(panel())).toBe(
      'var(--mlv-drawer-current-size, 60dvh)',
    );
    expect(panel()?.parentElement?.classList.contains('cdk-overlay-pane')).toBe(
      true,
    );
  });

  it('lets Back reach its own target, closing the drawer through the route, even when the route asks for closeOnNavigation (#361)', async () => {
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location) as SpyLocation;
    // What bootstrapping does: the router takes Back / Forward from here on.
    router.setUpLocationChangeListener();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/other');
    await openRouteIn(harness, '/page/history');
    expect(panel()).not.toBeNull();

    // Back lands on a route whose guard is still deciding, so the navigation
    // outlasts the drawer's leave animation.
    let release: (allowed: boolean) => void = () => undefined;
    holdOther = new Promise((resolve) => (release = resolve));
    const historyWrites = location.urlChanges.length;
    location.back();
    // The router picks the pop event up on a timer.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Ends a leave, had the pop event started one of its own.
    panel()?.dispatchEvent(new Event('animationend'));
    release(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(unhandled).toEqual([]);
    expect(router.url).toBe('/other');
    expect(location.path()).toBe('/other');
    // No history written after Back: no parent-route push, which would drop
    // the drawer's entry from Forward.
    expect(location.urlChanges.slice(historyWrites)).toEqual([]);
    // Leaving the route destroyed the shell, which closed the drawer.
    expect(panel()?.classList.contains('mlv-drawer--leave')).toBe(true);

    panel()?.dispatchEvent(new Event('animationend'));
    expect(panel()).toBeNull();
  });

  it('opens [mlvDrawerSection] and mlv-drawer-sections content without a provider error', async () => {
    await openRoute('/page/sections');

    expect(unhandled).toEqual([]);
    expect(
      document.querySelectorAll('.mlv-drawer .mlv-drawer-section__heading'),
    ).toHaveLength(2);
    expect(
      document.querySelector('.mlv-drawer mlv-drawer-sections button'),
    ).not.toBeNull();
  });
});
