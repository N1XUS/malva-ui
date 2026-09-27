import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DOCUMENT,
  ElementRef,
  ErrorHandler,
  HostAttributeToken,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { InteractivityChecker } from '@angular/cdk/a11y';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  LucideInfo,
  LucideCheckCircle,
  LucideTriangleAlert,
  LucideCircleX,
} from '@lucide/angular';
import { MlvAlertIcon, MlvAlertTitle } from './alert.directives';
import type { MlvTone } from '@malva-ui/cdk/utils';
import { MLV_ALERT_I18N } from '@malva-ui/i18n';
import { MlvButtonClose } from '@malva-ui/core/button';

/**
 * Where {@link MlvAlert} can send focus when it is dismissed: an element, or
 * any component exposing a public `focus()` — `mlv-input`, `mlv-checkbox`,
 * `mlv-switch`, `mlv-radio` and others do. A template reference to a
 * component without one (`button[mlvButton]`, `mlv-select`, `mlv-textarea`,
 * `mlv-number-input`, `mlv-combobox`, the pickers) resolves to the component
 * instance, not its element: pass the element instead.
 */
export interface MlvAlertFocusTarget {
  /**
   * Moves focus to the target, **synchronously**: the alert reads the
   * document straight after the call to decide whether the target took
   * focus, and falls back to the next tabbable element when it did not. A
   * `focus()` that defers the move (`afterNextRender`, a timer) reads as
   * refused, and focus then moves twice. A `focus()` that throws is reported
   * to the `ErrorHandler` and treated as refused.
   *
   * @param options `{ preventScroll: true }` when the dismissing click has a
   *   non-zero `detail` (a mouse or touch click, or an assistive-technology
   *   activation that arrives as one); omitted for Enter and Space, which
   *   arrive with `detail` 0. A target that ignores it scrolls into view as
   *   `focus()` always does.
   */
  focus(options?: FocusOptions): void;
}

/**
 * Inline feedback banner component for displaying contextual messages.
 *
 * Supports four semantic tones (`info`, `success`, `warning`, `danger`),
 * optional dismiss button, custom icon slot, and separate title/description
 * content projection slots.
 *
 * The host is a live region whose role follows the tone: `danger` and
 * `warning` are `role="alert"` (assertive), `info` and `success` are
 * `role="status"` (polite), so a banner rendered with the page does not
 * interrupt. A static `role` written on `<mlv-alert>` is kept as written.
 *
 * @example Basic
 * ```html
 * <mlv-alert tone="info">Your profile has been updated.</mlv-alert>
 * ```
 *
 * @example With title
 * ```html
 * <mlv-alert tone="warning">
 *   <ng-template mlvAlertTitle>Storage nearly full</ng-template>
 *   You have used 90% of your storage quota.
 * </mlv-alert>
 * ```
 *
 * @example Dismissible
 * ```html
 * <mlv-alert tone="success" dismissible (dismissed)="onDismissed()">
 *   File uploaded successfully.
 * </mlv-alert>
 * ```
 *
 * @example Custom icon
 * ```html
 * <mlv-alert tone="info">
 *   <ng-template mlvAlertIcon><svg lucideRocket [size]="16" /></ng-template>
 *   New version available.
 * </mlv-alert>
 * ```
 */
