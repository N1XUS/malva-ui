import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  ElementRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { filter, fromEvent } from 'rxjs';
import { MlvLinkAfter, MlvLinkBefore } from './link.directives';
import { NgTemplateOutlet } from '@angular/common';

export type MlvLinkVariant = 'default' | 'subtle' | 'emphasized';

@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[mlvLink]',
  template: `
    @if (_before()?.templateRef; as beforeTpl) {
      <span class="mlv-link__side">
        <ng-template [ngTemplateOutlet]="beforeTpl"></ng-template>
      </span>
    }
    <span class="mlv-link__text">
      <ng-content />
    </span>
    @if (_after()?.templateRef; as afterTpl) {
      <span class="mlv-link__side">
        <ng-template [ngTemplateOutlet]="afterTpl"></ng-template>
      </span>
    }
  `,
  styleUrl: './link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  // No `(click)` / `(keydown.*)` host listeners, deliberately (#309). The
  // disabled guard is the capture-phase stream in the constructor: a host
  // listener cannot stop `RouterLink`, and one whose expression evaluates to
  // `false` has Angular `preventDefault()` the event — the old
  // `disabled() && $event.preventDefault()` cancelled every click and Enter on
  // an *enabled* link. With an `href`, the browser turns Enter into the
  // `click` the guard sees; Space is not link activation.
  host: {
    class: 'mlv-link',
    '[class]': '"mlv-link--" + variant()',
    '[class.mlv-link--disabled]': 'disabled()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.tabindex]': 'disabled() ? -1 : null',
  },
  imports: [NgTemplateOutlet],
})
export class MlvLink {
  /** Visual style: action colour, muted secondary text, or bold and underlined. */
  readonly variant = input<MlvLinkVariant>('default');

  /**
   * Whether the link is disabled. A disabled link announces itself
   * (`aria-disabled="true"`), leaves the tab order (`tabindex="-1"`) and does
   * not activate: a click, including the one Enter and screen-reader
   * activation produce, neither follows `href` nor reaches `routerLink`, and
   * no bubble-phase click listener on the link or its ancestors runs.
   * Capture-phase listeners on an ancestor still see the click (CDK's
   * click-outside dismissal among them), because they run before the link's
   * own guard. `href` is kept, so the element stays a link to assistive
   * technology.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @protected Optional leading-slot template projected before the link text. */
  protected readonly _before = contentChild(MlvLinkBefore);
  /** @protected Optional trailing-slot template projected after the link text. */
  protected readonly _after = contentChild(MlvLinkAfter);

  /** @private Host anchor, the target of the disabled-click guard. */
  private readonly _elementRef =
    inject<ElementRef<HTMLAnchorElement>>(ElementRef);

  constructor() {
    // A disabled link needs a capture-phase guard to stay put (the
    // `mlv-segmented` link item has the same one). `preventDefault()` alone
    // cancels the native navigation but not `RouterLink.onClick`, which calls
    // `Router.navigateByUrl()` without reading `defaultPrevented`. Nor can a
    // host `(click)` listener stop it: Angular coalesces every host and
    // template listener for one event on one element into a single native
    // listener and walks that chain unconditionally (`__ngNextListenerFn__`).
    // A separate listener must run first, and a bubble-phase one would do so
    // only by registration order. A capture listener on the host runs before
    // every bubble listener on it — at `AT_TARGET` the capture pass precedes
    // the bubble pass — and, for a click on the text span inside, before the
    // event reaches the target at all.
    //
    // `{ capture: true }` is the whole mechanism and goes through `fromEvent`'s
    // options argument, never the boolean form. `Subscriber.next` is
    // synchronous, so `stopImmediatePropagation()` still runs inside the
    // native listener invocation.
    fromEvent<MouseEvent>(this._elementRef.nativeElement, 'click', {
      capture: true,
    })
      .pipe(
        filter(() => this.disabled()),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      });
  }
}
