import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostAttributeToken,
  inject,
  input,
  Renderer2,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';

/**
 * Orientation of the divider line.
 * - `'horizontal'` — a full-width horizontal rule (default)
 * - `'vertical'` — a full-height vertical rule; requires the parent to have a defined height
 */
export type MlvDividerOrientation = 'horizontal' | 'vertical';

/**
 * Divider component that renders a thin separator line between content sections.
 *
 * The host element itself is the separator (`role="separator"` with
 * `aria-orientation`); no `<hr>` is rendered. The line is drawn by the host's
 * `::before` / `::after` pseudo-elements, and an optional label projected via
 * `<ng-content>` sits between them, splitting the line into two segments.
 *
 * A projected label is the separator's accessible name: the host points
 * `aria-labelledby` at the `aria-hidden` wrapper holding the label, so
 * `<mlv-divider>OR</mlv-divider>` is announced as a separator named "OR"
 * (#332). The label is phrasing content only; never project a link or button
 * into a divider. Chromium never exposes a separator's children and Firefox
 * exposes content of more than one node, focusable controls included; the
 * wrapper hides it in both engines while a control inside stays focusable, so
 * move the control out.
 *
 * To name the separator yourself, write a static `aria-label` /
 * `aria-labelledby` on the host or bind {@link ariaLabel} /
 * {@link ariaLabelledBy}; each takes precedence over the label. A bound
 * `[attr.aria-label]` / `[attr.aria-labelledby]` is not the supported form —
 * see the two inputs.
 *
 * @example Basic horizontal
 * ```html
 * <mlv-divider />
 * ```
 *
 * @example With label
 * ```html
 * <mlv-divider>OR</mlv-divider>
 * ```
 *
 * @example Named more fully than its label
 * ```html
 * <mlv-divider [ariaLabel]="signInOptionsLabel()">OR</mlv-divider>
 * ```
 *
 * @example Vertical
 * ```html
 * <div style="display: flex; height: 2rem;">
 *   <span>Left</span>
 *   <mlv-divider orientation="vertical" />
 *   <span>Right</span>
 * </div>
 * ```
 *
 * @example Dashed
 * ```html
 * <mlv-divider dashed />
 * ```
 *
 * @example Muted
 * ```html
 * <mlv-divider muted />
 * ```
 */
@Component({
  selector: 'mlv-divider',
  templateUrl: './divider.html',
  styleUrl: './divider.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class: 'mlv-divider',
    role: 'separator',
    '[class.mlv-divider--vertical]': 'orientation() === "vertical"',
    '[class.mlv-divider--horizontal]': 'orientation() === "horizontal"',
    '[class.mlv-divider--dashed]': 'dashed()',
    '[class.mlv-divider--muted]': 'muted()',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.aria-labelledby]': '_labelledBy()',
  },
})
export class MlvDivider {
  /**
   * The orientation of the divider line.
   * Defaults to `'horizontal'`.
   */
  readonly orientation = input<MlvDividerOrientation>('horizontal');

  /**
   * When `true`, renders the divider line as a dashed stroke instead of solid.
   * Supports attribute syntax: `<mlv-divider dashed>`.
   */
  readonly dashed = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, uses a more subtle border color (`--mlv-border-subtle`)
   * instead of the default border token.
   * Supports attribute syntax: `<mlv-divider muted>`.
   */
  readonly muted = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Explicit accessible name, written to the host as `aria-label` while it has
   * non-whitespace text. Wins over a projected label, which is then visible
   * text only: the divider emits no `aria-labelledby` of its own. This is the
   * bound form of a name — a translated string, a per-row value. A static
   * `aria-label` attribute names the divider too, but does not feed this
   * input. The name replaces the label, so say at least what the label says
   * ("Sign-in options" around "OR"). Blank or unset: the label names the
   * separator; clearing it restores a static `aria-label`, if any.
   *
   * Accname ranks `aria-labelledby` above `aria-label`, so a static
   * `aria-labelledby` or {@link ariaLabelledBy} on the same divider wins.
   * Prefer this input to a bare `[attr.aria-label]`, which loses to any
   * projected label with text.
   */
  readonly ariaLabel = input<string | null | undefined>(undefined);

  /**
   * Space-separated ids of the elements that name the separator, written to
   * the host as `aria-labelledby` in place of the label wrapper. This is the
   * bound form of a reference — a per-row heading id in `@for`, a value that
   * changes. A static `aria-labelledby` attribute names the divider too, but
   * does not feed this input. Outranks every other name source. Blank or
   * unset: a static `aria-labelledby`, then {@link ariaLabel}, then the label
   * names the separator.
   *
   * Prefer this input to a bare `[attr.aria-labelledby]`: the host binds
   * `aria-labelledby` itself and wins the first render's tie, so a consumer's
   * bound value lands only once it changes, and a constant one never does.
   */
  readonly ariaLabelledBy = input<string | null | undefined>(undefined);

