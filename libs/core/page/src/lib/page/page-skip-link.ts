import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { MlvPageRegistry } from './page-registry';

/**
 * Skip link that targets whichever `main[mlvPage]` is currently on screen.
 *
 * ```html
 * <a mlvPageSkipLink>Skip to content</a>
 * ```
 *
 * A skip link is WCAG 2.4.1 (Bypass Blocks, A), and every application shell
 * needs one — but hand-rolling it means writing a fixed `href="#main-content"`
 * and then remembering to put that exact id on every page, forever. The page
 * already generates an id and already carries the `tabindex="-1"` that makes
 * the target focusable; this reads both off the live page instead.
 *
 * It is a **component** rather than a directive because the hidden-until-
 * focused treatment is not something every consumer should have to reproduce,
 * and a directive cannot carry a stylesheet.
 *
 * The `href` is real, so the link's destination is visible in the status bar
 * and the control degrades to a fragment jump without JavaScript. The click is
 * handled anyway: under a router a bare fragment `href` is a navigation, and
 * this needs to move focus, not change the URL.
 */
@Component({
  // Attribute-selector component intentionally enhances the native anchor.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[mlvPageSkipLink]',
  exportAs: 'mlvPageSkipLink',
  template: '<ng-content />',
  styleUrl: './page-skip-link.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-skip-link',
    'data-slot': 'page-skip-link',
    '[attr.href]': '_href()',
    '(click)': '_skip($event)',
  },
})
export class MlvPageSkipLink {
  /**
   * The landmark to skip to. Defaults to the page currently on screen, which
   * is what makes the link work across routes without a coordinated id.
   *
   * The transform is not decoration: the input's alias *is* the selector
   * attribute, so the bare `<a mlvPageSkipLink>` form assigns the static
   * attribute value `''`. Without it, the common spelling would pin the target
   * to an empty string and the link would silently resolve to nothing.
   */
  readonly target = input<
    HTMLElement | null,
    HTMLElement | '' | null | undefined
  >(null, {
    alias: 'mlvPageSkipLink',
    transform: (value) =>
      value && typeof value === 'object' ? (value as HTMLElement) : null,
  });

  /** @private Registry the default target is read from. */
  private readonly _registry = inject(MlvPageRegistry);

  /**
   * @private Resolved target: the explicit one, else the live page.
   *
   * `null` when there is no page mounted, which also removes the `href` — an
   * anchor with no `href` is not a link and not a tab stop, so the control
   * withdraws rather than becoming a focusable no-op.
   */
  private readonly _target = computed(
    () => this.target() ?? this._registry.active()?.element ?? null,
  );

  /** @private The fragment href, or `null` when there is nothing to link to. */
  protected readonly _href = computed(() => {
    const id = this._target()?.id;
    return id ? `#${id}` : null;
  });

  /**
   * @private Moves focus to the target instead of navigating to the fragment.
   *
   * Focus is what a skip link is for: the fragment jump alone scrolls without
   * moving the keyboard, so the next Tab restarts from the link. Scrolling is
   * left to `focus()` itself, which brings the landmark into view through
   * whichever ancestor actually scrolls — the page's own scrollport when it
   * has one, the document when it does not.
   */
  protected _skip(event: MouseEvent): void {
    const target = this._target();
    if (!target) {
      return;
    }
    event.preventDefault();
    target.focus();
  }
}
