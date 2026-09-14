import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewportScroller } from '@angular/common';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvPage } from './page';
import { MlvPageRegistry } from './page-registry';
import { MlvPageSkipLink } from './page-skip-link';
import { provideMlvPageRouteFocus } from './page-route-focus';
import { provideMlvPageScrollRestoration } from './page-scroll-restoration';
import {
  MlvPageViewTransition,
  mlvPageViewTransitionHook,
} from './page-view-transition';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

@Component({
  template: '<main mlvPage id="alpha"><h1>Alpha</h1></main>',
  imports: [MlvPage],
})
class AlphaRoute {}

@Component({
  template: '<main mlvPage id="beta"><h1>Beta</h1></main>',
  imports: [MlvPage],
})
class BetaRoute {}

@Component({
  template: `
    <a mlvPageSkipLink>Skip to content</a>
    <router-outlet />
  `,
  imports: [MlvPageSkipLink, RouterOutlet],
})
class ShellHost {}

/** Builds a two-route application with the given page providers. */
async function createRoutedApp(
  providers: readonly unknown[] = [],
): Promise<{
  fixture: ReturnType<typeof TestBed.createComponent>;
  router: Router;
}> {
  TestBed.configureTestingModule({
    imports: [ShellHost],
    providers: [
      provideRouter([
        { path: 'alpha', component: AlphaRoute },
        { path: 'beta', component: BetaRoute },
      ]),
      ...(providers as never[]),
    ],
  });

  const fixture = TestBed.createComponent(ShellHost);
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/alpha');
  await fixture.whenStable();
  return { fixture, router };
}

describe('MlvPageRegistry', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  it('publishes the live page and withdraws it on destroy', async () => {
    @Component({
      template: '@if (shown()) { <main mlvPage id="only"></main> }',
      imports: [MlvPage],
    })
    class ToggleHost {
      readonly shown = signal(true);
    }

    const fixture = TestBed.configureTestingModule({
      imports: [ToggleHost],
    }).createComponent(ToggleHost);
    await fixture.whenStable();

    const registry = TestBed.inject(MlvPageRegistry);
    expect(registry.active()?.element.id).toBe('only');
    expect(registry.pages()).toHaveLength(1);

    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();

    expect(registry.active()).toBeNull();
    expect(registry.pages()).toHaveLength(0);
  });

  it('hands the geometry and snap state of the page through', async () => {
    @Component({
      template: '<main mlvPage id="one"></main>',
      imports: [MlvPage],
    })
    class Host {}

    const fixture = TestBed.configureTestingModule({
      imports: [Host],
    }).createComponent(Host);
    await fixture.whenStable();

    const entry = TestBed.inject(MlvPageRegistry).active();
    expect(entry?.geometry.chromeBlockSize()).toBe(0);
    expect(entry?.snap.progress()).toBe(0);
  });
});

describe('provideMlvPageRouteFocus', () => {
  it('does not focus the landmark on the initial navigation', async () => {
    const { fixture } = await createRoutedApp([provideMlvPageRouteFocus()]);

    // A freshly loaded document already has focus at its start; stealing it
    // for the first route would move the reader for a page they did not ask
    // to navigate to.
    expect(document.activeElement?.id).not.toBe('alpha');
    fixture.destroy();
  });

  it('focuses the arriving page landmark on a route change', async () => {
    const { fixture, router } = await createRoutedApp([
      provideMlvPageRouteFocus(),
    ]);

    await router.navigateByUrl('/beta');
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('beta');
    fixture.destroy();
  });

  it('ignores a navigation that only changes the query string', async () => {
    const { fixture, router } = await createRoutedApp([
      provideMlvPageRouteFocus(),
    ]);

    (document.body.querySelector('a') as HTMLElement).focus();
    await router.navigateByUrl('/alpha?tab=2');
    await fixture.whenStable();

    expect(document.activeElement?.id).not.toBe('alpha');
    fixture.destroy();
  });

  it('announces the visible heading instead of focusing under "announce"', async () => {
    const { fixture, router } = await createRoutedApp([
      provideMlvPageRouteFocus({ strategy: 'announce' }),
    ]);
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

    await router.navigateByUrl('/beta');
    await fixture.whenStable();

    expect(announce).toHaveBeenCalledWith('Beta', 'polite');
    expect(document.activeElement?.id).not.toBe('beta');
    fixture.destroy();
  });

  it('does nothing at all without the provider', async () => {
    const { fixture, router } = await createRoutedApp();

    await router.navigateByUrl('/beta');
    await fixture.whenStable();

    expect(document.activeElement?.id).not.toBe('beta');
    fixture.destroy();
  });
});

