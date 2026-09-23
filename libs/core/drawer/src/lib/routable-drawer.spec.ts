import { ApplicationRef, Component, getDebugNode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
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

  beforeEach(() => {
    unhandled = [];
    previousOnUnhandledError = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = (error: unknown) =>
      unhandled.push(error instanceof Error ? error.message : String(error));
    vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);

    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        provideRouter([
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
    const harness = await RouterTestingHarness.create();
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
