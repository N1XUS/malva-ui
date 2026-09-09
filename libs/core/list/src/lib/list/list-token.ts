import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';
import type { MlvListVariant } from './list';

/**
 * The slice of `mlv-list` its descendants are allowed to read.
 *
 * Kept to the variant deliberately: the variant is the only list-level decision
 * that changes what a descendant *renders* rather than only how it looks. See
 * `MlvListItemGroup`, which renders no toggler when the variant pins its
 * content open.
 */
export interface MlvListAccessor {
  /** Visual variant of the enclosing list. See {@link MlvListVariant}. */
  readonly variant: Signal<MlvListVariant>;
}

/**
 * Injection token for the enclosing `mlv-list`, provided by `MlvList` itself.
 *
 * Resolution is lexical (Angular's element injector), not DOM-based: a group
 * declared inside `<mlv-list>` in the same template resolves it, and one merely
 * projected into a list from elsewhere does not. Inject it `{ optional: true }`
 * — every list child is documented as usable on its own.
 */
export const MLV_LIST = new InjectionToken<MlvListAccessor>('MLV_LIST');