describe('MlvPageSkipLink', () => {
  it('targets the live page and follows a route change', async () => {
    const { fixture, router } = await createRoutedApp();
    const link = fixture.nativeElement.querySelector(
      'a[mlvPageSkipLink]',
    ) as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('#alpha');

    await router.navigateByUrl('/beta');
    await fixture.whenStable();

    expect(link.getAttribute('href')).toBe('#beta');
    fixture.destroy();
  });

  it('moves focus rather than navigating to the fragment', async () => {
    const { fixture } = await createRoutedApp();
    const link = fixture.nativeElement.querySelector(
      'a[mlvPageSkipLink]',
    ) as HTMLAnchorElement;

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('alpha');
    fixture.destroy();
  });

  it('emits no href while no page is mounted, so it is not a dead tab stop', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [MlvPageSkipLink],
    }).createComponent(
      (() => {
        @Component({
          template: '<a mlvPageSkipLink>Skip to content</a>',
          imports: [MlvPageSkipLink],
        })
        class BareHost {}
        return BareHost;
      })(),
    );
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.hasAttribute('href')).toBe(false);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

describe('provideMlvPageScrollRestoration', () => {
  it('reads and writes the page scrollport, not the document', async () => {
    const { fixture } = await createRoutedApp([
      provideMlvPageScrollRestoration(),
    ]);
    const scroller = TestBed.inject(ViewportScroller);
    const viewport = fixture.nativeElement.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;

    viewport.scrollTop = 240;
    expect(scroller.getScrollPosition()).toEqual([0, 240]);

    scroller.scrollToPosition([0, 0]);
    expect(viewport.scrollTop).toBe(0);
    fixture.destroy();
  });

  it('falls through to the document when no page is mounted', async () => {
    TestBed.configureTestingModule({
      providers: [provideMlvPageScrollRestoration()],
    });

    // Nothing registered, so the scroller must not invent a scrollport — the
    // document answer is the correct one for a route that renders no page.
    expect(TestBed.inject(ViewportScroller).getScrollPosition()).toEqual([
      window.scrollX,
      window.scrollY,
    ]);
  });
});

describe('MlvPageViewTransition', () => {
  it('holds the freeze until the last overlapping transition finishes', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(MlvPageViewTransition);

    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    service.track({ finished: new Promise<void>((r) => (resolveFirst = r)) });
    service.track({ finished: new Promise<void>((r) => (resolveSecond = r)) });

    expect(service.active()).toBe(true);
    expect(
      document.documentElement.hasAttribute('data-mlv-page-view-transition'),
    ).toBe(true);

    resolveFirst();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.active()).toBe(true);

    resolveSecond();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.active()).toBe(false);
    expect(
      document.documentElement.hasAttribute('data-mlv-page-view-transition'),
    ).toBe(false);
  });

  it('is wired by the router hook from inside the router injection context', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(MlvPageViewTransition);
    const hook = mlvPageViewTransitionHook();

    TestBed.runInInjectionContext(() =>
      hook({ transition: { finished: Promise.resolve() } }),
    );

    expect(service.active()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(service.active()).toBe(false);
  });
});
