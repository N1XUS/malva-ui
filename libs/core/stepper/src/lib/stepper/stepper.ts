import type { AfterContentInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { MlvStep } from './step';
import { MlvStepHeader } from './step-header';
import { MLV_STEPPER } from './stepper-token';
import type { MlvStepState, MlvStepperOrientation } from './stepper.types';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_STEPPER_I18N } from '@malva-ui/i18n';

/**
 * Where the active step sits once the projected steps have changed.
 *
 * - The step that was active is still projected: its new position, so an
 *   insertion or removal elsewhere never swaps the step on screen.
 * - It was removed: the step now in its slot — the one after its nearest
 *   surviving predecessor (its replacement, or the step that followed it) —
 *   clamped to the last step. Nothing that followed it is skipped.
 * - No step was active (the first read, or an index past the old list): that
 *   index, clamped to the new list.
 */
function resolveActiveIndex(
  steps: readonly MlvStep[],
  previous: { source: readonly MlvStep[]; value: number } | undefined,
): number {
  if (!previous) return 0;
  const { source: before, value: index } = previous;
  const active = before[index];
  if (!active) return Math.max(0, Math.min(index, steps.length - 1));

  const kept = steps.indexOf(active);
  if (kept !== -1) return kept;

  for (let i = index - 1; i >= 0; i--) {
    const predecessor = steps.indexOf(before[i]);
    if (predecessor !== -1) {
      return Math.min(predecessor + 1, steps.length - 1);
    }
  }
  return 0;
}

/**
 * `mlv-stepper` — a multi-step workflow container.
 *
 * Usage:
 * ```html
 * <mlv-stepper>
 *   <mlv-step label="Account">...</mlv-step>
 *   <mlv-step label="Profile">...</mlv-step>
 *   <mlv-step label="Review">...</mlv-step>
 * </mlv-stepper>
 * ```
 */
