import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MLV_BREADCRUMB } from './breadcrumb-token';

/**
 * Individual breadcrumb item component.
 *
 * Renders a navigable link (via `routerLink` or `href`), or non-interactive
 * text in one of three distinct states:
 *
 * - `current` — the page being viewed (`aria-current="page"`).
 * - `disabled` — a destination that exists but is switched off for this user.
 * - *plain* — the default when no link, `current` or `disabled` is given: an
 *   ancestor step that simply has nowhere to navigate to.
 *
 * The last item in the breadcrumb list should have `current` set to `true`.
 *
 * Declared directly in the content of `nav[mlvBreadcrumb]` — in the same
 * template as the `<nav>`, `@for` / `@if` / `<ng-container>` included — every
 * item but the last renders the breadcrumb's separator after its link: the
 * consumer's `[mlvSeparator]` template, or the default chevron. A projected
 * trail then reads exactly like a data-driven one. Anywhere else the item has
 * no separator, because it finds the breadcrumb through DI and a content
 * query, both of which follow the template it is declared in:
 *
 * - **Unsupported:** a wrapper component that renders the `<nav>` and
 *   re-projects items passed to it through its own `<ng-content>` — the items
 *   belong to the wrapper's parent template, so none gets a separator. Give
 *   such a wrapper an `[items]` input and pass it on to the data-driven mode,
 *   or keep the `<nav mlvBreadcrumb>` in the template that declares the items.
 * - Do not mix shapes in one trail: separators are placed between
 *   `<mlv-breadcrumb-item>`s only, so a trailing `<li mlvBreadcrumbItem>`
 *   after them is not separated from the last one. Use one shape per trail.
 *
 * @example Basic usage
 * ```html
 * <mlv-breadcrumb-item href="/home">Home</mlv-breadcrumb-item>
 * <mlv-breadcrumb-item [routerLink]="['/products']">Products</mlv-breadcrumb-item>
 * <mlv-breadcrumb-item [current]="true">Widget Pro</mlv-breadcrumb-item>
 * ```
 *
 * @example Plain, non-navigable ancestor
 * ```html
 * <mlv-breadcrumb-item>Settings</mlv-breadcrumb-item>
 * ```
 */
@Component({
  selector: 'mlv-breadcrumb-item',
  imports: [RouterLink, NgTemplateOutlet],
  // A single <ng-content> lives inside #content and is stamped into whichever
  // branch is active. Declaring <ng-content> once per branch would leave every
  // branch except the first-declared one empty (Angular projects to the first
  // matching slot only), which silently dropped projected labels.
  template: `
    @if (current()) {
      <span
        class="mlv-breadcrumb__link mlv-breadcrumb__link--current"
        aria-current="page"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </span>
    } @else if (disabled()) {
      <span class="mlv-breadcrumb__link mlv-breadcrumb__link--disabled">
        <ng-container [ngTemplateOutlet]="content" />
      </span>
    } @else if (routerLink()) {
      <a class="mlv-breadcrumb__link" [routerLink]="routerLink()">
        <ng-container [ngTemplateOutlet]="content" />
      </a>
    } @else if (href()) {
      <a class="mlv-breadcrumb__link" [href]="href()">
        <ng-container [ngTemplateOutlet]="content" />
      </a>
    } @else {
      <span class="mlv-breadcrumb__link mlv-breadcrumb__link--plain">
        <ng-container [ngTemplateOutlet]="content" />
      </span>
    }
    @if (_trailingSeparator(); as separator) {
      <ng-container [ngTemplateOutlet]="separator" />
    }
    <ng-template #content><ng-content /></ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-breadcrumb__item',
    // `<mlv-breadcrumb-item>` is projected straight into the breadcrumb's own
    // `<ol>`, so without this the list has non-`<li>` children and the whole
    // trail stops being exposed as a list (axe `list`, WCAG 1.3.1). The
    // data-driven branch stamps real `<li>`s and needs nothing; this is the
    // projected branch's equivalent. `[mlvBreadcrumbItem]` deliberately does
    // NOT set it — that directive also goes on the `<a>` inside an `<li>`.
    role: 'listitem',
  },
})
export class MlvBreadcrumbItem {
  /**
   * Angular router link for navigation.
   * Supports string or string array (same as `[routerLink]`).
   */
  readonly routerLink = input<string | string[] | null>(null);

  /**
   * Standard `href` for anchor-based navigation.
   * Use when not using Angular Router.
   */
  readonly href = input<string | null>(null);

  /**
   * When `true`, marks this item as the current page.
   * Renders as non-interactive text with `aria-current="page"`.
   */
  readonly current = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, marks this step as **deliberately switched off** — a
   * destination that exists but is currently unavailable to this user.
   * Renders as non-interactive text with `.mlv-breadcrumb__link--disabled`.
   *
   * An ancestor step that merely has nowhere to navigate to is **not**
   * disabled: omit `routerLink`, `href`, `current` and `disabled`, and the
   * item renders as a plain readable crumb (`.mlv-breadcrumb__link--plain`).
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @private The enclosing `nav[mlvBreadcrumb]`, resolved lexically; `null`
   * for an item rendered outside one, which then renders no separator.
   */
  private readonly _breadcrumb = inject(MLV_BREADCRUMB, { optional: true });

  /**
   * @protected The breadcrumb's separator template when this item is followed
   * by another crumb, otherwise `null`. The breadcrumb owns the template (one
   * copy for both modes, honouring `[mlvSeparator]` and
   * `hideSeparatorFromScreenReaders`); the item only decides whether a gap
   * follows it, which is the one thing the data-driven `@for` knows from
   * `$last` and a projected crumb has to ask for.
   */
  protected readonly _trailingSeparator = computed(() => {
    const breadcrumb = this._breadcrumb;
    if (!breadcrumb || breadcrumb._lastProjectedItem() === this) return null;
    return breadcrumb._separatorTemplate() ?? null;
  });
}
