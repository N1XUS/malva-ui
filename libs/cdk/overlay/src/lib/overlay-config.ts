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
