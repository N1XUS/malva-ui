import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { BooleanInput } from '@angular/cdk/coercion';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  model,
  PLATFORM_ID,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { OnChanges, SimpleChanges } from '@angular/core';
import { LucideZoomIn, LucideZoomOut } from '@lucide/angular';
import { mlvNextId, MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  type MlvEditorOverlayRegistry,
} from '../editor-toolbar-context';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

const DEFAULT_ZOOM = 100;

/**
 * Sentinel option value for the "fit to container" row. Zoom percentages are
 * strictly positive, so a non-positive value can never collide with a preset
 * and the fit action can share the one list instead of sitting outside it.
 */
const FIT_TO_CONTAINER = 0;

/** View-only editor zoom stepper and preset menu. */
@Component({
  selector: 'mlv-editor-zoom',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideZoomIn,
    LucideZoomOut,
    MlvDropdownPanel,
    MlvInput,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvEditorToolbarWidget,
  ],
  templateUrl: './editor-zoom.html',
  styleUrl: './editor-zoom.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-zoom',
  },
  // `mlv-dropdown-panel` injects `MlvSelectionService` non-optionally and
  // expects one instance per owning control; the panel here is detached into a
  // popup, so this component's own injector is what its portal resolves.
  providers: [MlvSelectionService],
})
export class MlvEditorZoom implements OnChanges {
  /** Current view-only zoom percentage. */
  readonly zoom = model<number>(100);

  /** Preset percentages displayed by the zoom menu. */
  readonly zoomLevels = input<readonly number[]>([
    40, 50, 75, 90, 100, 125, 150, 175, 200,
  ]);

  /** Smallest permitted zoom percentage. */
  readonly min = input(40);

  /** Largest permitted zoom percentage. */
  readonly max = input(200);