@Component({
  selector: 'mlv-alert',
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    LucideInfo,
    LucideCheckCircle,
    LucideTriangleAlert,
    LucideCircleX,
    MlvButtonClose,
  ],
  host: {
    class: 'mlv-alert',
    '[class]': '"mlv-alert--tone-" + tone()',
    '[class.mlv-alert--dismissed]': '_dismissed()',
    '[class.mlv-alert--outlined]': 'outlined()',
    '[attr.role]': '_role()',
    '[attr.hidden]': '_dismissed() || null',
  },
})
export class MlvAlert {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_ALERT_I18N);

  /**
   * The semantic tone of the alert.
   * Controls the color scheme and default icon.
   * Defaults to `'info'`.
   */
  readonly tone = input<MlvTone>('info');

  /**
   * When `true`, renders a dismiss (close) button in the alert.
   * Clicking it emits `dismissed` and hides the alert. When focus is inside
   * the alert at that moment, it moves first — to {@link dismissFocusTarget},
   * else to the next tabbable element after the alert, else to the previous
   * one — so a keyboard user is not dropped onto the document.
   * Supports attribute syntax: `<mlv-alert dismissible>`.
   */
  readonly dismissible = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, renders the alert with a transparent background and a colored border.
   * The text and border color remain the tone foreground color.
   * Supports attribute syntax: `<mlv-alert outlined>`.
   */
  readonly outlined = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Where focus goes when the alert is dismissed while focus is inside it.
   * Tried before the next / previous tabbable element; when it cannot take
   * focus (disabled, hidden, detached, inside this alert, or no callable
   * `focus()`) the fallback applies. Its `focus()` must move focus
   * synchronously — see {@link MlvAlertFocusTarget}. Leave unset to use the
   * fallback alone.
   */
  readonly dismissFocusTarget = input<MlvAlertFocusTarget | null | undefined>(
    null,
  );

  /**
   * Emits when the user clicks the dismiss button.
   * The alert is hidden automatically after emission. Focus has already
   * moved out of the alert by then; a handler that focuses something else
   * wins.
   */
  readonly dismissed = output<void>();

  /**
   * @protected Tracks whether the alert has been dismissed by the user.
   */
  protected readonly _dismissed = signal(false);

  /**
   * @private A static `role` the consumer wrote on `<mlv-alert>`, captured
   * before host bindings run. The role used to be a static host attribute,
   * which such an attribute overrode; {@link _role} keeps honouring it.
   * `null` when none was written, and for a `createComponent` root host.
   */
  private readonly _authorRole = inject(new HostAttributeToken('role'), {
    optional: true,
  });

  /**
   * @protected The host's live-region role (owner ruling D25, #333):
   * `alert` (implicitly assertive) for `danger` / `warning`, `status`
   * (implicitly polite) for `info` / `success`. No `aria-live` is written:
   * the role carries the politeness. The old explicit `aria-live="polite"`
   * beside `role="alert"` made Chromium expose every tone as polite, while a
   * screen reader keying on the alert role still treated it as assertive.
   */
  protected readonly _role = computed(() => {
    if (this._authorRole !== null) return this._authorRole;
    const tone = this.tone();
    return tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  });

  /** @private The host element. */
  private readonly _host: HTMLElement = inject(ElementRef).nativeElement;

  /** @private Document the host lives in, for the focus fallback walk. */
  private readonly _document = inject(DOCUMENT);

  /** @private Decides which elements the focus fallback may try. */
  private readonly _interactivityChecker = inject(InteractivityChecker);

  /**
   * @private Receives an error thrown by a consumer's
   * {@link dismissFocusTarget} `focus()`, which is then treated as refused.
   */
  private readonly _errorHandler = inject(ErrorHandler);

  /**
   * @protected Query for the optional custom icon slot directive.
   */
  protected readonly _iconSlot = contentChild(MlvAlertIcon);

  /**
   * @protected Query for the optional title slot directive.
   */
  protected readonly _titleSlot = contentChild(MlvAlertTitle);

  /**
   * @protected Handles dismiss button click: moves focus out of the alert when
   * it is inside, marks as dismissed and emits output.
   *
   * Focus moves **before** the alert hides and before `dismissed` emits,
   * synchronously, while the host is still rendered. Deferring it to after
   * the hiding render would lose it whenever the consumer removes the alert
   * from its `(dismissed)` handler — the alert's own after-render work dies
   * with it — and during an `animate.leave` the close button would keep focus
   * on an element that is going away. A handler that focuses something else
   * runs after this and wins.
   *
   * A click with a non-zero `detail` — a mouse or touch click — focuses with
   * `preventScroll`: Chromium and Firefox focus a clicked button, so the move
   * runs for pointer users too, and scrolling the page to a far-off control
   * is a jump they did not ask for. Enter and Space arrive with `detail` 0
   * (measured in Chromium, Firefox and WebKit) and scroll the new focus into
   * view, as Tab would. An assistive-technology activation that arrives as a
   * pointer click moves focus without scrolling.
   *
   * @param event The click that reached the close button.
   */
  protected _onDismiss(event?: Event): void {
    if (this._isFocusInside()) {
      this._moveFocusOut(
        ((event as UIEvent | undefined)?.detail ?? 0) > 0
          ? { preventScroll: true }
          : undefined,
      );
    }
    this._dismissed.set(true);
    this.dismissed.emit();
  }

  /**
   * @private Whether focus is on the alert or inside it. Read from the host's
   * own root, so an alert inside a shadow root sees its close button and not
   * the shadow host.
   */
  private _isFocusInside(): boolean {
    const active =
      (this._host.getRootNode() as Partial<DocumentOrShadowRoot>)
        .activeElement ?? null;
    return active !== null && this._host.contains(active);
  }

  /**
   * @private Focus is still inside the leaving alert, or nowhere: on the
   * document body or on no element at all.
   */
  private _isFocusLost(): boolean {
    if (this._isFocusInside()) return true;
    const active = this._document.activeElement;
    return (
      active === null ||
      active === this._document.body ||
      active === this._document.documentElement
    );
  }

  /**
   * @private Sends focus out of the alert: {@link dismissFocusTarget} first,
   * then each tabbable element after the alert, then each one before it,
   * stopping at the first that actually takes focus. "Takes focus" is read
   * back from the document rather than predicted, because only the browser
   * knows whether a candidate is rendered, visible and not inert — a
   * `focus()` it refuses leaves focus where it was. A target without a
   * callable `focus()` (a component instance a template reference resolved
   * to) is skipped; one whose `focus()` throws is reported to the
   * `ErrorHandler` and skipped too, so the fallback still runs and the alert
   * still hides and emits. Nothing after that can throw: the candidates are
   * elements, whose `focus()` does not. When nothing takes focus, focus stays
   * put and the browser moves it off the hidden button.
   *
   * @param options Forwarded to every `focus()` call.
   */
  private _moveFocusOut(options: FocusOptions | undefined): void {
    const target = this.dismissFocusTarget();
    if (typeof target?.focus === 'function') {
      try {
        target.focus(options);
      } catch (error) {
        this._errorHandler.handleError(error);
      }
      if (!this._isFocusLost()) return;
    }
    for (const candidate of this._tabbablesBeside()) {
      candidate.focus(options);
      if (!this._isFocusLost()) return;
    }
  }

  /**
   * @private Tabbable elements outside the alert, nearest root first: in the
   * alert's own root, every one after the host and then every one before it
   * in document order; then, when that root is a shadow root, the same walk
   * around its shadow host in the root above, and so on up to the document.
   * The outer roots are reached only after the inner one is exhausted, so a
   * control beside the alert inside the same component wins over one outside
   * it. In an outer root the walk from a shadow host enters that host's light
   * children first — slotted content, wherever its `<slot>` renders — so it
   * can pick a control shown before the alert. The alert's own subtree is
   * skipped — it is about to hide. Visibility
   * is not checked here (jsdom has no layout, and the browser's answer to
   * `focus()` is the authoritative one); {@link _moveFocusOut} reads it back.
   */
  private *_tabbablesBeside(): Generator<HTMLElement> {
    const host = this._host;
    const acceptNode = (node: Node): number => {
      if (host.contains(node)) return NodeFilter.FILTER_REJECT;
      const element = node as HTMLElement;
      return this._interactivityChecker.isFocusable(element, {
        ignoreVisibility: true,
      }) && this._interactivityChecker.isTabbable(element)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    };
    let reference: Node | undefined = host;
    while (reference) {
      const root = reference.getRootNode();
      const walker = this._document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        { acceptNode },
      );
      for (const step of ['nextNode', 'previousNode'] as const) {
        walker.currentNode = reference;
        for (let node = walker[step](); node; node = walker[step]()) {
          yield node as HTMLElement;
        }
      }
      // A shadow root's `host`; `undefined` on the document, ending the walk.
      reference = (root as Partial<ShadowRoot>).host;
    }
  }
}
