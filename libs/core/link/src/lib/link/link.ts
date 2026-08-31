import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
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
  host: {
    class: 'mlv-link',
    '[class]': '"mlv-link--" + variant()',
    '[class.mlv-link--disabled]': 'disabled()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.tabindex]': 'disabled() ? -1 : null',
    '(click)': 'disabled() && $event.preventDefault()',
    '(keydown.enter)': 'disabled() && $event.preventDefault()',
    '(keydown.space)': 'disabled() && $event.preventDefault()',
  },
  imports: [NgTemplateOutlet],
})
export class MlvLink {
  readonly variant = input<MlvLinkVariant>('default');
  /** Whether the link is disabled — prevents activation and removes it from the tab order. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @protected Optional leading-slot template projected before the link text. */
  protected readonly _before = contentChild(MlvLinkBefore);
  /** @protected Optional trailing-slot template projected after the link text. */
  protected readonly _after = contentChild(MlvLinkAfter);
}
