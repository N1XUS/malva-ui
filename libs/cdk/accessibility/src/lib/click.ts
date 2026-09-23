import { Directive, ElementRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, merge, tap } from 'rxjs';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { hasModifierKey } from '@angular/cdk/keycodes';

/** The two keys that activate a button: `KeyboardEvent.key` values. */
type ActivationKey = 'Enter' | ' ';

/**
 * `<input>` types the browser answers Enter on with a `click` of its own —
 * the button-like types plus the two picker types.
 */
const ENTER_ACTIVATED_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'submit',
  'reset',
  'image',
  'file',
  'color',
]);

/**
 * `<input>` types the browser answers Space on with a `click`: every Enter
 * type plus the two toggles, which Enter leaves alone.
 */
const SPACE_ACTIVATED_INPUT_TYPES: ReadonlySet<string> = new Set([
  ...ENTER_ACTIVATED_INPUT_TYPES,
  'checkbox',
  'radio',
]);

/**
 * Whether the browser turns `key` pressed on `element` into a `click` of its
 * own. That click reaches `[mlvClick]`'s click listener, so it — not the
 * keydown — is the emission.
 *
 * Measured, not assumed: Chrome 153, one trusted press per element kind
 * (#299). A `<button>` clicks on Enter and on Space (on keyup), an `<a href>`
 * and an `<area href>` only on Enter, a `<details>`' first `<summary>` on
 * both. Nothing without an activation behaviour clicks at all: an `<a>` or
 * `<area>` without `href`, the second `<summary>` of an open `<details>`, a
 * text field, a `<div>`. Script-dispatched key events activate nothing, which
 * is why a unit spec sees no click here either.
 *
 * Read per key press rather than once: `href` and `type` are commonly bound.
 */
function activatesNatively(element: Element, key: ActivationKey): boolean {
  switch (element.localName) {
    case 'button':
      return true;
    case 'input':
      return (
        key === 'Enter'
          ? ENTER_ACTIVATED_INPUT_TYPES
          : SPACE_ACTIVATED_INPUT_TYPES
      ).has((element as HTMLInputElement).type);
    case 'a':
    case 'area':
      return key === 'Enter' && element.hasAttribute('href');
    case 'summary': {
      const details = element.parentElement;
      return (
        details?.localName === 'details' &&
        details.querySelector(':scope > summary') === element
      );
    }
    default:
      return false;
  }
}

/**
 * Whether Space already has a job on `element` other than scrolling — typing
 * a space, or opening a picker — so cancelling it would break the element.
 */
function ownsSpace(element: HTMLElement): boolean {
  return (
    element.isContentEditable ||
    element.localName === 'input' ||
    element.localName === 'textarea' ||
    element.localName === 'select'
  );
}

/**
 * The element a key was pressed on — the focused element, where the browser
 * runs activation behaviour.
 *
 * Not `event.target`: a listener outside a shadow tree sees the target
 * retargeted to that tree's host, so a `<button>` inside an open shadow root
 * — a web component, or a `ViewEncapsulation.ShadowDom` child — read as its
 * host element (#299). `composedPath()[0]` is the element itself for an open
 * root. A **closed** root hides its tree from `composedPath()` as well, so
 * there it is still the shadow host (the class JSDoc lists that shape).
 */
function keyOrigin(event: KeyboardEvent): Element {
  return (event.composedPath()[0] ?? event.target) as Element;
}

/**
 * Activation for a host that has none of its own: one `mlvClick` per pointer
 * click, Enter or Space, plus a managed `tabindex` and `role`.
 *
 * **One activation, one emission.** Where the browser already turns the key
 * into a `click` on the focused element — Enter or Space on a `<button>`,
 * Enter on an `<a href>` — that click is the emission and the keydown is left
 * alone; the directive emits on the keydown only where no click will follow.
 * On a `<button>` the directive therefore adds nothing to `(click)`: bind that
 * instead. Space the directive does consume is cancelled, so activating the
 * host does not also scroll the page.
 *
 * The rule reads the element the key was pressed on — through an open shadow
 * root too — so three shapes still emit twice (measured, Chrome 153): a
 * focusable element **inside** a `<button>` host, where the browser activates
 * the button ancestor, not the focused element; Enter in a text field of a
 * `<form>` wrapped by the host, where implicit submission clicks the form's
 * submit button; and a native control inside a **closed** shadow root below
 * the host, which hides the control from `composedPath()`, so the directive
 * sees only the shadow host.
 */
