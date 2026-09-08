import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';

/**
 * What a projected header region can know about the collapse without anything
 * being wired to it.
 *
 * Carbon publishes the equivalent as three intersection-observer events plus a
 * render prop; a region here injects the token, or a consumer reads the same
 * three signals off a template reference variable (`#header="mlvPageHeader"`).
 * Either way there is no output to forward, no view query and no state to
 * mirror into the consumer's component.
 */
export interface MlvPageHeaderState {
  /** Collapse fraction of the owning page: 0 fully expanded .. 1 fully snapped. */
  readonly progress: Signal<number>;

  /** True while the chrome is closer to snapped than expanded. */
  readonly collapsed: Signal<boolean>;

  /**
   * True while the visible title node is wider than the space it has.
   *
   * The header cannot fix this for a consumer — how a truncated title should
   * degrade is theirs to decide (a tooltip, a shorter string, a second line) —
   * so it reports it instead of guessing.
   */
  readonly titleClipped: Signal<boolean>;
}

/** Collapse state of the enclosing `mlv-page-header`. */
export const MLV_PAGE_HEADER_STATE = new InjectionToken<MlvPageHeaderState>(
  'MLV_PAGE_HEADER_STATE',
);
