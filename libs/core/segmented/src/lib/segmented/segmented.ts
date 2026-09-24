import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import type { FocusableOption } from '@angular/cdk/a11y';
import {
  MLV_FORM_CONTROL,
  MlvDescription,
  MlvLabel,
  MlvMessage,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MlvResizeObserverService, MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvSegmentedItem } from '../segmented-item/segmented-item';
import type { MlvSegmentedAccessor } from '../segmented-token';
import { MLV_SEGMENTED } from '../segmented-token';
import type {
  MlvSegmentedOrientation,
  MlvSegmentedTone,
} from '../segmented.types';

/**
 * `FocusKeyManager` requires `FocusableOption` (`disabled?: boolean`), which is
 * incompatible with the item's coerced `disabled` input signal. Disabled
 * skipping goes through `skipPredicate`, so the intersection is only a typing
 * bridge (same approach as `mlv-radio-group`).
 */
type SegmentedFocusItem = MlvSegmentedItem & FocusableOption;

/**
 * Segmented control: a grey track holding `mlvSegmentedItem` buttons or links,
 * with a raised pill sliding behind the active one (the boxed-tabs look).
 *
 * - **Radio mode** (`<button mlvSegmentedItem value="…">`): a signal-form
 *   control (`[(value)]`, `[(ngModel)]`, `[formField]`) with `role="radiogroup"`
 *   semantics, arrow-key navigation and a roving tabindex.
 * - **Link mode** (`<a mlvSegmentedItem routerLink="…">`): plain navigation
 *   links; the active one is derived from the router and marked
 *   `aria-current="page"`.
 */
