import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Directionality } from '@angular/cdk/bidi';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import {
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import type { Signal } from '@angular/core';

export type MlvDirection = 'ltr' | 'rtl';

/** Anything the direction helpers accept as a DOM target. */
export type MlvDirectionTarget =
  | Element
  | ElementRef<Element>
  | null
  | undefined;

export type MlvArrowKey =
  | typeof LEFT_ARROW
  | typeof RIGHT_ARROW
  | typeof UP_ARROW
  | typeof DOWN_ARROW;

/**
 * Owns the app direction and adapts arrow-key events to logical movement.
 *
 * Manual keyboard handlers can switch on Angular CDK key-code constants after
 * calling `normalizeArrowKey`. Horizontal keys are mirrored in RTL; vertical
 * keys retain their meaning in both directions.
 */
@Injectable({ providedIn: 'root' })
export class MlvRtlService {
  private readonly _document = inject(DOCUMENT);
  private readonly _directionality = inject(Directionality);

  /** @private Whether this service is running in a browser, not on the server. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _direction = signal<MlvDirection>(
    this._directionality.value,
  );
  readonly direction = this._direction.asReadonly();
  readonly rtl = computed(() => this.direction() === 'rtl');

  constructor() {
    this._syncDirection(this.direction());
  }

  setDirection(direction: MlvDirection): void {
    if (this.direction() === direction) return;
    this._direction.set(direction);
    this._syncDirection(direction);
  }

  setRtl(rtl: boolean): void {
    this.setDirection(rtl ? 'rtl' : 'ltr');
  }

  toggle(): void {
    this.setRtl(!this.rtl());
  }

  /**
   * Converts DOM/legacy arrow events to CDK key-code constants and mirrors
   * only the horizontal axis when the current direction is RTL.
   */
  normalizeArrowKey(event: KeyboardEvent): MlvArrowKey | null {
    const key = this._getArrowKeyCode(event);
    if (key === null) return null;

    if (key === LEFT_ARROW) return this.rtl() ? RIGHT_ARROW : LEFT_ARROW;
    if (key === RIGHT_ARROW) return this.rtl() ? LEFT_ARROW : RIGHT_ARROW;
    return key;
  }

  /**
   * Resolves the direction that actually applies to `target`.
   *
   * Direction can be scoped: an element inside a `[dir="rtl"]` subtree is RTL
   * even while the document is LTR. Overlays are the reason this matters most
   * — a CDK overlay is portaled to `<body>`, outside the scope its trigger sits
   * in, so it must be told the trigger's direction explicitly.
   *
   * Walks to the nearest ancestor carrying an explicit `dir="ltr"`/`dir="rtl"`
   * (`dir="auto"` is transparent and the walk continues past it) and falls back
   * to the global {@link direction} when nothing scopes the element.
   */
  resolveDirection(target: MlvDirectionTarget): MlvDirection {
    const element = this._toElement(target);

    for (
      let node: Element | null = element;
      node;
      node = node.parentElement ??
        ((node.getRootNode() as ShadowRoot).host ?? null)
    ) {
      const dir = node.getAttribute?.('dir')?.toLowerCase();
      if (dir === 'rtl' || dir === 'ltr') return dir;
    }

    return this.direction();
  }

  /**
   * A signal of the direction applying to `target`, recomputed whenever the
   * global direction changes or a `dir` attribute changes anywhere in the
   * document.
   *
   * Use it for anything that must be re-derived on a direction flip — most
   * importantly JS-measured geometry (sliding indicators, pills, thumbs), which
   * no `ResizeObserver` reports because a mirrored element keeps its size.
   *
   * Must be called in an injection context: the shared `dir` observer is torn
   * down with the calling scope.
   */
  elementDirection(target: MlvDirectionTarget): Signal<MlvDirection> {
    this._observeDirAttributes();
    return computed(() => {
      this._revision();
      return this.resolveDirection(target);
    });
  }

  /**
   * Calls `onChange` whenever the direction applying to `target` changes, and
   * returns a teardown that stops the watch.
   *
   * {@link elementDirection} needs an injection context; this does not, so it
   * works from an imperative API — the case it exists for is a CDK overlay,
   * which is created inside a service method and lives until it is disposed.
   * An open overlay is portaled outside its trigger's `[dir]` scope, so nothing
   * re-mirrors it when the direction flips underneath: the pane keeps its stale
   * `dir` and a connected position strategy keeps resolving `start`/`end`
   * against the direction the overlay was opened with.
   *
   * The current direction is not reported — only changes from it.
   */
  watchDirection(
    target: MlvDirectionTarget,
    onChange: (direction: MlvDirection) => void,
  ): () => void {
    // `elementDirection` needs an injection context of its own (the shared
    // `dir` observer is torn down with it); borrowing the root injector keeps
    // the observer alive for as long as this service is.
    const scoped = runInInjectionContext(this._injector, () =>
      this.elementDirection(target),
    );
    let previous = untracked(scoped);

    // Callers are imperative APIs that may themselves be driven from an effect
    // (a popup trigger opening its overlay from one), and `effect()` refuses to
    // be created inside a reactive context.
    const ref = untracked(() =>
      effect(
        () => {
          const next = scoped();
          if (next === previous) return;
          previous = next;
          onChange(next);
        },
        { injector: this._injector },
      ),
    );

    return () => ref.destroy();
  }

  /**
   * @private Root injector, used to own the effects {@link watchDirection}
   * creates outside any component's injection context.
   */
  private readonly _injector = inject(Injector);

  /**
   * @private Bumped by the shared `dir` `MutationObserver`; the dependency that
   * makes {@link elementDirection} recompute on a scoped direction change.
   */
  private readonly _revision = signal(0);

  /** @private Whether the shared `dir` observer is already running. */
  private _dirObserver: MutationObserver | null = null;

  /**
   * @private Starts one document-wide observer for `dir` attribute mutations,
   * shared by every {@link elementDirection} caller. No-op outside a browser or
   * once already started.
   *
   * The platform check is the load-bearing one. `typeof MutationObserver` alone
   * is not enough: an SSR process that has a DOM shim loaded (a jsdom-hosted
   * render, a server that polyfills for a dependency) passes that test, and
   * `observe()` then rejects the server document's element because it is not a
   * browser `Node` — taking the whole server render down with it.
   */
  private _observeDirAttributes(): void {
    if (!this._isBrowser) return;
    if (this._dirObserver || typeof MutationObserver === 'undefined') return;

    const root = this._document.documentElement;
    if (!root) return;

    const observer = new MutationObserver(() =>
      this._revision.update((revision) => revision + 1),
    );
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['dir'],
      subtree: true,
    });
    this._dirObserver = observer;

    inject(DestroyRef, { optional: true })?.onDestroy(() => {
      observer.disconnect();
      this._dirObserver = null;
    });
  }

  /** @private Narrows a direction target to its DOM element, if any. */
  private _toElement(target: MlvDirectionTarget): Element | null {
    if (!target) return null;
    return target instanceof ElementRef ? target.nativeElement : target;
  }

  private _syncDirection(direction: MlvDirection): void {
    this._document.documentElement.dir = direction;
    this._revision.update((revision) => revision + 1);

    if (this._directionality.value !== direction) {
      this._directionality.valueSignal.set(direction);
      this._directionality.change.emit(direction);
    }
  }

  private _getArrowKeyCode(event: KeyboardEvent): MlvArrowKey | null {
    switch (event.key) {
      case 'ArrowLeft':
        return LEFT_ARROW;
      case 'ArrowRight':
        return RIGHT_ARROW;
      case 'ArrowUp':
        return UP_ARROW;
      case 'ArrowDown':
        return DOWN_ARROW;
    }

    switch (event.keyCode) {
      case LEFT_ARROW:
        return LEFT_ARROW;
      case RIGHT_ARROW:
        return RIGHT_ARROW;
      case UP_ARROW:
        return UP_ARROW;
      case DOWN_ARROW:
        return DOWN_ARROW;
      default:
        return null;
    }
  }
}
