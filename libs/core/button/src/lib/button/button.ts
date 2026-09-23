import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  HostAttributeToken,
  inject,
  input,
  PLATFORM_ID,
  Renderer2,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { filter, fromEvent } from 'rxjs';
import {
  MlvButtonAfter,
  MlvButtonBefore,
  MlvButtonIcon,
} from '../button.directives';
import { isPlatformServer, NgTemplateOutlet } from '@angular/common';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MlvLoader } from '@malva-ui/core/loader';
import type { MlvButtonShape, MlvButtonVariant } from '../button.types';
import { MLV_BUTTON_VARIANT } from '../button-variant.token';

export type { MlvButtonShape, MlvButtonVariant } from '../button.types';

/**
 * Shapes whose width equals their height. They exist to hold a single icon, so
 * they drive both the icon-only sizing and the neutral default variant.
 */
const ICON_ONLY_SHAPES: readonly MlvButtonShape[] = ['circle', 'square'];

@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[mlvButton], a[mlvButton]',
  templateUrl: './button.html',
  styleUrl: './button.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, MlvLoader],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity: mlvDensity'],
    },
  ],
  providers: [
    {
      provide: MLV_DENSITY_ELEMENT,
      useValue: 'button',
    },
  ],
  // No `(click)` host listener, deliberately (#460, as #309 for `mlv-link`).
  // The disabled / loading guard is the capture-phase stream in the
  // constructor: a host listener cannot stop `RouterLink`. Native `disabled`
  // follows `disabled()` alone, never `loading()` (#324): the browser moves
  // focus off a button that becomes disabled and never gives it back, so a
  // loading button is announced with `aria-disabled` + `aria-busy`, blocked by
  // the guard and left focusable. It is written on `<button>` hosts only —
  // anchors have no disabled state, so a disabled anchor leaves the tab order
  // through the `tabindex` effect instead. `tabindex` is deliberately not a
  // host binding: it would evaluate to `null` on every `<button>` host and
  // remove the consumer's own (speed-dial actions, roving calendar cells).
  host: {
    class: 'mlv-button',
    '[class]':
      '"mlv-button--variant-" + effectiveVariant() + " mlv-button--shape-" + shape()',
    '[class.mlv-button--disabled]': 'disabled()',
    '[class.mlv-button--loading]': 'loading()',
    '[class.mlv-button--selected]': 'selected()',
    '[class.mlv-button--icon-only]': '_iconOnly()',
    '[attr.disabled]': '(!_isAnchor && disabled()) || null',
    '[attr.aria-disabled]': '_inert() || null',
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class MlvButton {
  /**
   * Visual treatment for this button. When omitted, the closest button group,
   * split button, or toggle supplies it; otherwise the fallback depends on the
   * shape — `secondary` for the icon-only `square`/`circle` shapes and
   * `primary` for every other shape.
   */
  readonly variant = input<MlvButtonVariant | undefined>(undefined);

  /** Shape of the button. Circle and square are intended for icon-only actions. */
  readonly shape = input<MlvButtonShape>('default');

  /**
   * Whether the button is disabled. A disabled button announces itself
   * (`aria-disabled="true"`), leaves the tab order and does not activate: a
   * click — including the one Enter and screen-reader activation produce —
   * reaches neither the native action (`href`, form submission) nor
   * `routerLink`, nor any bubble-phase click listener on the host or its
   * ancestors. A `<button>` host also gets the native `disabled` attribute;
   * an `<a>` host, which has no disabled state, gets `tabindex="-1"` instead
   * and keeps its `href`, and gets back its own `tabindex` (or none) once
   * re-enabled. Capture-phase listeners on an ancestor still see the click (CDK
   * click-outside dismissal among them).
   *
   * Write an anchor's own `tabindex` statically. One bound with
   * `[attr.tabindex]` overwrites the `-1` whenever its value changes while the
   * anchor is disabled, putting it back in the tab order, and is removed on
   * re-enable until its value next changes.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether the button is waiting for an asynchronous action to complete.
   * Exposes `aria-busy` and `aria-disabled="true"` and blocks the button's
   * activation as `disabled` does — the click a pointer, Enter, Space,
   * screen-reader activation or implicit form submission produces stops at
   * the button — but, on its own, keeps the button **focusable and in the tab
   * order**: no native `disabled` attribute, no `tabindex="-1"` on an anchor.
   * A focused button that starts loading therefore keeps focus, and so does it
   * once loading ends. Bind `disabled` beside it to take the button out of the
   * tab order as well; `disabled` then keeps its native semantics.
   *
   * Only that click is blocked. A directive on the same host that acts on
   * keydown or focus still runs on a focused loading button, which native
   * `disabled` used to keep from being focused at all. In this library:
   * `mlvMenuTrigger` opens on Enter / Space / ArrowDown / ArrowUp,
   * `[mlvContextMenuTrigger]` on the ContextMenu key or Shift+F10,
   * `mlvPopupTrigger` with `triggerOn="focus"` on focus, and `[mlvClick]` on
   * an anchor host emits on Space, or on any activation key when the anchor
   * has no `href`. Bind the directive's own disabled input there
   * (`menuTriggerDisabled`, `contextMenuDisabled`), or `disabled` beside
   * `loading` (#506).
   *
   * `form.requestSubmit()` from script bypasses every button and still
   * submits, as it did when `loading` wrote native `disabled`.
   */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether the button reflects a persistent selected state — an active
   * formatting menu trigger, a chosen view. Paints the same surface as a
   * pressed toggle while adding no ARIA of its own, so a menu button keeps
   * `aria-haspopup`/`aria-expanded` as its only state semantics. A real toggle
   * sets `aria-pressed` instead, which paints identically.
   */
  readonly selected = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Optional ancestor-provided default visual treatment. */
  private readonly _variantAccessor = inject(MLV_BUTTON_VARIANT, {
    optional: true,
  });

  /**
   * The visual treatment after resolving local, inherited, and default values.
   *
   * The final fallback is shape-aware: a bare `square`/`circle` button is an
   * icon action, and rendering a row of them as saturated `primary` CTAs was
   * never the intent, so they fall back to the neutral `secondary` treatment.
   * An explicit `variant` and an ancestor `MLV_BUTTON_VARIANT` both still win.
   */
  readonly effectiveVariant = computed<MlvButtonVariant>(
    () =>
      this.variant() ??
      this._variantAccessor?.effectiveVariant() ??
      (this._iconShape() ? 'secondary' : 'primary'),
  );

  /** @protected Whether `shape` is one of the square/circle icon-only shapes. */
  protected readonly _iconShape = computed(() =>
    ICON_ONLY_SHAPES.includes(this.shape()),
  );

  /**
   * @protected True for a circle/square button whose content is only an icon —
   * either marked with `mlvButtonIcon` or inferred from an empty label slot.
   * Drives the icon-only modifier.
   */
  protected readonly _iconOnly = computed(
    () =>
      this._iconShape() &&
      (!!this._iconDirective() || !this._hasProjectedText()),
  );

  /** @protected Template slot rendered before the button text. */
  protected readonly beforeRef = contentChild(MlvButtonBefore);

  /** @protected Template slot rendered after the button text. */
  protected readonly afterRef = contentChild(MlvButtonAfter);

  /** @private Projected icon directive, used to detect icon-only buttons. */
  private readonly _iconDirective = contentChild(MlvButtonIcon);

  /** @private The label slot, read back after render to detect icon-only content. */
  private readonly _textRef =
    viewChild.required<ElementRef<HTMLElement>>('textRef');

  /**
   * @private Whether the default content slot rendered any non-whitespace text.
   *
   * Starts `true` so a button that never reaches a browser render — server-side
   * rendering, where `afterRenderEffect` does not run — keeps the pre-inference
   * behaviour instead of guessing icon-only.
   */
  private readonly _hasProjectedText = signal(true);

  /** @private Host element: the target of the click guard and, on an anchor, of `tabindex`. */
  private readonly _host: HTMLElement =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** @private Writes the anchor's `tabindex` outside a host binding (see the `host` comment). */
  private readonly _renderer = inject(Renderer2);

  /**
   * @protected Whether the host is an `<a>`. Anchors have no disabled state, so
   * a disabled one gets `tabindex="-1"` instead of the (invalid) `disabled`
   * attribute. Resolved once: the selector fixes the element for the
   * component's life.
   */
  protected readonly _isAnchor = this._host.tagName === 'A';

  /**
   * @protected Whether activation is blocked — the button is disabled or
   * loading. Drives `aria-disabled` and the click guard only; leaving the tab
   * order (native `disabled`, an anchor's `tabindex="-1"`) follows `disabled`
   * alone, so a loading button keeps focus (#324).
   */
  protected readonly _inert = computed(() => this.disabled() || this.loading());

  constructor() {
    // An inert button needs a capture-phase guard to stay put (`mlv-link` and
    // the `mlv-segmented` link item carry the same one). `preventDefault()`
    // alone cancels the native action but not `RouterLink.onClick`, which
    // calls `Router.navigateByUrl()` without reading `defaultPrevented`. Nor
    // can a host `(click)` listener stop it: Angular coalesces every host and
    // template listener for one event on one element into a single native
    // listener and walks that chain unconditionally (`__ngNextListenerFn__`).
    // A capture listener on the host runs before every bubble listener on it —
    // at `AT_TARGET` the capture pass precedes the bubble pass, whatever the
    // registration order — and, for a click on the label span inside, before
    // the event reaches the target at all.
    //
    // It is installed on `<button>` hosts too. There it is the whole block
    // while `loading` alone: native `disabled` is not written, so the click a
    // pointer, Enter, Space, a screen reader or implicit form submission (the
    // browser's synthetic click at the default button) produces reaches the
    // host and stops here — `preventDefault()` cancels the submission. While
    // `disabled`, the native attribute already stops real clicks and the guard
    // keeps a scripted `dispatchEvent(click)` cancelled.
    //
    // `{ capture: true }` is the whole mechanism and goes through `fromEvent`'s
    // options argument, never the boolean form. `Subscriber.next` is
    // synchronous, so `stopImmediatePropagation()` still runs inside the
    // native listener invocation. The guard returns nothing, so no listener
    // expression evaluates to `false` and an enabled click is never cancelled.
    fromEvent<MouseEvent>(this._host, 'click', { capture: true })
      .pipe(
        filter(() => this._inert()),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      });

    // An anchor has no disabled state, so a disabled one would keep its tab
    // stop and Enter would still produce the (now cancelled) click. It leaves
    // the tab order through `tabindex="-1"` while disabled and gets the
    // consumer's own `tabindex` — or none — back afterwards. A loading anchor
    // keeps its tab stop, as a loading `<button>` does (#324): it is blocked
    // by the guard and announced through `aria-disabled` / `aria-busy`, and
    // leaving the tab order is what `disabled` is for. Nothing is written
    // until the anchor is first disabled, so an anchor that never is keeps
    // whatever the consumer bound — the one exception is a `-1` the server
    // wrote, below. `effect()` rather than `afterRenderEffect()` so the
    // attribute is in the server-rendered markup too.
    if (this._isAnchor) {
      // Whether this host is a server-rendered node hydration is claiming.
      // Angular exposes no public signal for it; the server stamps `ngh` on
      // every component host it serialises and the client strips it in
      // `renderComponent`, after the host's directives are constructed — so it
      // is on the host here exactly when the node came from the server
      // (`MlvSelect._hydrating` reads it the same way, and its tripwire spec
      // guards the Angular internal). `button-ssr.spec.ts` goes red if it
      // stops holding.
      const hydrating =
        !isPlatformServer(inject(PLATFORM_ID)) &&
        this._host.hasAttribute('ngh');

      // What the anchor returns to when it stops being disabled: the consumer's
      // own `tabindex`. Outside hydration that is the attribute on the host
      // now — static template attributes are written before directives are
      // constructed and no binding has run yet, and a root host created with
      // `createComponent(…, { hostElement })` has no template to read, only
      // the attribute it came with. A hydrated node is the server's, so its
      // `tabindex` may be the `-1` this component wrote there: read the
      // template's through `HostAttributeToken` instead.
      const restoreTo = hydrating
        ? inject(new HostAttributeToken('tabindex'), { optional: true })
        : this._host.getAttribute('tabindex');

      // Whether the `-1` on a claimed node is this component's own, written by
      // the server for an anchor it rendered disabled. Then the client owns it
      // from the start, and takes it back on its first render if it is not
      // disabled — `[disabled]="!isBrowser"`, a login state only the browser
      // knows, `[disabled]` over client-fetched data — instead of leaving an
      // enabled link Tab never reaches. The mark is `aria-disabled="true"`
      // beside the `-1`: the host binding writes it when the server rendered
      // the anchor disabled or loading, and removes one the template wrote
      // statically when the server rendered neither. It is a heuristic, not
      // proof, and which way it errs depends on the case:
      // - A static `aria-disabled` in the template voids the mark, erring
      //   toward leaving a `-1` alone. Hydration re-applies static attributes
      //   to the claimed node before this constructor runs, so the value read
      //   here is the template's, not the server's, and an anchor never
      //   disabled would otherwise lose a consumer-bound `-1`. The cost: an
      //   anchor carrying one (the host binding overwrites it anyway, so it has
      //   no effect on the rendered `aria-disabled`) and rendered disabled by
      //   the server only keeps the server's `-1` — pinned in
      //   `button-ssr.spec.ts` (`static-aria-server`).
      // - Otherwise the mark is taken at its word, erring toward taking a `-1`
      //   back, because an enabled link Tab never reaches is the worse error.
      //   Mistaken for it: an `aria-disabled="true"` a directive on the same
      //   host binds, one a consumer binding moves to after the server's first
      //   pass, and — since `loading` stopped writing `-1` (#324) — the one on
      //   an anchor the server rendered loading. Beside a bound `-1` on an
      //   anchor never disabled, each takes that `-1` away, whether or not the
      //   client is still loading (`button-ssr.spec.ts`, `loading-bound` and
      //   `loading-both-bound`). A loading render cannot be told from a
      //   disabled + loading one, whose `-1` is this component's: both carry
      //   `aria-busy`, and hydration rewrites `class` from the template.
      let overridden =
        hydrating &&
        inject(new HostAttributeToken('aria-disabled'), { optional: true }) ===
          null &&
        this._host.getAttribute('aria-disabled') === 'true' &&
        this._host.getAttribute('tabindex') === '-1';

      effect(() => {
        if (this.disabled()) {
          this._renderer.setAttribute(this._host, 'tabindex', '-1');
          overridden = true;
        } else if (overridden) {
          if (restoreTo === null) {
            this._renderer.removeAttribute(this._host, 'tabindex');
          } else {
            this._renderer.setAttribute(this._host, 'tabindex', restoreTo);
          }
          overridden = false;
        }
      });
    }

    // `mlvButtonIcon` is optional in practice: icon buttons are overwhelmingly
    // written as `<button mlvButton shape="circle"><svg lucideX /></button>`,
    // and without the directive nothing marked them icon-only, so the icon kept
    // its intrinsic size inside the label slot. The slot holds projected
    // content, so the only way to know whether it carries real text is to read
    // it back once the DOM is written. The effect re-runs when the signals read
    // below change rather than on every render pass, which keeps this to one
    // `textContent` read per button per relevant change. Text that appears or
    // disappears inside an already-rendered icon-only button is not observed —
    // annotate the icon with `mlvButtonIcon` for that case.
    afterRenderEffect(() => {
      this.shape();
      this.loading();
      this._iconDirective();
      const text = this._textRef().nativeElement.textContent ?? '';
      this._hasProjectedText.set(text.trim().length > 0);
    });
  }
}
