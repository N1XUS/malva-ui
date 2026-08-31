import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import type { MlvMenuItemData } from './menu-data.types';
import type { MlvMenubarDividerData } from './menu-data.types';
import { MlvMenuDataItem } from './menu-data-item';
import type { MlvMenuItemDef } from './menu-item-def';
import { MENUBAR_TOKEN } from './menubar.types';
import type { MlvMenubarAccessor } from './menubar.types';
import { MENU_TOKEN } from './menu.types';
import type { MlvMenuAccessor } from './menu.types';

/** Internal recursive renderer for data-driven menu rows. */
@Component({
  selector: 'mlv-menu-data-renderer',
  template: `
    @for (item of items(); track item.id) {
      @if (mode() === 'menubar' && isDivider(item)) {
        <span
          class="mlv-menubar__divider"
          role="separator"
          aria-orientation="vertical"
        ></span>
      } @else {
        <mlv-menu-data-item
          [item]="asItem(item)"
          [index]="$index"
          [itemDef]="itemDef()"
          [mode]="mode()"
          [parentMenu]="mode() === 'menu' ? _resolvedParentMenu() : null"
          [menubar]="_resolvedMenubar()"
        />
      }
    }
  `,
  styleUrl: './menu-data-renderer.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvMenuDataItem],
  host: {
    class: 'mlv-menu-data-renderer',
  },
})
export class MlvMenuDataRenderer<
  TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> {
  private readonly _injectedParentMenu = inject<MlvMenuAccessor | null>(
    MENU_TOKEN,
    { optional: true },
  );
  private readonly _injectedMenubar = inject<MlvMenubarAccessor | null>(
    MENUBAR_TOKEN,
    { optional: true },
  );

  /** Current collection to render at this menu level. */
  readonly items = input.required<readonly (TItem | MlvMenubarDividerData)[]>();

  /** Optional projected row template for each item. */
  readonly itemDef = input<MlvMenuItemDef<TItem> | undefined>(undefined);

  /** Whether this renderer is inside a menu or a root menubar. */
  readonly mode = input<'menu' | 'menubar'>('menu');

  /** Parent menu accessor for generated rows at this level. */
  readonly parentMenu = input<MlvMenuAccessor | null>(null);

  /** Parent menu input, falling back to the nearest menu provider. */
  protected readonly _resolvedParentMenu = computed(
    () => this.parentMenu() ?? this._injectedParentMenu,
  );

  /** Menubar accessor, falling back to the nearest menubar provider. */
  protected readonly _resolvedMenubar = computed(
    () => this.menubar() ?? this._injectedMenubar,
  );

  /** Root menubar accessor when rows need top-level menubar context. */
  readonly menubar = input<MlvMenubarAccessor | null>(null);

  /** Whether an entry is a root-level menubar divider. */
  protected isDivider(
    item: TItem | MlvMenubarDividerData,
  ): item is MlvMenubarDividerData {
    return 'kind' in item && item.kind === 'divider';
  }

  /** Narrows a mixed menubar entry to a renderable menu item. */
  protected asItem(item: TItem | MlvMenubarDividerData): TItem {
    return item as TItem;
  }
}
