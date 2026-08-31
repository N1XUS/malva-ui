import { InteractivityChecker } from '@angular/cdk/a11y';
import { Injectable, inject } from '@angular/core';

/**
 * Where an overlay should place focus once it is open.
 *
 * | Value              | Meaning                                                                      |
 * | ------------------ | ---------------------------------------------------------------------------- |
 * | `'auto'`           | The `[mlvAutofocus]` element if one is projected, else the first *meaningful* tabbable (see {@link MLV_OVERLAY_INITIAL_FOCUS_SKIP_SELECTOR}), else the container. |
 * | `'container'`      | The modal surface itself. Announces the dialog without pre-selecting a control. |
 * | `'first-tabbable'` | The first tabbable descendant in DOM order, with nothing skipped.             |
 * | `HTMLElement`      | That exact element.                                                          |
 * | any other string   | A CSS selector resolved against the overlay container.                        |
 *
 * Note that TypeScript widens the keyword members into `string`; they are kept
 * in the union for documentation and to keep the keyword spelling authoritative.
 */
export type MlvOverlayInitialFocus =
  | 'auto'
  | 'container'
  | 'first-tabbable'
  | HTMLElement
  | string;

/**
 * Selector for an element that opts itself in as the `'auto'` focus target.
 *
 * Matches the `[mlvAutofocus]` directive from `@malva-ui/cdk/utils` by
 * attribute, so the CDK layer does not have to depend on it.
 */
export const MLV_OVERLAY_AUTOFOCUS_SELECTOR = '[mlvAutofocus]';

/**
 * Elements that must not win `'auto'` initial focus even when they are the
 * first tabbable node inside the panel.
 *
 * - The close button is chrome, not content: capturing it made every drawer
 *   open with its "Close" tooltip popped and one keystroke from dismissal.
 * - The scrollbar viewport is a scroll region, not a control: focusing it drew
 *   a focus ring around the entire dialog body.
 *
 * Matching is per-element (never `closest()`), so a skipped node's descendants
 * remain candidates — that is the whole point for the scroll viewport, whose
 * children are the form controls we actually want.
 */
export const MLV_OVERLAY_INITIAL_FOCUS_SKIP_SELECTOR =
  '.mlv-button-close,.mlv-button--close,.mlv-scrollbar__viewport,[data-mlv-initial-focus-skip]';

/**
 * Resolves and applies an overlay's initial focus target.
 *
 * Shared by `MlvOverlayHostBase` (declarative `<mlv-drawer>`),
 * `MlvOverlayServiceBase` (imperative services), and the dialog's own CDK
 * container subclass, so every Malva overlay answers "what gets focus when
 * this opens?" identically.
 */
@Injectable({ providedIn: 'root' })
export class MlvOverlayInitialFocusResolver {
  /** @private CDK checker used to test focusability/tabbability of a candidate. */
  private readonly _checker = inject(InteractivityChecker);

  /**
   * Resolves the element that should receive focus.
   *
   * @param container - The modal surface to search within.
   * @param initialFocus - The requested strategy. Defaults to `'auto'`.
   * @returns The resolved element, or `null` when a selector matched nothing.
   */
  resolve(
    container: HTMLElement,
    initialFocus: MlvOverlayInitialFocus = 'auto',
  ): HTMLElement | null {
    if (typeof initialFocus !== 'string') {
      return initialFocus;
    }

    switch (initialFocus) {
      case 'container':
        return container;
      case 'first-tabbable':
        return this._firstTabbable(container);
      case 'auto':
        return this._resolveAuto(container);
      default:
        return container.querySelector<HTMLElement>(initialFocus);
    }
  }

  /**
   * Resolves the target and focuses it, falling back to the container.
   *
   * The container is made programmatically focusable first when it carries no
   * `tabindex` of its own — otherwise `focus()` on a plain `<div role="dialog">`
   * is a no-op and focus silently stays on the page behind the modal.
   *
   * @param container - The modal surface to search within.
   * @param initialFocus - The requested strategy. Defaults to `'auto'`.
   * @returns The element that was focused.
   */
  focus(
    container: HTMLElement,
    initialFocus: MlvOverlayInitialFocus = 'auto',
  ): HTMLElement {
    const target = this.resolve(container, initialFocus) ?? container;

    if (target === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }

    target.focus();
    return target;
  }

  /**
   * @private `'auto'`: prefer an explicit `[mlvAutofocus]` opt-in, then the
   * first tabbable that is not chrome, then the container itself.
   */
  private _resolveAuto(container: HTMLElement): HTMLElement {
    const autofocusHost = container.querySelector<HTMLElement>(
      MLV_OVERLAY_AUTOFOCUS_SELECTOR,
    );

    if (autofocusHost) {
      return this._firstTabbable(autofocusHost) ?? autofocusHost;
    }

    return (
      this._firstTabbable(container, MLV_OVERLAY_INITIAL_FOCUS_SKIP_SELECTOR) ??
      container
    );
  }

  /**
   * @private Depth-first, DOM-order search for the first tabbable element.
   *
   * `skipSelector` rejects the matching element only — the walk still descends
   * into it. Hidden subtrees are pruned entirely, which is also how an
   * ancestor's `display: none` keeps its children out of the results.
   */
  private _firstTabbable(
    root: HTMLElement,
    skipSelector?: string,
  ): HTMLElement | null {
    if (this._isHidden(root)) {
      return null;
    }

    if (
      this._isTabbable(root) &&
      !(skipSelector && root.matches(skipSelector))
    ) {
      return root;
    }

    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      const found = this._firstTabbable(child, skipSelector);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * @private Whether an element is reachable by Tab.
   *
   * `ignoreVisibility` is deliberate: the CDK's visibility test is geometric
   * (`offsetWidth`/`getClientRects`), and an overlay is measured before its
   * first paint — and never at all under jsdom — so the geometric check would
   * reject every candidate. Visibility is covered by {@link _isHidden} instead,
   * which reads declared state rather than layout.
   */
  private _isTabbable(element: HTMLElement): boolean {
    return (
      this._checker.isFocusable(element, { ignoreVisibility: true }) &&
      this._checker.isTabbable(element)
    );
  }

  /** @private Whether an element (and therefore its subtree) is hidden from users. */
  private _isHidden(element: HTMLElement): boolean {
    if (
      element.hasAttribute('hidden') ||
      element.getAttribute('aria-hidden') === 'true' ||
      element.hasAttribute('inert')
    ) {
      return true;
    }

    const view = element.ownerDocument.defaultView;
    if (!view) {
      return false;
    }

    const style = view.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden';
  }
}
