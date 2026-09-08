import { ApplicationInitStatus } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import type { Subject } from 'rxjs';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { MlvThemeService } from '@malva-ui/cdk/theme';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { DocsShellComponent } from './docs-shell';

/**
 * `Router.events` is a read-only getter over a private `Subject`. Pushing through
 * that Subject emits a real `NavigationEnd` on the real `Router` instance, so the
 * shell's own subscription (the `instanceof NavigationEnd` filter and its
 * `takeUntilDestroyed`) is exercised without configuring routes or navigating —
 * the spec's `provideRouter([])` setup has no routes to navigate to.
 */
function emitNavigationEnd(url = '/dialog'): void {
  const router = TestBed.inject(Router) as unknown as {
    _events: Subject<NavigationEnd>;
  };
  router._events.next(new NavigationEnd(1, url, url));
}

/** Lets the shell's `setTimeout(...)` focus/scroll callback run. */
function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('DocsShellComponent', () => {
  let fixture: ComponentFixture<DocsShellComponent>;

  beforeEach(async () => {
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
    document.documentElement.lang = 'en';

    await TestBed.configureTestingModule({
      imports: [DocsShellComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync('noop'),
        provideMlvDensity('comfortable'),
        provideMlvI18n(() => import('@malva-ui/i18n/en')),
      ],
    }).compileComponents();
    await TestBed.inject(ApplicationInitStatus).donePromise;

    fixture = TestBed.createComponent(DocsShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('delegates global chrome to the shared app bar', () => {
    expect(fixture.nativeElement.querySelector('docs-app-bar')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('header')).toHaveLength(1);
  });

  /**
   * The documentation pages are scrolled by the *document*, not by a track
   * inside the shell: `.docs-shell__main-area` declares no scroller of its own,
   * `docs-toc` is `position: sticky` against the viewport, and the shell's own
   * `NavigationEnd` handler resets `window.scrollTo`. `sizing="viewport"` makes
   * the shell a bounded `calc(100svh - inset)` box whose content track is
   * `overflow: hidden`, so every page taller than the viewport was silently
   * clipped with nothing able to scroll it.
   */
  /**
   * `mlv-page-shell` derives a rail's text, hover and active colours from its
   * own chrome, which is right for an application frame in a brand colour and
   * wrong for the documentation rail — it should look like every other
   * `mlv-sidebar` the site documents. Scoping the rail to a theme is the
   * shell's own opt-out, and binding the *resolved* theme rather than a
   * literal keeps it following the theme switcher.
   */
  it('scopes the navigation rail to the resolved theme', () => {
    const rail = fixture.nativeElement.querySelector(
      'mlv-sidebar',
    ) as HTMLElement;

    expect(rail.getAttribute('mlvTheme')).toBe(
      TestBed.inject(MlvThemeService).currentTheme(),
    );
  });

  it('is content-sized, so the document scrolls the page', () => {
    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;

    expect(shell.classList.contains('mlv-page-shell--sizing-content')).toBe(
      true,
    );
    expect(shell.classList.contains('mlv-page-shell--sizing-viewport')).toBe(
      false,
    );
  });

  describe('navigation trigger', () => {
    function trigger(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('.docs-shell__mobile-menu');
    }

    it('is the first item of the app bar, ahead of the brand link', () => {
      const nav = fixture.nativeElement.querySelector(
        'header nav[aria-label="Primary"]',
      ) as HTMLElement;

      expect(nav.firstElementChild).toBe(trigger());
      expect(
        nav
          .querySelector('.mlv-action-bar__logo')
          ?.compareDocumentPosition(trigger()) as number &
          Node['DOCUMENT_POSITION_PRECEDING'],
      ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
      expect(
        fixture.nativeElement.querySelector(
          '.docs-shell__main-area .docs-shell__mobile-menu',
        ),
      ).toBeNull();
    });

    it('toggles the sidebar and reflects it as aria-expanded', async () => {
      const shell = fixture.componentInstance;
      expect(trigger().getAttribute('aria-label')).toBe(
        'Close documentation navigation',
      );
      expect(trigger().getAttribute('aria-expanded')).toBe('true');

      trigger().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(shell.sidebarCollapsed()).toBe(true);
      expect(trigger().getAttribute('aria-label')).toBe(
        'Open documentation navigation',
      );
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('NavigationEnd focus guard', () => {
    let main: HTMLElement;
    let scrollTo: ReturnType<typeof vi.spyOn>;
    const stubs: HTMLElement[] = [];

    /** Appends a node that the guard has to see, and schedules its cleanup. */
    function track<T extends HTMLElement>(el: T): T {
      stubs.push(el);
      return el;
    }

    function overlayContainer(): HTMLElement {
      const container = document.createElement('div');
      container.className = 'cdk-overlay-container';
      document.body.appendChild(container);
      return track(container);
    }

    function focusableButton(parent: HTMLElement): HTMLButtonElement {
      const button = document.createElement('button');
      button.type = 'button';
      parent.appendChild(button);
      return track(button);
    }

    beforeEach(() => {
      // A previous test's popup may leave a real overlay container behind, and
      // `querySelector` would return that one instead of the stub below.
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((el) => el.remove());
      main = fixture.nativeElement.querySelector('main.docs-shell__content');
      // jsdom's own `scrollTo` logs a "Not implemented" error; stub it out.
      scrollTo = vi
        .spyOn(window, 'scrollTo')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      stubs.splice(0).forEach((el) => el.remove());
      scrollTo.mockRestore();
    });

    it('focuses main content on a plain navigation', async () => {
      document.body.focus();

      emitNavigationEnd();
      await flushMacrotask();

      expect(document.activeElement).toBe(main);
      expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });
    });

    it('leaves focus alone while a modal dialog is open, but still resets scroll', async () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      overlayContainer().appendChild(dialog);
      const dialogButton = focusableButton(dialog);
      dialogButton.focus();

      emitNavigationEnd('/dialog/edit');
      await flushMacrotask();

      expect(document.activeElement).toBe(dialogButton);
      expect(document.activeElement).not.toBe(main);
      expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });
    });

    it('leaves focus alone for an alertdialog too', async () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'alertdialog');
      overlayContainer().appendChild(dialog);

      emitNavigationEnd('/dialog/edit');
      await flushMacrotask();

      expect(document.activeElement).not.toBe(main);
    });

    it('leaves focus alone when it already sits inside the overlay container', async () => {
      // No dialog role — a non-modal overlay such as the sidebar flyout.
      const flyoutButton = focusableButton(overlayContainer());
      flyoutButton.focus();

      emitNavigationEnd();
      await flushMacrotask();

      expect(document.activeElement).toBe(flyoutButton);
      expect(document.activeElement).not.toBe(main);
    });

    it('leaves focus alone when it already sits on an element inside main', async () => {
      // Models the trigger a closing route dialog restores focus to: it lives in
      // the surviving main content, so <main> must not pull focus off it.
      const trigger = focusableButton(main);
      trigger.focus();

      emitNavigationEnd('/dialog');
      await flushMacrotask();

      expect(document.activeElement).toBe(trigger);
      expect(document.activeElement).not.toBe(main);
    });

    it('still focuses main when main itself holds focus and nothing else claims it', async () => {
      main.focus();

      emitNavigationEnd();
      await flushMacrotask();

      expect(document.activeElement).toBe(main);
    });
  });
});
