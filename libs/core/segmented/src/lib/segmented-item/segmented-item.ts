import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostAttributeToken,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { IsActiveMatchOptions } from '@angular/router';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs';
import { MLV_SEGMENTED } from '../segmented-token';

/** `RouterLinkActive`-style match options accepted by `linkActiveOptions`. */
export type MlvSegmentedLinkActiveOptions =
  | { exact: boolean }
  | IsActiveMatchOptions;

/**
 * Distinguishes a full `IsActiveMatchOptions` object from the `{ exact }`
 * shorthand (mirrors Angular's own `RouterLinkActive` check). `Router.isActive`
 * reads an object argument as raw `IsActiveMatchOptions` and would silently
 * ignore an `exact` key, so the shorthand must go through the boolean overload.
 */
function isFullMatchOptions(
  opts: MlvSegmentedLinkActiveOptions,
): opts is IsActiveMatchOptions {
  const o = opts as Partial<IsActiveMatchOptions>;
  return !!(o.paths || o.matrixParams || o.queryParams || o.fragment);
}

/**
 * One segment of an `mlv-segmented`. Enhances a native `<button>` (radio mode)
 * or `<a>` (link mode) — never a wrapper element, so native `disabled`,
 * `type`, `href`, `routerLink` and middle-click all keep working.
 *
 * Items must be direct children of `mlv-segmented`.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[mlvSegmentedItem], a[mlvSegmentedItem]',
  template: '<ng-content />',
  styleUrl: './segmented-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-segmented-item',
    '[class.mlv-segmented-item--active]': 'isActive()',
    '[class.mlv-segmented-item--disabled]': 'isDisabled()',
    '[class.mlv-segmented-item--link]': 'isLink',
    '[attr.role]': 'isLink ? null : "radio"',
    '[attr.aria-checked]': 'isLink ? null : isActive()',
    '[attr.aria-current]': 'isLink && isActive() ? "page" : null',
    '[attr.tabindex]': 'isLink ? (isDisabled() ? -1 : null) : tabIndex()',
    '[attr.disabled]': '!isLink && isDisabled() ? "" : null',
    '[attr.aria-disabled]': 'isLink && isDisabled() ? true : null',
    '[attr.type]': 'isLink ? null : _type',
    '(click)': '_onClick($event)',
    '(focus)': '_group.onItemFocus(this)',
  },
})
export class MlvSegmentedItem {
  /** Host element — read by the group for focus and pill measurement. */
  readonly elementRef = inject(ElementRef<HTMLElement>);

  /** @internal Parent group accessor (template-facing for the focus binding). */
  protected readonly _group = inject(MLV_SEGMENTED);

  /**
   * @internal `type` attribute reflected on `<button>` hosts: the consumer's
   * own value when present, else `"button"` so a segmented inside a `<form>`
   * never submits it.
   */
  protected readonly _type =
    inject(new HostAttributeToken('type'), { optional: true }) ?? 'button';

  /** Whether this item is an `<a>` (link mode) rather than a `<button>` (radio mode). */
  readonly isLink = this.elementRef.nativeElement.tagName === 'A';

  /** Value written to the group's `value` model when this item is selected (radio mode). */
  readonly value = input<unknown>(undefined);

  /** Disables this single item. The group's `disabled` disables all items. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Explicit active override. When set (`true`/`false`) it wins over the
   * value comparison (radio mode) and over router matching (link mode).
   */
  readonly active = input<boolean | undefined>(undefined);

  /**
   * Link mode only: match options for `Router.isActive` when the item carries a
   * `routerLink` but no `routerLinkActive` (same shape as `mlv-tab`).
   */
  readonly linkActiveOptions = input<MlvSegmentedLinkActiveOptions>({
    exact: false,
  });

  /** Roving tabindex (radio mode) — written by the group; `0` for the single tab stop. */
  readonly tabIndex = signal(-1);

  /** Item disabled by its own input or by the group. */
  readonly isDisabled = computed(
    () => this.disabled() || this._group.computedDisabled(),
  );

  /** @private Router — absent when the consumer app has no router. */
  private readonly _router = inject(Router, { optional: true });

  /** @private `routerLink` on this very element (link mode without `routerLinkActive`). */
  private readonly _routerLink = inject(RouterLink, {
    optional: true,
    self: true,
  });

  /** @private `routerLinkActive` on this very element — when present it owns the active state. */
  private readonly _routerLinkActive = inject(RouterLinkActive, {
    optional: true,
    self: true,
  });

  /**
   * @private Live `RouterLinkActive.isActive`, or `null` when the host has no
   * `routerLinkActive`.
   */
  private readonly _rlaActive = this._routerLinkActive
    ? toSignal(this._routerLinkActive.isActiveChange, {
        initialValue: this._routerLinkActive.isActive,
      })
    : null;

  /** @private Bumped on every `NavigationEnd` so `_routerActive` re-evaluates `Router.isActive`. */
  private readonly _navigationCount = signal(0);

  /** @private Removes the capture-phase disabled-click guard with the component. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @internal Router-derived active state for link items: `routerLinkActive`
   * when present on the host, else `Router.isActive(routerLink.urlTree,
   * linkActiveOptions)`. `false` for buttons and for links without a
   * `routerLink`.
   */
  protected readonly _routerActive = computed(() => {
    if (!this.isLink) return false;
    if (this._rlaActive) return this._rlaActive();
    this._navigationCount();
    const urlTree = this._routerLink?.urlTree ?? null;
    if (!this._router || !urlTree) return false;
    const opts = this.linkActiveOptions();
    return isFullMatchOptions(opts)
      ? this._router.isActive(urlTree, opts)
      : this._router.isActive(urlTree, opts.exact);
  });

  constructor() {
    // Without `routerLinkActive` nothing re-runs `Router.isActive` on its own,
    // so a navigation has to invalidate `_routerActive` explicitly.
    if (this.isLink && this._router && !this._rlaActive) {
      this._router.events
        .pipe(
          filter((e): e is NavigationEnd => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this._navigationCount.update((n) => n + 1));
    }

    // A disabled link needs a capture-phase guard to stay put. Angular
    // coalesces every host listener for one event on one element into a single
    // native listener and walks that chain unconditionally
    // (`__ngNextListenerFn__`), so `stopImmediatePropagation()` from `_onClick`
    // cannot stop `RouterLink.onClick` — which calls `Router.navigateByUrl()`
    // without ever reading `defaultPrevented`. A capture-phase listener runs
    // before the coalesced listener and stops it wholesale. `<button>` hosts
    // need none of this: a disabled button never dispatches `click`.
    if (this.isLink) {
      const element = this.elementRef.nativeElement;
      const guard = (event: Event): void => {
        if (!this.isDisabled()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      element.addEventListener('click', guard, true);
      this._destroyRef.onDestroy(() =>
        element.removeEventListener('click', guard, true),
      );
    }
  }

  /** Whether this item is the active segment (pill + `aria-checked` / `aria-current`). */
  readonly isActive = computed(() => {
    const explicit = this.active();
    if (explicit !== undefined) return explicit;
    if (this.isLink) return this._routerActive();
    const value = this.value();
    return value !== undefined && this._group.value() === value;
  });

  /** Focuses the host element (used by the group's `FocusKeyManager`). */
  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  /**
   * @internal Click handler. Radio-mode buttons ask the group to select this
   * item; disabled `<button>`s never fire `click` natively.
   *
   * Disabled links never reach this handler — the capture-phase guard installed
   * in the constructor stops the event first. The `preventDefault()` below is
   * the belt-and-braces fallback for a click that somehow bypasses it.
   *
   * The parameter must stay `Event`: host-binding type checking types `$event`
   * as `Event` (the compiler cannot infer the host element), so narrowing it to
   * `MouseEvent` breaks every consumer that compiles this source.
   */
  protected _onClick(event: Event): void {
    if (this.isDisabled()) {
      event.preventDefault();
      return;
    }
    if (!this.isLink) this._group.selectItem(this);
  }
}
