import {
  Directive,
  DestroyRef,
  ElementRef,
  computed,
  inject,
} from '@angular/core';
import { MLV_EDITOR_TOOLBAR_ROVING } from '../editor-toolbar-context';

/** Marks a projected or built-in editor control as one editor-toolbar roving widget. */
@Directive({
  selector: '[mlvEditorToolbarWidget]',
  host: {
    '[attr.tabindex]': '_tabIndex()',
    '(focus)': '_activate()',
    '(pointerdown)': '_activateOnPointerDown()',
  },
})
export class MlvEditorToolbarWidget {
  /** @internal Native widget registered with the enclosing toolbar. */
  private readonly _element =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** @internal Editor-scoped roving-focus coordinator. */
  private readonly _registry = inject(MLV_EDITOR_TOOLBAR_ROVING);
  /** @internal Widget lifecycle for deregistration. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @internal Derived tab stop for roving keyboard navigation. */
  protected readonly _tabIndex = computed(() =>
    this._registry.isActive(this._element) ? 0 : -1,
  );

  constructor() {
    const unregister = this._registry.register(this._element);
    this._destroyRef.onDestroy(unregister);
  }

  /** @internal Promotes this widget when it receives focus. */
  protected _activate(): void {
    this._registry.activate(this._element);
  }

  /** @internal Promotes this widget before pointer activation. */
  protected _activateOnPointerDown(): void {
    this._registry.activate(this._element);
  }
}
