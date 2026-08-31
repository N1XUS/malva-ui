/**
 * Represents a single breadcrumb navigation item.
 *
 * Use this interface when providing items data-driven via the `items` input
 * on `MlvBreadcrumb`.
 */
export interface MlvBreadcrumbEntry {
  /** Display label for this breadcrumb step. */
  label: string;

  /**
   * Router link for Angular router navigation.
   * Passed directly to `[routerLink]` on the anchor element.
   * Use either `routerLink` or `href`, not both.
   */
  routerLink?: string | string[];

  /**
   * Raw href for standard anchor navigation.
   * Use either `href` or `routerLink`, not both.
   */
  href?: string;

  /**
   * When `true`, marks this step as **deliberately switched off** — a
   * destination that exists but is currently unavailable to this user (no
   * permission, not yet provisioned, gated behind a plan).
   *
   * This is **not** the way to express an ancestor step that simply has
   * nowhere to navigate to — a grouping label such as "Settings" in
   * `Settings › Personal › Profile`. For those, omit both `routerLink` and
   * `href` and leave `disabled` unset: the item renders as a plain, readable,
   * non-interactive crumb (`.mlv-breadcrumb__link--plain`). Marking a plain
   * ancestor `disabled` tells assistive technology something false and opts
   * the crumb into the disabled colour ramp.
   */
  disabled?: boolean;
}
