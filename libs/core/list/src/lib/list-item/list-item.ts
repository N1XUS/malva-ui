import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvListItemLink } from '../list-item-link/list-item-link';
import { MlvListItemActions } from '../list-item-actions';
import { MlvListItemByline } from '../list-item-byline';
import { MlvListItemMedia } from '../list-item-media';
import { MlvListItemMeta } from '../list-item-meta';
import { MlvListItemPrefix } from '../list-item-prefix';
import { MlvListItemSuffix } from '../list-item-suffix';
import { MlvListItemTitle } from '../list-item-title';

/**
 * Semantic accent key used to tint the leading accent bar of a list item.
 * Any other string is treated as a raw CSS color value.
 */
export type MlvListItemAccent =
  | 'neutral'
  | 'primary'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | (string & {});

@Component({
  selector: 'mlv-list-item',
  templateUrl: './list-item.html',
  styleUrl: './list-item.scss',
  imports: [NgTemplateOutlet],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-list-item',
    '[attr.role]': 'itemRole()',
    '[class.mlv-list-item--active]': 'isActive()',
    '[class.mlv-list-item--rich]': '_hasRichLayout()',
    '[class.mlv-list-item--unread]': 'unread()',
    '[class.mlv-list-item--has-accent]': '!!accent()',
    '[style.--mlv-list-item-accent]': '_accentColor()',
  },
})
export class MlvListItem {
  /**
   * WAI-ARIA role for the host element.
   * Defaults to `'listitem'`. Override to `'menuitem'`, `'option'`, or another
   * appropriate role when the item is used inside a composite widget that
   * requires a different ARIA role (e.g. inside a `role="menu"` container).
   */
  readonly itemRole = input<string>('listitem');

  /**
   * Marks the item as unread — bolds the title and shows a leading unread dot.
   * Matches the familiar inbox/notification-center pattern.
   */
  readonly unread = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Optional accent color for the leading bar. Accepts semantic keys
   * (`primary`, `positive`, `negative`, `warning`, `info`, `neutral`) or any
   * raw CSS color value. When set, the accent bar is always rendered.
   */
  readonly accent = input<MlvListItemAccent | undefined>(undefined);

  /** @protected Projected `a[mlvListItemLink]` child, if any — drives router-active state. */
  protected readonly _link = contentChild(MlvListItemLink);
  /** @protected Leading rich-media slot (`[mlvListItemMedia]`). */
  protected readonly _mediaSlot = contentChild(MlvListItemMedia, {
    descendants: true,
  });
  /** @protected Title slot (`[mlvListItemTitle]`). */
  protected readonly _titleSlot = contentChild(MlvListItemTitle, {
    descendants: true,
  });
  /** @protected Secondary byline slot (`[mlvListItemByline]`). */
  protected readonly _bylineSlot = contentChild(MlvListItemByline, {
    descendants: true,
  });
  /** @protected Inline headline meta slot (`[mlvListItemMeta]`). */
  protected readonly _metaSlot = contentChild(MlvListItemMeta, {
    descendants: true,
  });
  /** @protected Trailing actions slot (`[mlvListItemActions]`). */
  protected readonly _actionsSlot = contentChild(MlvListItemActions, {
    descendants: true,
  });
  /** @protected Legacy leading prefix slot (`[mlvListItemPrefix]`). */
  protected readonly _prefixSlot = contentChild(MlvListItemPrefix, {
    descendants: true,
  });
  /** @protected Legacy trailing suffix slot (`[mlvListItemSuffix]`). */
  protected readonly _suffixSlot = contentChild(MlvListItemSuffix, {
    descendants: true,
  });

  readonly isActive = computed(() => this._link()?.isActive() ?? false);
  /** @protected Whether any rich-layout slot is projected — switches the row to rich layout. */
  protected readonly _hasRichLayout = computed(() => {
    return !!(
      this._mediaSlot() ||
      this._titleSlot() ||
      this._bylineSlot() ||
      this._metaSlot() ||
      this._actionsSlot()
    );
  });
  /** @protected Whether a leading slot (media or legacy prefix) is projected. */
  protected readonly _hasLeadingSlot = computed(
    () => !!(this._mediaSlot() || this._prefixSlot()),
  );
  /** @protected Whether a trailing slot (actions or legacy suffix) is projected. */
  protected readonly _hasTrailingSlot = computed(
    () => !!(this._actionsSlot() || this._suffixSlot()),
  );
  /** @protected Whether the actions slot opts into reveal-on-hover behaviour. */
  protected readonly _revealActions = computed(
    () => !!this._actionsSlot()?.revealOnHover(),
  );

  /**
   * @protected Resolves the `accent` input to a CSS color value. Semantic
   * keys map to Malva UI tokens; any other string is returned verbatim.
   */
  protected readonly _accentColor = computed<string | null>(() => {
    const accent = this.accent();
    if (!accent) return null;
    switch (accent) {
      case 'primary':
        return 'var(--mlv-background-accent-1)';
      case 'positive':
        return 'var(--mlv-background-success-1)';
      case 'negative':
        return 'var(--mlv-background-danger-1)';
      case 'warning':
        return 'var(--mlv-background-warning-1)';
      case 'info':
        return 'var(--mlv-background-info-1)';
      case 'neutral':
        return 'var(--mlv-background-neutral-1-active)';
      default:
        return accent;
    }
  });
}
