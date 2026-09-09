import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';
import type { MlvListVariant } from './list';

/**
 * The slice of `mlv-list` its descendants are allowed to read.
 *
 * Both members exist for the same reason: they are the list-level decisions
 * that change what a descendant *renders*, not merely how it looks. See
 * `MlvListItemGroup`, which reads {@link variant} to decide whether a toggler
 * may exist at all, and {@link listRole} to decide which ARIA roles — if any —
 * it is allowed to claim.
 *
 * Keep it that way. A descendant that only needs to *look* different has the
 * cascade for that: `MlvList` stamps `mlv-list--<variant>` and
 * `mlv-list--appearance-menu` on its own host, and every descendant stylesheet
 * can match on those without a DI edge.
 */
export interface MlvListAccessor {
  /** Visual variant of the enclosing list. See {@link MlvListVariant}. */
  readonly variant: Signal<MlvListVariant>;

  /**
   * WAI-ARIA role rendered on the enclosing list's host element — `'list'`
   * unless a consumer overrode it.
   *
   * A container role owns the roled and focusable descendants it reaches
   * through roleless wrappers, and each one owns a different, closed set of
   * child roles. So a descendant that claims a role of its own has to know
   * which container it is inside: `listitem` is right under `role="list"` and
   * invalid under `role="menu"`, which owns no such child. Typed `string`
   * because {@link MlvList.listRole} is — the input is deliberately open, so a
   * reader must treat any unrecognised value as "a container whose children I
   * know nothing about" rather than assume the default.
   */
  readonly listRole: Signal<string>;
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
