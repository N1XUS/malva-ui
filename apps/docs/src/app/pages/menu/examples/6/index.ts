import { ChangeDetectionStrategy, Component } from '@angular/core';
import { timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import {
  MlvMenu,
  MlvMenuItem,
  MlvMenuItemDef,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvButton } from '@malva-ui/core/button';
import { LucideChevronRight } from '@lucide/angular';
import type { MlvMenuItemData } from '@malva-ui/core/menu';

type CommandItem = MlvMenuItemData<{ readonly shortcut?: string }>;

const RECENT_ITEMS: CommandItem[] = [
  { id: 'brief', label: 'Project brief', data: { shortcut: '⌘B' } },
  { id: 'notes', label: 'Meeting notes', data: { shortcut: '⌘N' } },
];

@Component({
  selector: 'docs-menu-reactive-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvMenuTrigger,
    MlvListItem,
    MlvListItemSuffix,
    MlvSpacer,
    MlvButton,
    LucideChevronRight,
  ],
  template: `
    <div class="demo-row">
      <button mlvButton [mlvMenuTrigger]="commandsMenu">Commands</button>
    </div>

    <mlv-menu #commandsMenu label="Commands" [dataSource]="items">
      <mlv-list-item
        mlvMenuItem
        *mlvMenuItemDef="let item; let hasChildren = hasChildren"
      >
        {{ item.label }}
        <mlv-spacer />
        @if (hasChildren) {
          <svg mlvListItemSuffix lucideChevronRight [size]="16" />
        }
      </mlv-list-item>
    </mlv-menu>
  `,
})
export default class MenuReactiveExampleComponent {
  /** The children stream is subscribed to only when Recent is opened. */
  readonly items: CommandItem[] = [
    {
      id: 'new',
      label: 'New document',
      data: { shortcut: '⌘N' },
    },
    {
      id: 'recent',
      label: 'Recent documents',
      children: timer(700).pipe(map(() => RECENT_ITEMS)),
    },
    {
      id: 'preferences',
      label: 'Preferences',
      data: { shortcut: '⌘,' },
    },
  ];
}
