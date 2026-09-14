import {
  afterNextRender,
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MlvPageRegistry } from './page-registry';

/**
 * How a route arrival is communicated to a screen reader.
 *
 * - `'focus'` (default) moves focus to the new page's `<main>` landmark. The
 *   landmark carries `tabindex="-1"`, so the reader announces the landmark and
 *   starts reading from its top — and the next Tab continues from inside the
 *   new content instead of restarting at the top of the document.
 * - `'announce'` leaves focus alone and speaks the page's name through a live
 *   region. For an application that deliberately keeps focus where it was — a
 *   list-detail flow where the reader is still working the list — this is the
 *   correct one.
 * - `'both'` does both. It is deliberately **not** the default: focusing a
 *   landmark already announces it, so a live region on top says the same thing
 *   twice for most readers.
 */
export type MlvPageRouteFocusStrategy = 'focus' | 'announce' | 'both';

/** Options for {@link provideMlvPageRouteFocus}. */
export interface MlvPageRouteFocusOptions {
  /** How arrival is communicated. See {@link MlvPageRouteFocusStrategy}. */
  readonly strategy?: MlvPageRouteFocusStrategy;

  /** Live-region politeness used by the `announce` strategies. */
  readonly politeness?: 'polite' | 'assertive';

  /**
   * Produces the string announced on arrival. Defaults to the page's own
   * visible `<h1>` when it has one, falling back to `document.title`.
   *
   * Returning `null` announces nothing for that navigation.
   */
  readonly announceWith?: (
    page: HTMLElement,
    document: Document,
  ) => string | null;

  /**
   * Whether a navigation that changes only the fragment or the query string is
   * treated as an arrival. Default `false`: an in-page anchor is not a new
   * page, and stealing focus from it would undo the jump the reader asked for.
   */
  readonly includeSameRouteNavigations?: boolean;
}

/** @internal Options token consumed by {@link MlvPageRouteFocusHandler}. */
export const MLV_PAGE_ROUTE_FOCUS_OPTIONS =
  new InjectionToken<MlvPageRouteFocusOptions>('MLV_PAGE_ROUTE_FOCUS_OPTIONS', {
    providedIn: 'root',
    factory: (): MlvPageRouteFocusOptions => ({}),
  });

/**
 * Moves focus to the page landmark after each router navigation.
 *
 * Instantiated by {@link provideMlvPageRouteFocus}; there is nothing to call
 * on it, and injecting it directly does not enable the behaviour, because the
 * provider is what installs the environment initializer that constructs it.
 */
@Injectable({ providedIn: 'root' })
export class MlvPageRouteFocusHandler {
  /** @private The registry the arriving page is read from. */
  private readonly _registry = inject(MlvPageRegistry);

  /** @private Resolved options, with every default already applied. */
  private readonly _options = inject(MLV_PAGE_ROUTE_FOCUS_OPTIONS);

  /** @private Live region used by the announcing strategies. */
  private readonly _announcer = inject(LiveAnnouncer);

  /** @private Owning document; never the ambient global. */
  private readonly _document = inject(DOCUMENT);

  /** @private Injector an `afterNextRender` callback is scheduled against. */
  private readonly _injector = inject(Injector);

  /** @private Teardown boundary for the router subscription. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Whether this is a browser; server navigation focuses nothing. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * @private Path of the previous navigation, without query or fragment.
   *
   * `null` until the first navigation completes, which is what makes the
   * initial page load a non-arrival: the reader is already at the top of a
   * freshly loaded document and has not asked to go anywhere.
   */
  private _previousPath: string | null = null;

  constructor() {
    inject(Router)
      .events.pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((event) => this._onNavigationEnd(event));
  }

  /**
   * @private Decides whether a completed navigation is an arrival, and if so
   * acts on it once the incoming page has actually rendered.
   */
  private _onNavigationEnd(event: NavigationEnd): void {
    const path = event.urlAfterRedirects.split(/[?#]/)[0];
    const previous = this._previousPath;
    this._previousPath = path;

    if (!this._isBrowser || previous === null) {
      return;
    }
    if (path === previous && !this._options.includeSameRouteNavigations) {
      return;
    }

    // The outlet activates the incoming component during `activateRoutes`,
    // before `NavigationEnd`, so the registry already holds the new page here
    // — but its view has not been change-detected, so its `<h1>` does not
    // exist yet. Attaching that view notifies the scheduler, so a render is
    // already on the way; this rides it rather than forcing one.
    afterNextRender(
      { read: () => this._arrive() },
      { injector: this._injector },
    );
  }

  /** @private Acts on the page that is now on screen. */
  private _arrive(): void {
    const page = this._registry.active();
    if (!page) {
      return;
    }

    const strategy = this._options.strategy ?? 'focus';
    if (strategy !== 'announce') {
      // A route arrival scrolls the new page to its own top on its own; moving
      // focus must not additionally scroll the landmark into view, which on a
      // page whose scrollport is an inner element would scroll the *document*.
      page.element.focus({ preventScroll: true });
    }
    if (strategy !== 'focus') {
      const message = this._announcementFor(page.element);
      if (message) {
        void this._announcer.announce(
          message,
          this._options.politeness ?? 'polite',
        );
      }
    }
  }

  /** @private Resolves the string to announce for one arrival. */
  private _announcementFor(page: HTMLElement): string | null {
    if (this._options.announceWith) {
      return this._options.announceWith(page, this._document);
    }

    // `mlv-page-header` renders the projected title twice, at two type roles,
    // and marks the one that is off screen `aria-hidden` + `inert`. Reading
    // the first `<h1>` blindly would announce whichever copy happened to come
    // first in the DOM, including the hidden one.
    const heading = Array.from(page.querySelectorAll('h1')).find(
      (candidate) =>
        !candidate.closest('[aria-hidden="true"]') &&
        !candidate.closest('[inert]'),
    );
    return heading?.textContent?.trim() || this._document.title || null;
  }
}

/**
 * Moves focus to the arriving `main[mlvPage]` landmark after each router
 * navigation, so a single-page application announces its route changes.
 *
 * This is the most common accessibility defect in single-page applications:
 * nothing tells a screen reader that the content changed, and the next Tab
 * restarts at the top of the document rather than continuing inside the new
 * page. `main[mlvPage]` already carries the `tabindex="-1"` landmark that
 * makes the fix possible; this provider is the router half of it.
 *
 * It is a **provider rather than page behaviour** so that the router lifecycle
 * stays out of every page instance: `@angular/router` is then a dependency of
 * the application that opted in, not of every consumer of `mlv-page-header`.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideRouter(routes), provideMlvPageRouteFocus()],
 * });
 * ```
 *
 * The first navigation is deliberately not an arrival — a freshly loaded
 * document already has focus at its start — and neither is a navigation that
 * changes only the fragment or query string, unless
 * {@link MlvPageRouteFocusOptions.includeSameRouteNavigations} says so.
 *
 * @param options Overrides for the strategy, politeness and announcement text.
 */
export function provideMlvPageRouteFocus(
  options: MlvPageRouteFocusOptions = {},
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: MLV_PAGE_ROUTE_FOCUS_OPTIONS, useValue: options },
    provideEnvironmentInitializer(() => {
      inject(MlvPageRouteFocusHandler);
    }),
  ];
}