@Directive({
  selector: '[mlvClick]',
  host: {
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.role]': 'hostRole() || null',
  },
})
export class MlvClick {
  /**
   * When `true`, sets `tabindex="-1"` so the element is removed from the tab
   * order. The `mlvClick` output is not suppressed by this flag at the
   * directive level — the consumer should gate logic if needed.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * ARIA role applied to the host element. Defaults to `'button'` for
   * keyboard-accessible click semantics.
   *
   * A non-`button` role goes **through this input** (`mlv-select` passes
   * `'combobox'`), not into a `role` attribute written beside the directive:
   * this is a host `[attr.role]` binding, so it wins over a static `role` and a
   * `null` here removes it. Pass `null` only when the host's semantics are
   * native — an `<a href>` — and so cannot be written away. (A `<button>`
   * gains nothing from the directive at all — its Enter and Space already
   * click — so bind `(click)` there instead.)
   *
   * That includes a **component's** own `[attr.role]` on the same host, and
   * the two do not resolve by a fixed precedence. Each host binding is
   * dirty-checked against its own previous value and writes only on a pass
   * where that value changed; the directive's bindings merely run after the
   * component's, so this input wins a same-pass *tie*. First render is always
   * such a tie, which is why the `'button'` default silently replaces a role
   * the component wrote — and why `null` here **removes** the attribute rather
   * than handing the role back. On a later pass where only the component's
   * expression changed, though, the component is the one that writes and the
   * component wins (`MlvSidebarItem._hostRole` is a `computed()` of exactly
   * that shape).
   *
   * Co-hosting on a component that owns `[attr.role]` therefore means writing
   * the same role through both — the one arrangement that is both order- and
   * timing-independent. See `mlv-drawer-sections`, where `mlv-list-item`
   * inside a `role="menu"` needs
   * `itemRole="menuitem" [hostRole]="'menuitem'"` (#223).
   */
  readonly hostRole = input<string | null>('button');

  /**
   * Emits once per activation: a pointer click, or Enter / Space (no modifier
   * key) on the host.
   *
   * Where the browser turns the key into a `click` itself — Enter or Space on
   * a `<button>`, Enter on an `<a href>` — the payload is that `MouseEvent`
   * (a `PointerEvent` with `detail === 0` in Chromium); elsewhere it is the
   * `KeyboardEvent`. A key bubbling out of a descendant the browser activates
   * (a `<button>` inside the host, in an open shadow root too) likewise emits
   * once, through the click it produces. On a native host whose keydown something else cancels, the
   * browser clicks nothing and nothing is emitted.
   */
  readonly mlvClick = output<MouseEvent | KeyboardEvent>();

  /**
   * @protected The host `ElementRef`, used to attach keyboard/click listeners
   * and as the click event source.
   */
  protected readonly _elementRef = inject(ElementRef);

  constructor() {
    const host: HTMLElement = this._elementRef.nativeElement;

    const keyActivation$ = fromEvent<KeyboardEvent>(host, 'keydown').pipe(
      // The match the former `keydown.enter` / `keydown.space` listeners got
      // from Angular's key plugin: the key itself, with no modifier held.
      filter(
        (event) =>
          (event.key === 'Enter' || event.key === ' ') &&
          !hasModifierKey(event),
      ),
      // The key's origin is the focused element — the host, or a descendant
      // it bubbled out of, shadow-root descendants included — which is where
      // the browser runs activation behaviour (the class JSDoc names the
      // three shapes where that is not what the directive sees). Where that
      // produces a click, the click is the emission; emitting here too was
      // the double activation (#299).
      filter(
        (event) =>
          !activatesNatively(keyOrigin(event), event.key as ActivationKey),
      ),
      tap((event) => {
        // The host consumed Space as its activation, so its default — scroll
        // the nearest scroller — must not run too. Only on the host itself:
        // a descendant owns its own key, and a text field types the space.
        // The origin, not `event.target`: a field or button in the host's own
        // shadow root is retargeted to the host, and cancelling its Space
        // would swallow the typed space or the button's click.
        if (
          event.key === ' ' &&
          keyOrigin(event) === host &&
          !ownsSpace(host)
        ) {
          event.preventDefault();
        }
      }),
    );

    merge(fromEvent<MouseEvent>(host, 'click'), keyActivation$)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.mlvClick.emit(event));
  }
}
