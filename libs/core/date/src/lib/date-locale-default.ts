import { inject, InjectionToken, untracked } from '@angular/core';
import { MLV_LOCALE } from '@malva-ui/i18n';

/**
 * @internal What `MLV_DATE_LOCALE`'s default factory resolved in this
 * application, or `null` while it has not run.
 */
export interface MlvDateLocaleDefaultRecord {
  /** The locale the default factory returned; `null` until it runs. */
  resolved: string | null;
}

/**
 * @internal Root record `MLV_DATE_LOCALE`'s default factory writes to, so
 * `MlvNativeDateAdapter` can tell a **provided** `MLV_DATE_LOCALE` from a
 * defaulted one by where the value came from rather than by what it is.
 *
 * A string token has no identity to compare, and comparing its value with the
 * app locale is the defect review #306 F1 found: an explicit `'de'` in a `de`
 * app read as "defaulted" and followed the next switch. A root factory runs
 * only when no provider for the token exists between the injecting injector and
 * the root, so `resolved` stays `null` in an application that provides the
 * token at its root — the common `provideMlvDateAdapter(A, locale)` case — and
 * the adapter is pinned whatever the value.
 *
 * Residual: a token provided in a **child** injector (a lazy route, a
 * component) with the same value the root default already resolved for another
 * consumer is indistinguishable from the default, and follows. Kept out of the
 * barrel.
 */
export const MLV_DATE_LOCALE_DEFAULT_RECORD =
  new InjectionToken<MlvDateLocaleDefaultRecord>(
    'MLV_DATE_LOCALE_DEFAULT_RECORD',
    { providedIn: 'root', factory: () => ({ resolved: null }) },
  );

/**
 * @internal `MLV_DATE_LOCALE`'s default factory: `MLV_LOCALE` as it stands when
 * the token is first injected, recorded in {@link MLV_DATE_LOCALE_DEFAULT_RECORD}.
 * Must run in an injection context.
 */
export function mlvDateLocaleDefault(): string {
  const locale = untracked(inject(MLV_LOCALE));
  inject(MLV_DATE_LOCALE_DEFAULT_RECORD).resolved = locale;
  return locale;
}
