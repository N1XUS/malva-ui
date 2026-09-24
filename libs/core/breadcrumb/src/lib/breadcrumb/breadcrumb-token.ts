import { InjectionToken } from '@angular/core';
import type { Signal, TemplateRef } from '@angular/core';

/**
 * @internal The slice of `nav[mlvBreadcrumb]` a projected
 * `<mlv-breadcrumb-item>` reads to render the gap after itself.
 *
 * Projected mode hands the trail to the consumer's own elements, which the
 * breadcrumb's template never stamps, so the separator has to travel to them:
 * each crumb but the last renders {@link _separatorTemplate} after its link,
 * inside its own `listitem`, exactly where the data-driven `<li>` puts it.
 *
 * Both members are `_`-prefixed and therefore outside the public surface
 * (`VERSIONING.md` §2), and the token itself is deliberately not exported
 * from the barrel.
 */
export interface MlvBreadcrumbAccessor {
  /**
   * The breadcrumb's one separator: a `<span class="mlv-breadcrumb__separator">`
   * wrapping the consumer's `[mlvSeparator]` template, or the default chevron,
   * and honouring `hideSeparatorFromScreenReaders`. Both modes stamp this same
   * template, so a projected gap cannot drift from a data-driven one.
   * `undefined` until the breadcrumb's view exists.
   */
  readonly _separatorTemplate: Signal<TemplateRef<unknown> | undefined>;

  /**
   * The last `<mlv-breadcrumb-item>` declared in the breadcrumb's content, in
   * document order — the one crumb with no gap after it. Follows `@for` /
   * `@if` changes, so the trailing gap moves when the last crumb does.
   */
  readonly _lastProjectedItem: Signal<object | undefined>;
}

/**
 * @internal Injection token for the enclosing `nav[mlvBreadcrumb]`, provided by
 * `MlvBreadcrumb` itself.
 *
 * Resolution is lexical (Angular's element injector): a crumb declared inside
 * `<nav mlvBreadcrumb>` resolves it, and a crumb rendered anywhere else does
 * not — inject it `{ optional: true }`, and render no separator without it.
 */
export const MLV_BREADCRUMB = new InjectionToken<MlvBreadcrumbAccessor>(
  'MLV_BREADCRUMB',
);
