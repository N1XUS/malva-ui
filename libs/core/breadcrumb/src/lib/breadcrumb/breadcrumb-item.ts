import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

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
    <ng-template #content><ng-content /></ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-breadcrumb__item',
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
}
