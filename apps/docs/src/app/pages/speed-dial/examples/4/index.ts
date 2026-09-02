import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { LucideUsers } from '@lucide/angular';
import {
  MlvSpeedDial,
  MlvSpeedDialItemDef,
  MlvSpeedDialTriggerIcon,
} from '@malva-ui/core/speed-dial';
import type {
  MlvSpeedDialItem,
  MlvSpeedDialItemEvent,
} from '@malva-ui/core/speed-dial';

@Component({
  selector: 'docs-speed-dial-template-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSpeedDial,
    MlvSpeedDialItemDef,
    MlvSpeedDialTriggerIcon,
    LucideUsers,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SpeedDialTemplateExampleComponent {
  readonly assignee = signal<string | null>(null);

  readonly people: MlvSpeedDialItem[] = [
    { id: 'ab', label: 'Ada Byron' },
    { id: 'gh', label: 'Grace Hopper' },
    { id: 'kj', label: 'Katherine Johnson' },
    { id: 'mh', label: 'Margaret Hamilton' },
  ];

  initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase();
  }

  assign(event: MlvSpeedDialItemEvent): void {
    this.assignee.set(event.item.label);
  }
}
