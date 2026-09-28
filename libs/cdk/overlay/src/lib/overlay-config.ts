import type { Injector } from '@angular/core';
import type { MlvDirection } from '@malva-ui/cdk/utils';
import type { MlvOverlayInitialFocus } from './overlay-initial-focus';

/**
 * Shared configuration fields consumed by every imperative overlay service
 * built on top of {@link MlvOverlayServiceBase} (today: `MlvDrawerService`,
 * through `MlvDrawerConfig`). Concrete services extend this interface with
 * their own surface-specific options (size, position, snap points, …).
 */
export interface MlvBaseOverlayConfig {
  /** Arbitrary data injected into the opened component via the service's data token. */
  data?: unknown;
  /** Whether clicking the backdrop closes the overlay. Defaults to `true`. */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the overlay. Defaults to `true`. */
  closeOnEscape?: boolean;
  /**
   * Whether browser history navigation — Back / Forward, or a `hashchange` —
   * closes the overlay. A `hashchange` includes following a plain in-page
   * link (`<a href="#section">`), one inside the overlay's own content too.
   *
   * It closes through the ref, as a backdrop click or Escape does:
   * `beforeClose()` emits, the leave animation plays, and `afterClosed()`
   * emits once, with no result, when it ends. The page is handed back at
   * once, though, before the navigation runs: page scroll is unblocked and
   * restored, focus returns to the element that was focused when the overlay
   * opened, if it is still in the document, and the leaving overlay is made
   * `inert`.
   *
   * A router navigation (`router.navigate()`, a `routerLink`) writes history
   * without a pop event and closes nothing. These are the events CDK's
   * `disposeOnNavigation` and `MlvDialogConfig.closeOnNavigation` react to.
   *
   * Defaults to `false`; the next major changes the default to `true` for
   * dialog parity. Routable drawers (`mlvGenerateRoutableDrawerRoute()`)
   * never take this close: their route closes them when navigation leaves it.
   */
  closeOnNavigation?: boolean;
  /** Custom parent injector for the opened component. Used by routable overlays to pass the route's injector. */
  injector?: Injector;
  /**
   * Text direction applied to the overlay pane.
   *
   * A CDK overlay is portaled to the container on `<body>`, so it never
   * inherits a `[dir]` scope the trigger sits in. Defaults to the direction
   * resolved from the element focused when the overlay was opened (the
   * trigger, in practice), then the global direction. Set it explicitly when
   * the overlay is opened without a focused trigger inside the intended scope.
   */
  direction?: MlvDirection;

  /**
   * Where focus lands once the overlay is open. Defaults to `'auto'`, which
   * prefers a projected `[mlvAutofocus]` element and otherwise skips chrome
   * such as the close button and the scroll viewport.
   *
   * @see MlvOverlayInitialFocus
   */
  initialFocus?: MlvOverlayInitialFocus;
}