  /** @private Host element, written to by the `aria-label` effect. */
  private readonly _host: HTMLElement = inject(ElementRef<HTMLElement>)
    .nativeElement;

  /** @private Renderer used to write and restore the host's `aria-label`. */
  private readonly _renderer = inject(Renderer2);

  /**
   * @private A static `aria-labelledby` the consumer wrote on the host,
   * captured before host bindings run. The host binding would otherwise
   * overwrite it with the label wrapper's id, so {@link _labelledBy} writes it
   * back unchanged instead. A bound `[attr.aria-labelledby]` is not seen here,
   * and neither is a `createComponent(…, { hostElement })` root host's own
   * attribute (the token is always `null` there) — use {@link ariaLabelledBy}.
   */
  private readonly _authoredLabelledBy =
    inject(new HostAttributeToken('aria-labelledby'), {
      optional: true,
    })?.trim() || null;

  /**
   * @private A static `aria-label` the consumer wrote on the host. Accname
   * ranks `aria-labelledby` above it, so while one is present the divider
   * emits no `aria-labelledby` of its own and the consumer's wording stays the
   * name — the library's rule for a name generated from DOM text (`mlv-progress`,
   * `mlv-drawer`, `mlv-dialog`). Also what clearing {@link ariaLabel}
   * restores. A bound `[attr.aria-label]` is not seen here, nor a
   * `createComponent` root host's own attribute — use {@link ariaLabel}.
   */
  private readonly _authoredLabel =
    inject(new HostAttributeToken('aria-label'), { optional: true })?.trim() ||
    null;

  /**
   * @protected Id of the label wrapper, or `null` when a static attribute
   * names the separator: static attributes never change and each outranks the
   * wrapper, so nothing could reference it. Per instance, so two dividers
   * never share one; not allocated for a statically named divider, so that one
   * takes no number from the shared `mlvNextId` counter. A divider named only
   * through the inputs still takes one, because they can be cleared later.
   */
  protected readonly _labelId =
    this._authoredLabelledBy || this._authoredLabel
      ? null
      : mlvNextId('mlv-divider-label');

  /**
   * @protected `aria-labelledby` for the host, in accname's order:
   * {@link ariaLabelledBy}, then a static `aria-labelledby`, then nothing while
   * an `aria-label` names the separator ({@link ariaLabel} or a static one),
   * else the label wrapper. The wrapper is referenced whether or not anything
   * is projected: an empty reference yields no name and accname then falls
   * through to `aria-label` (measured in Chromium and Firefox), so a bare
   * divider stays unnamed while a label that arrives, changes or empties later
   * is followed by the browser with no script reading the DOM.
   */
  protected readonly _labelledBy = computed(
    () =>
      this.ariaLabelledBy()?.trim() ||
      this._authoredLabelledBy ||
      (this.ariaLabel()?.trim() || this._authoredLabel ? null : this._labelId),
  );

  constructor() {
    // `ariaLabel` is written by an effect, not by a `[attr.aria-label]` host
    // binding. A host binding writes on the first render whatever it holds —
    // `null` removes the attribute — and wins that render's tie against a
    // consumer's own `[attr.aria-label]`. A bare divider named that way (named
    // before #332, and still named since: its empty wrapper reference falls
    // through to `aria-label`) would lose its name for good while the input is
    // unset. So nothing is written until the input first has text, and
    // clearing it restores the static `aria-label` the template wrote, or
    // removes the attribute. `effect()` rather than `afterRenderEffect()` so
    // the attribute is in the server-rendered markup too (`mlv-button`'s
    // anchor `tabindex` has the same shape). Residual: a hydrating node the
    // server named through the input keeps that name if the client resolves
    // the input blank from its first render.
    let overridden = false;
    effect(() => {
      const label = this.ariaLabel();
      if (label?.trim()) {
        this._renderer.setAttribute(this._host, 'aria-label', label);
        overridden = true;
      } else if (overridden) {
        if (this._authoredLabel === null) {
          this._renderer.removeAttribute(this._host, 'aria-label');
        } else {
          this._renderer.setAttribute(
            this._host,
            'aria-label',
            this._authoredLabel,
          );
        }
        overridden = false;
      }
    });
  }
}
