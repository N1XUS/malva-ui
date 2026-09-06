import { Component } from '@angular/core';
import {
  MlvTaskboardColumnContentDef,
  MlvTaskboardDropIndicatorDef,
  MlvTaskboardItemDef,
} from './taskboard-defs';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

@Component({
  imports: [
    MlvTaskboardItemDef,
    MlvTaskboardColumnContentDef,
    MlvTaskboardDropIndicatorDef,
  ],
  template: `
    <ng-template mlvTaskboardItemDef [mlvTaskboardItemDefFrom]="item" let-card>
      {{ card.title }}
    </ng-template>
    <ng-template
      mlvTaskboardColumnContentDef
      [mlvTaskboardColumnContentDefFrom]="item"
      let-items
    >
      {{ items[0]?.title }}
    </ng-template>
    <ng-template
      mlvTaskboardDropIndicatorDef
      [mlvTaskboardDropIndicatorDefFrom]="item"
      let-target="target"
    >
      {{ target.items[0]?.title }}
    </ng-template>
  `,
})
class _TaskboardDefinitionTypecheckHost {
  readonly item: Ticket = { id: 'ticket-1', title: 'Typed card' };
}
