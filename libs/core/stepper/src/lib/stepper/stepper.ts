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
  output,
  signal,
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
   * Zero-based index of the initially active step.
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

  /** @private Zero-based index of the currently active step (internal signal). */
  readonly activeIndex = signal(0);

  /** @private Projected step definition components. */
  private readonly _steps = contentChildren(MlvStep);

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
    this._assignIndices();
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

  /** @protected Resolve the effective state for a given step. */
  protected _stateFor(step: MlvStep): MlvStepState {
    if (step.state()) return step.state() as MlvStepState;
    const active = this.activeIndex();
    if (step._index === active) return 'active';
    if (step._index < active) return 'completed';
    return 'pending';
  }

  /** @protected Returns `true` if a step header is clickable. */
  protected _isClickable(step: MlvStep): boolean {
    if (!this.linear()) return true;
    return step._index <= this.activeIndex();
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

  /** @private Assign sequential indices to child step components. */
  private _assignIndices(): void {
    this._steps().forEach((step, i) => {
      step._index = i;
    });
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