@Component({
  selector: 'mlv-segmented',
  templateUrl: './segmented.html',
  styleUrl: './segmented.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLabel, MlvDescription, MlvMessage],
  hostDirectives: [
    { directive: MlvDensityDirective, inputs: ['mlvDensity: mlvDensity'] },
  ],
  providers: [
    { provide: MLV_SEGMENTED, useExisting: forwardRef(() => MlvSegmented) },
    { provide: MLV_FORM_CONTROL, useExisting: forwardRef(() => MlvSegmented) },
    { provide: MLV_DENSITY_ELEMENT, useValue: 'segmented' },
  ],
  host: {
    class: 'mlv-segmented',
    '[class]': '_hostModifiers()',
    '[class.mlv-segmented--disabled]': 'computedDisabled()',
    '[class.mlv-segmented--readonly]': 'readonly()',
    '[class.mlv-segmented--equal-width]': 'equalWidth()',
    '[class.mlv-segmented--link]': '_isLinkMode()',
    '[class.mlv-segmented--measured]': '_measured()',
    '[attr.id]': 'id()',
  },
})
export class MlvSegmented
  extends MlvSignalFormControlBase<unknown>
  implements MlvSegmentedAccessor
{
  /** Two-way bindable selected value (radio mode). */
  readonly value = model<unknown>();

  /** Colour of the active pill — `'neutral'` (boxed-tabs white) or a pale semantic tone. */
  readonly tone = input<MlvSegmentedTone>('neutral');

  /** Layout axis of the track. */
  readonly orientation = input<MlvSegmentedOrientation>('horizontal');

  /** Stretch the track to its container and give every item the same size. */
  readonly equalWidth = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Projected items in DOM order. */
  readonly items = contentChildren(MlvSegmentedItem, { descendants: true });

  /** Whether the control holds a value — a segment is selected. */
  readonly hasValue = computed(() => this.value() != null);

  /** @internal Track element hosting the pill and the projected items. */
  protected readonly _trackRef =
    viewChild.required<ElementRef<HTMLElement>>('track');

  /** @internal Link mode: any item is an `<a>`. */
  protected readonly _isLinkMode = computed(() =>
    this.items().some((i) => i.isLink),
  );

  /** @internal The item currently rendered as active, if any. */
  protected readonly _activeItem = computed(
    () => this.items().find((i) => i.isActive()) ?? null,
  );

  /** @internal Set once the pill has been positioned; enables the slide transition. */
  protected readonly _measured = signal(false);

  /** @internal Tone / orientation / state modifier classes. */
  protected readonly _hostModifiers = computed(
    () =>
      `mlv-segmented--tone-${this.tone()} mlv-segmented--${this.orientation()} mlv-segmented--state-${this.resolvedState()}`,
  );

  /** @private Roving-focus manager over the items (radio mode only). */
  private _keyManager: FocusKeyManager<MlvSegmentedItem> | null = null;

  /** @private Guards the mixed `<a>` / `<button>` dev warning to one per group instance. */
  private _warnedMixed = false;

  /** @private Guards the multiple-active dev warning to one per group instance. */
  private _warnedMultiActive = false;

  /** @private Destroys the key manager with the component. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Shared ResizeObserver — re-measures the pill when the track resizes (fonts, density, content). */
  private readonly _resizeService = inject(MlvResizeObserverService);

  /** @private Normalizes horizontal segment navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element. Both direction-aware halves of this component — the
   * pill measurement and the arrow-key model — resolve against it, so they can
   * never disagree about which direction applies inside a `[dir]` scope.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Effective direction of this group, tracking both the global
   * direction and any `[dir]` scope above the host. Drives pill re-measurement.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /** @private Bumped on every track resize to re-run the measuring render effect. */
  private readonly _layoutVersion = signal(0);

  constructor() {
    super();
    // Touched when focus leaves the whole control — not when a segment is
    // chosen while focus stays on the track (#347, D22).
    this._reportTouchOnFocusLeave({ enabled: () => !this._isLinkMode() });

    this._destroyRef.onDestroy(() => this._keyManager?.destroy());

    // Rebuild the manager whenever the projected set (or the mode) changes.
    effect(() => {
      const items = [...this.items()];
      const linkMode = this._isLinkMode();
      untracked(() => {
        this._keyManager?.destroy();
        this._keyManager = null;
        if (linkMode || items.length === 0) return;
        this._keyManager = new FocusKeyManager<MlvSegmentedItem>(
          items as SegmentedFocusItem[],
        )
          .skipPredicate((item) => item.isDisabled())
          .withWrap();
      });
    });

    // Roving tabindex (radio mode): the active item is the single tab stop, or
    // the first enabled item when nothing is selected / the selection is disabled.
    effect(() => {
      const items = this.items();
      if (this._isLinkMode()) return;
      const active = this._activeItem();
      const firstEnabled = items.find((i) => !i.isDisabled()) ?? null;
      const stop = active && !active.isDisabled() ? active : firstEnabled;
      items.forEach((i) => i.tabIndex.set(i === stop ? 0 : -1));
    });

    // Dev-only diagnostics for the two group shapes that break silently: a
    // group mixing `<a>` and `<button>` hosts (link mode wins, so the buttons
    // lose their radio keyboard model), and a radio group rendering more than
    // one active item (two `aria-checked="true"` radios). Each warns once per
    // group instance; in production the guard reads no signal, so the effect
    // registers no dependency and never re-runs.
    effect(() => {
      if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
      const items = this.items();
      const linkMode = this._isLinkMode();

      if (!this._warnedMixed) {
        const links = items.filter((i) => i.isLink).length;
        if (links > 0 && links < items.length) {
          this._warnedMixed = true;
          console.warn(
            '[mlv-segmented] Mixing <a mlvSegmentedItem> and <button mlvSegmentedItem> in one group is unsupported: the group switches to link mode and the buttons lose their radio keyboard model.',
          );
        }
      }

      const activeCount = items.filter((i) => i.isActive()).length;
      if (!linkMode && !this._warnedMultiActive && activeCount > 1) {
        this._warnedMultiActive = true;
        console.warn(
          '[mlv-segmented] More than one item is active in a radio-mode group: [active] is an uncontrolled override and must not be combined with a value-driven selection of another item — two radios now report aria-checked="true".',
        );
      }
    });

    // Observe the track once it exists; every resize re-measures the pill.
    afterNextRender(() => {
      this._resizeService
        .observe(this._trackRef().nativeElement)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._layoutVersion.update((n) => n + 1));
    });

    // Position the pill after every render in which the active item, the item
    // set, the layout inputs or the track size changed.
    afterRenderEffect(() => {
      const active = this._activeItem();
      this.items();
      this.orientation();
      this.equalWidth();
      this._layoutVersion();
      // Mirroring the group moves every item without resizing it, so the
      // ResizeObserver behind `_layoutVersion` never fires. The direction is
      // its own dependency, scoped to this host so a `[dir]` on any ancestor
      // counts — not just a document-level flip.
      this._direction();
      untracked(() => this._measure(active));
    });
  }

  /**
   * Selects `item` (radio mode). Ignored while the group is disabled or
   * readonly. Does **not** mark the control touched: that happens when focus
   * leaves the control (#347), so choosing a segment never shows a validation
   * error before the user has moved on.
   */
  selectItem(item: MlvSegmentedItem): void {
    if (this.computedDisabled() || this.readonly() || item.isDisabled()) return;
    this.value.set(item.value());
    item.focus();
  }

  /** Keeps the key manager's active item in sync with the item that received DOM focus. */
  onItemFocus(item: MlvSegmentedItem): void {
    const index = this.items().indexOf(item);
    if (index >= 0) this._keyManager?.setActiveItem(index);
  }

  /**
   * @internal Track keydown handler (radio mode). ArrowLeft/ArrowUp → previous,
   * ArrowRight/ArrowDown → next (wrapping, skipping disabled), Home/End → first/last.
   * Moving focus also selects (WAI-ARIA radio group), unless the group is readonly.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    const manager = this._keyManager;
    if (!manager) return;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case RIGHT_ARROW:
      case DOWN_ARROW:
        if (manager.activeItem) manager.setNextItemActive();
        else manager.setFirstItemActive();
        break;
      case LEFT_ARROW:
      case UP_ARROW:
        if (manager.activeItem) manager.setPreviousItemActive();
        else manager.setLastItemActive();
        break;
      case 'Home':
        manager.setFirstItemActive();
        break;
      case 'End':
        manager.setLastItemActive();
        break;
      default:
        return;
    }

    event.preventDefault();
    const active = manager.activeItem;
    if (active) this.selectItem(active);
  }

  /**
   * @private Writes the active item's offset box (relative to the track — its
   * `offsetParent`, so items must be direct children) into the four
   * `--mlv-segmented-indicator-*` custom properties. Without an active item the
   * pill collapses. On the first successful (non-zero) measurement `_measured`
   * flips (one macrotask later, after a forced style flush) so the slide
   * transition only ever animates *subsequent* moves — never a slide-in from
   * `0` on load. A group first rendered without a box (inside `display: none`,
   * a collapsed `mlv-expand`, a closed drawer) measures `0` and stays
   * unmeasured until it is actually laid out.
   */
  private _measure(active: MlvSegmentedItem | null): void {
    const track = this._trackRef().nativeElement;
    const set = (name: string, px: number): void =>
      track.style.setProperty(`--mlv-segmented-indicator-${name}`, `${px}px`);

    if (!active) {
      set('width', 0);
      set('height', 0);
      return;
    }

    const el = active.elementRef.nativeElement;
    set('left', el.offsetLeft);
    set('top', el.offsetTop);
    set('width', el.offsetWidth);
    set('height', el.offsetHeight);

    if (!this._measured() && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
      // Force a style flush so the initial position is committed *before* the
      // transition-enabling class lands; otherwise the first move animates from 0.
      void track.offsetWidth;
      const id = setTimeout(() => this._measured.set(true));
      this._destroyRef.onDestroy(() => clearTimeout(id));
    }
  }
}