  /** Recalculates the largest safe zoom whenever the content viewport resizes. */
  readonly fitToContainer = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @protected Editor-scoped view and command state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Shared observer abstraction for the editor viewport. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Component host used to retain a stable focus-restore target. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Registry that keeps focus within the editor composite. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );

  /** @private Document used only after a browser menu opens. */
  private readonly _document = inject(DOCUMENT);

  /** @private Component teardown scope. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Prevents browser view access during server rendering. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Optional reactive localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Rendered mixed-control popup. */
  protected readonly _popup = viewChild.required<MlvPopup>('_popup');

  /** @protected Trigger that owns the detached popup. */
  protected readonly _trigger = viewChild.required<MlvPopupTrigger>('_trigger');

  /** @protected Percentage field focused when the popup opens. */
  protected readonly _input = viewChild.required<MlvInput>('_input');

  /** @protected Stable id used to resolve this component's detached panel. */
  protected readonly _panelId = mlvNextId('mlv-editor-zoom-panel');

  /** @private Last synchronized model value. */
  private _lastZoom = DEFAULT_ZOOM;

  /** @private Last synchronized editor-context value. */
  private _lastContextZoom = DEFAULT_ZOOM;

  /** @private Distinguishes initial context adoption from later writes. */
  private _initialized = false;

  /** @private Whether Angular assigned the public model, including an explicit default. */
  private _zoomWasSupplied = false;

  /** @private Current detached-popup registration teardown. */
  private _unregister: (() => void) | undefined;

  /** @private Guards a queued popup registration after close or destroy. */
  private _menuOpen = false;

  /** @private Connected trigger retained while the popup is open. */
  private _restoreFocusTarget: HTMLButtonElement | undefined;

  /** @protected Numeric field draft kept separate until commit. */
  protected readonly _draft = signal(String(DEFAULT_ZOOM));

  /** @protected Normalized inclusive zoom bounds. */
  protected readonly _bounds = computed(() => {
    const first = Number.isFinite(this.min())
      ? Math.max(1, this.min())
      : DEFAULT_ZOOM;
    const second = Number.isFinite(this.max())
      ? Math.max(1, this.max())
      : DEFAULT_ZOOM;
    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  });

  /** @protected Finite, in-range, sorted menu presets. */
  protected readonly _presetLevels = computed(() => {
    const { min, max } = this._bounds();
    return [...new Set(this.zoomLevels())]
      .filter((level) => Number.isFinite(level) && level >= min && level <= max)
      .sort((left, right) => left - right);
  });

  /**
   * @protected Largest panel height in px. Nine presets plus the fit row scroll
   * inside the panel's own scrollbar rather than growing the popup, so the
   * percentage field above them stays pinned.
   */
  protected readonly _PANEL_MAX_HEIGHT = 240;

  /** @protected Preset rows rendered by the dropdown panel, fit action last. */
  protected readonly _levelOptions = computed<MlvSelectOption<number>[]>(() => {
    const disabled = this._disabled();
    const options: MlvSelectOption<number>[] = this._presetLevels().map(
      (level) => ({ label: `${level}%`, value: level, disabled }),
    );
    if (this.fitToContainer()) {
      options.push({
        label: this._copy().fitToContainer,
        value: FIT_TO_CONTAINER,
        disabled,
      });
    }
    return options;
  });

  /**
   * @protected Selected preset, or nothing when the current percentage is a
   * free-form value (typed in the field, or produced by a fit).
   */
  protected readonly _selectedLevels = computed(() =>
    this._presetLevels().includes(this.zoom()) ? [this.zoom()] : [],
  );

  /** @protected Whether the complete editor composite is disabled. */
  protected readonly _disabled = computed(() => this._context.disabled());

  /** @protected Reactive localized labels for every zoom surface. */
  protected readonly _copy = computed(() => {
    const zoom = this._i18n?.().zoom ?? 'Zoom';
    return {
      zoom,
      zoomOut: `${zoom} −`,
      zoomIn: `${zoom} +`,
      fitToContainer: this._i18n?.().fitToContainer ?? 'Fit to container',
    };
  });

  /** @protected Whether decrementing would exceed the lower bound. */
  protected readonly _zoomOutDisabled = computed(
    () => this._disabled() || this.zoom() <= this._bounds().min,
  );

  /** @protected Whether incrementing would exceed the upper bound. */
  protected readonly _zoomInDisabled = computed(
    () => this._disabled() || this.zoom() >= this._bounds().max,
  );

  constructor() {
    effect(() => this._synchronizeZoom());
    effect(() => this._draft.set(String(this.zoom())));

    effect((onCleanup) => {
      const enabled = this.fitToContainer();
      const editor = this._context.editor();
      if (!enabled || !this._isBrowser || !editor) return;
      const viewport = editor.view.dom.closest<HTMLElement>(
        '.mlv-editor__viewport',
      );
      if (!viewport) return;
      const subscription = this._resizeObserver
        .observe(viewport)
        .subscribe((entries) => {
          const width = entries[entries.length - 1]?.contentRect.width;
          if (width !== undefined) this._fit(width);
        });
      this._fit(viewport.getBoundingClientRect().width);
      onCleanup(() => subscription.unsubscribe());
    });

    this._destroyRef.onDestroy(() => this._releaseOverlay());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zoom']) this._zoomWasSupplied = true;
  }

  /** @protected Selects the previous preset or the exact minimum. */
  protected _zoomOut(): void {
    if (this._disabled()) return;
    const current = this.zoom();
    const previous = this._steps().filter((level) => level < current);
    const target = previous[previous.length - 1];
    this._setZoom(target ?? this._bounds().min);
  }

  /** @protected Selects the next preset or the exact maximum. */
  protected _zoomIn(): void {
    if (this._disabled()) return;
    const current = this.zoom();
    const target = this._steps().find((level) => level > current);
    this._setZoom(target ?? this._bounds().max);
  }

  /** @protected Applies a menu preset without dispatching an editor transaction. */
  protected _select(level: number): void {
    if (this._disabled()) return;
    this._setZoom(level);
    this._trigger().close();
  }

  /**
   * @protected Applies a dropdown row. The aria listbox also emits while it
   * reconciles its value against the rendered options — which drops a
   * free-form percentage to an empty array — so only a non-empty emission is a
   * user pick.
   */
  protected _selectLevel(values: readonly number[]): void {
    const value = values[values.length - 1];
    if (value === undefined) return;
    if (value === FIT_TO_CONTAINER) {
      this._fitCurrentViewport();
      return;
    }
    this._select(value);
  }

  /** @protected Commits a finite numeric field value and restores the normalized display. */
  protected _applyDraft(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this._disabled()) {
      this._draft.set(String(this.zoom()));
      return;
    }
    const parsed = Number(this._draft());
    if (Number.isFinite(parsed)) this._setZoom(parsed);
    this._draft.set(String(this.zoom()));
  }

  /** @protected Fits against the viewport's latest synchronous width. */
  protected _fitCurrentViewport(): void {
    if (this._disabled()) return;
    const viewport = this._context
      .editor()
      ?.view.dom.closest<HTMLElement>('.mlv-editor__viewport');
    if (viewport) {
      this._fit(viewport.clientWidth || viewport.getBoundingClientRect().width);
      this._trigger().close();
    }
  }

  /** @protected Registers the detached dialog and moves focus to its field. */
  protected _onPopupOpened(): void {
    this._menuOpen = true;
    this._restoreFocusTarget =
      this._host.nativeElement.querySelector<HTMLButtonElement>(
        'button[aria-haspopup="dialog"]',
      ) ?? undefined;
    queueMicrotask(() => {
      if (!this._menuOpen) return;
      const content = this._document.getElementById(this._panelId);
      const panel = content?.closest<HTMLElement>('.mlv-popup');
      if (!panel) return;
      this._unregister?.();
      this._unregister = this._overlays.register(panel, () =>
        this._trigger().close(),
      );
      this._input().focus();
      this._input().select();
    });
  }

  /** @protected Releases focus ownership and restores the visible trigger. */
  protected _onPopupClosed(): void {
    const trigger = this._restoreFocusTarget;
    this._releaseOverlay();
    if (!this._disabled() && trigger?.isConnected) trigger.focus();
  }

  /** @private Removes detached popup focus ownership without moving focus. */
  private _releaseOverlay(): void {
    this._menuOpen = false;
    this._restoreFocusTarget = undefined;
    this._unregister?.();
    this._unregister = undefined;
  }

  /** @private Synchronizes the literal public model with the nearest toolbar context. */
  private _synchronizeZoom(): void {
    const modelValue = this.zoom();
    const contextValue = this._context.zoom();
    const modelChanged = modelValue !== this._lastZoom;
    const contextChanged = contextValue !== this._lastContextZoom;
    let next: number;

    if (!this._initialized) {
      next =
        this._zoomWasSupplied ||
        modelValue !== DEFAULT_ZOOM ||
        contextValue === DEFAULT_ZOOM
          ? this._clamp(modelValue)
          : this._clamp(contextValue);
      this._initialized = true;
    } else if (modelChanged || modelValue !== this._clamp(modelValue)) {
      next = this._clamp(modelValue);
    } else if (contextChanged || contextValue !== this._clamp(contextValue)) {
      next = this._clamp(contextValue);
    } else {
      next = this._clamp(modelValue);
    }

    this._lastZoom = next;
    this._lastContextZoom = next;
    if (this.zoom() !== next) this.zoom.set(next);
    if (this._context.zoom() !== next) this._context.zoom.set(next);
  }

  /** @private Ordered stepping levels, including exact configured bounds. */
  private _steps(): readonly number[] {
    const { min, max } = this._bounds();
    return [...new Set([min, ...this._presetLevels(), max])].sort(
      (left, right) => left - right,
    );
  }

  /** @private Applies a clamped visual-only percentage to model and context. */
  private _setZoom(value: number): void {
    const next = this._clamp(value);
    this._lastZoom = next;
    this._lastContextZoom = next;
    this.zoom.set(next);
    this._context.zoom.set(next);
  }

  /** @private Calculates the largest integer zoom whose natural content fits. */
  private _fit(containerWidth: number): void {
    if (this._disabled()) return;
    const viewport = this._context
      .editor()
      ?.view.dom.closest<HTMLElement>('.mlv-editor__viewport');
    const view = viewport?.querySelector<HTMLElement>('.mlv-editor__view');
    if (!viewport || !view) return;
    const viewportWidths = [
      containerWidth,
      viewport.clientWidth,
      viewport.getBoundingClientRect().width,
    ].filter((width) => Number.isFinite(width) && width > 0);
    const availableWidth = Math.min(...viewportWidths);
    const currentScale = untracked(this.zoom) / 100;
    const transformedWidth = view.getBoundingClientRect().width;
    const naturalWidth = Math.max(
      view.scrollWidth,
      currentScale > 0 ? transformedWidth / currentScale : 0,
    );
    if (
      !Number.isFinite(availableWidth) ||
      !Number.isFinite(naturalWidth) ||
      availableWidth <= 0 ||
      naturalWidth <= 0
    ) {
      return;
    }
    const { min, max } = this._bounds();
    let next = Math.min(
      max,
      Math.max(min, Math.floor((availableWidth / naturalWidth) * 100)),
    );
    while (next > min && (naturalWidth * next) / 100 > availableWidth) {
      next -= 1;
    }
    this._setZoom(next);
  }

  /** @private Clamps a finite percentage to the configured inclusive bounds. */
  private _clamp(value: number): number {
    const { min, max } = this._bounds();
    const finite = Number.isFinite(value) ? value : DEFAULT_ZOOM;
    return Math.min(Math.max(finite, min), max);
  }
}