@Component({
  selector: 'mlv-stepper',
  templateUrl: './stepper.html',
  styleUrl: './stepper.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_STEPPER, useExisting: MlvStepper }],
  host: {
    class: 'mlv-stepper',
    '[class]': '_hostClasses()',
    '[attr.aria-label]': 'ariaLabel() || null',
  },
  imports: [NgTemplateOutlet, MlvStepHeader],
})
export class MlvStepper implements AfterContentInit {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_STEPPER_I18N);

  /** @private Used to tear down the FocusKeyManager. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * MlvLayout orientation of the stepper.
   * `'horizontal'` renders step headers side-by-side with a connector line.
   * `'vertical'` stacks each step header and its content in a column.
   */
  readonly orientation = input<MlvStepperOrientation>('horizontal');

  /**
   * When `true`, users must complete each step in order before proceeding.
   * Only completed and the next pending step are clickable.
   */
  readonly linear = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Zero-based index of the initially active step. Applied once, at content
   * init. An index past the steps projected by then is kept, so steps that
   * arrive later (a `@for` over async data) open on it, clamped to the last.
   */
  readonly initialIndex = input(0);

  /**
   * Accessible label for the stepper container announced by screen readers.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Emits the new zero-based active step index after navigation.
   */
  readonly activeIndexChange = output<number>();

  /**
   * Zero-based index of the currently active step.
   *
   * Follows the active step's live position once the steps have rendered.
   * When projected steps are inserted or removed after init (an `@if` /
   * `@for` step), the same step stays active and this moves with it; when the
   * active step itself is removed, the step that took its slot becomes active,
   * clamped to the last step.
   *
   * Such a re-index is not navigation and emits no `activeIndexChange`, so
   * derive the index from this signal (a template reference, or a `computed()`
   * over a `viewChild`) instead of copying the output into state of your own.
   * The step query refreshes during change detection: a read in the same
   * handler that changes the steps still returns the old position.
   *
   * An out-of-range value, from `set()` or `initialIndex`, is kept as it is,
   * with no step active, until the steps next change; it is then clamped to
   * the last step.
   */
  readonly activeIndex = linkedSignal<readonly MlvStep[], number>({
    source: () => this._steps(),
    computation: resolveActiveIndex,
  });

  /** @private Projected step definition components. */
  private readonly _steps = contentChildren(MlvStep);

  /**
   * @private Live position of every projected step. Derived from the query
   * rather than stamped on each step once, so a step projected after init is
   * numbered, selected and navigated by where it actually sits.
   */
  private readonly _positions = computed(
    () => new Map(this._steps().map((step, index) => [step, index] as const)),
  );

  /** @protected Iterable step array for the template. */
  protected readonly _stepList = computed(() => this._steps());

  /** @protected CSS class list applied to the host. */
  protected readonly _hostClasses = computed(
    () => `mlv-stepper--${this.orientation()}`,
  );

  /** @private Step-header trigger directives rendered in the current orientation. */
  private readonly _headers = viewChildren(MlvStepHeader);

  /** @private Drives arrow-key navigation + roving tabindex over the step headers. */
  private _keyManager: FocusKeyManager<MlvStepHeader> | null = null;

  /** @private Supplies the current inline direction to the horizontal key manager. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Direction applying to this stepper, following any `[dir]` scope
   * above it rather than the document. `FocusKeyManager` reads raw key codes,
   * so a horizontal stepper is handed this direction and rebuilt whenever it
   * flips — reading the global `direction()` would leave the step headers laid
   * out right-to-left inside a scoped `[dir="rtl"]` while ArrowRight still
   * stepped left-to-right.
   */
  private readonly _direction = this._rtlService.elementDirection(
    inject(ElementRef<HTMLElement>),
  );

  constructor() {
    // (Re)build the FocusKeyManager whenever the rendered headers or the
    // orientation change. Vertical steppers navigate with Up/Down, horizontal
    // with Left/Right; both wrap and support Home/End, skipping disabled steps.
    effect(() => {
      const headers = this._headers();
      const isHorizontal = this.orientation() === 'horizontal';
      const direction = this._direction();

      untracked(() => {
        this._keyManager?.destroy();

        if (headers.length === 0) {
          this._keyManager = null;
          return;
        }

        const km = new FocusKeyManager<MlvStepHeader>(headers)
          .withWrap()
          .withHomeAndEnd()
          .skipPredicate((header) => header.disabled);

        if (isHorizontal) {
          km.withHorizontalOrientation(direction);
        } else {
          km.withVerticalOrientation();
        }

        this._keyManager = km;

        // Seed the roving tabindex on the active step without stealing focus.
        km.updateActiveItem(this.activeIndex());
        this._syncTabIndices();
      });
    });

    this._destroyRef.onDestroy(() => this._keyManager?.destroy());
  }

  ngAfterContentInit(): void {
    this.activeIndex.set(this.initialIndex());
  }

  /**
   * @protected Keydown handler on the step-header tablist. Delegates arrow /
   * Home / End navigation to the FocusKeyManager (roving tabindex + focus),
   * leaving Enter/Space activation to the individual headers.
   */
  protected _onHeaderKeydown(event: KeyboardEvent): void {
    const km = this._keyManager;
    if (!km) return;

    // Start navigation from the header that currently holds focus (e.g. reached
    // via Tab), not the last programmatically-set active item.
    const focusedIndex = this._focusedHeaderIndex(event.target);
    if (focusedIndex !== -1 && focusedIndex !== km.activeItemIndex) {
      km.updateActiveItem(focusedIndex);
    }

    const previousIndex = km.activeItemIndex;
    km.onKeydown(event);

    // Sync roving tabindex only when the manager actually moved focus.
    if (km.activeItemIndex !== previousIndex) {
      this._syncTabIndices();
    }
  }

  /**
   * @private Resolve the index of the step header containing `target`, or `-1`.
   */
  private _focusedHeaderIndex(target: EventTarget | null): number {
    if (!(target instanceof HTMLElement)) return -1;
    const headerEl = target.closest('.mlv-stepper__step-header');
    if (!headerEl) return -1;
    return this._headers().findIndex(
      (header) => header.elementRef.nativeElement === headerEl,
    );
  }

  /**
   * Navigate to the next step (no-op if already at the last step).
   */
  next(): void {
    const steps = this._steps();
    this._navigate(Math.min(this.activeIndex() + 1, steps.length - 1));
  }

  /**
   * Navigate to the previous step (no-op if already at the first step).
   */
  previous(): void {
    this._navigate(Math.max(this.activeIndex() - 1, 0));
  }

  /**
   * Navigate directly to the step at `index`.
   * In linear mode, forward navigation beyond the active step is blocked.
   */
  selectStep(index: number): void {
    const steps = this._steps();
    if (index < 0 || index >= steps.length) return;
    if (this.linear() && index > this.activeIndex()) return;
    this._navigate(index);
  }

  /**
   * @protected Indicator state of `step`: its explicit `state` when set, else
   * derived from its position against `activeIndex` — `completed` before it,
   * `active` at it, `pending` after it.
   *
   * Decoration only. It styles the indicator, the label and the connector and
   * never decides which step is selected: that is `_isSelected`, so a
   * `state="error"` on the step the user is on keeps its panel open, and a
   * `state="active"` on another step opens nothing.
   */
  protected _stateFor(step: MlvStep): MlvStepState {
    const explicit = step.state();
    if (explicit) return explicit;
    const active = this.activeIndex();
    const index = this._positionOf(step);
    if (index === active) return 'active';
    if (index < active) return 'completed';
    return 'pending';
  }

  /**
   * @protected Whether `step` is the selected step — the one at `activeIndex`.
   * The single source of `aria-selected`, the rendered horizontal panel and
   * the open (`--active`, non-`inert`) vertical panel. A step's `state` is
   * never consulted (#312).
   */
  protected _isSelected(step: MlvStep): boolean {
    return this._positionOf(step) === this.activeIndex();
  }

  /** @protected Returns `true` if a step header is clickable. */
  protected _isClickable(step: MlvStep): boolean {
    if (!this.linear()) return true;
    return this._positionOf(step) <= this.activeIndex();
  }

  /** @private Live zero-based position of `step` among the projected steps. */
  private _positionOf(step: MlvStep): number {
    return this._positions().get(step) ?? -1;
  }

  /** @private Emit and update the active index. */
  private _navigate(index: number): void {
    this.activeIndex.set(index);
    this.activeIndexChange.emit(index);
    // Move the roving tabindex to the newly-active step (no focus theft — the
    // triggering element already holds focus after a click/keyboard activate).
    this._keyManager?.updateActiveItem(index);
    this._syncTabIndices();
  }

  /**
   * @private Reflect the FocusKeyManager's active item into the roving
   * tabindex: the active header is tabbable (`0`), all others are `-1`.
   */
  private _syncTabIndices(): void {
    const activeIndex = this._keyManager?.activeItemIndex ?? 0;
    this._headers().forEach((header, i) => {
      header.tabIndex.set(i === activeIndex ? 0 : -1);
    });
  }
}
