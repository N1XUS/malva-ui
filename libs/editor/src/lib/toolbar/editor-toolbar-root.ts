import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { BooleanInput } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MlvResizeObserverService, MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_TOOLBAR_REVISION,
  MLV_EDITOR_TOOLBAR_ROVING,
} from '../editor-toolbar-context';

/** @internal Named roving-focus root used by editor and compatibility toolbar shells. */
@Directive({
  selector: '[mlvEditorToolbarRoot]',
  exportAs: 'mlvEditorToolbarRoot',
  host: {
    class: 'mlv-editor-toolbar',
    '[class.mlv-editor-toolbar--narrow]': 'narrow()',
    role: 'toolbar',
    '[attr.aria-label]': 'resolvedAriaLabel()',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.aria-disabled]': 'disabled() || null',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class MlvEditorToolbarRoot {
  /** Whether the toolbar has entered its compact overflow layout. */
  readonly narrow = signal(false);
  /** Accessible toolbar name. */
  readonly ariaLabel = input<string | undefined>(undefined);
  /** Whether the composite toolbar is unavailable. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Keyboard-navigation axis. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Whether arrow navigation wraps at the boundaries. */
  readonly wrap = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /**
   * @internal Element whose width decides narrow mode, instead of this root's
   * own. `MlvEditor` passes its `.mlv-editor__surface`, for the docked bar
   * and the selection bubble alike. The bubble hugs its controls, so measuring
   * itself would be circular: hiding groups shrinks the bubble, which
   * un-narrows it. `undefined` observes this root, which the standalone
   * `MlvEditorToolbar` shell keeps doing.
   */
  readonly measureTarget = input<HTMLElement | undefined>(undefined);
  /** @internal Editor-scoped focus registry. */
  private readonly _registry = inject(MLV_EDITOR_TOOLBAR_ROVING);
  /** @internal Transaction state that re-evaluates disabled toolbar widgets. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @internal Optional localized defaults. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /**
   * @internal Actual composite-root element. Also the scope the horizontal
   * roving arrows resolve their direction against.
   */
  private readonly _element = inject<ElementRef<HTMLElement>>(ElementRef);
  /** @internal Root teardown lifecycle. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @internal Avoids DOM observers during server rendering. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** @internal Shared observer abstraction for responsive width changes. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);
  /** @internal Normalizes horizontal arrow meaning for RTL toolbars. */
  private readonly _rtlService = inject(MlvRtlService);
  /**
   * @internal Direction applying to this toolbar, resolved once and cached
   * behind the shared `dir` observer rather than re-walked on every arrow
   * keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._element,
  );

  constructor() {
    effect(() => {
      this._revision?.();
      this._registry.setDisabled(this.disabled());
    });
    if (this._isBrowser) {
      this._destroyRef.onDestroy(
        this._registry.connect(this._element.nativeElement),
      );
    }
    effect((onCleanup) => {
      if (!this._isBrowser) return;
      const target = this.measureTarget() ?? this._element.nativeElement;
      // Re-created whenever the target changes, so it is released by this
      // effect's cleanup; `takeUntilDestroyed` would fire only at destroy and
      // leak every earlier generation (best-practices, "DOM Listeners").
      const subscription = this._resizeObserver
        .observe(target)
        .subscribe((entries) => {
          const width = entries[entries.length - 1]?.contentRect.width;
          if (width !== undefined && width > 0) this.narrow.set(width < 640);
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  /** @internal Resolves the user or localized toolbar label. */
  protected resolvedAriaLabel(): string {
    return this.ariaLabel() ?? this._i18n?.().toolbarLabel ?? 'Editor toolbar';
  }

  /** @internal Handles roving navigation from the host metadata event binding. */
  protected handleKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this._registry.focusBoundary(event.key === 'Home' ? 'start' : 'end');
      return;
    }
    // Resolved against the toolbar root, not the document: direction is scoped,
    // so a toolbar inside a `dir` subtree — or inside a CDK overlay pane, which
    // is stamped with its own `dir` — must mirror on its own reading.
    const key = this._rtlService.normalizeArrowKey(event, this._direction());
    const direction =
      this.orientation() === 'vertical'
        ? key === UP_ARROW
          ? -1
          : key === DOWN_ARROW
            ? 1
            : undefined
        : key === LEFT_ARROW
          ? -1
          : key === RIGHT_ARROW
            ? 1
            : undefined;
    if (!direction) return;
    event.preventDefault();
    this._registry.move(target, direction, this.wrap());
  }
}
