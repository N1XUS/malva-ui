import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  LucideCopy,
  LucidePencil,
  LucideShare2,
  LucideTrash2,
  provideLucideIcons,
} from '@lucide/angular';
import { MlvSpeedDial } from '@malva-ui/core/speed-dial';
import type {
  MlvSpeedDialDirection,
  MlvSpeedDialItem,
} from '@malva-ui/core/speed-dial';

@Component({
  selector: 'docs-speed-dial-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSpeedDial],
  providers: [
    // Actions name their icon (`icon: 'pencil'`), resolved through the Lucide
    // registry at runtime — register every icon the items use.
    provideLucideIcons(LucidePencil, LucideShare2, LucideTrash2, LucideCopy),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SpeedDialBasicExampleComponent {
  readonly lastAction = signal<string | null>(null);

  readonly directions: readonly MlvSpeedDialDirection[] = [
    'up',
    'down',
    'left',
    'right',
  ];

  readonly items: MlvSpeedDialItem[] = [
    { label: 'Edit', icon: 'pencil', command: () => this.run('Edit') },
    { label: 'Duplicate', icon: 'copy', command: () => this.run('Duplicate') },
    { label: 'Share', icon: 'share-2', command: () => this.run('Share') },
    { label: 'Delete', icon: 'trash-2', command: () => this.run('Delete') },
  ];

  run(action: string): void {
    this.lastAction.set(action);
  }
}
